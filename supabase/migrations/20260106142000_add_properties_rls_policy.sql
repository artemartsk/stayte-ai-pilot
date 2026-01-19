-- Enable RLS on properties table if not already enabled
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Allow only authenticated users to read properties
CREATE POLICY "Allow authenticated users to read properties" 
ON properties 
FOR SELECT 
TO authenticated
USING (true);

-- Enable RLS and add policies for property_features
ALTER TABLE property_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read property_features" 
ON property_features 
FOR SELECT 
TO authenticated
USING (true);

-- Enable RLS and add policies for property_tags
ALTER TABLE property_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read property_tags" 
ON property_tags 
FOR SELECT 
TO authenticated
USING (true);

-- Enable RLS and add policies for features (referenced by property_features)
ALTER TABLE features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read features" 
ON features 
FOR SELECT 
TO authenticated
USING (true);
