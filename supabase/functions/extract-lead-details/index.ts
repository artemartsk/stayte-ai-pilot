import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { text, context, agency_id } = await req.json();

        if (!text) {
            return new Response(JSON.stringify({ error: 'Text input is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`Analyzing text (${text.length} chars) with context: ${context || 'none'}`);

        // Fetch reference data from database
        const { data: locations, error: locError } = await supabase
            .from('locations')
            .select('id, name');

        if (locError) console.error('Error fetching locations:', locError);

        const { data: features, error: featError } = await supabase
            .from('features')
            .select('key, name');

        if (featError) console.error('Error fetching features:', featError);

        // Fetch Lead Sources if agency_id is provided
        let sourceList = '';
        if (agency_id) {
            const { data: sources, error: sourceError } = await supabase
                .from('lead_sources')
                .select('name')
                .eq('agency_id', agency_id);

            if (sourceError) {
                console.error('Error fetching lead sources:', sourceError);
            } else if (sources && sources.length > 0) {
                sourceList = sources.map((s: any) => s.name).join(', ');
                console.log(`Loaded ${sources.length} custom lead sources: ${sourceList}`);
            }
        }

        // Build reference lists for the prompt
        const locationList = (locations || [])
            .map((l: any) => `ID:${l.id} = "${l.name}"`)
            .join('\n');

        const featureList = (features || [])
            .map((f: any) => `KEY:"${f.key}" = "${f.name}"`)
            .join('\n');

        console.log(`Loaded ${locations?.length || 0} locations, ${features?.length || 0} features for matching.`);

        const systemPrompt = `
            You are an expert real estate lead data extractor. 
            Analyze the provided text (email, call transcript, or message) and extract structured data.
            
            Return a SINGLE FLAT JSON object with the following fields (use null if missing or not applicable).
            DO NOT NEST fields under categories. All fields must be at the root level of the JSON object.
            
            CONTACT INFO:
            - full_name (string)
            - email (string): The LEAD'S email address. CRITICAL: If this is a forwarded email, do NOT use the sender's email. Look for the original sender's email in the body text (e.g. "From: <email>", "Email: <email>", or "Reply-To: <email>").
            - phone (string)
            - language (string, ISO code e.g. 'es', 'en')
            - summary (string, brief summary of the request)
            - is_agent (boolean): True if sender is a real estate agent/broker (look for 'collaborate', 'share commission', 'my client', 'inmobiliaria')
            - agency_name (string): Name of the agency if sender is an agent
            - portal (string): The ORIGIN platform/website. 
              CRITICAL: Map to one of these EXACT values if possible: [${sourceList || 'Idealista, Fotocasa, Kyero, Rightmove, JamesEdition, Website, WhatsApp'}]. 
              If the email is from a known portal but not in the list, use the portal name (e.g. "Rightmove Overseas"). 
              If it is a direct email not from a portal, return "Email".
              If it is from a specific source configured by the user, PRIORITIZE matching that source name (case-insensitive).

            PERSONAL DETAILS (Demographics, Job, Income):
            - age_25_35 (boolean)
            - age_36_50 (boolean)
            - age_51_plus (boolean)
            - gender_male (boolean)
            - gender_female (boolean)
            - marital_single (boolean)
            - marital_couple (boolean)
            - marital_with_children (boolean)
            - nationality (string)
            - residence_country (string)
            - profession_it (string): Client profession (generic text or 'IT' check)
            - profession_retired (boolean)
            - company_name (string)
            - job_title (string)
            - industry (string)
            - income_lt_50k (boolean)
            - income_50k_100k (boolean)
            - income_gt_100k (boolean)
            - funding_mortgage (boolean)
            - funding_foreign_loan (boolean)
            - financing_method (string): cash, crypto, loan etc.
            - visited_location_before (boolean): Client visited Marbella or costa del sol before
            - hobby (string)
            - owns_property_elsewhere (boolean)
            - existing_property_country (string)
            - purchase_timeframe (string): Timeframe for purchase (e.g. "ASAP", "6 months", "Visiting Feb 15-20")
            - trip_planned (string): Trip planned details or visiting availability

            PROPERTY PREFERENCES (Boolean fields are true/false, numeric are numbers):
            
            LOCATION:
            - country (string): Country where client wants to buy
            - region (string): Region where client wants to buy
            - city (string): SINGLE city/town where client wants to buy. If multiple locations are mentioned, pick the FIRST/MOST IMPORTANT one.
            - area (string): SINGLE area/neighborhood where client wants to buy. If multiple areas mentioned, pick only ONE. Use location_ids for all matches.
            - loc_coast (boolean): Near sea is important
            - loc_city_center (boolean): City center is important
            - loc_suburbs (boolean): Suburbs location is important
            - loc_rural (boolean): Rural location is important
            - dist_beach_lt_1km (boolean): Near sea/beach (<1km) is important
            - dist_golf_lt_2km (boolean): Location near golf (<2km) is important
            - location_type_beachside (boolean): Beachside location
            - location_type_close_to_forest (boolean): Close to forest
            - location_type_close_to_golf (boolean): Close to golf
            - location_type_close_to_marina (boolean): Close to marina
            - location_type_close_to_schools (boolean): Close to schools
            - location_type_close_to_sea (boolean): Close to sea
            - location_type_close_to_town (boolean): Close to town
            - location_type_country (boolean): Country location
            - location_type_suburban (boolean): Suburban location
            - location_type_town (boolean): Town location
            - location_type_urbanisation (boolean): Urbanisation

            PROPERTY TYPE:
            - type_apartment (boolean): Client wants apartment
            - type_villa (boolean): Client wants villa/house/chalet/casa independent house. IMPORTANT: Map "Casa", "Chalet", "Villa" here.
            - type_townhouse (boolean): Client wants townhouse/adosado
            - type_land_plot (boolean): Client wants land plot
            - subtype_penthouse (boolean): Penthouse
            - subtype_duplex (boolean): Duplex
            - subtype_detached_villa (boolean): Detached villa (Chalet independiente/Casa independiente)
            - subtype_finca_cortijo (boolean): Finca/cortijo
            - subtype_ground_floor_apartment (boolean): Ground floor apartment
            - subtype_ground_floor_studio (boolean): Ground floor studio
            - subtype_middle_floor_apartment (boolean): Middle floor apartment
            - subtype_middle_floor_studio (boolean): Middle floor studio
            - subtype_top_floor_apartment (boolean): Top floor apartment
            - subtype_top_floor_studio (boolean): Top floor studio
            - group_subtype_apartment (boolean): Apartment subtype
            - group_subtype_detached (boolean): Detached subtype
            - group_subtype_duplex (boolean): Duplex subtype
            - group_subtype_townhouse (boolean): Townhouse subtype

            DETAILS:
            - bedrooms (number): Number of bedrooms
            - bathrooms (number): Number of bathrooms
            - size_sq_m (number): Size of property in sq.m.
            - budget (number): Target price OR specific listing price mentioned.
            - max_budget (number): Only set if user explicitly sets a maximum cap (e.g. "up to 2M"). Otherwise leave null (system will calculate).

            FEATURES:
            - feature_pool (boolean): Client wants pool
            - feature_private_pool (boolean): Private pool
            - feature_garden (boolean): Client wants garden
            - feature_terrace (boolean): Client wants terrace
            - feature_covered_terrace (boolean): Covered terrace
            - feature_garage (boolean): Client wants garage
            - feature_private_parking (boolean): Private parking
            - feature_sea_view (boolean): Client wants sea view
            - feature_mountain_view (boolean): Client wants mountain view
            - feature_gated_community (boolean): Client wants gated community
            - feature_gym (boolean): Gym available
            - feature_lift (boolean): Lift/Elevator
            - feature_fitted_wardrobes (boolean): Fitted wardrobes
            - feature_access_for_reduced_mobility (boolean): Accessible for reduced mobility
            - feature_balcony (boolean): Balcony available
            - feature_barbeque (boolean): Barbeque available
            - feature_bar_restaurant (boolean): Bar/Restaurant on site
            - feature_basement (boolean): Basement available
            - feature_children_playground (boolean): Children's playground
            - feature_cinema (boolean): Cinema available
            - feature_concierge_service (boolean): Concierge service
            - feature_courtesy_bus (boolean): Courtesy bus service
            - feature_coworking_area (boolean): Coworking area
            - feature_dedicated_workspace (boolean): Dedicated workspace
            - feature_domotics (boolean): Domotics/smart home system
            - feature_double_glazing (boolean): Double glazing
            - feature_ensuite_bathroom (boolean): Ensuite bathroom
            - feature_ev_charger (boolean): EV charger
            - feature_guest_house (boolean): Guest house
            - feature_jacuzzi (boolean): Jacuzzi available
            - feature_marble_flooring (boolean): Marble flooring
            - feature_padel_court_tennis_court (boolean): Padel/Tennis court
            - feature_sauna (boolean): Sauna
            - feature_solarium (boolean): Solarium
            - feature_spa (boolean): Spa
            - feature_storage_room (boolean): Storage room

            PARKING:
            - parking_covered (boolean): Covered parking
            - parking_garage (boolean): Garage parking
            - parking_gated (boolean): Gated parking
            - parking_underground (boolean): Underground parking

            POOL:
            - pool_childrens_pool (boolean): Children's pool
            - pool_communal (boolean): Communal pool
            - pool_heated (boolean): Heated pool
            - pool_indoor (boolean): Indoor pool
            - pool_private (boolean): Private pool

            SECURITY:
            - security_24_hour_security (boolean): 24-hour security
            - security_alarm_system (boolean): Alarm system
            - security_electric_blinds (boolean): Electric blinds
            - security_gated_complex (boolean): Gated complex

            CONDITIONS:
            - condition_new_build (boolean): Client wants new build
            - condition_resale (boolean): Client wants second hand property
            - condition_renovation_ok (boolean): Client OK with renovation needed
            - condition_recently_renovated (boolean): Recently renovated
            - condition_recently_refurbished (boolean): Recently refurbished
            - condition_excellent (boolean): Condition is excellent
            - build_type_new (boolean): Property is newly built
            - build_type_secondhand (boolean): Property is second hand
            - completion_type_construction (boolean): Construction in progress
            - completion_type_ready (boolean): Ready to move in

            CLIMATE:
            - climate_control_air_conditioning (boolean): Air conditioning available
            - fireplace (boolean): Fireplace available

            INTENT:
            - main_home (boolean): Client wants to live in this property
            - second_home (boolean): For vacation only (few months per year)
            - want_short_term_rental (boolean): Client wants to earn from short term rent
            - want_long_term_rental (boolean): Client wants to earn from long term rent

            ========== CANONICAL LOCATION IDs ==========
            Match any mentioned locations (cities, areas, regions) to the IDs below. Return as "location_ids" (array of integers).
            
${locationList}

            ========== CANONICAL FEATURE KEYs ==========
            Match any mentioned features to the KEYs below. Return as "feature_ids" (array of strings).
            
${featureList}

            IMPORTANT RULES FOR IDs:
            1. location_ids: Array of INTEGER IDs from the location list above. Match by name or alias.
            2. feature_ids: Array of STRING keys from the feature list above. Match by name or alias.
            3. If no match found, return empty arrays: "location_ids": [], "feature_ids": []
            
            Infer boolean constraints only if explicitly mentioned or strongly implied.
            Language detection should be based on the text language.
            
            RESPOND WITH ONLY VALID JSON. NO MARKDOWN, NO EXPLANATIONS.
        `;

        const userMessage = `Context: ${context || ''}\n\nText to Analyze:\n${text}`;

        // Call Gemini API
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userMessage }] }
                    ],
                    generationConfig: {
                        responseMimeType: 'application/json'
                    }
                })
            }
        );

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error('Gemini API error:', errorText);
            throw new Error(`Gemini API error: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        console.log('Gemini raw response:', JSON.stringify(geminiData).substring(0, 500));

        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const result = JSON.parse(responseText);

        // Post-processing: Apply Business Logic
        // If we extracted a specific property price as 'budget', assume Max Budget is +30% higher
        if (result.budget && !result.max_budget) {
            result.max_budget = Math.round(result.budget * 1.3);
            console.log(`Applied +30% rule: Budget ${result.budget} -> Max Budget ${result.max_budget}`);
        } else if (result.budget && result.max_budget && result.max_budget === result.budget) {
            // If AI just copied budget to max_budget (common), apply the +30% rule to expand search range
            result.max_budget = Math.round(result.budget * 1.3);
            console.log(`Applied +30% rule (overwrite): Budget ${result.budget} -> Max Budget ${result.max_budget}`);
        }

        console.log('Extraction complete. location_ids:', result.location_ids, 'feature_ids:', result.feature_ids);

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('Error in extract-lead-details:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
