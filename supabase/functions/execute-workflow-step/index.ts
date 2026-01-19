import { createClient } from 'jsr:@supabase/supabase-js@2'
import { toZonedTime, fromZonedTime } from 'npm:date-fns-tz@3.2.0'

const TIMEZONE = 'Europe/Madrid'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
// ... (rest of the file until calculateNextSmartSlot)

function calculateNextSmartSlot() {
    const nowUTC = new Date()
    const nowCET = toZonedTime(nowUTC, TIMEZONE) // Get components in CET
    const currentHour = nowCET.getHours()

    // Morning window: 09:00 - 12:00
    // Evening window: 16:00 - 19:00

    // We work with "CET Time" logic, then convert back to UTC at the end
    // But toZonedTime returns a Date that "shifts" the timestamp.
    // It's safer to work with timestamps.

    let targetDateCET = new Date(nowCET)

    if (currentHour < 9) {
        // Before 9am CET -> Today 9am CET
        targetDateCET.setHours(9, 0, 0, 0)
    } else if (currentHour < 12) {
        // Morning window -> Schedule for 16:00 CET (Evening)
        targetDateCET.setHours(16, 0, 0, 0)
    } else if (currentHour < 16) {
        // Between windows -> Schedule for 16:00 CET
        targetDateCET.setHours(16, 0, 0, 0)
    } else if (currentHour < 19) {
        // Evening window -> Schedule for Tomorrow 9am CET
        targetDateCET.setDate(targetDateCET.getDate() + 1)
        targetDateCET.setHours(9, 0, 0, 0)
    } else {
        // After 19:00 CET -> Tomorrow 9am CET
        targetDateCET.setDate(targetDateCET.getDate() + 1)
        targetDateCET.setHours(9, 0, 0, 0)
    }

    // Convert back to UTC considering rules (DST etc)
    // fromZonedTime takes the "Date object that represents local time" and the timezone
    // to give back the real UTC timestamp.
    return fromZonedTime(targetDateCET, TIMEZONE)
}

function enforceTimeWindows(date: Date, windows: any[]) {
    if (!windows || windows.length === 0) return date;

    // date is UTC. We need to check against windows defined in CET.
    // windows = [{ start: '09:00', end: '12:00', days: ['mon'] }] (implicitly local/CET)

    const isAllowed = (dUTC: Date) => {
        const dCET = toZonedTime(dUTC, TIMEZONE)
        const dayStr = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dCET.getDay()];
        // HH:MM in CET
        const timeStr = dCET.getHours().toString().padStart(2, '0') + ':' + dCET.getMinutes().toString().padStart(2, '0');

        return windows.some(w => {
            if (!w.days.includes(dayStr)) return false;
            return timeStr >= w.start && timeStr <= w.end;
        });
    };

    if (isAllowed(date)) return date;

    // Find next valid slot
    // We check every hour (or start time of windows)
    // Using date-fns-tz effectively by iterating in CET time?

    // Easier: Shift to CET, calculate next slot in CET, convert back.
    const startCET = toZonedTime(date, TIMEZONE)
    let bestSlotCET = new Date(startCET.getTime() + 8 * 24 * 60 * 60 * 1000); // init high

    for (let i = 0; i < 8; i++) {
        const checkDateCET = new Date(startCET);
        checkDateCET.setDate(startCET.getDate() + i);
        const dayStr = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][checkDateCET.getDay()];

        const dayWindows = windows.filter(w => w.days.includes(dayStr));

        for (const w of dayWindows) {
            const [h, m] = w.start.split(':').map(Number);
            const slotCET = new Date(checkDateCET);
            slotCET.setHours(h, m, 0, 0);

            // if i=0, slotCET could be in past relative to startCET.
            if (slotCET < startCET) continue;

            if (slotCET < bestSlotCET) {
                bestSlotCET = slotCET;
            }
        }
    }

    return fromZonedTime(bestSlotCET, TIMEZONE);
}

interface WorkflowRun {
    id: string
    workflow_id: string
    contact_id: string
    agency_id: string
    current_node_id: string
    status: string
    context: Record<string, any>
}

interface WorkflowNode {
    id: string
    type: string
    data: {
        label: string
        action: 'call' | 'send_whatsapp' | 'send_email' | 'wait' | 'create_task' | 'check_qualification' | 'assign_agent' | 'mark_as_lost' | 'start_nurture'
        delay_minutes?: number
        config?: Record<string, any>
        timeWindows?: any[] // Using any[] to avoid needing to define TimeWindow interface here
    }
}

interface WorkflowEdge {
    id: string
    source: string
    target: string
    sourceHandle?: string
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    console.log(`Initializing Supabase client. URL: ${supabaseUrl ? 'Set' : 'Missing'}, Key: ${serviceKey ? 'Set (' + serviceKey.substring(0, 5) + '...)' : 'Missing'}`)

