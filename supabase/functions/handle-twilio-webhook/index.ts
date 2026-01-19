
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, serviceKey)

        // Twilio sends data as application/x-www-form-urlencoded
        const formData = await req.formData()
        const from = formData.get('From') as string // e.g., "whatsapp:+123456789"
        const to = formData.get('To') as string
        const body = formData.get('Body') as string
        const messageSid = formData.get('MessageSid') as string
        const profileName = formData.get('ProfileName') as string

        console.log(`Received Twilio Webhook: From=${from}, Body=${body}`)

        if (!from || !body) {
            return new Response('Missing From or Body', { status: 400 })
        }

        // Normalize Phone Number (remove whatsapp: prefix)
        const phoneNumber = from.replace('whatsapp:', '')

        // Find Contact
        // We search by phone, primary_phone, or phones array
        // Use a simplified query for now, assuming normalized format matches
        const { data: contacts, error: contactError } = await supabase
            .from('contacts')
            .select('id, agency_id, first_name, last_name, primary_phone, phones')
            .eq('primary_phone', phoneNumber)
            .limit(1)

        if (contactError) {
            console.error('Error finding contact:', contactError)
            return new Response('Error finding contact', { status: 500 })
        }

        const contact = contacts?.[0]

        if (!contact) {
            console.log(`Contact NOT found for phone: ${phoneNumber}. Contacts found: ${contacts?.length || 0}`)
            return new Response('Contact not found', { status: 200 })
        }

        console.log(`Contact found: ${contact.first_name} (ID: ${contact.id})`)
        const agencyId = contact.agency_id

        // Log Inbound Message
        const { error: logError } = await supabase.from('chat_messages').insert({
            contact_id: contact.id,
            agency_id: agencyId,
            direction: 'inbound',
            channel: 'whatsapp',
            content: body,
            metadata: {
                messageSid,
                profileName,
                raw: Object.fromEntries(formData.entries())
            }
        })

        if (logError) {
            console.error('Error logging message to chat_messages:', logError)
        } else {
            console.log('Message logged to chat_messages')
        }

        // RESUME WORKFLOWS WAITING FOR REPLY
        const { data: runs } = await supabase
            .from('workflow_runs')
            .select('id, context, current_node_id')
            .eq('contact_id', contact.id)
            .eq('status', 'waiting')

        console.log(`Found ${runs?.length || 0} waiting workflow runs for contact`)

        if (runs && runs.length > 0) {
            for (const run of runs) {
                const nodeContext = run.context[run.current_node_id];
                if (nodeContext && nodeContext.status === 'waiting_for_reply') {
                    console.log(`Resuming workflow run ${run.id}`);
                    await supabase.from('workflow_runs').update({
                        status: 'pending',
                        next_run_at: new Date().toISOString(),
                        context: {
                            ...run.context,
                            [run.current_node_id]: {
                                ...nodeContext,
                                reply_received: true,
                                reply_content: body
                            }
                        }
                    }).eq('id', run.id);
                }
            }
        }

        // TRIGGER AI AUTO-REPLY
        const { data: agency } = await supabase
            .from('agencies')
            .select('twilio_settings')
            .eq('id', agencyId)
            .single()

        const settings = agency?.twilio_settings || {}

        // Determine flags from active run OR agency setting
        let enableAi = settings.enableAi;
        let extractInsights = settings.extractInsights;
        let activeAgentPrompt = settings.whatsappAgentPrompt;

        console.log('Global Settings:', { enableAi, extractInsights, hasPrompt: !!activeAgentPrompt })

        if (runs && runs.length > 0) {
            const activeRunMeta = runs[0].context[runs[0].current_node_id];
            if (activeRunMeta) {
                if (activeRunMeta.enableAi !== undefined) enableAi = activeRunMeta.enableAi;
                if (activeRunMeta.extractInsights !== undefined) extractInsights = activeRunMeta.extractInsights;
                if (activeRunMeta.agentPrompt) activeAgentPrompt = activeRunMeta.agentPrompt;
                console.log('Workflow Overrides Applied:', { enableAi, extractInsights })
            }
        }

        if (enableAi || extractInsights) {
            console.log(`AI Processing active: enableAi=${enableAi}, extractInsights=${extractInsights}`)
            await handleAiConversation(supabase, contact, body, agencyId, settings, {
                enableAi,
                extractInsights,
                agentPrompt: activeAgentPrompt
            })
        } else {
            console.log('AI processing skipped (both enableAi and extractInsights are false)')
        }

        return new Response('<Response></Response>', {
            headers: { 'Content-Type': 'text/xml' }
        })

    } catch (err: any) {
        console.error('Webhook Error:', err)
        return new Response(err.message, { status: 500 })
    }
})

