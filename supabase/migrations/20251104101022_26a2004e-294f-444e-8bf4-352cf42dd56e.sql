-- Enable public read access for features (reference table)
CREATE POLICY "features_public_read"
ON features
FOR SELECT
TO authenticated
USING (true);

-- Enable public read access for property_features (junction table)
CREATE POLICY "property_features_public_read"
ON property_features
FOR SELECT
TO authenticated
USING (true);
