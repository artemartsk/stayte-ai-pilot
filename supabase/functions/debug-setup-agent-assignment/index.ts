import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, serviceKey)

        console.log('--- [DEBUG] Starting Agent Assignment Test (AI Smart Match) ---');

        // 1. Setup Environment
        const agencyId = '00000000-0000-0000-0000-000000000001'
        console.log(`[DEBUG] Using Agency ID: ${agencyId}`)

        // 1.1 Ensure Test Agents Exist
        const { data: existingAgents } = await supabase
            .from('profiles')
            .select('*')
            .eq('agency_id', agencyId)

        // We need an agent with Swedish
        // 1. Try to find EXISTING agent with Swedish in languages
        let agentSwedish: any = existingAgents?.find((a: any) =>
            a.languages && Array.isArray(a.languages) && a.languages.some((l: string) => l.toLowerCase() === 'swedish')
        )

        // 2. If no real agent found, look for our test agent "Sven Swedish" or create one
        if (!agentSwedish) {
            console.log('[DEBUG] No existing Swedish-speaking agent found. Checking for test agent...')
            agentSwedish = existingAgents?.find((a: any) => a.full_name?.includes('Swedish'))

            if (!agentSwedish) {
                console.log('[DEBUG] Creating test agent "Sven Swedish"...')
                const { data, error } = await supabase.auth.admin.createUser({
                    email: `agent.swedish.${Date.now()}@example.com`,
                    password: 'password123',
                    email_confirm: true,
                    user_metadata: { full_name: 'Sven Swedish' }
                })
                if (error) throw error
                const { data: profile, error: profileError } = await supabase.from('profiles').insert({
                    id: data.user.id,
                    agency_id: agencyId,
                    full_name: 'Sven Swedish',
                    languages: ['Swedish'],
                    available_for_assignment: true,
                    max_active_leads: 50
                }).select().single()
                if (profileError || !profile) throw new Error('Failed to create Swedish agent profile')
                agentSwedish = profile
                await supabase.from('memberships').insert({ user_id: data.user.id, agency_id: agencyId, role: 'agent' })
            } else {
                await supabase.from('profiles').update({ languages: ['Swedish'], available_for_assignment: true }).eq('id', agentSwedish.id)
                agentSwedish.languages = ['Swedish']
            }
        }

        console.log(`[DEBUG] Agent Ready: ${agentSwedish.full_name} (Swedish)`)

        // Group will be assigned automatically by the system based on deal criteria match

        // 1.2 Create Contact
        const timestamp = Date.now()
        const contactEmail = `tester.swedish.${timestamp}@example.com`
        const contactPhone = `+467${String(timestamp).slice(-8)}` // Swedish number hint

        const { data: contact, error: contactError } = await supabase.from('contacts').insert({
            first_name: 'Sven',
            last_name: 'Customer',
            primary_email: contactEmail,
            primary_phone: contactPhone,
            agency_id: agencyId
            // NO group_id - will be assigned by system based on criteria match
        }).select().single()

        if (contactError || !contact) {
            console.error('Contact creation failed:', contactError)
            throw new Error('Contact creation failed')
        }
        console.log(`[DEBUG] Created Contact: ${contact.id}`)

        // 1.3 Fetch Auto-Created Deal (Trigger-based)
        console.log('[DEBUG] Waiting for Deal creation via trigger...')
        let deal: any = null
        for (let i = 0; i < 5; i++) {
            const { data } = await supabase.from('deals')
                .select('*')
                .eq('contact_id', contact.id)
                .eq('type', 'buy')
                .maybeSingle()
            if (data) {
                deal = data
                break
            }
            await new Promise(r => setTimeout(r, 500)) // Wait 500ms
        }

        if (!deal) {
            console.error('[ERROR] Deal not found after waiting for trigger')
            throw new Error('Deal was not automatically created by trigger')
        }

        // Update Deal with AI Analysis simulation
        await supabase.from('deals').update({
            status: 'new',
            ai_mode: 'autopilot',
            segment: 'hot',
            budget_max: 500000, // Some budget
            commission_value: 0
        }).eq('id', deal.id)

        console.log(`[DEBUG] Used (and updated) Auto-Created Deal: ${deal.id}`)


        // 2. Use Existing "Idealista" Workflow
        const workflowId = 'a354c202-2b57-47c0-ab43-61c0c42e3992'
        console.log(`[DEBUG] Using Existing Workflow ID: ${workflowId}`)

        // Target Node: "Assign Agent"
        const assignNodeId = '1768406248650'
        console.log(`[DEBUG] Target Node (Assign Agent): ${assignNodeId}`)


        // 3. Simulate Interaction & Analysis
        console.log('[DEBUG] Simulating Chat & AI Analysis...')

        // 3.1 Insert Chat (content matching Hot Buyer criteria: budget 7M, 3+ bedrooms)
        await supabase.from('chat_messages').insert({
            contact_id: contact.id,
            agency_id: agencyId,
            direction: 'inbound',
            channel: 'whatsapp',
            content: 'Hej! Jag letar efter en villa i Spanien med minst 3 sovrum. Min budget är cirka 7 miljoner kronor.' // Swedish: 3 bedrooms, 7M budget
        })

        // 3.2 Simulate AI Extraction Update (Profile)
        await supabase.from('contact_profiles').upsert({
            contact_id: contact.id,
            language_primary: 'Swedish',
            nationality: 'Sweden'
        })

        // 3.3 Simulate AI Extraction Update (Deal Preferences) - matching Hot Buyer criteria
        await supabase.from('deal_preference_profiles').upsert({
            deal_id: deal.id,
            budget: 7000000, // 7M - within Hot Buyer range (5M-10M)
            bedrooms: 3      // 3+ bedrooms matches Hot Buyer
        })
        console.log('[DEBUG] Updated Contact Profile (Swedish/Sweden) and Deal Preferences (7M/3BR)')


        // 4. Call assign-agent directly (testing the function, not the workflow)
        console.log('[DEBUG] Calling /assign-agent directly...')
        const execRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/assign-agent`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                deal_id: deal.id,
                agency_id: agencyId,
                strategy: 'smart'
            })
        });
        const execData = await execRes.json()
        console.log('[DEBUG] Assign-Agent Result:', JSON.stringify(execData, null, 2))


        // 5. Verify Result
        const { data: finalDeal, error: fdError } = await supabase.from('deals').select('primary_agent_id').eq('id', deal.id).single()
        const { data: finalContact, error: fcError } = await supabase.from('contacts').select('owner, group_id').eq('id', contact.id).single()

        if (fdError) console.error('Final Deal Fetch Error:', fdError)
        if (fcError) console.error('Final Contact Fetch Error:', fcError)

        const actualAgentDeal = finalDeal?.primary_agent_id || 'null'
        const actualOwnerContact = finalContact?.owner || 'null'

        // Both deal and contact owner should be set
        const success = actualAgentDeal === agentSwedish.id && actualOwnerContact === agentSwedish.id

        return new Response(JSON.stringify({
            status: success ? 'SUCCESS' : 'FAILURE',
            message: success
                ? 'Correctly assigned to Swedish agent (Deal + Owner)'
                : `Assignment issue. Deal: ${actualAgentDeal}, Owner: ${actualOwnerContact}. Expected: ${agentSwedish.id}`,
            expected_agent: { id: agentSwedish.id, name: agentSwedish.full_name },
            actual_agent_deal: actualAgentDeal,
            actual_owner_contact: actualOwnerContact,
            execution_log: execData
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error: any) {
        console.error('Debug Function Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
