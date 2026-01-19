
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { deal_id } = await req.json()

        if (!deal_id) {
            throw new Error('deal_id is required')
        }

        console.log(`Generating selection for deal ${deal_id}`)

        // 1. Fetch Deal & Preferences
        const { data: deal, error: dealError } = await supabaseClient
            .from('deals')
            .select(`
        *,
        contact:contacts(*),
        preferences:deal_preference_profiles(*)
      `)
            .eq('id', deal_id)
            .single()

        if (dealError || !deal) throw new Error('Deal not found')

        // 2. Fetch exclusion list (properties already sent)
        const { data: previousSelections } = await supabaseClient
            .from('selection_batches')
            .select('selection_items(property_id)')
            .eq('deal_id', deal_id)

        const excludedPropertyIds = new Set<string>()
        previousSelections?.forEach((batch: any) => {
            batch.selection_items?.forEach((item: any) => {
                if (item.property_id) excludedPropertyIds.add(item.property_id)
            })
        })

        console.log(`Found ${excludedPropertyIds.size} previously sent properties to exclude`)

        // 3. Build Query for Candidate Properties
        const preferences = deal.preferences?.[0] || {} // Assuming 1:1 or taking first
        const budget = preferences.max_budget || deal.budget_max || 10000000
        const minBedrooms = preferences.bedrooms || 0
        const requestedCity = preferences.city
        const requestedArea = preferences.area

        // Map property types
        const typeFilters: string[] = []
        if (preferences.type_villa) typeFilters.push('HOUSE')
        if (preferences.type_apartment) typeFilters.push('APARTMENT')
        if (preferences.type_townhouse) typeFilters.push('HOUSE')

        let query = supabaseClient
            .from('properties')
            .select('id, price, bedrooms, bathrooms, built_size, address, description:content, type, pictures, resale_ref, name')
            .eq('status', 'ONLINE')
            .lte('price', budget * 1.2) // Allow 20% stretch
            .order('created_at', { ascending: false })
            .limit(50)

        if (minBedrooms > 0) {
            query = query.gte('bedrooms', minBedrooms)
        }

        if (typeFilters.length > 0) {
            query = query.in('type', typeFilters)
        }

        // Apply Location Filters if available
        if (requestedCity || requestedArea) {
            const locations = [requestedCity, requestedArea].filter(Boolean) as string[]
            // We use or condition to check if address contains any of the requested locations
            const locationFilters = locations.map(loc => `address.ilike.%${loc}%`).join(',')
            query = query.or(locationFilters)
        }

        const { data: candidates, error: candidatesError } = await query

        if (candidatesError) throw candidatesError

        // Filter out excluded IDs in memory
        let freshCandidates = candidates.filter((p: any) => !excludedPropertyIds.has(p.id))

        // Deduplicate candidates
        const seen = new Set<string>()
        freshCandidates = freshCandidates.filter((p: any) => {
            // Use resale_ref if available, otherwise construct a content signature
            const signature = p.resale_ref
                ? `ref:${p.resale_ref}`
                : `content:${p.price}-${p.bedrooms}-${p.built_size}-${p.type}-${p.address}`

            if (seen.has(signature)) return false
            seen.add(signature)
            return true
        })

        console.log(`Retrieved ${freshCandidates.length} potential candidates after filtering history and duplicates`)

        if (freshCandidates.length === 0) {
            return new Response(JSON.stringify({ success: false, message: 'No suitable properties found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 4. AI Analysis with GPT-4
        const openAiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openAiKey) throw new Error('OPENAI_API_KEY validation failed')

        const contactName = deal.contact?.first_name || 'Client'
        const contactLang = deal.contact?.language || 'Russian' // explicit request for Russian usually implies Russian client, but let's default safe or use contact attribute

        const systemPrompt = `You are a luxury real estate assistant. Select exactly 5 properties for the client.
    Language: The client speaks ${contactLang}. Output the explanation in ${contactLang}.
    Match Criteria:
    - Budget: ${budget}
    - Bedrooms: ${minBedrooms}+
    - Types: ${typeFilters.join(', ') || 'Any'}
    
    IMPORTANT: Respond in JSON format with the following structure:
    {
      "selected_properties": [
        {
          "property_id": "uuid from the candidate list",
          "explanation": "Persuasive reason in ${contactLang}"
        }
      ]
    }`;

        const userPrompt = `Client Profile: ${deal.contact?.first_name} ${deal.contact?.last_name}.
    Preferences: ${JSON.stringify(preferences)}
    
    Candidate Properties:
    ${JSON.stringify(freshCandidates.map((p: any) => ({
            id: p.id,
            price: p.price,
            beds: p.bedrooms,
            loc: p.address,
            type: p.type,
            desc: p.description?.substring(0, 200) // Truncate for tokens
        })))}`

        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openAiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' }
            })
        })

        const aiData = await aiRes.json()

        if (!aiData.choices || !aiData.choices.length) {
            console.error('OpenAI Error:', JSON.stringify(aiData))
            throw new Error('AI generation failed: No choices returned')
        }

        const aiContent = JSON.parse(aiData.choices[0].message.content)
        const selections = aiContent.selected_properties || []

        console.log(`AI selected ${selections.length} properties`)

        if (selections.length === 0) {
            return new Response(JSON.stringify({ success: false, message: 'AI found no matches' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 5. Save to Database
        // Create Batch
        const { data: batch, error: batchError } = await supabaseClient
            .from('selection_batches')
            .insert({
                agency_id: deal.agency_id,
                deal_id: deal_id,
                created_by: deal.contact.owner_id || 'system', // or can we get user from auth context?
                // for now let's leave created_by empty or system. Schema says "created_by: string". 
                // ideally we pass the user.id from the frontend request context.
                kind: 'autopilot',
                status: 'draft',
                summary: `AI Selection for ${contactName}`,
                item_count: selections.length
            })
            .select()
            .single()

        if (batchError) throw batchError

        // Create Items
        const itemsToInsert = selections
            .filter((sel: any) => sel.property_id) // Safety guard
            .map((sel: any, index: number) => {
                const prop = freshCandidates.find((p: any) => p.id === sel.property_id)
                return {
                    selection_id: batch.id,
                    property_id: sel.property_id,
                    rank: index + 1,
                    explanation: sel.explanation,
                    property_snapshot: prop // Store snapshot
                }
            })

        const { error: itemsError } = await supabaseClient
            .from('selection_items')
            .insert(itemsToInsert)

        if (itemsError) throw itemsError

        return new Response(JSON.stringify({ success: true, batch_id: batch.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (err) {
        console.error(err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
