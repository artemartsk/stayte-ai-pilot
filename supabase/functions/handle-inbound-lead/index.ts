
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { OpenAI } from "https://deno.land/x/openai@v4.20.0/mod.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? 're_BcU7ggg6_7PTuxgBH7xAeiLtbs637QS1m';

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
        const emailData = body.type === 'email.received' && body.data ? body.data : body;
        const toAddress = Array.isArray(emailData.to) ? emailData.to[0] : emailData.to;

        if (emailData) {
            console.log('Email Data Keys:', Object.keys(emailData));
        }

        if (toAddress && emailData.email_id) {
            // Case: Email from Resend Inbound
            source = 'email';
            console.log(`Fetching full email content via Resend Receiving API for email_id: ${emailData.email_id}`);

            let emailBody = '';
            let emailSubject = emailData.subject || 'No Subject';
            let senderEmail = emailData.from || '';

            try {
                const receivingResponse = await fetch(`https://api.resend.com/emails/receiving/${emailData.email_id}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${RESEND_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (receivingResponse.ok) {
                    const fullEmail = await receivingResponse.json();
                    // Prefer HTML because it contains rich listing details. Fallback to text.
                    emailBody = fullEmail.html || fullEmail.text || '';
                    emailSubject = fullEmail.subject || emailSubject;
                    senderEmail = fullEmail.from || senderEmail;
                } else {
                    console.error(`Failed to fetch from Resend Receiving API: ${receivingResponse.status}`);
                }
            } catch (err) {
                console.error('Error fetching from Resend Receiving API:', err);
            }

            if (!emailBody) {
                console.warn('Email body still empty after API fetch. Using metadata only.');
                rawContent = `Subject: ${emailSubject}\nFrom: ${senderEmail}`;
            } else {
                // If HTML is present, it might be large, but GPT-4.1 handles it well. 
                // We strip extremely excessive HTML only if needed, but for now passing raw HTML is best for structure.
                rawContent = `Subject: ${emailSubject}\nFrom: ${senderEmail}\n\n${emailBody}`;
            }

            const toStr = String(toAddress).toLowerCase();
            const uuidMatch = toStr.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

            if (uuidMatch) {
                agencyId = uuidMatch[0];
                console.log(`Extracted agencyId ${agencyId}`);
            } else {
                throw new Error(`Could not extract agency UUID from To address: ${toStr}`);
            }
        } else if (toAddress && !emailData.email_id) {
            // Fallback
            source = 'email';
            // Prefer HTML
            const content = emailData.html || emailData.text || '';
            rawContent = `Subject: ${emailData.subject || 'No Subject'}\nFrom: ${emailData.from || ''}\n\n${content}`;

            const toStr = String(toAddress).toLowerCase();
            const uuidMatch = toStr.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
            if (uuidMatch) {
                agencyId = uuidMatch[0];
            } else {
                throw new Error(`Could not extract agency UUID from To address: ${toStr}`);
            }
        } else if (body.agency_id || body.agencyId) {
            // Direct Webhook
            source = body.source || 'direct_webhook';
            agencyId = body.agency_id || body.agencyId;
            leadData = body.lead || body;
            rawContent = JSON.stringify(body);
        } else {
            return new Response(JSON.stringify({ error: 'Unsupported payload format' }), { status: 400 });
        }

        console.log('Raw content for AI parsing:', rawContent.substring(0, 500) + '...');

        // 2. Parse Content with AI
        if (source === 'email' || !leadData.full_name || !leadData.email) {
            console.log('Invoking extract-lead-details function...');

            const { data: parsedData, error: parseError } = await supabase.functions.invoke('extract-lead-details', {
                body: {
                    text: rawContent,
                    context: `Inbound email from ${emailData.from}`
                }
            });

            if (parseError) {
                console.error('Error invoking extract-lead-details:', parseError);
                throw parseError;
            }

            console.log('Extracted Data:', JSON.stringify(parsedData));
            console.log('DEBUG: Parsed Portal:', parsedData.portal);
            leadData = { ...leadData, ...parsedData };

            // Map new extraction fields to old leadData expectations where they differ slightly
            if (!leadData.location_city && parsedData.city) leadData.location_city = parsedData.city;
            if (!leadData.location_area && parsedData.area) leadData.location_area = parsedData.area;
            if (!leadData.budget_max && parsedData.budget) leadData.budget_max = parsedData.budget;
            if (!leadData.budget_min && parsedData.min_budget) leadData.budget_min = parsedData.min_budget;
            if (!leadData.bedrooms_min && parsedData.bedrooms) leadData.bedrooms_min = parsedData.bedrooms;
            if (!leadData.bedrooms_min && parsedData.bedrooms) leadData.bedrooms_min = parsedData.bedrooms;
            if (!leadData.bathrooms_min && parsedData.bathrooms) leadData.bathrooms_min = parsedData.bathrooms;
            if (!leadData.portal && parsedData.portal) leadData.portal = parsedData.portal;

            // Flatten features object to array if needed or keep using boolean flags directly in updatePayload
            // The extract-lead-details returns booleans like feature_pool=true. 
            // We can now use these directly in the deal update section.
        }

        if (!agencyId) throw new Error('Agency ID not found');

        // 3. Upsert Contact
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
        let isNewContact = false;

        if (contact) {
            console.log(`Updating existing contact: ${contact.id}`);
            const { data, error } = await supabase.from('contacts').update(contactPayload).eq('id', contact.id).select().single();
            if (error) throw error;
            finalContactId = data.id;
        } else {
            console.log('Creating NEW contact');
            const { data, error } = await supabase.from('contacts').insert(contactPayload).select().single();
            if (error) throw error;
            finalContactId = data.id;
            isNewContact = true;
        }

        // 3.5 Upsert Contact Profile for Language & Agent Info & Personal Data
        const profileUpdate: any = {
            contact_id: finalContactId
        };

        if (leadData.language) profileUpdate.language_primary = leadData.language;
        if (leadData.is_agent) {
            profileUpdate.job_title = 'Real Estate Agent';
            if (leadData.summary) profileUpdate.qualification_notes = `[AGENT DETECTED] ${leadData.summary}`;
        }
        if (leadData.agency_name) profileUpdate.company_name = leadData.agency_name;

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
            if (leadData[attr] !== undefined && leadData[attr] !== null) {
                profileUpdate[attr] = leadData[attr];
            }
        }

        if (Object.keys(profileUpdate).length > 1) {
            console.log(`Updating contact profile with extra info:`, profileUpdate);
            await supabase.from('contact_profiles').upsert(profileUpdate, { onConflict: 'contact_id' });
        }

        // 4. Poll and Update Deal (Wait for auto-creation)
        console.log(`Polling for deal associated with contact ${finalContactId}...`);
        let dealId: string | null = null;

        // Poll for up to 10 seconds (5 attempts * 2000ms)
        for (let i = 0; i < 5; i++) {
            await sleep(2000);
            const { data: deals } = await supabase
                .from('deals')
                .select('id')
                .eq('contact_id', finalContactId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (deals && deals.length > 0) {
                dealId = deals[0].id;
                console.log(`Found auto-created deal: ${dealId}`);
                break;
            }
            console.log(`Attempt ${i + 1}: Deal not found yet...`);
        }

        if (dealId) {
            // Now all preference data goes directly into the deals table (no separate table)
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

            const dealUpdate: any = {};

            for (const key of allowedDealKeys) {
                if (leadData[key] !== undefined && leadData[key] !== null) {
                    dealUpdate[key] = leadData[key];
                }
            }

            // Map legacy/mismatched keys
            if (leadData.budget_max && !dealUpdate.max_budget) dealUpdate.max_budget = leadData.budget_max;
            if (leadData.budget_min && !dealUpdate.budget) dealUpdate.budget = leadData.budget_min;
            if (leadData.bedrooms_min && !dealUpdate.bedrooms) dealUpdate.bedrooms = leadData.bedrooms_min;
            if (leadData.bathrooms_min && !dealUpdate.bathrooms) dealUpdate.bathrooms = leadData.bathrooms_min;
            if (leadData.location_city && !dealUpdate.city) dealUpdate.city = leadData.location_city;
            if (leadData.location_area && !dealUpdate.area) dealUpdate.area = leadData.location_area;

            // Map budget for display: AI "budget" -> "budget_min", AI "max_budget" -> "budget_max"
            if (leadData.budget) dealUpdate.budget_min = leadData.budget;
            if (leadData.max_budget) dealUpdate.budget_max = leadData.max_budget;

            // AI summary and hot lead indicator
            if (leadData.summary) dealUpdate.ai_summary = leadData.summary;


            // Canonical IDs from reference tables
            if (leadData.location_ids && Array.isArray(leadData.location_ids) && leadData.location_ids.length > 0) {
                dealUpdate.location_ids = leadData.location_ids;

                // Resolve Location Names from DB to override text-based extraction
                const { data: locs } = await supabase
                    .from('locations')
                    .select('name, type') // Assuming 'type' exists, if not we'll just use names
                    .in('id', leadData.location_ids);

                if (locs && locs.length > 0) {
                    // Reset text fields to avoid conflict with AI text extraction
                    dealUpdate.city = null;
                    dealUpdate.area = null;
                    dealUpdate.region = null;

                    // Classify locations by type
                    // "Specific" = zone, area, district, urbanisation
                    // "Broad" = city, municipality, province
                    const specificLocs = locs.filter((l: any) => l.type && (l.type.toLowerCase().includes('zone') || l.type.toLowerCase().includes('area') || l.type.toLowerCase().includes('district') || l.type.toLowerCase().includes('urbanisation'))).map((l: any) => l.name);
                    const broadLocs = locs.filter((l: any) => !l.type || l.type.toLowerCase().includes('city') || l.type.toLowerCase() === 'municipality').map((l: any) => l.name);

                    if (specificLocs.length > 0) {
                        dealUpdate.city = specificLocs.join(', ');
                        dealUpdate.area = null;
                    } else if (broadLocs.length > 0) {
                        dealUpdate.city = broadLocs.join(', ');
                    } else {
                        dealUpdate.city = locs[0].name;
                    }

                    console.log(`Resolved Canonical Locations: Main="${dealUpdate.city}" from IDs ${JSON.stringify(leadData.location_ids)}`);
                }
            }

            if (leadData.feature_ids && Array.isArray(leadData.feature_ids) && leadData.feature_ids.length > 0) {
                dealUpdate.feature_ids = leadData.feature_ids;
            }

            // Map timeframe
            if (leadData.purchase_timeframe) {
                dealUpdate.timeline = leadData.purchase_timeframe;
            } else if (leadData.purchace_timeframe) {
                // Handle legacy typo key if it still comes back from older prompts context
                dealUpdate.timeline = leadData.purchace_timeframe;
            }

            console.log('Updating deals table directly with:', JSON.stringify(dealUpdate));

            if (Object.keys(dealUpdate).length > 0) {
                const { error: updateError } = await supabase.from('deals').update(dealUpdate).eq('id', dealId);
                if (updateError) {
                    console.error('ERROR updating deals:', JSON.stringify(updateError));
                } else {
                    console.log('SUCCESS: Updated deals table directly.');
                }
            } else {
                console.log('No data extracted to update.');
            }
        } else {
            console.warn('Timed out waiting for deal creation (10s).');
        }

        // 5. Log Communication & Activity
        const activityMessage = leadData.message || `New inquiry from ${leadData.portal || 'portal'}`;

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

        await supabase.from('activities').insert({
            contact_id: finalContactId,
            agency_id: agencyId,
            deal_id: dealId || null,
            type: contact ? 'lead_updated' : 'contact_created',
            description: `Lead ${contact ? 'updated' : 'created'} from ${leadData.portal || 'portal'}`,
            metadata: {
                source: leadData.portal,
                property_ref: leadData.property_ref
            }
        });

        return new Response(JSON.stringify({
            status: 'success',
            contact_id: finalContactId,
            deal_id: dealId,
            lead: leadData
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
