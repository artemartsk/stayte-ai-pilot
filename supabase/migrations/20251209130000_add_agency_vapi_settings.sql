-- Add vapi_settings column to agencies table for custom call configurations
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS vapi_settings JSONB;

-- Comment on column
COMMENT ON COLUMN public.agencies.vapi_settings IS 'Stores custom Vapi configuration for the agency (assistant override, voice, etc)';
