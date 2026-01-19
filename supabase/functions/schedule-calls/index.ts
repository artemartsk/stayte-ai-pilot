
import { createClient } from 'jsr:@supabase/supabase-js@2'

const MAX_SCORE = 100.0;
const VAPI_URL = "https://api.vapi.ai/call";
const ASSISTANT_ID_UK = "5b11b405-2f31-4553-a3c1-814b2d1669f1"; // From n8n "phoneNumberId": ... "name": "UK Isobella"

// Define interfaces for type safety
interface Contact {
    id: string;
    first_name: string;
    email: string;
    phone: string;
    marketing_source: string;
    call_attempts: number;
    call_today_count: number;
    last_call_at: string | null;
    // ... other fields as needed
}

interface Task {
    id: string;
    contact_id: string;
    // ...
}

interface ScoreRecord {
    contact: Contact;
    task: Task;
    score: number;
}

Deno.serve(async (req) => {
    // 1. Init Supabase Client
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
        // 2. Fetch Tasks (Open calls due now or earlier)
        const { data: tasks, error: taskError } = await supabase
            .from('tasks')
            .select(`
        id,
        contact_id,
        title,
        contacts!inner (
          id, first_name, email, phone, marketing_source,
          call_attempts, call_today_count, last_call_at, qualification_status
        )
      `)
            .eq('title', 'call')
            .eq('status', 'open')
            .lte('due_at', new Date().toISOString())
            .limit(1000); // Safety limit for scalability foundation

        if (taskError) throw taskError;
        if (!tasks || tasks.length === 0) {
            return new Response(JSON.stringify({ message: 'No tasks to process' }), { headers: { 'Content-Type': 'application/json' } });
        }

        // 3. Score candidates
        const scoredCandidates: ScoreRecord[] = [];
        const now = new Date();

        for (const task of tasks) {
            const contact = task.contacts as unknown as Contact;

            // Filter Logic (from n8n)
            if (!contact) continue;
            if (contact.call_attempts >= 7) continue;
            if (contact.call_today_count >= 2) continue;
            if (['stop', 'failed', 'qualified'].includes(contact.qualification_status || '')) continue;

            // Phone filters (simplified from n8n)
            if (!contact.phone) continue;
            // TODO: Add specific phone number filters if strictly required (e.g. +44 exclusion)

            // Scoring Logic
            let score = 0.0;
            const attempts = contact.call_attempts || 0;

            if (attempts === 0) {
                score = MAX_SCORE;
            } else if (attempts > 7) {
                score = 0.0;
            } else {
                // Calculate hours since last interaction
                let lastInteraction = contact.last_call_at ? new Date(contact.last_call_at) : null;
                // Fallback to recent conversion if needed, but for now simplify

                if (!lastInteraction) {
                    score = 0.0; // Should satisfy attempts > 0 condition usually
                } else {
                    const diffMs = now.getTime() - lastInteraction.getTime();
                    const hoursSince = diffMs / (1000 * 60 * 60);

                    if (hoursSince < 1) {
                        score = 0.0; // Too soon
                    } else {
                        score = hoursSince / (attempts + 1);
                    }
                }
            }

            if (score > 0) {
                scoredCandidates.push({ contact, task: task as Task, score });
            }
        }

        if (scoredCandidates.length === 0) {
            return new Response(JSON.stringify({ message: 'No candidates matched criteria' }), { headers: { 'Content-Type': 'application/json' } });
        }

        // 4. Select Best Candidates (Batch Processing)
        scoredCandidates.sort((a, b) => b.score - a.score);

        // Configurable Batch Size (Start small to respect Vapi limits)
        const BATCH_SIZE = 5;
        const selectedCandidates = scoredCandidates.slice(0, BATCH_SIZE);

        console.log(`Processing ${selectedCandidates.length} candidates (Top score: ${selectedCandidates[0]?.score})`);

        const results = [];

        // 5. Initiate Calls (Parallel Requests)
        for (const candidate of selectedCandidates) {
            const { contact, task } = candidate;

            try {
                // Fetch Agency Settings if available
                let agencySettings: any = {};
                if (task.agency_id) {
                    const { data: agency } = await supabase
                        .from('agencies')
                        .select('vapi_settings')
                        .eq('id', task.agency_id)
                        .single();

                    if (agency?.vapi_settings) {
                        agencySettings = agency.vapi_settings;
                    }
                }

                // Default Vapi Payload
                let vapiPayload: any = {
                    assistantId: ASSISTANT_ID_UK,
                    assistantOverrides: {
                        variableValues: {
                            first_name: contact.first_name,
                            buyer_id: contact.id
                        }
                    },
                    customer: {
                        number: contact.phone
                    },
                    phoneNumberId: "3c383b83-9535-43ca-999d-708dfbe0fe94"
                };

                // Merge Agency Settings (Deep merge logic simplified)
                if (Object.keys(agencySettings).length > 0) {
                    // If agency provides specific assistant ID or full config
                    if (agencySettings.assistantId) {
                        vapiPayload.assistantId = agencySettings.assistantId;
                    }
                    // If agency provides assistant overrides (e.g. system prompt or name)
                    if (agencySettings.assistant) {
                        vapiPayload.assistant = {
                            ...vapiPayload.assistant, // defaults if any (none in base payload)
                            ...agencySettings.assistant
                        };

                        // Inject variables into Custom Assistant logic if needed
                        // For now assuming agencySettings.assistant is the full object structure from n8n 
                        // We need to ensure dynamic variables ({{ first_name }}) are handled or pre-filled.
                        // Vapi supports variable injection via assistantOverrides, so we shouldn't hardcode values in 'assistant' object
                        // unless we use Vapi's templating.
                    }

                    // Merge other top-level keys
                    if (agencySettings.phoneNumberId) vapiPayload.phoneNumberId = agencySettings.phoneNumberId;

                    // Ensure critical variableValues are preserved/merged
                    if (agencySettings.assistantOverrides?.variableValues) {
                        vapiPayload.assistantOverrides.variableValues = {
                            ...vapiPayload.assistantOverrides.variableValues,
                            ...agencySettings.assistantOverrides.variableValues
                        };
                    }
                }
                const vapiRes = await fetch(VAPI_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${Deno.env.get('VAPI_API_KEY')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(vapiPayload)
                });

                if (!vapiRes.ok) {
                    const errText = await vapiRes.text();
                    console.error(`Failed to call ${contact.email}: ${errText}`);
                    results.push({ contact: contact.email, status: 'failed', error: errText });
                    continue;
                }

                const callData = await vapiRes.json();

                // Increment counters locally to update DB safely
                await supabase.from('contacts').update({
                    call_attempts: (contact.call_attempts || 0) + 1,
                    call_today_count: (contact.call_today_count || 0) + 1,
                    last_call_at: now.toISOString()
                }).eq('id', contact.id);

                // Update Task
                await supabase.from('tasks').update({
                    status: 'completed',
                    updated_at: now.toISOString()
                }).eq('id', task.id);

                // Create Comm Log
                await supabase.from('contact_communications').insert({
                    contact_id: contact.id,
                    agency_id: task.agency_id || '00000000-0000-0000-0000-000000000001', // Fallback if not fetched
                    channel: 'ai_call',
                    direction: 'out',
                    status: 'sent',
                    payload: { call_id: callData.id }
                });

                results.push({ contact: contact.email, callId: callData.id, status: 'initiated' });

                // Add a small delay between calls to be safe and respect rate limits
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

            } catch (innerErr) {
                console.error(`Error processing candidate ${contact.id}:`, innerErr);
                results.push({ contact: contact.email, status: 'error', error: innerErr.message });
            }
        }

        return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