async function handleAiConversation(supabase: any, contact: any, userMessage: string, agencyId: string, settings: any, options: { enableAi?: boolean, extractInsights?: boolean, agentPrompt?: string }) {
    try {
        const openAiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openAiKey) {
            console.error('Missing OPENAI_API_KEY')
            return
        }

        // 1. Fetch recent Context
        const { data: history } = await supabase
            .from('chat_messages')
            .select('direction, content, created_at')
            .eq('contact_id', contact.id)
            .order('created_at', { ascending: false })
            .limit(15)

        // Reverse to chronological
        const chatHistory = (history || []).reverse().map((msg: any) => ({
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: msg.content
        }))

        // AI REPLY LOGIC
        if (options.enableAi) {
            const defaultPrompt = `You are a helpful AI real estate assistant for ${contact.first_name || 'a client'}.
            Your goal is to qualify the lead, understand their budget, location preferences, and timeline.
            Be concise, professional, and friendly. Do not use emojis excessively.
            Current User: ${contact.first_name || 'Client'}.`;

            const systemPrompt = options.agentPrompt || defaultPrompt;

            const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'system', content: systemPrompt }, ...chatHistory]
                })
            })

            const aiData = await aiRes.json()
            const replyText = aiData.choices?.[0]?.message?.content

            if (replyText) {
                console.log('AI Reply generated:', replyText)
                await sendTwilioMessage(replyText, contact.primary_phone, settings, supabase, agencyId, contact.id)
            }
        }

        // EXTRACTION LOGIC
        if (options.extractInsights) {
            console.log('Performing AI Insight extraction...')
            const extractionPrompt = `Analyze the conversation history and extract structured info about the client's real estate preferences and personal details.
            Return ONLY a FLAT JSON object with the keys listed below. Do NOT nest objects.
            
            Property & Deal Preferences:
            - budget (numeric value only)
            - max_budget (numeric value only)
            - bedrooms (numeric)
            - bathrooms (numeric)
            - city (string)
            - region (string)
            - country (string, default "Spain")
            - timeline (string, e.g., "ASAP", "2 months" - when they want to close the deal)
            - type_apartment (boolean)
            - type_villa (boolean)
            
            Personal info (Contact):
            - nationality (string)
            - language_primary (string)
            - summary (string, short overview of the client and their situation)
            
            Conversation:
            ${chatHistory.map((m: any) => m.role + ': ' + m.content).join('\n')}
            `

            const extractRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + openAiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: extractionPrompt }],
                    response_format: { type: "json_object" }
                })
            })

            const extractData = await extractRes.json()
            let insights = JSON.parse(extractData.choices?.[0]?.message?.content || '{}')
            console.log('Raw Extracted insights:', insights)

            // Robust flattening logic
            if (insights['Property & Deal Preferences'] || insights['Personal Info']) {
                insights = {
                    ...insights,
                    ...(insights['Property & Deal Preferences'] || {}),
                    ...(insights['Personal Info'] || {})
                }
            }

            // Separate deal preferences from personal info
            const dealFields = ['budget', 'max_budget', 'bedrooms', 'bathrooms', 'city', 'region', 'country', 'timeline',
                'type_apartment', 'type_villa']

            const dealUpdates: Record<string, any> = {}
            const contactProfileUpdates: Record<string, any> = {}

            if (insights.nationality) contactProfileUpdates.nationality = insights.nationality
            if (insights.language_primary) contactProfileUpdates.language_primary = insights.language_primary
            if (insights.summary) contactProfileUpdates.summary = insights.summary

            for (const [key, val] of Object.entries(insights)) {
                if (val === null || val === undefined || typeof val === 'object') continue
                if (dealFields.includes(key)) {
                    dealUpdates[key] = val
                }
            }

            // CANONICAL MATCHING: Extract mentioned locations and features
            let locationIds: number[] = []
            let featureIds: string[] = []

            try {
                // Collect mentioned locations from insights
                const mentionedLocations = [
                    insights.city,
                    insights.region,
                    insights.area
                ].filter(Boolean)

                // Extract feature keywords from conversation
                const conversationText = chatHistory.map((m: any) => m.content).join(' ').toLowerCase()
                const featureKeywords = []

                // Common feature terms to look for
                const featurePatterns = [
                    'gym', 'pool', 'swimming pool', 'parking', 'garage', 'garden', 'terrace',
                    'balcony', 'jacuzzi', 'sauna', 'spa', 'lift', 'elevator', 'beach view',
                    'sea view', 'mountain view', 'golf', 'tennis', 'padel', 'security',
                    'fireplace', 'air conditioning', 'ac', 'heating', 'furnished', 'storage'
                ]

                for (const pattern of featurePatterns) {
                    if (conversationText.includes(pattern)) {
                        featureKeywords.push(pattern)
                    }
                }

                console.log('Extracted for matching:', { mentionedLocations, featureKeywords })

                // Call matching service if we have data to match
                if (mentionedLocations.length > 0 || featureKeywords.length > 0) {
                    const matchRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/match-canonical-entities`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            locations: mentionedLocations,
                            features: featureKeywords
                        })
                    })

                    if (matchRes.ok) {
                        const matchData = await matchRes.json()
                        locationIds = matchData.matched_location_ids || []
                        featureIds = matchData.matched_feature_keys || []
                        console.log('Canonical matches:', { locationIds, featureIds })
                    } else {
                        console.error('Matching service error:', await matchRes.text())
                    }
                }
            } catch (matchErr) {
                console.error('Error in canonical matching:', matchErr)
                // Continue without matching - don't block the extraction
            }

            // 1. Update Contact Profile (Personal Info)
            if (Object.keys(contactProfileUpdates).length > 0) {
                const { error: profileError } = await supabase
                    .from('contact_profiles')
                    .update(contactProfileUpdates)
                    .eq('contact_id', contact.id)

                if (profileError) console.error('Error updating contact_profile:', profileError)
                else console.log('Contact Profile updated:', contactProfileUpdates)
            }

            // 2. Update Deal Preferences
            if (Object.keys(dealUpdates).length > 0) {
                // Find existing deal
                const { data: deals } = await supabase
                    .from('deals')
                    .select('id')
                    .eq('contact_id', contact.id)
                    .limit(1)

                let dealId = deals?.[0]?.id

                if (!dealId) {
                    console.log('Creating new deal for contact preferences')
                    const { data: newDeal, error: dealError } = await supabase
                        .from('deals')
                        .insert({
                            contact_id: contact.id,
                            agency_id: agencyId,
                            status: 'new',
                            name: 'Deal for ' + (contact.first_name || 'Contact')
                        })
                        .select('id')
                        .single()

                    if (!dealError) dealId = newDeal.id
                    else console.error('Error creating deal:', dealError)
                }

                if (dealId) {
                    // 1. Update main deal table (budget_min/max + areas) for better compatibility with existing UI
                    const mainDealUpdates: Record<string, any> = {
                        updated_at: new Date().toISOString()
                    }
                    if (dealUpdates.budget) mainDealUpdates.budget_min = dealUpdates.budget
                    if (dealUpdates.max_budget) mainDealUpdates.budget_max = dealUpdates.max_budget

                    if (dealUpdates.city) {
                        // Optionally merge with existing areas if you want to keep them
                        mainDealUpdates.areas = [dealUpdates.city]
                    }

                    const { error: mainDealError } = await supabase
                        .from('deals')
                        .update(mainDealUpdates)
                        .eq('id', dealId)

                    if (mainDealError) console.error('Error updating main deal:', mainDealError)
                    else console.log('Main deal synced with budget and city:', mainDealUpdates)

                    // 2. Upsert deal_preference_profiles
                    const { error: prefError } = await supabase
                        .from('deal_preference_profiles')
                        .upsert({
                            deal_id: dealId,
                            ...dealUpdates,
                            location_ids: locationIds.length > 0 ? locationIds : null,
                            feature_ids: featureIds.length > 0 ? featureIds : null
                        }, { onConflict: 'deal_id' })

                    if (prefError) console.error('Error updating deal preferences:', prefError)
                    else console.log('Deal preferences updated:', { ...dealUpdates, locationIds, featureIds })
                }
            }
        }

    } catch (err) {
        console.error('AI Conversation Error:', err)
    }
}

async function sendTwilioMessage(body: string, to: string, settings: any, supabase: any, agencyId: string, contactId: string) {
    const accountSid = settings.accountSid || Deno.env.get('TWILIO_ACCOUNT_SID')
    const authToken = settings.authToken || Deno.env.get('TWILIO_AUTH_TOKEN')
    const fromNumber = settings.fromNumber

    if (!accountSid || !authToken || !fromNumber) {
        console.error('Missing Twilio Credentials')
        return
    }

    const recipient = to.startsWith('whatsapp:') ? to : 'whatsapp:' + to
    const sender = fromNumber.startsWith('whatsapp:') ? fromNumber : 'whatsapp:' + fromNumber

    const params = new URLSearchParams()
    params.append('From', sender)
    params.append('To', recipient)
    params.append('Body', body)

    const authHeader = 'Basic ' + btoa(accountSid + ':' + authToken)

    try {
        const res = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + accountSid + '/Messages.json', {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        })

        if (!res.ok) {
            console.error('Twilio Send Failed', await res.text())
            return
        }

        const data = await res.json()
        console.log('Twilio Message Sent:', data.sid)

        // Log Outbound Message
        await supabase.from('chat_messages').insert({
            contact_id: contactId,
            agency_id: agencyId,
            direction: 'outbound',
            channel: 'whatsapp',
            content: body,
            metadata: { sid: data.sid }
        })
    } catch (err) {
        console.error('Error in sendTwilioMessage:', err)
    }
}
