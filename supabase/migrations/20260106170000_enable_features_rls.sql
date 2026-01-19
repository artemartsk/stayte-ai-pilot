-- Enable RLS on features and property_features tables
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_features ENABLE ROW LEVEL SECURITY;

-- Allow public read access to features (or at least authenticated)
CREATE POLICY "Allow public read access to features"
ON features FOR SELECT
USING (true);

-- Allow public read access to property_features
CREATE POLICY "Allow public read access to property_features"
ON property_features FOR SELECT
USING (true);

-- Ensure authenticated users can also read (redundant with true but good for clarity if rules change)
-- IF NOT EXISTS policies for authenticated users...
