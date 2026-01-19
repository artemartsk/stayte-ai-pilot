-- Replace province/area text fields with location_id FK
-- This links properties to the hierarchical locations table

ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);

CREATE INDEX IF NOT EXISTS idx_properties_location_id 
ON properties(location_id);

COMMENT ON COLUMN properties.location_id IS 'FK to locations table - most specific location (area > municipality > province)';
