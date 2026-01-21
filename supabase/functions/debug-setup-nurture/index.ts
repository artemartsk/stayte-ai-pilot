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

        console.log('--- [DEBUG] Starting Debug Setup Nurture (Full AI Simulation) ---');

        // 1. Use Specific Test Agency
        const agencyId = '00000000-0000-0000-0000-000000000001'
        console.log(`[DEBUG] Using Agency ID: ${agencyId}`)

        // 2. Create Test Contact
        const timestamp = Date.now()
        const contactEmail = `test_ai_${timestamp}@example.com`
        const contactPhone = `+346${String(timestamp).slice(-8)}` // Unique phone per run
        console.log(`[DEBUG] Creating Contact with email: ${contactEmail}, phone: ${contactPhone}`)


        const { data: contact, error: contactErr } = await supabase
            .from('contacts')
            .insert({
                first_name: 'Test',
                last_name: `AI_Sim_${timestamp}`,
                primary_email: contactEmail,
                primary_phone: contactPhone, // Set phone
                agency_id: agencyId
            })

            .select()
            .single()

        if (contactErr) {
            console.error('[ERROR] Failed to create contact:', contactErr)
            throw contactErr
        }
        console.log(`[DEBUG] Created Contact: ${contact.id}`)

        // 3. Create or Fetch Test Deal
        console.log('[DEBUG] Checking if deal already exists for contact...')
        let { data: deal, error: dealFetchErr } = await supabase
            .from('deals')
            .select('*')
            .eq('contact_id', contact.id)
            .eq('type', 'buy')
            .maybeSingle()

        if (!deal) {
            console.log('[DEBUG] No deal found, creating fresh deal...')
            const { data: newDeal, error: dealErr } = await supabase
                .from('deals')
                .insert({
                    contact_id: contact.id,
                    agency_id: agencyId,
                    status: 'new',
                    type: 'buy',
                    ai_mode: 'autopilot',
                    segment: 'hot',
                    budget_max: 0,
                    commission_value: 0
                })
                .select()
                .single()

            if (dealErr) {
                console.error('[ERROR] Failed to create deal:', dealErr)
                throw dealErr
            }
            deal = newDeal
        }

        console.log(`[DEBUG] Using Deal: ${deal.id}`)


        await supabase.from('contacts').update({ current_deal_id: deal.id }).eq('id', contact.id)
        console.log('[DEBUG] Linked Deal to Contact')


        // 4. Use Specific Workflow Template ("Idealista")
        const workflowId = 'a354c202-2b57-47c0-ab43-61c0c42e3992'

        // Target Node: "Calling" (Step 1)
        // ID: "1"
        const startNodeId = '1'
        console.log(`[DEBUG] Setting up Workflow Run for ID: ${workflowId} at Node: ${startNodeId}`)

        // 5. Insert Workflow Run at "Calling" node
        const { data: run, error: runErr } = await supabase
            .from('workflow_runs')
            .insert({
                workflow_id: workflowId,
                contact_id: contact.id,
                agency_id: agencyId,
                status: 'pending', // Waiting to be picked up (or we simulate it's waiting for call end)
                current_node_id: startNodeId,
                next_run_at: new Date().toISOString(),
                context: {
                    'trigger': { triggered: true }
                }
            })
            .select()
            .single()

        if (runErr) {
            console.error('[ERROR] Failed to create workflow run:', runErr)
            throw runErr
        }
        console.log(`[DEBUG] Created Workflow Run: ${run.id}`)

        // 6. Simulate Vapi Webhooks
        const transcript = `
        Speaker 0: Hello?
        Speaker 1: Hi, is this Artem?
        Speaker 0: Yes, speaking.
        Speaker 1: Hi Artem, I'm calling from State Real Estate. You left an inquiry on our website. Do you have a minute?
        Speaker 0: Yes, sure.
        Speaker 1: Great. I see you're looking for a property in Malaga. Could you tell me a bit more about what you're looking for?
        Speaker 0: Well, I'm looking for a villa. I need at least 3 bedrooms. My budget is around 300000 Euros. I'm looking to buy in the next 3 months.
        Speaker 1: Okay, understood. A villa with 3 bedrooms, around 300k. Are you looking ideally in Malaga city or surroundings?
        Speaker 0: Surroundings are fine.
        Speaker 1: Perfect. I'll send you some options. Goodbye.
        `

        console.log(`[DEBUG] Simulating Vapi Webhooks...`)

        // A. Status Update (Ended)
        console.log('[DEBUG] Sending status-update...')
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/handle-vapi-webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: {
                    type: 'status-update',
                    status: 'ended',
                    endedReason: 'customer-ended-call',
                    call: {
                        id: 'test-call-' + timestamp,
                        metadata: { workflow_run_id: run.id, contact_id: contact.id, agency_id: agencyId }
                    }
                }
            })
        });

        // B. End of Call Report
        console.log('[DEBUG] Sending end-of-call-report...')
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/handle-vapi-webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: {
                    type: 'end-of-call-report',
                    transcript: transcript,
                    call: {
                        id: 'test-call-' + timestamp,
                        metadata: { workflow_run_id: run.id, contact_id: contact.id, agency_id: agencyId }
                    }
                }
            })
        });

        console.log('[DEBUG] Webhook simulation finished. Waiting for async processing...')
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 7. Advance Workflow
        console.log('[DEBUG] Triggering Workflow Step Execution Loop...')
        const executionResults = []
        for (let i = 1; i <= 3; i++) {
            console.log(`[DEBUG] Triggering Execution #${i}`)
            const execRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/execute-workflow-step`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await execRes.json();
            executionResults.push(data)
            await new Promise(resolve => setTimeout(resolve, 2000))
        }

        // 7.1 Re-trigger update to check for race condition
        console.log('[DEBUG] Re-triggering contact update to ensure data propagation...')
        await supabase.from('contacts').update({ updated_at: new Date().toISOString() }).eq('id', contact.id)
        await new Promise(resolve => setTimeout(resolve, 1000))

        // 8. Check Final State and Debug Groups
        const { data: finalDeal } = await supabase.from('deals').select('*').eq('id', deal.id).single();
        const { data: finalContact } = await supabase.from('contacts').select('group_id').eq('id', contact.id).single();

        // Debug: Fetch all groups to see why assignment failed
        const { data: groups } = await supabase.from('contact_groups').select('id, name, filter_criteria');

        // Debug: Preferences are now directly in the deal object (merged schema)
        const prefs = finalDeal;

        // JS Matcher Logic for debugging
        const jsMatches = groups?.map(group => {
            const filter = group.filter_criteria || {};
            const budget = prefs?.max_budget || prefs?.budget;
            const propertyType = prefs?.type_villa ? 'villa' : (prefs?.type_apartment ? 'apartment' : null);

            const results = {
                id: group.id,
                name: group.name,
                matches: true,
                reasons: [] as string[]
            };

            if (filter.minBudget && budget && budget < filter.minBudget) { results.matches = false; results.reasons.push(`Budget ${budget} < Min ${filter.minBudget}`); }
            if (filter.maxBudget && budget && budget > filter.maxBudget) { results.matches = false; results.reasons.push(`Budget ${budget} > Max ${filter.maxBudget}`); }
            if (filter.minBedrooms && prefs?.bedrooms && prefs.bedrooms < filter.minBedrooms) { results.matches = false; results.reasons.push(`Bedrooms ${prefs.bedrooms} < Min ${filter.minBedrooms}`); }
            if (filter.propertyType && propertyType && filter.propertyType.toLowerCase() !== propertyType.toLowerCase()) { results.matches = false; results.reasons.push(`Type ${propertyType} != ${filter.propertyType}`); }

            return results;
        });

        return new Response(JSON.stringify({
            status: 'success',
            deal: finalDeal,
            contact_group_id: finalContact?.group_id,
            debug: {
                groups: groups,
                preferences: prefs,
                js_matching_results: jsMatches,
                match_logic_hint: "Check 'filter_criteria' matches 'preferences' keys"
            },
            executions: executionResults
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error('[FATAL] Debug Function Crash:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
});