    const supabase = createClient(supabaseUrl, serviceKey)

    try {
        // 1. Find pending workflow runs ready to execute
        const now = new Date().toISOString()
        const { data: runs, error: runsError } = await supabase
            .from('workflow_runs')
            .select('*')
            .in('status', ['pending', 'waiting'])
            .or(`next_run_at.is.null,next_run_at.lte.${now}`)
            .limit(10)

        if (runsError) throw runsError

        console.log(`Found ${runs?.length || 0} runs to process`)

        if (!runs || runs.length === 0) {
            return new Response(JSON.stringify({ message: 'No workflow runs to process' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const results: any[] = []

        for (const run of runs as WorkflowRun[]) {
            try {
                // Mark as running
                await supabase
                    .from('workflow_runs')
                    .update({ status: 'running' })
                    .eq('id', run.id)

                // Load workflow
                const { data: workflow, error: wfError } = await supabase
                    .from('ai_workflow_templates')
                    .select('steps')
                    .eq('id', run.workflow_id)
                    .single()

                if (wfError || !workflow) {
                    throw new Error('Workflow not found: ' + run.workflow_id)
                }

                const steps = workflow.steps as { nodes: WorkflowNode[], edges: WorkflowEdge[] }
                const currentNode = steps.nodes.find(n => n.id === run.current_node_id)

                if (!currentNode) {
                    throw new Error('Node not found: ' + run.current_node_id)
                }

                // Load contact
                const { data: contact } = await supabase
                    .from('contacts')
                    .select('*')
                    .eq('id', run.contact_id)
                    .single()

                if (!contact) {
                    throw new Error('Contact not found: ' + run.contact_id)
                }

                // Execute action
                let success = false
                let actionResult: any = null

                // Check if we are resuming from a previous attempt (e.g. call finished)
                const previousAttempt = run.context[currentNode.id];
                let shouldRetry = false;

                if (previousAttempt && currentNode.data.action === 'call') {
                    // Check success of the *previous* attempt
                    if (previousAttempt.success) {
                        success = true;
                    } else {
                        // Previous attempt failed (no answer / busy)
                        const retryConfig = currentNode.data.config?.retryConfig;
                        const currentRetryCount = run.context.retry_count || 0;

                        if (retryConfig && retryConfig.maxAttempts > 1 && currentRetryCount < retryConfig.maxAttempts) {
                            shouldRetry = true;

                            // 1. Execute Interventions for the UPCOMING attempt (e.g. if we are about to do attempt #2)
                            // "If attempt #2 fails" -> implies we do it AFTER attempt 2 fails? 
                            // User said: "On Attempt 3 -> Send Email". Usually means "Before" or "After".
                            // Let's assume user means "If Attempt X fails, do Y".
                            // So if we just failed Attempt 1 (currentRetryCount=0 -> 1), we check for rules for attempt 1?
                            // No, typically "On Attempt 3" means "When we are about to try the 3rd time" or "After 3rd failure".
                            // Let's go with: "If Attempt N failed, trigger intervention".

                            const justFinishedAttempt = currentRetryCount + 1;
                            const intervention = retryConfig.interventions?.find((i: any) => i.attempt === justFinishedAttempt);

                            if (intervention) {
                                console.log(`Executing intervention for attempt ${justFinishedAttempt}: ${intervention.action}`);
                                try {
                                    if (intervention.action === 'send_email') await executeEmail(contact, { templateId: intervention.templateId }, supabase);
                                    if (intervention.action === 'send_whatsapp') await executeWhatsApp(contact, { templateId: intervention.templateId }, supabase);
                                    if (intervention.action === 'update_contact') {
                                        // Assign to group or update fields
                                        // simplified: intervention.fields = { group_id: '...' }
                                        await supabase.from('contacts').update(intervention.fields).eq('id', contact.id);
                                    }
                                } catch (err) {
                                    console.error('Intervention execution failed', err);
                                }
                            }

                            // 2. Schedule next retry
                            const nextRetryCount = currentRetryCount + 1;

                            // Smart Scheduling
                            let nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000); // default fixed 24h

                            if (retryConfig.backoff === 'smart_morning_evening') {
                                nextRun = calculateNextSmartSlot();
                            } else {
                                // For fixed_24h, we just keep the default nextRun
                            }

                            // Apply Time Windows if defined
                            // The node data has timeWindows: TimeWindow[]
                            const timeWindows = currentNode.data.timeWindows || [];
                            if (timeWindows.length > 0) {
                                nextRun = enforceTimeWindows(nextRun, timeWindows);
                            }

                            console.log(`Scheduling retry #${nextRetryCount} for ${nextRun.toISOString()}`);

                            await supabase.from('workflow_runs').update({
                                status: 'pending', // Ready for next attempt
                                next_run_at: nextRun.toISOString(),
                                context: {
                                    ...run.context,
                                    retry_count: nextRetryCount,
                                    // Clear the 'waiting' status of the current node result so it runs again
                                    [currentNode.id]: null
                                }
                            }).eq('id', run.id);

                            results.push({ runId: run.id, action: 'retry_scheduled', retryCount: nextRetryCount });
                            continue; // STOP here, do not advance node
                        }
                        // Else: Max retries reached or no retry config -> treat as failure (follow no_reply edge)
                        success = false;
                    }
                } else if (previousAttempt && currentNode.data.action === 'send_whatsapp' && previousAttempt.status === 'waiting_for_reply') {
                    // RESUMING WhatsApp Wait
                    // Check if we received a reply (set by webhook)
                    const hasReplied = run.context[currentNode.id]?.reply_received === true;

                    if (hasReplied) {
                        console.log(`WhatsApp Reply Received for run ${run.id}. Continuing Green path.`);
                        success = true;
                        actionResult = { message: 'Replied' };
                    } else {
                        // We are here due to Timeout (Cron triggered it after next_run_at passed)
                        console.log(`WhatsApp Wait Timeout for run ${run.id}. Continuing Red path.`);
                        success = false;
                        actionResult = { message: 'Timeout: No Reply' };
                    }
                } else {
                    // First time executing this node

                    // Check Time Windows for FIRST attempt (unless forced)
                    const timeWindows = currentNode.data.timeWindows || [];
                    const config = currentNode.data.config || {};
                    const actionType = currentNode.data.action;

                    // Only enforce for communication steps
                    if (['call', 'send_whatsapp'].includes(actionType) && timeWindows.length > 0) {
                        const forceImmediate = config.forceImmediate === true;

                        if (!forceImmediate) {
                            const now = new Date();
                            const validRunTime = enforceTimeWindows(now, timeWindows);

                            // If validRunTime is in the future (allowing 1 min buffer)
                            if (validRunTime.getTime() > now.getTime() + 60000) {
                                console.log(`Time Window Restriction: Rescheduling run ${run.id} for ${validRunTime.toISOString()}`);

                                await supabase.from('workflow_runs').update({
                                    status: 'pending',
                                    next_run_at: validRunTime.toISOString()
                                    // Do not write result context, so it treats it as fresh next time
                                }).eq('id', run.id);

                                results.push({ runId: run.id, action: 'rescheduled_time_window', nextRunAt: validRunTime });
                                continue;
                            }
                        }
                    }

                    switch (currentNode.data.action) {
                        case 'call':
                            // Use run.id for tracking in webhook
                            actionResult = await executeCall(contact, run.agency_id, supabase, run.id)
                            success = actionResult.success
                            break

                        case 'send_whatsapp':
                            actionResult = await executeWhatsApp(contact, currentNode.data.config, supabase)
                            success = actionResult.success

                            // Check for Wait for Reply logic
                            if (success && config.timeoutMinutes > 0) {
                                console.log(`WhatsApp sent. Waiting for reply for ${config.timeoutMinutes} minutes.`);
                                actionResult = {
                                    ...actionResult,
                                    status: 'waiting_for_reply',
                                    timeoutMinutes: config.timeoutMinutes,
                                    enableAi: config.enableAi,
                                    agentPrompt: config.agentPrompt,
                                    extractInsights: config.extractInsights
                                };
                            }
                            break

                        case 'send_email':
                            actionResult = await executeEmail(contact, currentNode.data.config, supabase)
                            success = actionResult.success
                            break

                        case 'wait':
                            success = true
                            actionResult = { message: 'Wait completed' }
                            break

                        case 'create_task':
                            actionResult = await executeCreateTask(contact, currentNode.data.config, run.agency_id, supabase)
                            success = actionResult.success
                            break

                        case 'check_qualification':
                            // Check if contact matches configured conditions
                            actionResult = await executeCheckQualification(contact, supabase, currentNode.data.config)
                            success = actionResult.qualified
                            break

                        case 'assign_agent':
                            // Auto-assign agent using configured strategy
                            actionResult = await executeAssignAgent(contact, run.agency_id, supabase, currentNode.data.config)
                            success = actionResult.success
                            break

                        case 'mark_as_lost':
                            // Mark contact and deal as lost
                            actionResult = await executeMarkAsLost(contact, supabase)
                            success = actionResult.success
                            break

                        case 'start_nurture':
                            actionResult = await executeNurtureStep(contact, currentNode.data.config, currentNode.data.timeWindows, run.agency_id, supabase)
                            success = actionResult.success
                            break

                            // ... (skipping to function definition)

                            async function executeNurtureStep(contact: any, config: any, timeWindows: any[], agencyId: string, supabase: any) {
                                console.log(`Executing Nurture Step for contact ${contact.id}`);

                                if (!contact.current_deal_id) {
                                    return {
                                        success: false,
                                        error: 'No active deal found for contact'
                                    }
                                }

                                const dayMap: Record<string, number> = {
                                    'monday': 1, 'mon': 1,
                                    'tuesday': 2, 'tue': 2,
                                    'wednesday': 3, 'wed': 3,
                                    'thursday': 4, 'thu': 4,
                                    'friday': 5, 'fri': 5,
                                    'saturday': 6, 'sat': 6,
                                    'sunday': 7, 'sun': 7
                                }

                                // Determine Day and Time
                                // Priority: 1. timeWindows (first available slot), 2. config.day/time, 3. Default (Mon 09:00)
                                let nurtureDay = 1;
                                let nurtureTime = '09:00';

                                if (timeWindows && timeWindows.length > 0) {
                                    // e.g. [{ days: ['mon', 'wed'], start: '09:00', end: '12:00' }]
                                    // We pick the first day of the first window and the start time
                                    const firstWindow = timeWindows[0];
                                    if (firstWindow.days && firstWindow.days.length > 0) {
                                        const firstDayStr = String(firstWindow.days[0]).toLowerCase();
                                        nurtureDay = dayMap[firstDayStr] || 1;
                                    }
                                    if (firstWindow.start) {
                                        nurtureTime = firstWindow.start;
                                    }
                                } else {
                                    // Fallback to config or default
                                    const requestedDay = String(config?.day || 'monday').toLowerCase();
                                    nurtureDay = dayMap[requestedDay] || 1;
                                    nurtureTime = config?.time || '09:00';
                                }

                                try {
                                    const { error } = await supabase
                                        .from('deals')
                                        .update({
                                            nurture_enabled: true,
                                            nurture_day: nurtureDay,
                                            nurture_time: nurtureTime,
                                        })
                                        .eq('id', contact.current_deal_id)

                                    if (error) throw error

                                    return {
                                        success: true,
                                        message: `Nurturing enabled for deal ${contact.current_deal_id} (Day: ${nurtureDay}, Time: ${nurtureTime})`
                                    };

                                } catch (err: any) {
                                    console.error('Error enabling nurture:', err);
                                    return { success: false, error: err.message };
                                }
                            }

                        default:
                            console.warn('Unknown action: ' + currentNode.data.action)
                            success = true
                    }
                }

                if (actionResult?.status === 'waiting_for_callback') {
                    // Update status to waiting_for_callback and EXIT for this run
                    await supabase.from('workflow_runs').update({
                        status: 'waiting_for_callback',
                        context: {
                            ...run.context,
                            [run.current_node_id]: actionResult
                        }
                    }).eq('id', run.id)
                    continue; // Skip next node logic
                }

                if (actionResult?.status === 'waiting_for_reply') {
                    // Enable WAIT state
                    const timeoutMinutes = actionResult.timeoutMinutes || 60;
                    const nextRun = new Date(Date.now() + timeoutMinutes * 60 * 1000);

                    await supabase.from('workflow_runs').update({
                        status: 'waiting',
                        next_run_at: nextRun.toISOString(),
                        context: {
                            ...run.context,
                            [run.current_node_id]: actionResult
                        }
                    }).eq('id', run.id)
                    results.push({ runId: run.id, action: 'waiting_for_reply', nextRunAt: nextRun });
                    continue; // STOP here
                }


                // Find next node (follow 'replied' or 'next' edge on success, 'no_reply' on failure)
                // For check_qualification (Switch node), use the routeTo value from actionResult
                let edgeHandle: string[]

                if (currentNode.data.action === 'check_qualification' && actionResult?.routeTo) {
                    // Switch node: use the specific route
                    edgeHandle = [actionResult.routeTo]
                    console.log(`Switch node routing to: ${actionResult.routeTo}`)
                } else {
                    // Normal branching: replied/no_reply
                    edgeHandle = success ? ['replied', 'next'] : ['no_reply']
                }

                const nextEdge = steps.edges.find(e =>
                    e.source === currentNode.id &&
                    (!e.sourceHandle || edgeHandle.includes(e.sourceHandle))
                )

                if (nextEdge) {
                    const nextNode = steps.nodes.find(n => n.id === nextEdge.target)
                    const delayMinutes = nextNode?.data.delay_minutes || 0
                    const nextRunAt = new Date(Date.now() + delayMinutes * 60 * 1000)

                    await supabase
                        .from('workflow_runs')
                        .update({
                            current_node_id: nextEdge.target,
                            status: delayMinutes > 0 ? 'waiting' : 'pending',
                            next_run_at: nextRunAt.toISOString(),
                            context: { ...run.context, [currentNode.id]: actionResult }
                        })
                        .eq('id', run.id)
                } else {
                    // No next node = completed
                    await supabase
                        .from('workflow_runs')
                        .update({
                            status: 'completed',
                            completed_at: new Date().toISOString(),
                            context: { ...run.context, [currentNode.id]: actionResult }
                        })
                        .eq('id', run.id)
                }

                results.push({ runId: run.id, action: currentNode.data.action, success, actionResult })

            } catch (stepError: any) {
                console.error('Error processing run ' + run.id + ':', stepError)
                await supabase
                    .from('workflow_runs')
                    .update({ status: 'failed', context: { error: stepError.message } })
                    .eq('id', run.id)
                results.push({ runId: run.id, status: 'failed', error: stepError.message })
            }
        }

        return new Response(JSON.stringify({ processed: results.length, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error('execute-workflow-step error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})

// Action Handlers

async function executeCall(contact: any, agencyId: string, supabase: any, runId: string) {
    const phoneNumber = contact.phone || contact.primary_phone || (contact.phones && contact.phones[0])

    if (!phoneNumber) {
        return { success: false, error: 'No phone number' }
    }

    // Fetch agency Vapi settings
    const { data: agency } = await supabase
        .from('agencies')
        .select('vapi_settings')
        .eq('id', agencyId)
        .single()

    const settings = agency?.vapi_settings || {}

    const vapiPayload: any = {
        phoneNumberId: settings.phoneNumberId || '27d8b1ec-f601-443b-8fef-c0f8b01ae8f6',
        customer: {
            number: phoneNumber,
            name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
        },
        // IMPORTANT: Pass runId in metadata so webhook can find this run
        metadata: {
            workflow_run_id: runId,
            contact_id: contact.id,
            agency_id: agencyId
        }
    }

    // Use assistant config if provided
    if (settings.assistant) {
        vapiPayload.assistant = {
            ...settings.assistant,
            firstMessage: (settings.assistant.firstMessage || '')
                .replace('{{first_name}}', contact.first_name || 'there')
                .replace('{{marketing_source}}', contact.marketing_source || '')
        }
    } else {
        vapiPayload.assistantId = settings.assistantId || '5b11b405-2f31-4553-a3c1-814b2d1669f1'
        vapiPayload.assistantOverrides = {
            variableValues: {
                first_name: contact.first_name,
                buyer_id: contact.id
            }
        }
    }

    console.log('Use assistant config if provided...')

    console.log('Sending request to Vapi...')
    const res = await fetch('https://api.vapi.ai/call', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + Deno.env.get('VAPI_API_KEY'),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(vapiPayload)
    })

    console.log('Vapi response status:', res.status)

    if (!res.ok) {
        const errorData = await res.json()
        console.error('Vapi call failed:', errorData)
        // Log communication failure
        await supabase.from('contact_communications').insert({
            contact_id: contact.id,
            agency_id: agencyId,
            channel: 'ai_call',
            direction: 'out',
            status: 'failed',
            payload: { error: errorData }
        })
        return { success: false, error: errorData.message || 'Vapi call failed' }
    }

    const callData = await res.json()
    console.log('Vapi call initiated, ID:', callData.id)

    // Log communication
    console.log('Logging to contact_communications...')
    const { error: commError } = await supabase.from('contact_communications').insert({
        contact_id: contact.id,
        agency_id: agencyId,
        channel: 'ai_call',
        direction: 'out',
        status: 'sent',
        payload: { call_id: callData.id }
    })

    if (commError) {
        console.error('Error logging to contact_communications:', commError)
        // Do not fail the flow, just log
    }

    // Return 'waiting' status because we need to wait for the webhook
    return { success: true, status: 'waiting_for_callback', call_id: callData.id }
}

async function executeWhatsApp(contact: any, config: any, supabase: any) {
    console.log('Executing WhatsApp for contact:', contact.id);

    // 1. Get Agency and Settings from Contact's Agency
    // We can infer agency_id from contact if needed, but the planner passed it?
    // Wait, executeWhatsApp signature doesn't pass agencyId, but we need it.
    // We can get it from contact.agency_id if it exists, or update signature to pass it.
    // Looking at caller: `executeWhatsApp(contact, ...)`
    // Let's rely on contact.agency_id for now as it should be there.
    const agencyId = contact.agency_id;
    if (!agencyId) {
        return { success: false, error: 'Contact has no agency_id' };
    }

    const { data: agency, error: agError } = await supabase
        .from('agencies')
        .select('twilio_settings')
        .eq('id', agencyId)
        .single();

    if (agError || !agency) {
        return { success: false, error: 'Agency not found or settings missing' };
    }

    const settings = agency.twilio_settings || {};
    const fromNumber = settings.fromNumber; // e.g. "whatsapp:+123456789"

    if (!fromNumber) {
        return { success: false, error: 'No WhatsApp number assigned to this agency' };
    }

    // 2. Get Credentials (Global Secrets preferred, or Override)
    const accountSid = settings.accountSid || Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = settings.authToken || Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken) {
        return { success: false, error: 'Server configuration error: Missing Twilio Credentials' };
    }

    // 3. Prepare Message Payload
    const toNumber = contact.phone || contact.primary_phone || (contact.phones && contact.phones[0]);
    if (!toNumber) {
        return { success: false, error: 'Contact has no phone number' };
    }

    const recipient = toNumber.startsWith('whatsapp:') ? toNumber : `whatsapp:${toNumber}`;
    const sender = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

    const params = new URLSearchParams();
    params.append('From', sender);
    params.append('To', recipient);

    if (config.templateId) {
        // Content API Template
        // https://www.twilio.com/docs/content-api/sending-c-api-messages
        params.append('ContentSid', config.templateId);

        // Resolve variables
        if (config.variables) {
            const resolvedVars: Record<string, string> = {};
            for (const [varKey, field] of Object.entries(config.variables as Record<string, string>)) {
                // Skip static helper keys
                if (varKey.endsWith('_static')) continue;

                if (field === 'custom_static') {
                    resolvedVars[varKey] = config.variables[`${varKey}_static`] || '';
                } else {
                    // Get value from contact object
                    const value = contact[field];
                    resolvedVars[varKey] = value !== null && value !== undefined ? String(value) : '';
                }
            }
            if (Object.keys(resolvedVars).length > 0) {
                params.append('ContentVariables', JSON.stringify(resolvedVars));
            }
        }
    } else if (config.message) {
        // Free Text
        params.append('Body', config.message);
    } else {
        return { success: false, error: 'No templateId or message body provided' };
    }

    // 4. Send Request
    console.log(`Sending WhatsApp from ${sender} to ${recipient}`);

    // Using Basic Auth
    const authHeader = `Basic ${btoa(accountSid + ':' + authToken)}`;

    try {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('Twilio Send Error:', errText);

            // Log Failure
            await supabase.from('contact_communications').insert({
                contact_id: contact.id,
                agency_id: agencyId,
                channel: 'whatsapp',
                direction: 'out',
                status: 'failed',
                payload: { error: errText, config }
            });

            return { success: false, error: `Twilio Error: ${res.status} ${errText}` };
        }

        const data = await res.json();
        console.log('Twilio Message Sent, SID:', data.sid);

        // Log Success
        await supabase.from('contact_communications').insert({
            contact_id: contact.id,
            agency_id: agencyId,
            channel: 'whatsapp',
            direction: 'out',
            status: 'sent',
            payload: { sid: data.sid, config }
        });

        // Log to Chat History
        await supabase.from('chat_messages').insert({
            contact_id: contact.id,
            agency_id: agencyId,
            direction: 'outbound',
            channel: 'whatsapp',
            content: config.message || `Template: ${config.templateId}`,
            metadata: { sid: data.sid, templateId: config.templateId }
        });

        return { success: true, sid: data.sid };

    } catch (err: any) {
        console.error('Execute WhatsApp Exception:', err);
        return { success: false, error: err.message };
    }
}

async function executeEmail(contact: any, config: any, supabase: any) {
    // TODO: Integrate with Resend or other email provider
    console.log('Email action for contact: ' + contact.id)
    return { success: true, message: 'Email sending not implemented yet' }
}

async function executeCreateTask(contact: any, config: any, agencyId: string, supabase: any) {
    const { error } = await supabase.from('tasks').insert({
        contact_id: contact.id,
        agency_id: agencyId,
        title: config?.title || 'Follow up',
        status: 'open',
        due_at: new Date(Date.now() + (config?.delay_days || 1) * 24 * 60 * 60 * 1000).toISOString()
    })

    if (error) {
        return { success: false, error: error.message }
    }
    return { success: true }
}

// Route contact based on group membership (Switch node)
async function executeCheckQualification(contact: any, supabase: any, config?: any) {
    console.log(`Routing contact ${contact.id} (Switch Node)`)

    // Default fallback
    const defaultOutput = 'default'
    const outputs = config?.outputs || []

    // Quick legacy check or if no outputs configured
    if (!outputs.length) {
        return {
            qualified: true,
            // routeTo: defaultOutput, // Remove specific route to allow generic traversal
            status: 'default',
            message: 'No outputs configured, routing via generic edge'
        }
    }

    try {
        // Fetch contact's groups
        const { data: memberships, error } = await supabase
            .from('contact_group_members')
            .select('group_id')
            .eq('contact_id', contact.id)

        if (error) {
            console.error('Error fetching group memberships:', error)
            throw error
        }

        console.log(`outputs config:`, JSON.stringify(outputs))

        const contactGroupIds = new Set((memberships || []).map((m: any) => m.group_id))

        // Also check the single group_id on the contact record (Legacy/Simple support)
        if (contact.group_id) {
            contactGroupIds.add(contact.group_id)
        }

        console.log(`Contact raw data: group_id=${contact.group_id}, contact_id=${contact.id}`)
        console.log(`Resolved contactGroupIds:`, Array.from(contactGroupIds))

        // Find matching output
        let matchedOutput = defaultOutput
        let matchedGroupName = 'Default'

        // Iterate through configured outputs in order
        for (const output of outputs) {
            // Handle both legacy string outputs and new object outputs
            const outputId = typeof output === 'string' ? output : output.id
            const outputName = typeof output === 'string' ? output : output.name

            // Check if this output is 'default' (fallback)
            if (outputId === 'default') {
                // We don't "match" default immediately, we use it as fallback if no other groups match
                // BUT if we want "default" to catch things explicitly defined in valid outputs list...
                // Actually, logic is: try to find a specific group match. If none found, use 'default' 
                // IF 'default' is one of the outputs.
                continue
            }

            // Check if contact is in this group
            if (contactGroupIds.has(outputId)) {
                matchedOutput = outputId
                matchedGroupName = outputName
                break // Stop at first match (priority based on order in config)
            }
        }

        // If no specific group matched, check if 'default' is an available route
        let finalRouteTo = matchedOutput;
        if (matchedOutput === defaultOutput) {
            const hasDefault = outputs.includes('default') || outputs.some((o: any) => o.id === 'default' || o.name === 'default');
            if (!hasDefault) {
                // If default is not explicitly configured, use generic edge traversal (undefined routeTo)
                finalRouteTo = undefined as any;
            }
        }

        console.log(`Contact routing result: ${matchedGroupName} (${matchedOutput}) -> Edge: ${finalRouteTo || 'Generic'}`)

        return {
            qualified: true,
            routeTo: finalRouteTo,
            status: matchedOutput,
            message: `Routed to ${matchedGroupName}`
        }

    } catch (err) {
        console.error('Error in executeCheckQualification:', err)
        // Fallback on error
        return {
            qualified: true,
            routeTo: defaultOutput,
            status: 'error',
            message: 'Error checking groups, routed to default'
        }
    }
}

// Auto-assign agent with fewest leads
async function executeAssignAgent(contact: any, agencyId: string, supabase: any, config?: any) {
    const strategy = config?.strategy || 'least_leads'
    console.log(`Assigning agent for contact ${contact.id} with strategy: ${strategy}`)

    try {
        // Get deal for this contact
        const { data: deal } = await supabase
            .from('deals')
            .select('id, segment, budget_max, type')
            .eq('contact_id', contact.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        // Get available agents in this agency
        const { data: agents, error: agentError } = await supabase
            .from('profiles')
            .select('id, full_name, languages, specializations, experience_years, target_segments, max_active_leads, available_for_assignment')
            .eq('agency_id', agencyId)
            .eq('available_for_assignment', true)

        if (agentError || !agents || agents.length === 0) {
            // Fallback: try memberships table
            const { data: memberships } = await supabase
                .from('memberships')
                .select('user_id')
                .eq('agency_id', agencyId)
                .eq('active', true)

            if (!memberships || memberships.length === 0) {
                console.warn('No agents found in agency')
                return { success: false, error: 'No agents available' }
            }

            // Get profiles for these users
            const userIds = memberships.map((m: any) => m.user_id)
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, languages, specializations, experience_years, target_segments, max_active_leads, available_for_assignment')
                .in('id', userIds)

            if (!profiles || profiles.length === 0) {
                return { success: false, error: 'No agent profiles found' }
            }

            // Continue with these profiles
            return await processAssignment(contact, deal, profiles, agencyId, supabase, strategy)
        }

        return await processAssignment(contact, deal, agents, agencyId, supabase, strategy)

    } catch (err: any) {
        console.error('executeAssignAgent error:', err)
        return { success: false, error: err.message }
    }
}

async function processAssignment(contact: any, deal: any, agents: any[], agencyId: string, supabase: any, strategy: string) {
    // Count active leads per agent
    const agentIds = agents.map((a: any) => a.id)
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

    // Add load info and filter by capacity
    const agentsWithLoad = agents.map((a: any) => ({
        ...a,
        active_leads: leadsPerAgent[a.id] || 0,
        max_leads: a.max_active_leads || 20
    })).filter((a: any) => a.active_leads < a.max_leads)

    if (agentsWithLoad.length === 0) {
        return { success: false, error: 'All agents at capacity' }
    }

    let selectedAgent: any

    if (strategy === 'always_admin') {
        // Pick first available agent (ideally would check for admin role)
        selectedAgent = agentsWithLoad[0]

    } else if (strategy === 'smart' && deal) {
        // Use LLM-based matching
        selectedAgent = await smartMatch(contact, deal, agentsWithLoad, supabase)

    } else {
        // Default: least_leads - simple round robin
        agentsWithLoad.sort((a: any, b: any) => a.active_leads - b.active_leads)
        selectedAgent = agentsWithLoad[0]
    }

    console.log(`Selected agent: ${selectedAgent.full_name || selectedAgent.id} (load: ${selectedAgent.active_leads}/${selectedAgent.max_leads})`)

    // Update deal with assigned agent
    if (deal) {
        await supabase
            .from('deals')
            .update({ primary_agent_id: selectedAgent.id })
            .eq('id', deal.id)
    }

    // Update contact
    await supabase
        .from('contacts')
        .update({
            assigned_agent_id: selectedAgent.id,
            owner: selectedAgent.id, // Frontend uses this field
            current_status: 'assigned'
        })
        .eq('id', contact.id)

    return {
        success: true,
        agentId: selectedAgent.id,
        agentName: selectedAgent.full_name,
        message: `Assigned to ${selectedAgent.full_name || 'agent'}`
    }
}

async function smartMatch(contact: any, deal: any, agents: any[], supabase: any) {
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiKey) {
        console.warn('OpenAI key not configured, falling back to least_leads')
        return agents.sort((a: any, b: any) => a.active_leads - b.active_leads)[0]
    }

    // Get contact profile for language/nationality
    const { data: contactProfile } = await supabase
        .from('contact_profiles')
        .select('nationality, language_primary, residence_country, a_class, b_class')
        .eq('contact_id', contact.id)
        .maybeSingle()

    const agentDescriptions = agents.map((a: any, i: number) =>
        `Agent ${i + 1} (ID: ${a.id}): Name: ${a.full_name || 'Unknown'}, Languages: ${(a.languages || []).join(', ') || 'Any'}, Experience: ${a.experience_years || 0} years, Load: ${a.active_leads}/${a.max_leads}`
    ).join('\n')

    const clientInfo = `Nationality: ${contactProfile?.nationality || 'Unknown'}, Language: ${contactProfile?.language_primary || 'Unknown'}, Segment: ${deal.segment}, Budget: ${deal.budget_max || 'Unknown'}`

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openAiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a lead assignment AI. Match clients to agents prioritizing: 1) Language match 2) Load balancing. Return JSON with selected_agent_id.'
                    },
                    {
                        role: 'user',
                        content: `AGENTS:\n${agentDescriptions}\n\nCLIENT: ${clientInfo}\n\nSelect best agent ID.`
                    }
                ],
                functions: [{
                    name: 'select_agent',
                    parameters: {
                        type: 'object',
                        properties: {
                            selected_agent_id: { type: 'string' }
                        },
                        required: ['selected_agent_id']
                    }
                }],
                function_call: { name: 'select_agent' }
            })
        })

        const aiData = await response.json()
        const result = JSON.parse(aiData.choices?.[0]?.message?.function_call?.arguments || '{}')

        const matched = agents.find((a: any) => a.id === result.selected_agent_id)
        if (matched) {
            console.log(`LLM selected: ${matched.full_name}`)
            return matched
        }
    } catch (err) {
        console.error('Smart matching failed:', err)
    }

    // Fallback
    return agents.sort((a: any, b: any) => a.active_leads - b.active_leads)[0]
}

// Mark lead as lost
async function executeMarkAsLost(contact: any, supabase: any) {
    console.log(`Marking contact ${contact.id} as lost`)

    try {
        // 1. Update Contact Status
        const { error: contactError } = await supabase
            .from('contacts')
            .update({ current_status: 'lost' })
            .eq('id', contact.id)

        if (contactError) throw contactError

        // 2. Update Deal Status (if exists)
        if (contact.current_deal_id) {
            const { error: dealError } = await supabase
                .from('deals')
                .update({ status: 'lost' })
                .eq('id', contact.current_deal_id)

            if (dealError) throw dealError
        }

        return {
            success: true,
            message: 'Marked contact and deal as lost'
        }
    } catch (err: any) {
        console.error('Error marking as lost:', err)
        return { success: false, error: err.message }
    }
}

