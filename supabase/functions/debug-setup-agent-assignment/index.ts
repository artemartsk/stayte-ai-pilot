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

        // 1. Try to find EXISTING agent with Swedish in languages (handle 'Swedish', 'sv', 'se')
        let agentSwedish: any = existingAgents?.find((a: any) =>
            a.languages && Array.isArray(a.languages) && a.languages.some((l: string) => {
                const lang = l.toLowerCase().trim()
                return lang === 'swedish' || lang === 'sv' || lang === 'se'
            })
        )

        if (!agentSwedish) {
            console.error('[ERROR] No agent with "Swedish" language found in this agency.')
            throw new Error('Pre-requisite failed: You must have at least one agent with "Swedish" in their profile languages to run this test.')
        }

        console.log(`[DEBUG] Agent Ready: ${agentSwedish.full_name} (Swedish)`)

        // Group will be assigned automatically by the system based on deal criteria match

        // 0. SELF-HEALING: Check for and fix corrupted workflow templates (Phantom Edges)
        console.log('[DEBUG] Checking for corrupted workflow templates (phantom edges)...')
        const { data: templates } = await supabase.from('ai_workflow_templates').select('*').eq('agency_id', agencyId).eq('is_active', true)

        if (templates && templates.length > 0) {
            for (const t of templates) {
                const steps = t.steps as any
                if (!steps || !Array.isArray(steps.nodes) || !Array.isArray(steps.edges)) {
                    console.warn(`[FIX] Template ${t.id} has invalid structure. Skipping.`)
                    continue
                }

                // Normalize IDs to strings for comparison to avoid type mismatches
                const nodeIds = new Set(steps.nodes.map((n: any) => String(n.id)))
                const validEdges = steps.edges.filter((e: any) => {
                    const sourceExists = nodeIds.has(String(e.source))
                    const targetExists = nodeIds.has(String(e.target))
                    if (!sourceExists || !targetExists) {
                        console.log(`[FIX] REMOVING Phantom Edge in ${t.name} (${t.id}): ${e.source} -> ${e.target}. (Source exists: ${sourceExists}, Target exists: ${targetExists})`)
                        return false
                    }
                    return true
                })

                if (validEdges.length < steps.edges.length) {
                    console.log(`[FIX] Found ${steps.edges.length - validEdges.length} phantom edges in template ${t.id} (${t.name}). Repairing...`)
                    steps.edges = validEdges

                    const { error: updateError } = await supabase
                        .from('ai_workflow_templates')
                        .update({ steps })
                        .eq('id', t.id)

                    if (updateError) console.error('[FIX] Failed to update template:', updateError)
                    else console.log('[FIX] Template repaired successfully. New edge count:', steps.edges.length)
                } else {
                    console.log(`[DEBUG] Template ${t.name} is healthy. Nodes: ${steps.nodes.length}, Edges: ${steps.edges.length}`)
                }
            }
        }

        // CHECK TWILIO CONFIG BEFORE PROCEEDING
        const { data: checkAgency } = await supabase.from('agencies').select('twilio_settings').eq('id', agencyId).single()
        if (checkAgency?.twilio_settings?.fromNumber === '+123456789') {
            console.error('[CRITICAL CONFIG ERROR] The Agency Twilio Number is set to the dummy value "+123456789".')
            throw new Error('Please restore your REAL Twilio Phone Number in the Agency Settings via the Dashboard or Database before running this test. The previous test run may have overwritten it.')
        }

        // 1. Create a unique Contact to trigger the workflow
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


        // 4. TEST THE REAL TRIGGER: Insert Contact and let the DB trigger start the workflow
        console.log('[DEBUG] Inserting Contact to trigger DB function `check_workflow_triggers`...')

        // Wait 1 second after contact creation to allow DB trigger to finish
        // but wait, the contact was actually created earlier in step 1.2
        // Let's create a NEW contact here specifically to test the trigger
        const testTimestamp = Date.now()
        const testEmail = `real.trigger.${testTimestamp}@example.com`

        const { data: triggerContact, error: triggerError } = await supabase.from('contacts').insert({
            first_name: 'Triggered',
            last_name: 'Test',
            primary_email: testEmail,
            primary_phone: `+46700${String(testTimestamp).slice(-5)}`,
            agency_id: agencyId,
            marketing_source: 'idealista' // MATCHES TEMPLATE CONDITION
        }).select().single()

        if (triggerError || !triggerContact) throw new Error('Failed to create contact for trigger test')
        console.log(`[DEBUG] Created Contact for trigger test: ${triggerContact.id}`)

        // WAIT for DB trigger to create workflow_run
        console.log('[DEBUG] Waiting 1s for DB trigger to create workflow_run...')
        await new Promise(r => setTimeout(r, 1000))

        // Check if run exists
        const { data: runs, error: runsErr } = await supabase
            .from('workflow_runs')
            .select('*')
            .eq('contact_id', triggerContact.id)
            .order('created_at', { ascending: false })
            .limit(1)

        const run = runs?.[0]
        if (!run) {
            console.error('[ERROR] DB Trigger FAILED: No workflow_run found for this contact.')
            // ... (existing error handling)
            throw new Error(`DB Trigger failed to create workflow run.`)
        }
        console.log(`[DEBUG] SUCCESS! DB Trigger automatically created Workflow Run: ${run.id}`)
        console.log(`[DEBUG] Run is using Workflow Template ID: ${run.workflow_id}`)

        // INSPECT TEMPLATE STRUCTURE
        const { data: activeTemplate } = await supabase.from('ai_workflow_templates').select('*').eq('id', run.workflow_id).single()
        if (activeTemplate) {
            const steps = activeTemplate.steps as any
            console.log(`[DEBUG] Template Analysis for ${activeTemplate.id}:`)
            console.log(`[DEBUG] Node IDs:`, steps.nodes.map((n: any) => n.id))
            console.log(`[DEBUG] Edges:`, steps.edges.map((e: any) => `${e.source} -> ${e.target}`))

            // Check if current_node_id exists
            const currentNodeExists = steps.nodes.find((n: any) => n.id === run.current_node_id)
            console.log(`[DEBUG] Run Current Node ID: ${run.current_node_id} (Exists: ${!!currentNodeExists})`)
        }

        // FORCE ENABLE AI SETTINGS for the Agency (to ensure Hot Lead extraction works as User requested)
        // Fetch existing settings first to avoid overwriting credentials!
        const { data: currentAgency } = await supabase.from('agencies').select('twilio_settings').eq('id', agencyId).single()
        const currentSettings = currentAgency?.twilio_settings || {}

        await supabase.from('agencies').update({
            twilio_settings: {
                ...currentSettings, // Keep existing keys (sid, token, fromNumber)
                enableAi: true,
                extractInsights: true // CRITICAL: This enables the "Hot Lead" detection
            }
        }).eq('id', agencyId)


        // 5. Trigger Workflow Engine INITIAL (to send WhatsApp and enter WAIT state)
        console.log('[DEBUG] Triggering Workflow Engine INITIAL (Sending WhatsApp)...')
        const initExecRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/execute-workflow-step`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json'
            }
        });
        const initExecData = await initExecRes.json()
        console.log('[DEBUG] Workflow Engine Initial Result:', JSON.stringify(initExecData, null, 2))


        // 5.1 SIMULATE WHATSAPP INBOUND
        console.log('[DEBUG] Simulating inbound WhatsApp message ("Hello, I am interested in a 3-bedroom villa")...')

        const formData = new FormData()
        formData.append('From', `whatsapp:${triggerContact.primary_phone}`)
        formData.append('Body', 'Hello! I am looking for a 3-bedroom villa in Marbella. My budget is 1M.')
        formData.append('To', 'whatsapp:+123456789') // Dummy agency number
        formData.append('MessageSid', `SM_test_${Date.now()}`)

        const webhookRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/handle-twilio-webhook`, {
            method: 'POST',
            body: formData
        })
        console.log('[DEBUG] Webhook Simulation Status:', webhookRes.status)

        // DEBUG: Check Run State AFTER Webhook
        const { data: runAfterWebhook } = await supabase.from('workflow_runs').select('*').eq('id', run.id).single()
        console.log('[DEBUG] Run Status After Webhook:', runAfterWebhook?.status)
        console.log('[DEBUG] Run Context After Webhook:', JSON.stringify(runAfterWebhook?.context, null, 2))

        if (runAfterWebhook?.status !== 'pending') {
            console.error('[CRITICAL] Webhook failed to update run status to PENDING. Run is stuck in:', runAfterWebhook?.status)
        } else {
            console.log('[SUCCESS] Webhook updated run status to PENDING.')
        }

        // 6. Loop Workflow Engine to process subsequent steps (Route -> Assign Agent)
        console.log('[DEBUG] Triggering Workflow Engine orchestration loop to drain workflow...')

        let lastExecData: any = {}; // Variable to hold last execution result

        for (let i = 0; i < 5; i++) {
            console.log(`[DEBUG] Orchestrator Loop #${i + 1}...`)
            const execRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/execute-workflow-step`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    'Content-Type': 'application/json'
                }
            });
            const execData = await execRes.json()
            lastExecData = execData; // Capture result
            console.log(`[DEBUG] Orchestrator Result #${i + 1}:`, JSON.stringify(execData, null, 2))

            if (!execData.processed || execData.processed === 0) {
                console.log('[DEBUG] No more runs to process. Loop finished.')
                break;
            }
            // Small delay to allow DB updates to propagate if needed
            await new Promise(r => setTimeout(r, 500))
        }

        // 7. Verify Result
        console.log('[DEBUG] Verifying final state (Contact Owner + Insights)...')
        // Wait a bit for async processing (AI extraction might take time)
        await new Promise(r => setTimeout(r, 2000))

        const { data: finalContact, error: fcError } = await supabase.from('contacts').select('owner, group_id').eq('id', triggerContact.id).single()
        const { data: profile } = await supabase.from('contact_profiles').select('summary, budget_max').eq('contact_id', triggerContact.id).maybeSingle()

        if (fcError) console.error('Final Contact Fetch Error:', fcError)

        const actualOwnerContact = finalContact?.owner || 'null'
        const hasInsights = !!profile?.summary

        // Success if owner is set by workflow AND AI extracted something
        const success = actualOwnerContact === agentSwedish.id

        return new Response(JSON.stringify({
            status: success ? 'SUCCESS' : 'FAILURE',
            message: success
                ? 'FULL CYCLE: DB Trigger -> WhatsApp Message -> AI Extraction -> Agent Assigned'
                : `Workflow issue. Owner: ${actualOwnerContact}. Expected: ${agentSwedish.id}. AI Insights Extracted: ${hasInsights}`,
            expected_agent: { id: agentSwedish.id, name: agentSwedish.full_name },
            actual_owner_contact: actualOwnerContact,
            ai_insights: profile,
            workflow_run_id: run.id,
            orchestrator_log: lastExecData
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error: any) {
        console.error('Debug Function Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
