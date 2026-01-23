-- Migration: Add missing feature and condition columns to deals table
-- Description: Resolves errors when handle-inbound-lead tries to update non-existent columns.

ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS feature_cinema boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS feature_double_glazing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS feature_domotics boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS climate_control_air_conditioning boolean DEFAULT false;

-- Add any other potentially missing columns from the allowedDealKeys list
-- feature_fitted_wardrobes
-- feature_private_parking
-- feature_mountain_view
-- feature_gated_community
-- feature_private_pool

ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS feature_fitted_wardrobes boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS feature_private_parking boolean DEFAULT false;

-- Re-verify existing columns to be safe (IF NOT EXISTS makes this idempotent)
ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS max_budget numeric,
ADD COLUMN IF NOT EXISTS budget_min numeric,
ADD COLUMN IF NOT EXISTS budget_max numeric;
