ALTER TABLE properties ADD COLUMN IF NOT EXISTS listing_category text;
COMMENT ON COLUMN properties.listing_category IS 'The category of the property listing, e.g., sale, rent, from Resales Online or other sources.';
