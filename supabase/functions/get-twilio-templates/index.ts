
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')

        if (!accountSid || !authToken) {
            throw new Error('Missing Twilio Credentials in Secrets')
        }

        console.log('Fetching Twilio Templates for Account:', accountSid)

        // Fetch templates from the Content API
        // https://www.twilio.com/docs/content-api/list-content-and-approvals
        // This returns all Content Templates
        const twilioRes = await fetch(`https://content.twilio.com/v1/Content?PageSize=100`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${btoa(accountSid + ':' + authToken)}`,
            },
        })

        if (!twilioRes.ok) {
            const errText = await twilioRes.text()
            console.error('Twilio Error:', errText)
            throw new Error(`Twilio API Error: ${twilioRes.status} ${errText}`)
        }

        const data = await twilioRes.json()
        const contents = data.contents || []

        // Filter only WhatsApp approved templates or generic ones?
        // For now, return all. Let user filtering happen if needed.
        // We map to a simpler structure for the frontend
        const templates = contents.map((c: any) => ({
            sid: c.sid,
            friendly_name: c.friendly_name,
            language: c.language,
            variables: c.variables, // Key-value or list of needed vars
            types: c.types // e.g. 'twilio/text', 'twilio/media'
        }))

        return new Response(JSON.stringify({ templates }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error('Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
