-- Recreate Foreign Key on property_features to point to features(id)
-- First, drop existing constraint if name is known, or generic alter
ALTER TABLE property_features DROP CONSTRAINT IF EXISTS property_features_feature_id_fkey;

-- Make sure feature_id column types match (both uuid)
-- If property_features.feature_id was text (pointing to key), we need to migrate data first!
-- WAIT! property_features.feature_id was ALREADY uuid (step 747).
-- So we just need to make sure it points to features(id).

ALTER TABLE property_features
  ADD CONSTRAINT property_features_feature_id_fkey
  FOREIGN KEY (feature_id)
  REFERENCES features(id)
  ON DELETE CASCADE;
