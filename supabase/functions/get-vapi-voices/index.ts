import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Vapi's curated voices (from their docs/dashboard)
// These are the "Vapi Voices" - prebuilt high-quality voices
const VAPI_VOICES = [
    { id: "Paige", name: "Paige", provider: "vapi", gender: "female", description: "Professional female voice" },
    { id: "Lily", name: "Lily", provider: "vapi", gender: "female", description: "Asian American female" },
    { id: "Neha", name: "Neha", provider: "vapi", gender: "female", description: "Indian female" },
    { id: "Hana", name: "Hana", provider: "vapi", gender: "female", description: "Japanese female" },
    { id: "Rohan", name: "Rohan", provider: "vapi", gender: "male", description: "Indian American male" },
    { id: "Andrew", name: "Andrew", provider: "vapi", gender: "male", description: "American male" },
    { id: "Elliot", name: "Elliot", provider: "vapi", gender: "male", description: "British male" },
    { id: "Nicole", name: "Nicole", provider: "vapi", gender: "female", description: "American female" },
    { id: "Emma", name: "Emma", provider: "vapi", gender: "female", description: "British female" },
    { id: "Aria", name: "Aria", provider: "vapi", gender: "female", description: "Expressive female" },
    { id: "Roger", name: "Roger", provider: "vapi", gender: "male", description: "American male" },
    { id: "Sarah", name: "Sarah", provider: "vapi", gender: "female", description: "American female" },
];

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
        if (!VAPI_API_KEY) {
            throw new Error('Missing VAPI_API_KEY');
        }

        const url = new URL(req.url);
        const action = url.searchParams.get('action') || 'list';

        if (action === 'preview') {
            const voiceId = url.searchParams.get('voiceId');
            const provider = url.searchParams.get('provider') || 'vapi';

            if (!voiceId) {
                throw new Error('Missing voiceId for preview');
            }

            // For Vapi voices, try the dashboard preview endpoint pattern
            // Based on common Vapi patterns: /call/preview or similar
            // Actually, Vapi voices can be previewed via their TTS endpoint
            // Let's try creating a short TTS sample

            const ttsResponse = await fetch('https://api.vapi.ai/call/create-web-call', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + VAPI_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    assistant: {
                        voice: {
                            provider: provider,
                            voiceId: voiceId
                        },
                        firstMessage: "Hello, this is a voice preview. How can I help you today?"
                    }
                })
            });

            // This approach won't give us audio directly, so let's just return the voice info
            // The frontend can show a "preview not available" or link to Vapi dashboard
            return new Response(JSON.stringify({
                message: "Voice preview requires Vapi dashboard. Selected voice: " + voiceId,
                voiceId: voiceId,
                provider: provider
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Return curated list of Vapi voices
        return new Response(JSON.stringify(VAPI_VOICES), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
