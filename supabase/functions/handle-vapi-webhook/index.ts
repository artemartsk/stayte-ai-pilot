
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

            // 2. Extract Data (If Coherent Dialogue)
            console.log('[DEBUG] Transcript Length:', transcript.length)

            if (coherent_dialogue) {
                const extractSystemPrompt = `
                EXTRACT COMPREHENSIVE USER INFO AND PREFERENCES.
                You are a real estate analyst. Extract EVERY detail mentioned by the user.
                
                1. Property Specs:
                   - Budget (exact or range)
                   - Bedrooms & Bathrooms (min counts)
                   - Size/Area (sq m)
                   - Property Type (villa, apartment, penthouse, townhouse, finca...)
                   - Condition (new build, resale, renovation required, move-in ready)
                
                2. Location:
                   - Specific cities, areas, neighborhoods
                   - Proximity preferences (near beach, walking distance to shops, golf front, sea view)
                
                3. Features & Amenities:
                   - Pool (private/communal), Garden, Garage/Parking
                   - Views (Sea, Mountain, Golf, Urban)
                   - Style (Modern, Andalusian, Rustic)
                
                4. Workflow/Timeline:
                   - When are they looking to buy? (ASAP, 3 months, just looking)
                   - Reason for buying (Investment, Holiday Home, Permanent Residence)
                   - Financing (Cash, Mortgage needed)
            `;
                console.log('[DEBUG] Coherent Dialogue detected. Extraction starting...')

                const extractRaw = await openai.chat.completions.create({
                    model: "gpt-4",
                    messages: [
                        { role: "system", content: extractSystemPrompt },
                        { role: "user", content: transcript }
                    ],
                    functions: [
                        {
                            name: "update_preferences",
                            parameters: {
                                type: "object",
                                properties: {
                                    budget: { type: "number" },
                                    max_budget: { type: "number" },
                                    bedrooms: { type: "number" },
                                    bathrooms: { type: "number" },
                                    size_sq_m: { type: "number" },
                                    property_type: { type: "string" },
                                    location: { type: "string", description: "City or specific area name" },
                                    features: {
                                        type: "array",
                                        items: { type: "string" },
                                        description: "List of requested features (e.g. 'sea view', 'pool', 'garage')"
                                    },
                                    timeline: { type: "string", description: "e.g. 'ASAP', '6 months'" },
                                    usage: { type: "string", description: "e.g. 'Investment', 'Holiday', 'Living'" },
                                    condition: { type: "string", description: "e.g. 'New', 'Resale', 'Renovation'" }
                                }
                            }
                        }
                    ],
                    function_call: { name: "update_preferences" }
                });

                const extractedData = JSON.parse(extractRaw.choices[0].message.function_call?.arguments || '{}');
                console.log('[DEBUG] Extracted Data:', JSON.stringify(extractedData, null, 2));

                // CANONICAL MATCHING: Match extracted data to canonical entities
                let locationIds: number[] = []
                let featureIds: string[] = []

                try {
                    const mentionedLocations = [extractedData.location].filter(Boolean)

                    // Extract feature keywords logic (enhanced by explicit AI features list)
                    const transcriptLower = transcript.toLowerCase()
                    const featureKeywords = new Set<string>()

                    // 1. Add AI-extracted features (high confidence)
                    if (extractedData.features && Array.isArray(extractedData.features)) {
                        extractedData.features.forEach((f: string) => featureKeywords.add(f.toLowerCase()))
                    }

                    // 2. Fallback: Keyword scan if AI missed well-known terms
                    const featurePatterns = [
                        'gym', 'pool', 'swimming pool', 'parking', 'garage', 'garden', 'terrace',
                        'balcony', 'jacuzzi', 'sauna', 'spa', 'lift', 'elevator', 'beach view',
                        'sea view', 'mountain view', 'golf', 'tennis', 'padel', 'security',
                        'fireplace', 'air conditioning', 'ac', 'heating', 'furnished', 'storage'
                    ]

                    for (const pattern of featurePatterns) {
                        if (transcriptLower.includes(pattern)) {
                            featureKeywords.add(pattern)
                        }
                    }

                    if (mentionedLocations.length > 0 || featureKeywords.size > 0) {
                        const matchRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/match-canonical-entities`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                locations: mentionedLocations,
                                features: Array.from(featureKeywords)
                            })
                        })

                        if (matchRes.ok) {
                            const matchData = await matchRes.json()
                            locationIds = matchData.matched_location_ids || []
                            featureIds = matchData.matched_feature_keys || []
                            console.log('Vapi canonical matches:', { locationIds, featureIds })
                        }
                    }
                } catch (matchErr) {
                    console.error('Error in Vapi canonical matching:', matchErr)
                }

                // Update Database (Example: update deals or main contact fields)
                // Assuming we map extractedData to update 'contacts' or create a 'deal'
                // For now, log capabilities

                // Mark as 'qualified' or 'call_occurred'
                await supabase.from('contacts').update({
                    qualification_status: 'call_occurred',
                    last_call_at: new Date().toISOString()
                }).eq('id', contactId);

                // --- DATA PERSISTENCE PORTED FROM OLD WEBHOOK ---
                try {
                    // Update Contact Base Info
                    const contactUpdates: any = {}
                    if (extractedData.customer_name) {
                        const parts = extractedData.customer_name.split(' ')
                        if (parts.length > 0) contactUpdates.first_name = parts[0]
                        if (parts.length > 1) contactUpdates.last_name = parts.slice(1).join(' ')
                    }
                    if (extractedData.email) contactUpdates.primary_email = extractedData.email // Normalize field name

                    if (Object.keys(contactUpdates).length > 0) {
                        await supabase.from('contacts').update(contactUpdates).eq('id', contactId)
                        console.log('Updated contact info from transcript')
                    }

                    // Update Deal Preferences
                    // First find latest open deal
                    const { data: deals } = await supabase
                        .from('deals')
                        .select('id')
                        .eq('contact_id', contactId)
                        .order('created_at', { ascending: false })
                        .limit(1)

                    let dealId = deals?.[0]?.id

                    // Create deal if not exists (Optional - let's stick to update for now or create if strong intent?)
                    // For now, only update existing deal to map preferences
                    if (dealId) {
                        const prefUpdates: any = {}
                        // Map fields from 'extractedData' (which comes from update_preferences function)
                        // Note: extractedData has properties: budget, bedrooms, property_type, location...

                        if (extractedData.budget) {
                            const b = typeof extractedData.budget === 'number' ? extractedData.budget : parseInt(String(extractedData.budget).replace(/[^0-9]/g, '')) || 0
                            prefUpdates.budget = b
                            // Auto-set max_budget to budget + 30% per user request
                            prefUpdates.max_budget = Math.round(b * 1.3)
                        } else if (extractedData.max_budget) {
                            // Fallback if only max_budget is extracted
                            prefUpdates.max_budget = typeof extractedData.max_budget === 'number' ? extractedData.max_budget : parseInt(String(extractedData.max_budget).replace(/[^0-9]/g, '')) || 0
                        }

                        if (extractedData.bedrooms) prefUpdates.bedrooms = parseInt(String(extractedData.bedrooms)) || null
                        if (extractedData.bathrooms) prefUpdates.bathrooms = parseInt(String(extractedData.bathrooms)) || null
                        if (extractedData.size_sq_m) prefUpdates.size_sq_m = parseInt(String(extractedData.size_sq_m)) || null
                        if (extractedData.timeline) prefUpdates.timeline = extractedData.timeline

                        // Map location IDs if found canonically
                        if (locationIds && locationIds.length > 0) {
                            prefUpdates.location_ids = locationIds
                        }

                        // Map property types
                        if (extractedData.property_type) {
                            const pt = extractedData.property_type.toLowerCase()
                            if (pt.includes('villa')) prefUpdates.type_villa = true
                            if (pt.includes('apartment') || pt.includes('flat')) prefUpdates.type_apartment = true
                            if (pt.includes('townhouse')) prefUpdates.type_townhouse = true
                            if (pt.includes('penthouse')) prefUpdates.type_penthouse = true
                            if (pt.includes('land') || pt.includes('plot')) prefUpdates.type_land_plot = true
                        }

                        // Map features
                        if (featureIds && featureIds.length > 0) {
                            prefUpdates.feature_ids = featureIds
                        }

                        // Other Metadata
                        // If we have 'condition', 'usage' etc but no direct columns, append to AI Summary or Context?
                        // Actually let's put them in ai_summary to be visible

                        if (Object.keys(prefUpdates).length > 0) {
                            await supabase.from('deal_preference_profiles').upsert({
                                deal_id: dealId,
                                ...prefUpdates
                            }, { onConflict: 'deal_id' })
                            console.log('[DEBUG] Updated deal preferences for deal', dealId, prefUpdates)

                            // Update deal with AI summary so it shows in the UI
                            let aiSummary = `Type: ${extractedData.property_type || 'Unknown'}. Budget: €${extractedData.budget || 'Unknown'}. Bed/Bath: ${extractedData.bedrooms || '-'}/${extractedData.bathrooms || '-'}. Size: ${extractedData.size_sq_m ? extractedData.size_sq_m + 'm2' : '-'}.`;
                            if (extractedData.timeline) aiSummary += ` Timeline: ${extractedData.timeline}.`;
                            if (extractedData.condition) aiSummary += ` Condition: ${extractedData.condition}.`;

                            await supabase.from('deals').update({
                                ai_summary: aiSummary,
                                ai_hot: coherent_dialogue && !do_not_call
                            }).eq('id', dealId)
                            console.log('[DEBUG] Updated deal ai_summary:', aiSummary)


                            // Fetch groups to perform immediate assignment (bypassing potentially racey SQL trigger)
                            console.log('[DEBUG] Fetching contact groups for assignment...')
                            const { data: agencyGroups } = await supabase
                                .from('contact_groups')
                                .select('id, name, filter_criteria')
                                .eq('agency_id', agencyId);

                            let matchedGroupId = null;
                            if (agencyGroups && agencyGroups.length > 0) {
                                // Prepare matching data
                                const mBudget = prefUpdates.max_budget || prefUpdates.budget;
                                const mBedrooms = prefUpdates.bedrooms;
                                // prefUpdates.property_type is string (e.g. 'villa')
                                const mType = prefUpdates.property_type;

                                // Iterate and find first match
                                // Logic: Prioritize groups with specific criteria over generic ones (Catch-all), then alphabetical.
                                agencyGroups.sort((a: any, b: any) => {
                                    const aHasFilter = a.filter_criteria && Object.keys(a.filter_criteria).length > 0;
                                    const bHasFilter = b.filter_criteria && Object.keys(b.filter_criteria).length > 0;

                                    if (aHasFilter && !bHasFilter) return -1;
                                    if (!aHasFilter && bHasFilter) return 1;
                                    return a.name.localeCompare(b.name);
                                });

                                for (const group of agencyGroups) {
                                    const filter = group.filter_criteria || {};
                                    let isMatch = true;

                                    // Min Budget
                                    if (filter.minBudget && mBudget && mBudget < filter.minBudget) isMatch = false;
                                    // Max Budget
                                    if (isMatch && filter.maxBudget && mBudget && mBudget > filter.maxBudget) isMatch = false;
                                    // Min Bedrooms
                                    if (isMatch && filter.minBedrooms && mBedrooms && mBedrooms < filter.minBedrooms) isMatch = false;
                                    // Property Type
                                    if (isMatch && filter.propertyType && mType && filter.propertyType.toLowerCase() !== mType.toLowerCase()) isMatch = false;

                                    if (isMatch) {
                                        console.log(`[DEBUG] Matched Group: ${group.name} (${group.id})`);
                                        matchedGroupId = group.id;
                                        break;
                                    }
                                }
                            }

                            // Update contact with group_id if matched
                            const contactUpdatePayload: any = {
                                updated_at: new Date().toISOString()
                            };

                            if (matchedGroupId) {
                                contactUpdatePayload.group_id = matchedGroupId;
                            }

                            console.log('[DEBUG] Updating contact with payload:', JSON.stringify(contactUpdatePayload));

                            await supabase.from('contacts').update(contactUpdatePayload).eq('id', contactId);
                            console.log('[DEBUG] Contact updated (group assignment handled in-function).')
                        } else {
                            console.log('[DEBUG] No preferences to update.')
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
