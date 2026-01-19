-- Add unique constraint on resale_ref for upsert operations
ALTER TABLE properties ADD CONSTRAINT properties_resale_ref_unique UNIQUE (resale_ref);
