import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

interface Property {
    id: string
    name?: string
    price?: number
    bedrooms?: number
    bathrooms?: number
    built_size?: number
    address?: string
    type?: string
    pictures?: any[]
    resale_ref?: string
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, serviceKey)

        const {
            contact_id,
            agency_id,
            channel = 'email',  // 'email' or 'whatsapp'
            include_agent_intro = true
        } = await req.json()

        console.log('send-nurture request:', { contact_id, agency_id, channel })

        if (!contact_id || !agency_id) {
            return new Response(JSON.stringify({ error: 'contact_id and agency_id required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 1. Fetch contact with deal
        console.log('Fetching contact:', contact_id)
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('id, first_name, last_name, primary_email, phones, owner, current_deal_id')
            .eq('id', contact_id)
            .single()

        console.log('Contact fetch result:', { contact: contact?.id, error: contactError?.message })

        if (contactError || !contact) {
            console.error('Contact not found:', contactError)
            return new Response(JSON.stringify({ error: 'Contact not found', details: contactError?.message }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (!contact.current_deal_id) {
            return new Response(JSON.stringify({ error: 'No active deal for contact' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 1b. Fetch contact profile for language
        const { data: contactProfile } = await supabase
            .from('contact_profiles')
            .select('language_primary')
            .eq('contact_id', contact_id)
            .maybeSingle()

        const clientLanguage = contactProfile?.language_primary || 'English'
        console.log(`Client language: ${clientLanguage}`)

        // 2. Call generate-selection to create a selection batch
        console.log(`Calling generate-selection for deal ${contact.current_deal_id}`)

        const selectionRes = await fetch(`${supabaseUrl}/functions/v1/generate-selection`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ deal_id: contact.current_deal_id })
        })

        const selectionResult = await selectionRes.json()

        if (!selectionRes.ok || !selectionResult.success) {
            console.log('generate-selection failed or no properties:', selectionResult)
            return new Response(JSON.stringify({
                success: true,
                message: selectionResult.message || 'No properties to send',
                properties_sent: 0
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const batchId = selectionResult.batch_id
        console.log(`Selection batch created: ${batchId}`)

        // 3. Fetch selection items with property snapshots
        const { data: selectionItems } = await supabase
            .from('selection_items')
            .select('id, property_id, explanation, property_snapshot, rank')
            .eq('selection_id', batchId)
            .order('rank', { ascending: true })

        if (!selectionItems || selectionItems.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                message: 'Selection created but no items',
                properties_sent: 0
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const properties: Property[] = selectionItems.map((item: any) => item.property_snapshot)
        console.log(`Found ${properties.length} properties in selection`)

        // 4. Fetch agency info for branding
        const { data: agency } = await supabase
            .from('agencies')
            .select('name, logo_url, primary_color')
            .eq('id', agency_id)
            .single()

        // 5. Fetch assigned agent if agentIntro enabled
        let agentInfo = null
        if (include_agent_intro && contact.owner) {
            const { data: agent } = await supabase
                .from('profiles')
                .select('full_name, avatar_url, email, phone')
                .eq('id', contact.owner)
                .single()
            agentInfo = agent
        }

        // 6. Send via appropriate channel
        let sendResult: any

        if (channel === 'email') {
            sendResult = await sendViaEmail(contact, selectionItems, agency, agentInfo, clientLanguage, RESEND_API_KEY)
        } else if (channel === 'whatsapp') {
            sendResult = await sendViaWhatsApp(contact, selectionItems, agency, agentInfo, clientLanguage)
        } else {
            return new Response(JSON.stringify({ error: `Unknown channel: ${channel}` }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (!sendResult.success) {
            return new Response(JSON.stringify({ error: sendResult.error }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 7. Update selection batch status to 'sent'
        await supabase
            .from('selection_batches')
            .update({ status: 'sent' })
            .eq('id', batchId)

        // 8. Log to contact_communications
        await supabase.from('contact_communications').insert({
            contact_id: contact.id,
            agency_id: agency_id,
            channel: channel === 'email' ? 'email' : 'wa',
            direction: 'out',
            status: 'sent',
            payload: {
                batch_id: batchId,
                properties_count: properties.length,
                ...sendResult.payload
            }
        })

        // 9. Update deal nurture settings
        await supabase.from('deals').update({ nurture_enabled: true }).eq('id', contact.current_deal_id)

        console.log('Nurture sent successfully:', { contact_id, channel, properties_sent: properties.length })

        return new Response(JSON.stringify({
            success: true,
            message: `Sent ${properties.length} properties via ${channel}`,
            channel,
            properties_sent: properties.length,
            batch_id: batchId,
            ...sendResult.payload
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error('Nurture error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})

// ============ TRANSLATIONS ============
const translations: Record<string, any> = {
    en: {
        subject: 'New Properties For You',
        title: 'New Properties For You',
        greeting: (name: string, count: number) => `Hi ${name}, we've found ${count} new properties matching your preferences.`,
        agentIntro: (name: string, count: number) => `Hi ${name}! I've personally curated this selection of ${count} properties based on your preferences. Each one has been carefully chosen to match what you're looking for. Take a look and let me know which ones catch your eye — I'd love to arrange viewings for you!`,
        yourAgent: 'Your Personal Agent',
        beds: 'beds',
        baths: 'baths',
        viewDetails: 'View Details',
        footer: "You're receiving this because you're looking for properties with us."
    },
    ru: {
        subject: 'Новые объекты для вас',
        title: 'Новые объекты для вас',
        greeting: (name: string, count: number) => `Привет, ${name}! Мы нашли ${count} новых объектов, соответствующих вашим предпочтениям.`,
        agentIntro: (name: string, count: number) => `Привет, ${name}! Я лично подобрал для вас ${count} объектов на основе ваших предпочтений. Каждый из них был тщательно отобран. Посмотрите и дайте знать, какие вам понравились — я с удовольствием организую просмотры!`,
        yourAgent: 'Ваш персональный агент',
        beds: 'спален',
        baths: 'ванных',
        viewDetails: 'Подробнее',
        footer: 'Вы получили это письмо, потому что ищете недвижимость с нами.'
    },
    es: {
        subject: 'Nuevas propiedades para ti',
        title: 'Nuevas propiedades para ti',
        greeting: (name: string, count: number) => `Hola ${name}, hemos encontrado ${count} nuevas propiedades que coinciden con tus preferencias.`,
        agentIntro: (name: string, count: number) => `¡Hola ${name}! He seleccionado personalmente ${count} propiedades basándome en tus preferencias. Cada una ha sido cuidadosamente elegida. ¡Echa un vistazo y dime cuáles te interesan — estaré encantado de organizar visitas!`,
        yourAgent: 'Tu agente personal',
        beds: 'hab.',
        baths: 'baños',
        viewDetails: 'Ver detalles',
        footer: 'Recibes este correo porque estás buscando propiedades con nosotros.'
    }
}

function getLang(language: string): string {
    const lang = language.toLowerCase().trim()
    if (lang === 'ru' || lang.includes('rus') || lang.includes('рус') || lang.includes('russian')) return 'ru'
    if (lang === 'es' || lang.includes('spa') || lang.includes('esp') || lang.includes('spanish')) return 'es'
    return 'en'
}

// ============ EMAIL SENDING ============
async function sendViaEmail(
    contact: any,
    selectionItems: any[],
    agency: any,
    agentInfo: any,
    language: string,
    resendApiKey: string
): Promise<{ success: boolean; error?: string; payload?: any }> {

    if (!contact.primary_email) {
        return { success: false, error: 'No email address for contact' }
    }

    const lang = getLang(language)
    const t = translations[lang] || translations.en

    const agencyName = agency?.name || 'Your Real Estate Agency'
    const primaryColor = agency?.primary_color || '#1a1a1a'
    const logoUrl = agency?.logo_url

    // Generate compact property cards with AI explanation
    const propertyCardsHtml = selectionItems.map((item: any) => {
        const p = item.property_snapshot
        const explanation = item.explanation || ''
        const imageUrl = p?.pictures?.[0]?.url || p?.pictures?.[0] || 'https://via.placeholder.com/300x180?text=No+Image'
        const formattedPrice = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(p?.price || 0)
        const propertyLink = `https://resales-online.com/properties/${p?.resale_ref || p?.id}`
        const specs = [
            p?.bedrooms ? `${p.bedrooms} ${t.beds}` : null,
            p?.bathrooms ? `${p.bathrooms} ${t.baths}` : null,
            p?.built_size ? `${p.built_size} m²` : null
        ].filter(Boolean).join(' · ')

        return `
        <div style="margin-bottom: 24px; border: 1px solid #e5e5e5; border-radius: 6px; overflow: hidden; background: #ffffff;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                    <td width="140" style="vertical-align: top;">
                        <img src="${imageUrl}" alt="" style="width: 140px; height: 100px; object-fit: cover; display: block;" />
                    </td>
                    <td style="vertical-align: top; padding: 12px 16px;">
                        <div style="font-size: 15px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">${p?.name || p?.address || 'Property'}</div>
                        <div style="font-size: 16px; font-weight: 700; color: ${primaryColor}; margin-bottom: 6px;">${formattedPrice}</div>
                        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${specs}</div>
                        <div style="font-size: 12px; color: #9ca3af;">${p?.address || ''}</div>
                    </td>
                </tr>
            </table>
            ${explanation ? `<div style="padding: 12px 16px; background: #f9fafb; border-top: 1px solid #e5e5e5; font-size: 13px; color: #4b5563; line-height: 1.5;">${explanation}</div>` : ''}
            <div style="padding: 12px 16px; border-top: 1px solid #e5e5e5;">
                <a href="${propertyLink}" style="display: inline-block; padding: 8px 16px; background: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 500;">${t.viewDetails}</a>
            </div>
        </div>`
    }).join('')

    const agentIntroHtml = agentInfo ? `
        <div style="margin-bottom: 24px; padding: 16px; background: #f9fafb; border-radius: 6px; border-left: 3px solid ${primaryColor};">
            <div style="font-size: 14px; color: #374151; line-height: 1.6; margin-bottom: 12px;">
                ${t.agentIntro(contact.first_name || '', selectionItems.length)}
            </div>
            <div style="font-size: 13px; font-weight: 600; color: #1a1a1a;">${agentInfo.full_name || ''}</div>
            <div style="font-size: 12px; color: #6b7280;">${t.yourAgent}${agentInfo.phone ? ` · ${agentInfo.phone}` : ''}</div>
        </div>` : ''

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 40px;">
                ${logoUrl ? `<img src="${logoUrl}" alt="${agencyName}" style="max-height: 48px; margin-bottom: 16px;" />` : `<div style="font-size: 24px; font-weight: 700; color: #1a1a1a;">${agencyName}</div>`}
            </div>

            <!-- Main Content -->
            <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h1 style="font-size: 24px; font-weight: 600; color: #1a1a1a; margin: 0 0 8px 0;">${t.title}</h1>
                <p style="font-size: 15px; color: #6b7280; margin: 0 0 32px 0; line-height: 1.6;">
                    ${t.greeting(contact.first_name || 'there', selectionItems.length)}
                </p>

                ${agentIntroHtml}

                <!-- Properties -->
                ${propertyCardsHtml}
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 32px; color: #9ca3af; font-size: 12px;">
                <p style="margin: 0 0 8px 0;">${agencyName}</p>
                <p style="margin: 0;">${t.footer}</p>
            </div>
        </div>
    </body>
    </html>`

    // Send via Resend
    try {
        const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: `${agencyName} <${agencyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}@leads.stayte.ai>`,
                to: contact.primary_email,
                subject: `${selectionItems.length} ${t.subject} – ${agencyName}`,
                html: emailHtml
            })
        })

        if (!resendRes.ok) {
            const errText = await resendRes.text()
            console.error('Resend error:', errText)
            return { success: false, error: `Email send failed: ${errText}` }
        }

        const resendResult = await resendRes.json()
        console.log('Email sent via Resend:', resendResult.id)

        return {
            success: true,
            payload: { resend_id: resendResult.id }
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ============ WHATSAPP SENDING ============
async function sendViaWhatsApp(
    contact: any,
    selectionItems: any[],
    agency: any,
    agentInfo: any,
    _language: string
): Promise<{ success: boolean; error?: string; payload?: any }> {

    if (!contact.phones?.[0]) {
        return { success: false, error: 'No phone number for contact' }
    }

    // TODO: Implement WhatsApp sending via Twilio
    // For now, return a placeholder
    console.log('WhatsApp sending not yet implemented')

    return {
        success: false,
        error: 'WhatsApp channel not yet implemented'
    }
}
