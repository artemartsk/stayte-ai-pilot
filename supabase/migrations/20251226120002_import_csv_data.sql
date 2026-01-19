-- Import locations data
-- This will be populated from locations (1).csv
-- Run: psql -d postgres -c "\COPY public.locations(id, type, name, name_resale, name_ai, description, latitude, longitude, annual_revenue_increase_pct, created_at, updated_at, parent_id, picture, is_favorite) FROM '/path/to/locations (1).csv' DELIMITER ',' CSV HEADER;"

-- For manual import via SQL, use INSERT statements:
-- Example row from CSV:
-- INSERT INTO public.locations VALUES (3, 'municipality', 'Alhaurín de la Torre', 'Alhaurín de la Torre', 'Alhaurín de la Torre', NULL, 36.66034180, -4.55856720, 2.1, '2025-05-29 17:15:49.118854', '2025-05-29 17:15:49.118854', 2, '', false);

-- Import features data  
-- This will be populated from features (3).csv
-- Run: psql -d postgres -c "\COPY public.features(key, icon, name, name_resale, name_ai, created_at, updated_at, property_type, parent_key) FROM '/path/to/features (3).csv' DELIMITER ',' CSV HEADER;"

-- Manual import example:
-- INSERT INTO public.features VALUES ('Features_Gym', 'https://...svg', 'Gym', 'Gym', '', '2024-03-15 12:30:56.966029', '2024-03-15 12:30:56.966029', 'COMPLEX,HOUSE', '');
