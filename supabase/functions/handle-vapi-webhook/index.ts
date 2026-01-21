
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { OpenAI } from "https://deno.land/x/openai@v4.20.0/mod.ts";

// Environment variables
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const WHATSAPP_API_URL = "https://graph.facebook.com/v17.0/646730691850844/messages"; // From n8n input
const WHATSAPP_TOKEN = Deno.env.get('YELLOW_WHATSAPP_API_KEY') ?? ''; // Actually 'Yellow' creds in n8n, assuming similar API or standard WA Cloud API using Yellow provider?
// N8n uses "Yellow" credential. Use standard if Yellow follows standard WA API, or check docs. Assuming standard for now or placeholder.

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

Deno.serve(async (req) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const body = await req.json();
        const message = body.message;

        if (!message) {
            return new Response(JSON.stringify({ message: 'No message body' }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Extract Contact ID from Vapi call (assistantOverrides OR metadata)
        // n8n: message.call.assistantOverrides.variableValues.buyer_id
        // OR message.assistant.variableValues.buyer_id (depending on message type)
        // OR message.call.metadata.contact_id (passed in execute-workflow-step)
        let contactId = message.call?.metadata?.contact_id ||
            message.call?.assistantOverrides?.variableValues?.buyer_id ||
            message.assistant?.variableValues?.buyer_id ||
            message.call?.assistantOverride?.variableValues?.buyer_id;

        let agencyId = message.call?.metadata?.agency_id ||
            message.call?.assistantOverrides?.variableValues?.agency_id ||
            message.assistant?.variableValues?.agency_id;

        // Fetch agencyId if missing but contactId exists
        if (contactId && !agencyId) {
            const { data: c } = await supabase.from('contacts').select('agency_id').eq('id', contactId).single();
            if (c) agencyId = c.agency_id;
        }

        if (!contactId) {
            console.warn('No contact_id (buyer_id) found in webhook body:', JSON.stringify(message).substring(0, 200));
            return new Response(JSON.stringify({ status: 'ignored', reason: 'no_contact_id' }), { headers: { 'Content-Type': 'application/json' } });
        }

        console.log(`Processing ${message.type} for contact ${contactId}`);

        // --- CASE 1: Status Update (Ended - No Answer / Busy) ---
        if (message.type === 'status-update' && message.status === 'ended') {
            const reason = message.endedReason;
            const isNoAnswer = ['customer-did-not-answer', 'busy', 'customer-busy', 'voicemail', 'silence-timed-out'].includes(reason);

            // Determine detailed status
            let finalStatus = 'completed';
            if (reason === 'voicemail') finalStatus = 'voicemail';
            else if (['busy', 'customer-busy'].includes(reason)) finalStatus = 'busy';
            else if (['customer-did-not-answer', 'no-answer', 'silence-timed-out'].includes(reason)) finalStatus = 'no-answer';
            else if (['assistant-ended-call', 'customer-ended-call'].includes(reason)) finalStatus = 'answer';

            // DB Update/Insert Logic (Run for ALL ended calls to show status immediately)
            const callId = message.call?.id;
            console.log(`Processing status-update for call ${callId}, reason: ${reason}`);

            // 1. Try precise match
            let { data: existingComm } = await supabase
                .from('contact_communications')
                .select('id, payload')
                .eq('contact_id', contactId)
                .contains('payload', { call_id: callId })
                .maybeSingle();

            // 2. Fallback: Find recent 'sent' call (within last hour?)
            if (!existingComm) {
                console.log('Precise match failed, trying fallback for sent call...');
                const { data: fallback } = await supabase
                    .from('contact_communications')
                    .select('id, payload')
                    .eq('contact_id', contactId)
                    .eq('channel', 'ai_call')
                    .eq('status', 'sent')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (fallback) {
                    console.log(`Fallback matched call ${fallback.id}`);
                    existingComm = fallback;
                }
            }

            if (existingComm) {
                await supabase.from('contact_communications').update({
                    status: finalStatus,
                    payload: { ...existingComm.payload, reason, call_id: callId }
                }).eq('id', existingComm.id);
            } else {
                await supabase.from('contact_communications').insert({
                    contact_id: contactId,
                    agency_id: agencyId || '00000000-0000-0000-0000-000000000001',
                    channel: 'ai_call',
                    direction: 'out',
                    status: finalStatus,
                    payload: { reason, call_id: callId }
                });
            }

            // WhatsApp Logic (Only on failure) - PRESERVING LEGACY LOGIC IF NEEDED, BUT WORKFLOW SHOULD HANDLE IT
            if (isNoAnswer) {
                // Legacy support: If this call wasn't from a workflow, we might still want to do something? 
                // But for now, let's leave the WA logic as it was originally (before my tasks edit) 
                // just so we don't break non-workflow calls if any.

                const { data: contact } = await supabase.from('contacts').select('call_attempts, phone').eq('id', contactId).single();
                if (contact) {
                    const attempts = contact.call_attempts || 0;
                    let waTemplate = '';
                    if (attempts === 2) waTemplate = 'firstfollowup';
                    if (attempts === 3) waTemplate = 'secondfollowup';
                    if (attempts === 5) waTemplate = 'thirdfollowup';

                    if (waTemplate) {
                        console.log(`Sending WhatsApp (${waTemplate}) to ${contact.phone}`);
                        await supabase.from('contact_communications').insert({
                            contact_id: contactId,
                            agency_id: '00000000-0000-0000-0000-000000000001',
                            channel: 'wa',
                            direction: 'out',
                            status: 'sent',
                            payload: { template: waTemplate }
                        });
                    }
                }
            }

            // If this call was triggered by a Workflow Run, wake it up!
            const workflowRunId = message.call?.metadata?.workflow_run_id;

            if (workflowRunId) {
                console.log(`Linking Vapi call to Workflow Run: ${workflowRunId}`);

                // Fetch run to get current node
                const { data: run } = await supabase.from('workflow_runs').select('id, current_node_id, context, status').eq('id', workflowRunId).single();

                if (run) {
                    const nodeId = run.current_node_id;
                    const success = finalStatus === 'answer'; // Logic matches 'execute-workflow-step' expectation

                    console.log(`Updating Workflow Run ${run.id}: Node ${nodeId} -> Success: ${success}`);

                    const newContext = {
                        ...run.context,
                        [nodeId]: {
                            success,
                            status: finalStatus,
                            reason: reason,
                            timestamp: new Date().toISOString(),
                            call_id: callId
                            // 'reply_received' is for WA, but good to keep structure consistent
                        }
                    };

                    // Set back to 'pending' so execute-workflow-step runs again immediately
                    // It will check 'retryConfig' and either schedule next attempt or move to no_reply edge.
                    await supabase.from('workflow_runs').update({
                        status: 'pending',
                        context: newContext,
                        next_run_at: new Date().toISOString()
                    }).eq('id', run.id);
                }
            }
        }

        // --- CASE 2: End of Call Report (Analysis & Extraction) ---
        else if (message.type === 'end-of-call-report') {
            const transcript = message.transcript;
            const recordingUrl = message.recordingUrl;

            if (!transcript) {
                return new Response(JSON.stringify({ status: 'ok', reason: 'no_transcript' }), { headers: { 'Content-Type': 'application/json' } });
            }

            // 1. Analyze Call (Agent)
            const analysisSystemPrompt = `
            YOU ARE AN EXPERT PHONE-CALL TRANSCRIPT INTENT CLASSIFIER.
            CLASSIFY THE INTERACTION:
            - voicemail: true/false
            - call_me_later: true/false
            - do_not_call: true/false
            - coherent_dialogue: true/false (at least 2-3 meaningful exchanges)
        `;

            const analysisRaw = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { role: "system", content: analysisSystemPrompt },
                    { role: "user", content: transcript }
                ],
                functions: [
                    {
                        name: "classify_call",
                        parameters: {
                            type: "object",
                            properties: {
                                voicemail: { type: "boolean" },
                                call_me_later: { type: "boolean" },
                                do_not_call: { type: "boolean" },
                                coherent_dialogue: { type: "boolean" }
                            },
                            required: ["voicemail", "call_me_later", "do_not_call", "coherent_dialogue"]
                        }
                    }
                ],
                function_call: { name: "classify_call" }
            });

            const analysisArgs = JSON.parse(analysisRaw.choices[0].message.function_call?.arguments || '{}');
            const { coherent_dialogue, voicemail, do_not_call } = analysisArgs;

            console.log('[DEBUG] Analysis Result:', analysisArgs);

            // DB Update/Insert for Report
            const callId = message.call?.id;
            console.log(`Processing report for call ${callId}`);

            // 1. Precise match
            let { data: reportComm } = await supabase
                .from('contact_communications')
                .select('id, payload')
                .eq('contact_id', contactId)
                .contains('payload', { call_id: callId })
                .maybeSingle();

            // 2. Fallback
            if (!reportComm) {
                console.log('Precise match failed for report, trying fallback...');
                const { data: fallback } = await supabase
                    .from('contact_communications')
                    .select('id, payload')
                    .eq('contact_id', contactId)
                    .eq('channel', 'ai_call')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (fallback) reportComm = fallback;
            }

            if (reportComm) {
                // Determine final status for update
                let newStatus = 'answer'; // Current default

                // Keep existing failure statuses if reason confirms it
                const reason = message.endedReason || reportComm.payload?.reason;
                if (['customer-did-not-answer', 'no-answer', 'busy', 'silence-timed-out', 'failed'].includes(reason)) {
                    newStatus = 'no-answer'; // or keep previous
                    if (['busy', 'customer-busy'].includes(reason)) newStatus = 'busy';
                    else if (reason === 'voicemail') newStatus = 'voicemail';
                }

                await supabase.from('contact_communications').update({
                    status: newStatus,
                    payload: { ...reportComm.payload, transcript, recordingUrl, analysis: analysisArgs }
                }).eq('id', reportComm.id);
            } else {
                // Insert logic
                const reason = message.endedReason;
                let newStatus = 'answer';
                if (['customer-did-not-answer', 'no-answer', 'busy', 'silence-timed-out', 'failed'].includes(reason)) {
                    newStatus = 'no-answer';
                    if (['busy', 'customer-busy'].includes(reason)) newStatus = 'busy';
                    else if (reason === 'voicemail') newStatus = 'voicemail';
                }

                await supabase.from('contact_communications').insert({
                    contact_id: contactId,
                    agency_id: agencyId || '00000000-0000-0000-0000-000000000001',
                    channel: 'ai_call',
                    direction: 'out',
                    status: newStatus,
                    payload: {
                        call_id: callId,
                        transcript,
                        recordingUrl,
                        analysis: analysisArgs,
                        reason
                    }
                });
            }

            // Update Contact Status based on analysis
            if (do_not_call) {
                await supabase.from('contacts').update({ qualification_status: 'stop' }).eq('id', contactId);
            }

            // 2. Extract Data using Universal Parser (extract-lead-details)
            console.log('[DEBUG] Transcript Length:', transcript.length)

            // Extract using the centralized function
            if (coherent_dialogue) {
                console.log('[DEBUG] Coherent Dialogue detected. Invoking extract-lead-details...');

                let extractedData: any = {};
                try {
                    const extractRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/extract-lead-details`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            text: transcript,
                            context: 'Call Transcript'
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

                // 3. Persist Extracted Data
                try {
                    // Update Contact Base Info
                    const contactUpdates: any = {}
                    if (extractedData.full_name) {
                        const parts = extractedData.full_name.split(' ')
                        if (parts.length > 0) contactUpdates.first_name = parts[0]
                        if (parts.length > 1) contactUpdates.last_name = parts.slice(1).join(' ')
                    }
                    if (extractedData.email) contactUpdates.primary_email = extractedData.email
                    if (extractedData.phone) contactUpdates.primary_phone = extractedData.phone

                    if (Object.keys(contactUpdates).length > 0) {
                        await supabase.from('contacts').update(contactUpdates).eq('id', contactId)
                        console.log('Updated contact info from transcript')
                    }

                    // Update Contact Profile (Language, Agent, Personal Data)
                    const profileUpdate: any = { contact_id: contactId };

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
                        .eq('contact_id', contactId)
                        .order('created_at', { ascending: false })
                        .limit(1)

                    let dealId = deals?.[0]?.id

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

                        const dealUpdate: any = {}
                        for (const key of allowedDealKeys) {
                            if (extractedData[key] !== undefined && extractedData[key] !== null) {
                                dealUpdate[key] = extractedData[key];
                            }
                        }

                        if (extractedData.purchace_timeframe) dealUpdate.timeline = extractedData.purchace_timeframe;

                        // Map budget for display
                        if (extractedData.budget) dealUpdate.budget_min = extractedData.budget;
                        if (extractedData.max_budget) dealUpdate.budget_max = extractedData.max_budget;

                        // AI summary
                        dealUpdate.ai_summary = extractedData.summary || `Extracted from call: Budget ${dealUpdate.budget || '?'}`;
                        dealUpdate.ai_hot = coherent_dialogue && !do_not_call;

                        if (Object.keys(dealUpdate).length > 0) {
                            await supabase.from('deals').update(dealUpdate).eq('id', dealId)
                            console.log('[DEBUG] Updated deals table directly for deal', dealId)
                        }
                    }
                } catch (persistErr) {
                    console.error('Error persisting extracted data:', persistErr)
                }
            }
        }

        return new Response(JSON.stringify({ status: 'processed' }), { headers: { 'Content-Type': 'application/json' } });

    } catch (err: any) {
        console.error(err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
