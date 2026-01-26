import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Parse request body for optional overrides
        const { agency_id } = await req.json().catch(() => ({}))

        // Get agency inbound email
        let inboundEmail = ''
        if (agency_id) {
            const { data: agency } = await supabase
                .from('agencies')
                .select('id')
                .eq('id', agency_id)
                .single()
            if (agency) {
                inboundEmail = `${agency.id}@leads.stayte.ai`
            }
        }

        if (!inboundEmail) {
            // Find first agency
            const { data: agencies } = await supabase
                .from('agencies')
                .select('id')
                .limit(1)
            if (agencies && agencies.length > 0) {
                inboundEmail = `${agencies[0].id}@leads.stayte.ai`
            }
        }

        if (!inboundEmail) {
            return new Response(JSON.stringify({ error: 'No agency found' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Generate unique test data
        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substring(2, 8)
        const testNames = ['Carlos García', 'María López', 'Juan Martínez', 'Ana Fernández', 'Pedro Sánchez', 'Laura Rodríguez']
        const locations = ['Marbella', 'Estepona', 'Puerto Banús', 'Nueva Andalucía', 'Benahavís', 'Fuengirola']
        const propertyTypes = ['Apartamento', 'Villa', 'Ático', 'Casa adosada', 'Piso']

        const name = testNames[Math.floor(Math.random() * testNames.length)]
        const location = locations[Math.floor(Math.random() * locations.length)]
        const propertyType = propertyTypes[Math.floor(Math.random() * propertyTypes.length)]
        const budget = (Math.floor(Math.random() * 10) + 3) * 100000 // 300k - 1.2M
        const bedrooms = Math.floor(Math.random() * 3) + 2 // 2-4
        const refId = `IDL-2024-${Math.floor(Math.random() * 90000) + 10000}`

        const emailBody = `
Estimado agente,

Ha recibido una nueva solicitud de contacto a través de idealista.

═══════════════════════════════════════════════════════
DATOS DEL INTERESADO
═══════════════════════════════════════════════════════

Nombre: ${name}
Email: test.lead.${randomId}@gmail.com
Teléfono: +34 661 896 698

═══════════════════════════════════════════════════════
MENSAJE
═══════════════════════════════════════════════════════

"Hola, estoy buscando un ${propertyType.toLowerCase()} en ${location}. 
Necesito ${bedrooms} dormitorios mínimo.
Mi presupuesto es de ${budget.toLocaleString()}€.
Me gustaría programar una visita.
Gracias."

═══════════════════════════════════════════════════════
INMUEBLE DE REFERENCIA
═══════════════════════════════════════════════════════

Referencia: ${refId}
Ubicación: ${location}, Costa del Sol
Tipo: ${propertyType}
Precio: ${Math.floor(budget * 0.9).toLocaleString()} €
Dormitorios: ${bedrooms}

═══════════════════════════════════════════════════════

Este mensaje ha sido enviado automáticamente por idealista.
ID de prueba: ${timestamp}
`

        // Send email via Resend
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'test@updates.stayte.ai',
                to: inboundEmail,
                subject: `Nueva solicitud de información - ${propertyType} en ${location}`,
                text: emailBody
            })
        })

        if (!res.ok) {
            const error = await res.text()
            console.error('Resend error:', error)
            return new Response(JSON.stringify({ error: 'Failed to send email', details: error }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const result = await res.json()
        console.log('Test email sent:', result)

        return new Response(JSON.stringify({
            success: true,
            message: 'Test email sent successfully',
            to: inboundEmail,
            lead_name: name,
            lead_email: `test.lead.${randomId}@gmail.com`,
            lead_phone: '+34 661 896 698',
            resend_id: result.id
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error('Error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
