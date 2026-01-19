import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
        if (!VAPI_API_KEY) {
            throw new Error('Missing VAPI_API_KEY');
        }

        const body = await req.json();
        const { phoneNumber, settings } = body;

        if (!phoneNumber) {
            throw new Error('Missing phoneNumber');
        }

        if (!settings) {
            throw new Error('Missing settings');
        }

        console.log("Initiating test call to: " + phoneNumber);

        // Build Vapi payload from settings
        const vapiPayload: any = {
            phoneNumberId: settings.phoneNumberId,
            customer: {
                number: phoneNumber
            },
            assistant: {
                name: settings.assistant?.name || "Test Assistant",
                voice: settings.assistant?.voice || { provider: "vapi", voiceId: "Paige" },
                model: settings.assistant?.model || {
                    provider: "openai",
                    model: "gpt-4",
                    messages: [{ role: "system", content: "You are a helpful assistant." }]
                },
                firstMessage: settings.assistant?.firstMessage || "Hello! This is a test call."
            }
        };

        // Add voicemailDetection if present
        if (settings.assistant?.voicemailDetection) {
            vapiPayload.assistant.voicemailDetection = settings.assistant.voicemailDetection;
        }

        console.log("Vapi payload:", JSON.stringify(vapiPayload, null, 2));

        const response = await fetch('https://api.vapi.ai/call/phone', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + VAPI_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(vapiPayload)
        });

        const responseText = await response.text();
        console.log("Vapi response:", responseText);

        if (!response.ok) {
            throw new Error('Vapi API error: ' + response.status + ' - ' + responseText);
        }

        const result = JSON.parse(responseText);

        return new Response(JSON.stringify({
            success: true,
            callId: result.id,
            message: "Call initiated successfully"
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error initiating test call:', error);
        return new Response(JSON.stringify({
            success: false,
            error: (error as Error).message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
