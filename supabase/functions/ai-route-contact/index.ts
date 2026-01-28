import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RouteResult {
    group: string
    confidence: number
    reason: string
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { contact_id, available_groups } = await req.json()

        if (!contact_id || !available_groups?.length) {
            return new Response(JSON.stringify({
                error: 'contact_id and available_groups required'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log(`AI routing contact ${contact_id} to one of: ${available_groups.join(', ')}`)

        // 1. Fetch contact with all related data
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select(`
                *,
                deals(*),
                contact_profiles(*),
                activities(type, payload, created_at)
            `)
            .eq('id', contact_id)
            .single()

        if (contactError || !contact) {
            return new Response(JSON.stringify({ error: 'Contact not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. Fetch lead source info
        const { data: leadSource } = await supabase
            .from('lead_sources')
            .select('name, type')
            .eq('id', contact.source_id)
            .maybeSingle()

        // 3. Fetch recent communications
        const { data: communications } = await supabase
            .from('contact_communications')
            .select('channel, direction, subject, created_at')
            .eq('contact_id', contact_id)
            .order('created_at', { ascending: false })
            .limit(10)

        // 4. Build context for AI
        const profile = contact.contact_profiles?.[0] || {}
        const activeDeal = contact.deals?.find((d: any) => d.status === 'open') || contact.deals?.[0]
        const recentActivities = (contact.activities || []).slice(0, 10)

        const contactContext = {
            name: `${contact.first_name} ${contact.last_name}`.trim(),
            email: contact.primary_email,
            phone: contact.phones?.[0],
            status: contact.current_status,

            // Lead Source Info
            lead_source: {
                name: leadSource?.name || contact.source || 'unknown',
                type: leadSource?.type || 'unknown', // email, form, whatsapp, phone, etc.
                original_message: profile.initial_inquiry || null
            },

            // Financial Profile
            budget: {
                min: profile.budget_min || activeDeal?.budget_min,
                max: profile.budget_max || activeDeal?.budget_max,
                currency: 'EUR'
            },

            // Preferences
            preferences: {
                property_types: [
                    profile.type_villa && 'villa',
                    profile.type_apartment && 'apartment',
                    profile.type_townhouse && 'townhouse'
                ].filter(Boolean),
                bedrooms_min: profile.bedrooms_min || activeDeal?.bedrooms_min,
                locations: profile.preferred_locations || [],
                timeline: profile.purchase_timeline,
                purpose: profile.investment_purpose || profile.personal_use ?
                    (profile.investment_purpose ? 'investment' : 'personal') : 'unknown'
            },

            // Engagement & Activity
            engagement: {
                ai_hot: contact.ai_hot,
                ai_hot_score: contact.ai_hot_score,
                ai_hot_reason: contact.ai_hot_reason,
                total_communications: communications?.length || 0,
                last_contact_at: contact.ai_last_touch_at,
                first_contact_at: contact.ai_first_touch_at
            },

            // Recent Activity
            recent_activities: recentActivities.map((a: any) => ({
                type: a.type,
                date: a.created_at,
                summary: a.payload?.summary || a.payload?.subject || a.type
            })),

            // Communications
            recent_communications: (communications || []).map((c: any) => ({
                channel: c.channel,
                direction: c.direction,
                date: c.created_at
            }))
        }

        // 5. Call GPT for intelligent routing
        const openAiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openAiKey) {
            throw new Error('OPENAI_API_KEY not configured')
        }

        const systemPrompt = `You are an intelligent lead routing assistant for a luxury real estate agency in Marbella, Spain.

Your task is to analyze a lead/contact and decide which group they should be routed to.

IMPORTANT CONSIDERATIONS:
- Be FLEXIBLE with budget thresholds. A client with €1.9M budget when threshold is €2M is still a hot lead.
- Consider the LEAD SOURCE. An email inquiry may contain important context about their intent.
- Look at ENGAGEMENT signals: Are they actively communicating? Have they viewed properties?
- Consider TIMELINE urgency: Someone ready to buy now is more valuable than "just browsing"
- Investment buyers typically have larger budgets and are more decisive.

Available groups to route to: ${available_groups.join(', ')}

RESPONSE FORMAT (JSON only):
{
  "group": "<exact group name from available groups>",
  "confidence": <0.0 to 1.0>,
  "reason": "<brief explanation in 1-2 sentences>"
}`

        const userPrompt = `Analyze this lead and decide which group to route them to:

${JSON.stringify(contactContext, null, 2)}

Which group should this contact be routed to?`

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                temperature: 0.3,
                response_format: { type: 'json_object' }
            })
        })

        if (!aiResponse.ok) {
            const errorText = await aiResponse.text()
            console.error('OpenAI error:', errorText)
            throw new Error('AI routing failed')
        }

        const aiData = await aiResponse.json()
        const result: RouteResult = JSON.parse(aiData.choices[0].message.content)

        console.log(`AI routed contact to "${result.group}" with ${result.confidence} confidence: ${result.reason}`)

        // 6. Log the routing decision
        await supabase.from('activities').insert({
            contact_id,
            actor_id: null, // System
            agency_id: contact.agency_id,
            type: 'ai_routing',
            payload: {
                routed_to: result.group,
                confidence: result.confidence,
                reason: result.reason,
                available_groups,
                context_snapshot: {
                    budget: contactContext.budget,
                    lead_source: contactContext.lead_source.name,
                    ai_hot_score: contactContext.engagement.ai_hot_score
                }
            }
        })

        // 7. Update contact group if there's a matching group in DB
        const { data: matchingGroup } = await supabase
            .from('contact_groups')
            .select('id')
            .eq('name', result.group)
            .eq('agency_id', contact.agency_id)
            .maybeSingle()

        if (matchingGroup) {
            await supabase
                .from('contacts')
                .update({ group_id: matchingGroup.id })
                .eq('id', contact_id)
        }

        return new Response(JSON.stringify({
            success: true,
            ...result
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error('AI routing error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
