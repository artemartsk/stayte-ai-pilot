-- Add timeline to deal_preference_profiles and missing columns to contact_profiles
ALTER TABLE IF EXISTS public.deal_preference_profiles 
ADD COLUMN IF NOT EXISTS timeline TEXT;

-- Ensure contact_profiles has necessary columns for extraction
ALTER TABLE IF EXISTS public.contact_profiles
ADD COLUMN IF NOT EXISTS nationality TEXT,
ADD COLUMN IF NOT EXISTS language_primary TEXT,
ADD COLUMN IF NOT EXISTS summary TEXT;
