-- Add branding columns to agencies table
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#1a1a1a';

COMMENT ON COLUMN agencies.logo_url IS 'URL to agency logo image';
COMMENT ON COLUMN agencies.primary_color IS 'Primary brand color in hex format';
