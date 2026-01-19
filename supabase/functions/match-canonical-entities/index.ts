
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const openAiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
        const supabase = createClient(supabaseUrl, serviceKey)

        const { locations: mentionedLocations, features: mentionedFeatures } = await req.json()

        console.log('Matching request:', { mentionedLocations, mentionedFeatures })

        // Fetch all canonical locations and features (using camelCase to match CSV import)
        const { data: allLocations } = await supabase
            .from('locations')
            .select('id, name, "nameResale", "nameAI", type')

        const { data: allFeatures } = await supabase
            .from('features')
            .select('key, name, "nameResale", "nameAI"')

        // Build context for LLM
        const locationContext = (allLocations || []).map(loc => {
            const variants = [loc.name, loc.nameResale, loc.nameAI].filter(Boolean).join('; ')
            return `ID ${loc.id}: ${variants} (${loc.type})`
        }).join('\n')

        const featureContext = (allFeatures || []).map(feat => {
            const variants = [feat.name, feat.nameResale, feat.nameAI].filter(Boolean).join('; ')
            return `Key "${feat.key}": ${variants}`
        }).join('\n')

        // Call OpenAI with function calling
        const systemPrompt = `You are a real estate entity matcher. Match mentioned locations and features to canonical IDs/keys.

LOCATIONS DATABASE:
${locationContext}

FEATURES DATABASE:
${featureContext}

Your task: Given user mentions, return the matching canonical IDs and keys. Be flexible with spelling variations, abbreviations, and different languages.`

        const userPrompt = `Match these mentions:
Locations: ${JSON.stringify(mentionedLocations || [])}
Features: ${JSON.stringify(mentionedFeatures || [])}`

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openAiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                functions: [{
                    name: 'match_entities',
                    description: 'Match mentioned locations and features to canonical database entries',
                    parameters: {
                        type: 'object',
                        properties: {
                            matched_location_ids: {
                                type: 'array',
                                items: { type: 'integer' },
                                description: 'Array of location IDs that match the mentioned locations'
                            },
                            matched_feature_keys: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Array of feature keys (e.g. "Features_Gym") that match the mentioned features'
                            }
                        },
                        required: ['matched_location_ids', 'matched_feature_keys']
                    }
                }],
                function_call: { name: 'match_entities' }
            })
        })

        const aiData = await response.json()
        const matchResult = JSON.parse(aiData.choices?.[0]?.message?.function_call?.arguments || '{}')

        console.log('Match result:', matchResult)

        return new Response(JSON.stringify(matchResult), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error('Matching error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
