-- Add insight extraction columns to contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS budget TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS location_preferences TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS bedrooms TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS timeline TEXT;

-- Index for quick filtering
CREATE INDEX IF NOT EXISTS contacts_budget_idx ON public.contacts (budget);
CREATE INDEX IF NOT EXISTS contacts_location_preferences_idx ON public.contacts (location_preferences);
