
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { testPhone, templateId, message, variables } = await req.json()

        if (!testPhone) throw new Error('Missing testPhone')

        // 1. Authenticate the user
        const authHeader = req.headers.get('Authorization')!
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: userError } = await supabase.auth.getUser(token)

        if (userError || !user) {
            console.error('Auth Error:', userError)
            throw new Error('Unauthorized')
        }

        // 2. Fetch user's profile to get agency_id
        const { data: profile } = await supabase
            .from('profiles')
            .select('agency_id')
            .eq('id', user.id)
            .single()

        if (!profile?.agency_id) {
            console.error('Profile/Agency Error: No agency_id for user', user.id)
            throw new Error('User has no agency assigned')
        }

        // 3. Fetch agency settings
        const { data: agency } = await supabase
            .from('agencies')
            .select('*')
            .eq('id', profile.agency_id)
            .single()

        if (!agency) throw new Error('Agency not found')

        const settings = agency.twilio_settings || {}
        const accountSid = settings.accountSid || Deno.env.get('TWILIO_ACCOUNT_SID')
        const authToken = settings.authToken || Deno.env.get('TWILIO_AUTH_TOKEN')
        const fromNumber = settings.fromNumber

        if (!accountSid || !authToken || !fromNumber) {
            console.error('Twilio config check failed:', { hasSid: !!accountSid, hasAuth: !!authToken, hasFrom: !!fromNumber })
            throw new Error('Twilio configuration incomplete. Please set WhatsApp number in Agency Settings and ensure TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are set in Supabase.')
        }

        const recipient = testPhone.startsWith('whatsapp:') ? testPhone : `whatsapp:${testPhone}`
        const sender = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`

        const params = new URLSearchParams()
        params.append('From', sender)
        params.append('To', recipient)

        if (templateId) {
            params.append('ContentSid', templateId)
            if (variables) {
                params.append('ContentVariables', JSON.stringify(variables))
            }
        } else if (message) {
            params.append('Body', message)
        } else {
            throw new Error('No template or message provided')
        }

        console.log(`Sending Test WhatsApp from ${sender} to ${recipient}`)

        const twilioAuth = `Basic ${btoa(accountSid + ':' + authToken)}`
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: 'POST',
            headers: {
                'Authorization': twilioAuth,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        })

        const result = await res.json()
        if (!res.ok) {
            console.error('Twilio API Error:', result)
            throw new Error(result.message || 'Twilio API Error')
        }

        console.log(`Twilio Message Sent Successfully. SID: ${result.sid}, Status: ${result.status}`)

        return new Response(JSON.stringify({ success: true, sid: result.sid, twilioStatus: result.status }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error: any) {
        console.error('test-whatsapp function error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
