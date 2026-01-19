
-- Seed default lead sources for all existing agencies
INSERT INTO public.lead_sources (agency_id, name, label, color)
SELECT id, 'idealista', 'Idealista', '#f97316' FROM public.agencies
ON CONFLICT (agency_id, name) DO NOTHING;

INSERT INTO public.lead_sources (agency_id, name, label, color)
SELECT id, 'website', 'Website', '#3b82f6' FROM public.agencies
ON CONFLICT (agency_id, name) DO NOTHING;

INSERT INTO public.lead_sources (agency_id, name, label, color)
SELECT id, 'whatsapp', 'WhatsApp', '#22c55e' FROM public.agencies
ON CONFLICT (agency_id, name) DO NOTHING;
