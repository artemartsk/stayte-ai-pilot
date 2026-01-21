
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
            console.log('Performing AI Insight extraction using extract-lead-details...')

            const conversationText = chatHistory.map((m: any) => m.role + ': ' + m.content).join('\n') + `\nuser: ${userMessage}`;

            let extractedData: any = {};
            try {
                const extractRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/extract-lead-details`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: conversationText,
                        context: 'WhatsApp Conversation History'
                    })
                });

                if (extractRes.ok) {
                    extractedData = await extractRes.json();
                    console.log('[DEBUG] Extracted Data from Function:', JSON.stringify(extractedData, null, 2));
                } else {
                    console.error('Error invoking extract-lead-details:', await extractRes.text());
                }
            } catch (err) {
                console.error('Exception invoking extract-lead-details:', err);
            }

            // 1. Persist Extracted Data
            try {
                // Update Contact Base Info
                const contactUpdates: any = {}
                if (extractedData.full_name) {
                    const parts = extractedData.full_name.split(' ')
                    if (parts.length > 0) contactUpdates.first_name = parts[0]
                    if (parts.length > 1) contactUpdates.last_name = parts.slice(1).join(' ')
                }
                if (extractedData.email) contactUpdates.primary_email = extractedData.email

                if (Object.keys(contactUpdates).length > 0) {
                    await supabase.from('contacts').update(contactUpdates).eq('id', contact.id)
                    console.log('Updated contact info from transcript')
                }

                // Update Contact Profile (Language, Agent, Personal Data)
                const profileUpdate: any = { contact_id: contact.id };

                if (extractedData.language) profileUpdate.language_primary = extractedData.language;
                if (extractedData.is_agent) {
                    profileUpdate.job_title = 'Real Estate Agent';
                    if (extractedData.summary) profileUpdate.qualification_notes = `[AGENT DETECTED] ${extractedData.summary}`;
                }
                if (extractedData.agency_name) profileUpdate.company_name = extractedData.agency_name;

                // Map personal details attributes
                const personalAttributes = [
                    'age_25_35', 'age_36_50', 'age_51_plus',
                    'gender_male', 'gender_female',
                    'marital_single', 'marital_couple', 'marital_with_children',
                    'nationality', 'residence_country',
                    'profession_it', 'profession_retired',
                    'company_name', 'job_title', 'industry',
                    'income_lt_50k', 'income_50k_100k', 'income_gt_100k',
                    'funding_mortgage', 'funding_foreign_loan', 'financing_method',
                    'visited_location_before', 'hobby', 'owns_property_elsewhere',
                    'trip_planned'
                ];

                for (const attr of personalAttributes) {
                    if (extractedData[attr] !== undefined && extractedData[attr] !== null) {
                        profileUpdate[attr] = extractedData[attr];
                    }
                }

                if (Object.keys(profileUpdate).length > 1) {
                    console.log(`Updating contact profile with extra info:`, profileUpdate);
                    await supabase.from('contact_profiles').upsert(profileUpdate, { onConflict: 'contact_id' });
                }

                // Update Deal Preferences
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
                    // Now all preference data goes directly into the deals table
                    const allowedDealKeys = [
                        'max_budget', 'budget', 'bedrooms', 'bathrooms', 'size_sq_m', 'city', 'area', 'country', 'region',
                        'loc_coast', 'loc_city_center', 'loc_suburbs', 'loc_rural',
                        'dist_beach_lt_1km', 'dist_golf_lt_2km',
                        'type_apartment', 'type_villa', 'type_townhouse', 'type_land_plot',
                        'subtype_penthouse', 'subtype_duplex', 'subtype_detached_villa', 'subtype_finca_cortijo',
                        'subtype_ground_floor_apartment', 'subtype_ground_floor_studio', 'subtype_middle_floor_apartment',
                        'subtype_middle_floor_studio', 'subtype_top_floor_apartment', 'subtype_top_floor_studio',
                        'group_subtype_apartment', 'group_subtype_detached', 'group_subtype_duplex', 'group_subtype_townhouse',
                        'location_type_beachside', 'location_type_close_to_forest', 'location_type_close_to_golf',
                        'location_type_close_to_marina', 'location_type_close_to_schools', 'location_type_close_to_sea',
                        'location_type_close_to_town', 'location_type_country', 'location_type_suburban',
                        'location_type_town', 'location_type_urbanisation',
                        'feature_pool', 'feature_private_pool', 'feature_garden', 'feature_terrace', 'feature_garage',
                        'feature_private_parking', 'feature_sea_view', 'feature_mountain_view', 'feature_gated_community',
                        'feature_gym', 'feature_lift', 'feature_fitted_wardrobes', 'feature_air_conditioning',
                        'feature_access_for_reduced_mobility', 'feature_balcony', 'feature_barbeque', 'feature_bar_restaurant',
                        'feature_basement', 'feature_children_playground', 'feature_cinema', 'feature_concierge_service',
                        'feature_courtesy_bus', 'feature_covered_terrace', 'feature_coworking_area', 'feature_dedicated_workspace',
                        'feature_domotics', 'feature_double_glazing', 'feature_ensuite_bathroom', 'feature_ev_charger',
                        'feature_guest_house', 'feature_jacuzzi', 'feature_marble_flooring', 'feature_padel_court_tennis_court',
                        'feature_sauna', 'feature_solarium', 'feature_spa', 'feature_storage_room',
                        'parking_covered', 'parking_garage', 'parking_gated', 'parking_underground',
                        'pool_childrens_pool', 'pool_communal', 'pool_heated', 'pool_indoor', 'pool_private',
                        'security_24_hour_security', 'security_alarm_system', 'security_electric_blinds', 'security_gated_complex',
                        'condition_new_build', 'condition_resale', 'condition_renovation_ok', 'condition_recently_renovated',
                        'condition_recently_refurbished', 'condition_excellent', 'build_type_new', 'build_type_secondhand',
                        'completion_type_construction', 'completion_type_ready',
                        'climate_control_air_conditioning', 'fireplace',
                        'main_home', 'second_home', 'want_short_term_rental', 'want_long_term_rental', 'timeline'
                    ];

                    const dealUpdate: any = {
                        updated_at: new Date().toISOString()
                    }
                    for (const key of allowedDealKeys) {
                        if (extractedData[key] !== undefined && extractedData[key] !== null) {
                            dealUpdate[key] = extractedData[key];
                        }
                    }
                    if (extractedData.purchace_timeframe) dealUpdate.timeline = extractedData.purchace_timeframe;

                    // Map budget for display
                    if (extractedData.budget) dealUpdate.budget_min = extractedData.budget;
                    if (extractedData.max_budget) dealUpdate.budget_max = extractedData.max_budget;
                    if (extractedData.city) dealUpdate.areas = [extractedData.city];

                    // AI summary
                    dealUpdate.ai_summary = extractedData.summary || `Extracted from WA: Budget ${dealUpdate.budget || '?'}`;

                    if (Object.keys(dealUpdate).length > 1) {
                        const { error: dealError } = await supabase
                            .from('deals')
                            .update(dealUpdate)
                            .eq('id', dealId)
                        if (dealError) console.error('Error updating deals:', dealError)
                        else console.log('[DEBUG] Updated deals table directly for deal', dealId)
                    }
                }
            } catch (persistErr) {
                console.error('Error persisting extracted data:', persistErr)
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
