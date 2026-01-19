import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AgentProfile {
    id: string;
    full_name: string;
    languages: string[];
    specializations: string[];
    experience_years: number;
    target_segments: string[];
    max_active_leads: number;
    available_for_assignment: boolean;
    active_leads_count?: number;
}

interface ContactData {
    nationality: string | null;
    language_primary: string | null;
    residence_country: string | null;
    a_class: boolean | null;
    b_class: boolean | null;
    z_class: boolean | null;
}

interface DealData {
    segment: string;
    budget_max: number | null;
    type: string;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const openAiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
        const supabase = createClient(supabaseUrl, serviceKey)

        const { deal_id, agency_id, strategy = 'smart' } = await req.json()

        console.log('Assign agent request:', { deal_id, agency_id, strategy })

        if (!deal_id || !agency_id) {
            return new Response(JSON.stringify({ error: 'deal_id and agency_id required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 1. Fetch deal + contact info
        const { data: deal, error: dealError } = await supabase
            .from('deals')
            .select(`
                id, segment, budget_max, type, contact_id,
                contacts!inner(id, first_name, last_name, primary_email, primary_phone)
            `)
            .eq('id', deal_id)
            .single()

        if (dealError || !deal) {
            console.error('Deal not found:', dealError)
            return new Response(JSON.stringify({ error: 'Deal not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. Fetch contact profile with language/nationality info
        const { data: contactProfile } = await supabase
            .from('contact_profiles')
            .select('nationality, language_primary, residence_country, a_class, b_class, z_class')
            .eq('contact_id', deal.contact_id)
            .maybeSingle()

        // 3. Fetch available agents with their profiles
        const { data: agents, error: agentsError } = await supabase
            .from('profiles')
            .select('id, full_name, languages, specializations, experience_years, target_segments, max_active_leads, available_for_assignment')
            .eq('agency_id', agency_id)
            .eq('available_for_assignment', true)

        if (agentsError || !agents || agents.length === 0) {
            console.error('No available agents:', agentsError)
            return new Response(JSON.stringify({ error: 'No available agents' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 4. Get active leads count per agent
        const agentIds = agents.map(a => a.id)
        const { data: activeDeals } = await supabase
            .from('deals')
            .select('primary_agent_id')
            .in('primary_agent_id', agentIds)
            .not('status', 'in', '("closed","lost")')

        const leadsPerAgent: Record<string, number> = {}
        for (const d of activeDeals || []) {
            if (d.primary_agent_id) {
                leadsPerAgent[d.primary_agent_id] = (leadsPerAgent[d.primary_agent_id] || 0) + 1
            }
        }

        const agentsWithLoad: AgentProfile[] = agents.map(a => ({
            ...a,
            languages: a.languages || [],
            specializations: a.specializations || [],
            target_segments: a.target_segments || [],
            active_leads_count: leadsPerAgent[a.id] || 0
        }))

        // Filter out agents at capacity
        const availableAgents = agentsWithLoad.filter(a =>
            a.active_leads_count! < a.max_active_leads
        )

        if (availableAgents.length === 0) {
            return new Response(JSON.stringify({ error: 'All agents at capacity' }), {
                status: 503,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        let selectedAgentId: string

        if (strategy === 'least_leads') {
            // Simple strategy: assign to agent with fewest active leads
            const sorted = availableAgents.sort((a, b) =>
                a.active_leads_count! - b.active_leads_count!
            )
            selectedAgentId = sorted[0].id

        } else if (strategy === 'always_admin') {
            // Assign to first admin agent (role check would require join with memberships)
            selectedAgentId = availableAgents[0].id

        } else {
            // Smart matching using LLM
            const contactData: ContactData = contactProfile || {
                nationality: null,
                language_primary: null,
                residence_country: null,
                a_class: null,
                b_class: null,
                z_class: null
            }

            const dealData: DealData = {
                segment: deal.segment,
                budget_max: deal.budget_max,
                type: deal.type
            }

            // Build agent descriptions for LLM
            const agentDescriptions = availableAgents.map((a, i) =>
                `Agent ${i + 1} (ID: ${a.id}):
                - Name: ${a.full_name || 'Unknown'}
                - Languages: ${a.languages.length > 0 ? a.languages.join(', ') : 'Not specified'}
                - Specializations: ${a.specializations.length > 0 ? a.specializations.join(', ') : 'General'}
                - Experience: ${a.experience_years} years
                - Preferred segments: ${a.target_segments.length > 0 ? a.target_segments.join(', ') : 'Any'}
                - Current load: ${a.active_leads_count}/${a.max_active_leads} leads`
            ).join('\n\n')

            const clientDescription = `
Client profile:
- Nationality: ${contactData.nationality || 'Unknown'}
- Primary language: ${contactData.language_primary || 'Unknown'}
- Residence: ${contactData.residence_country || 'Unknown'}
- Classification: ${contactData.a_class ? 'A-Class (Premium)' : contactData.b_class ? 'B-Class (Standard)' : 'Z-Class'}

Deal info:
- Segment: ${dealData.segment}
- Budget: ${dealData.budget_max ? `€${dealData.budget_max.toLocaleString()}` : 'Not specified'}
- Type: ${dealData.type}
`

            const systemPrompt = `You are a lead assignment AI for a real estate agency. Your job is to match incoming leads with the best available agent based on:

1. LANGUAGE MATCH (highest priority): If client speaks Polish, assign to Polish-speaking agent
2. SEGMENT MATCH: Match client segment with agent preferences
3. BUDGET/SPECIALIZATION: Luxury properties → experienced luxury specialists
4. LOAD BALANCING: Prefer agents with fewer active leads

Return only the agent ID that best matches.`

            const userPrompt = `
AVAILABLE AGENTS:
${agentDescriptions}

CLIENT TO ASSIGN:
${clientDescription}

Select the best agent ID for this client. Consider language match as highest priority.
Return a JSON object with the selected_agent_id.`

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openAiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    functions: [{
                        name: 'assign_agent',
                        description: 'Select the best agent for this lead',
                        parameters: {
                            type: 'object',
                            properties: {
                                selected_agent_id: {
                                    type: 'string',
                                    description: 'UUID of the selected agent'
                                },
                                reason: {
                                    type: 'string',
                                    description: 'Brief explanation for the selection'
                                }
                            },
                            required: ['selected_agent_id']
                        }
                    }],
                    function_call: { name: 'assign_agent' }
                })
            })

            const aiData = await response.json()
            const result = JSON.parse(aiData.choices?.[0]?.message?.function_call?.arguments || '{}')

            console.log('LLM assignment result:', result)

            // Validate the selected agent exists
            const validAgent = availableAgents.find(a => a.id === result.selected_agent_id)
            if (validAgent) {
                selectedAgentId = result.selected_agent_id
            } else {
                // Fallback to least leads if LLM returns invalid ID
                const sorted = availableAgents.sort((a, b) =>
                    a.active_leads_count! - b.active_leads_count!
                )
                selectedAgentId = sorted[0].id
            }
        }

        // 5. Update the deal with the assigned agent
        const { error: updateError } = await supabase
            .from('deals')
            .update({ primary_agent_id: selectedAgentId })
            .eq('id', deal_id)

        if (updateError) {
            console.error('Failed to update deal:', updateError)
            return new Response(JSON.stringify({ error: 'Failed to assign agent' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 6. Update contact with assigned agent (for UI display)
        const { error: contactUpdateError } = await supabase
            .from('contacts')
            .update({
                owner: selectedAgentId
            })
            .eq('id', deal.contact_id)

        if (contactUpdateError) {
            console.error('Failed to update contact owner:', contactUpdateError)
            // Non-blocking - deal was assigned, contact update is secondary
        }

        const assignedAgent = availableAgents.find(a => a.id === selectedAgentId)

        console.log('Agent assigned:', { deal_id, agent_id: selectedAgentId, agent_name: assignedAgent?.full_name })

        return new Response(JSON.stringify({
            success: true,
            deal_id,
            assigned_agent_id: selectedAgentId,
            assigned_agent_name: assignedAgent?.full_name,
            strategy
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error('Assignment error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
