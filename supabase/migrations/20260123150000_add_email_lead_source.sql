
-- Add 'email' to lead sources for all existing agencies
INSERT INTO public.lead_sources (agency_id, name, label, color)
SELECT id, 'email', 'Email', '#64748b' FROM public.agencies
ON CONFLICT (agency_id, name) DO NOTHING;
