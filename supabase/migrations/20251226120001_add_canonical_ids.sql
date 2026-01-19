-- Add canonical ID columns to deal_preference_profiles
ALTER TABLE IF EXISTS public.deal_preference_profiles 
ADD COLUMN IF NOT EXISTS location_ids INTEGER[],
ADD COLUMN IF NOT EXISTS feature_ids TEXT[];

-- Create indexes for array searches
CREATE INDEX IF NOT EXISTS idx_deal_prefs_location_ids ON public.deal_preference_profiles USING GIN(location_ids);
CREATE INDEX IF NOT EXISTS idx_deal_prefs_feature_ids ON public.deal_preference_profiles USING GIN(feature_ids);

-- Add comment for documentation
COMMENT ON COLUMN public.deal_preference_profiles.location_ids IS 'Array of canonical location IDs matched via LLM';
COMMENT ON COLUMN public.deal_preference_profiles.feature_ids IS 'Array of canonical feature keys matched via LLM';
