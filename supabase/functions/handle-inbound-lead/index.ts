
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { OpenAI } from "https://deno.land/x/openai@v4.20.0/mod.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const body = await req.json();
        console.log('Received inbound lead payload:', JSON.stringify(body, null, 2));

        let leadData: any = {};
        let agencyId: string | null = null;
        let rawContent = '';
        let source = 'unknown';

        // 1. Identify Case: Email (Resend) vs Direct Webhook
        if (body.to && (body.text || body.html)) {
            // Case: Email from Resend Inbound
            source = 'email';
            rawContent = `Subject: ${body.subject}\n\n${body.text || body.html}`;

            // Extract agency ID from 'to' address (e.g. 550e8400-e29b-41d4-a716-446655440000@leads...)
            // Handle formats like "My Agency <uuid@leads...>" or just "uuid@leads..."
            const toStr = String(body.to).toLowerCase();
            const uuidMatch = toStr.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

            if (uuidMatch) {
                agencyId = uuidMatch[0];
                console.log(`Extracted agencyId ${agencyId} from To: ${toStr}`);
            } else {
                console.error(`Invalid To address format: ${toStr}`);
                throw new Error(`Could not extract agency UUID from To address: ${toStr}`);
            }
        } else if (body.agency_id) {
            // Case: Direct Webhook / Manual Trigger
            source = body.source || 'direct_webhook';
            agencyId = body.agency_id;
            leadData = body.lead || body;
            rawContent = JSON.stringify(body);
        } else {
            // Check for Idealista specific patterns if they send a different JSON
            // For now, fail if we can't identify the agency
            return new Response(JSON.stringify({ error: 'Unsupported payload format or missing agency_id' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 2. Parse Content with AI if it's an email or unstructured text
        if (source === 'email' || !leadData.name || !leadData.phone) {
            console.log('Parsing unstructured lead content with GPT-4o...');

            const systemPrompt = `
                Extract structured lead info from this real estate portal inquiry email.
                Return the data as a JSON object with these fields:
                - full_name (string)
                - email (string)
                - phone (string, in international format if possible)
                - property_ref (string, or link)
                - message (string, the customer's query)
                - portal (string, e.g., 'idealista', 'fotocasa', 'website')

                If data is missing, return null for that field.
                Be smart: Phone numbers in Spain start with +34, 6 or 7.
            `;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: rawContent }
                ],
                response_format: { type: "json_object" }
            });

            const aiParsed = JSON.parse(completion.choices[0].message.content || '{}');
            leadData = { ...leadData, ...aiParsed };
        }

        if (!agencyId) throw new Error('Agency ID not found');

        console.log('Lead data extracted:', leadData);

        // 3. Handle Duplicate Detection / Upsert Contact
        // We prioritize email, then phone for matching
        let contact: any = null;

        if (leadData.email) {
            const { data } = await supabase.from('contacts').select('id').eq('agency_id', agencyId).eq('primary_email', leadData.email).single();
            contact = data;
        }

        if (!contact && leadData.phone) {
            const { data } = await supabase.from('contacts').select('id').eq('agency_id', agencyId).eq('primary_phone', leadData.phone).single();
            contact = data;
        }

        const contactPayload = {
            agency_id: agencyId,
            first_name: leadData.full_name?.split(' ')[0] || 'Lead',
            last_name: leadData.full_name?.split(' ').slice(1).join(' ') || '',
            primary_email: leadData.email,
            emails: leadData.email ? [leadData.email] : [],
            primary_phone: leadData.phone,
            phones: leadData.phone ? [leadData.phone] : [],
            marketing_source: leadData.portal || 'portal_lead',
            current_status: 'new'
        };

        let finalContactId: string;

        if (contact) {
            console.log(`Updating existing contact: ${contact.id}`);
            const { data, error } = await supabase.from('contacts')
                .update(contactPayload)
                .eq('id', contact.id)
                .select()
                .single();

            if (error) throw error;
            finalContactId = data.id;
        } else {
            console.log('Creating NEW contact');
            const { data, error } = await supabase.from('contacts')
                .insert(contactPayload)
                .select()
                .single();

            if (error) throw error;
            finalContactId = data.id;
        }

        // 4. Log Communication
        const activityMessage = leadData.message || `New lead from ${leadData.portal || 'portal'}`;

        await supabase.from('contact_communications').insert({
            contact_id: finalContactId,
            agency_id: agencyId,
            channel: 'email',
            direction: 'inbound',
            status: 'received',
            body: activityMessage,
            metadata: {
                source: leadData.portal,
                property_ref: leadData.property_ref,
                full_name: leadData.full_name,
                email: leadData.email,
                phone: leadData.phone
            }
        });

        // Log to activities (for timeline/history)
        await supabase.from('activities').insert({
            contact_id: finalContactId,
            agency_id: agencyId,
            type: contact ? 'lead_updated' : 'contact_created',
            description: `Lead ${contact ? 'updated' : 'created'} from ${leadData.portal || 'Idealista'}`,
            metadata: {
                source: leadData.portal,
                property_ref: leadData.property_ref
            }
        });

        return new Response(JSON.stringify({
            status: 'success',
            contact_id: finalContactId,
            action: contact ? 'updated' : 'created'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('Error in handle-inbound-lead:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
