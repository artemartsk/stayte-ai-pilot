-- Migration: Add agent profile characteristics for smart lead distribution
-- This adds fields to help match agents with leads based on language, experience, etc.

-- Agent languages (ISO 639-1 codes)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{}';

-- Agent specializations (e.g., 'luxury', 'investment', 'new_builds', 'resale')
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS specializations text[] DEFAULT '{}';

-- Years of experience
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experience_years integer DEFAULT 0;

-- Free-form agent bio/description
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;

-- Target segments the agent prefers to work with (e.g., 'hot_buyer', 'qualified', 'cold')
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_segments text[] DEFAULT '{}';

-- Maximum number of concurrent active leads
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_active_leads integer DEFAULT 20;

-- Whether agent is available for auto-assignment
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS available_for_assignment boolean DEFAULT true;

-- Comments for clarity
COMMENT ON COLUMN profiles.languages IS 'ISO 639-1 language codes the agent speaks, e.g. en, pl, ru, es';
COMMENT ON COLUMN profiles.specializations IS 'Agent specializations: luxury, investment, new_builds, resale, commercial';
COMMENT ON COLUMN profiles.target_segments IS 'Lead segments agent prefers: hot_buyer, qualified, warm, cold';
COMMENT ON COLUMN profiles.max_active_leads IS 'Maximum concurrent active leads for load balancing';
COMMENT ON COLUMN profiles.available_for_assignment IS 'Whether agent accepts auto-assigned leads';
