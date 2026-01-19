-- Add commission and year_built columns to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS commission NUMERIC,
ADD COLUMN IF NOT EXISTS year_built INTEGER,
ADD COLUMN IF NOT EXISTS original_price NUMERIC;
