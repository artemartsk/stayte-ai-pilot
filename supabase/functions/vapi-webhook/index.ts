
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !serviceKey) {
            throw new Error('Missing Supabase credentials')
        }

        const supabase = createClient(supabaseUrl, serviceKey)
        const payload = await req.json()
        const { message } = payload

        console.log('Received Vapi Webhook:', message?.type)

        // specific handler for different message types
        if (message?.type === 'call-ended' || message?.type === 'end-of-call-report') {
            const call = message.call
            // We need to find which workflow_run triggered this call.
            // We can store the workflow_run_id in the call metadata when we start it.
            // Assuming metadata.workflow_run_id exists.

            const workflowRunId = call?.metadata?.workflow_run_id

            if (!workflowRunId) {
                console.log('No workflow_run_id in call metadata, skipping.')
                return new Response(JSON.stringify({ received: true, ignored: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }

            console.log(`Processing call end for workflow_run: ${workflowRunId}`)

            // Determine outcome
            // reason: 'assistant-ended-call', 'customer-ended-call', 'no-answer', 'busy', 'voicemail'
            const reason = call?.endedReason
            const analysis = call?.analysis // Structured data extracted from call

            let status = 'completed'
            let outputContext = {
                call_id: call.id,
                recording_url: call.recordingUrl,
                duration: call.durationSeconds,
                reason: reason,
                transcript: call.transcript,
                summary: analysis?.summary,
                structured_data: analysis?.structuredData,
                success: false
            }

            // Logic to determine if "Replied" or "No Reply/Failed"
            if (['assistant-ended-call', 'customer-ended-call'].includes(reason)) {
                outputContext.success = true
            } else {
                // 'no-answer', 'busy', 'voicemail', 'silence-timed-out'
                outputContext.success = false
            }

            // Update workflow_run
            // We set status to 'pending' so execute-workflow-step picks it up again to decide next step
            // But we need to save the result context so the next execution knows what happened.

            // 4. DATA EXTRACTION & UPDATE
            if (analysis?.structuredData) {
                try {
                    console.log('Processing structured data update for contact', call?.metadata?.contact_id)
                    const sd = analysis.structuredData
                    const contactId = call?.metadata?.contact_id

                    if (contactId) {
                        // 4.1 Update Contact Base Info
                        const contactUpdates: any = {}
                        if (sd.customer_name) {
                            const parts = sd.customer_name.split(' ')
                            if (parts.length > 0) contactUpdates.first_name = parts[0]
                            if (parts.length > 1) contactUpdates.last_name = parts.slice(1).join(' ')
                        }
                        if (sd.first_name) contactUpdates.first_name = sd.first_name
                        if (sd.last_name) contactUpdates.last_name = sd.last_name
                        if (sd.email) contactUpdates.emails = sd.email

                        if (Object.keys(contactUpdates).length > 0) {
                            await supabase.from('contacts').update(contactUpdates).eq('id', contactId)
                        }

                        // 4.2 Update Contact Profile (Summary, etc)
                        // defined in schema: contact_profiles(contact_id, summary, ...)
                        const profileUpdates: any = {}
                        if (analysis.summary) profileUpdates.summary = analysis.summary
                        if (sd.nationality) profileUpdates.nationality = sd.nationality

                        if (Object.keys(profileUpdates).length > 0) {
                            await supabase.from('contact_profiles').upsert({
                                contact_id: contactId,
                                ...profileUpdates
                            }, { onConflict: 'contact_id' })
                        }

                        // 4.3 Update Deal Preferences
                        // First find latest open deal
                        const { data: deals } = await supabase
                            .from('deals')
                            .select('id')
                            .eq('contact_id', contactId)
                            .order('created_at', { ascending: false })
                            .limit(1)

                        let dealId = deals?.[0]?.id

                        // If no deal exists, maybe create one? 
                        // For now, only update if deal exists to avoid spamming deals on every call
                        if (dealId) {
                            const prefUpdates: any = {}
                            if (sd.budget) prefUpdates.budget = typeof sd.budget === 'number' ? sd.budget : parseInt(String(sd.budget).replace(/[^0-9]/g, '')) || 0
                            if (sd.max_budget || sd.budget_max) prefUpdates.max_budget = typeof (sd.max_budget || sd.budget_max) === 'number' ? (sd.max_budget || sd.budget_max) : parseInt(String(sd.max_budget || sd.budget_max).replace(/[^0-9]/g, '')) || 0
                            if (sd.bedrooms) prefUpdates.bedrooms = parseInt(String(sd.bedrooms)) || null
                            if (sd.location || sd.city) prefUpdates.city = sd.location || sd.city

                            // Map property types
                            if (sd.property_type) {
                                const pt = sd.property_type.toLowerCase()
                                if (pt.includes('villa')) prefUpdates.type_villa = true
                                if (pt.includes('apartment') || pt.includes('flat')) prefUpdates.type_apartment = true
                                if (pt.includes('townhouse')) prefUpdates.type_townhouse = true
                            }

                            if (Object.keys(prefUpdates).length > 0) {
                                // Preferences are now stored directly in deals table
                                await supabase.from('deals').update(prefUpdates).eq('id', dealId)
                                console.log('Updated deal preferences in deals table for deal', dealId)
                            }
                        }
                    }

                } catch (idxErr) {
                    console.error('Error processing extraction:', idxErr)
                }
            }

            // Fetch current run to get context and current_node_id
            const { data: currentRun, error: fetchError } = await supabase
                .from('workflow_runs')
                .select('context, current_node_id')
                .eq('id', workflowRunId)
                .single()

            if (fetchError || !currentRun) {
                console.error('Error fetching workflow run:', fetchError)
                throw new Error('Workflow run not found')
            }

            const { error } = await supabase
                .from('workflow_runs')
                .update({
                    status: 'pending', // Ready for next step processing
                    next_run_at: new Date().toISOString(), // Process immediately
                    context: {
                        ...currentRun.context,
                        [currentRun.current_node_id]: outputContext
                    }
                })
                .eq('id', workflowRunId)

            if (error) {
                console.error('Error updating workflow_run:', error)
                throw error
            }

            console.log(`Updated workflow_run ${workflowRunId} with success=${outputContext.success}`)

            // 5. UPDATE CONTACT_COMMUNICATIONS with call result
            // This is critical for the UI to show call outcomes
            const contactId = call?.metadata?.contact_id
            const agencyId = call?.metadata?.agency_id

            if (contactId) {
                // Determine final status based on call outcome
                let finalStatus = 'completed'
                if (['no-answer', 'customer-did-not-answer'].includes(reason)) {
                    finalStatus = 'no-answer'
                } else if (['busy', 'customer-busy'].includes(reason)) {
                    finalStatus = 'busy'
                } else if (reason === 'voicemail') {
                    finalStatus = 'voicemail'
                } else if (['assistant-ended-call', 'customer-ended-call'].includes(reason)) {
                    finalStatus = 'answer'
                } else if (['error', 'failed'].includes(reason)) {
                    finalStatus = 'failed'
                }

                // Insert new communication record with final result
                await supabase.from('contact_communications').insert({
                    contact_id: contactId,
                    agency_id: agencyId,
                    channel: 'ai_call',
                    direction: 'out',
                    status: finalStatus,
                    payload: {
                        call_id: call.id,
                        endedReason: reason,
                        recordingUrl: call.recordingUrl,
                        transcript: call.transcript,
                        duration: call.durationSeconds,
                        summary: analysis?.summary,
                        structured_data: analysis?.structuredData
                    }
                })
                console.log(`Logged call result to contact_communications: ${finalStatus}`)

                // Update workflow_step_logs with final call result
                // Find the log entry with waiting_for_callback status for this call
                const { data: existingLogs } = await supabase
                    .from('workflow_step_logs')
                    .select('id')
                    .eq('contact_id', contactId)
                    .eq('status', 'waiting_for_callback')
                    .order('created_at', { ascending: false })
                    .limit(1)

                if (existingLogs && existingLogs.length > 0) {
                    await supabase.from('workflow_step_logs').update({
                        status: finalStatus,
                        result: {
                            call_id: call.id,
                            reason: reason,
                            duration: call.durationSeconds,
                            summary: analysis?.summary
                        }
                    }).eq('id', existingLogs[0].id)
                    console.log(`Updated workflow_step_logs to status: ${finalStatus}`)
                }
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error: any) {
        console.error('Error processing webhook:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
