-- Add uuid id column to features table to match property_features.feature_id
ALTER TABLE features ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Make it primary key if not already set
-- First check if there's already a primary key
DO $$
BEGIN
  -- Try to add primary key, ignore if already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'features' AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE features ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Create index on key for faster lookups
CREATE INDEX IF NOT EXISTS idx_features_key ON features(key);

-- Update existing rows to have unique ids if they don't have one
UPDATE features SET id = gen_random_uuid() WHERE id IS NULL;
