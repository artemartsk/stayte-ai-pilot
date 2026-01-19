-- Add additional features identified from Resales Online API sync
INSERT INTO features (key, name, "nameResale", "propertyType")
VALUES
  ('feature_photovoltaic_solar_panels', 'Photovoltaic Solar Panels', 'Photovoltaic solar panels', null),
  ('feature_with_planning_permission', 'With Planning Permission', 'With Planning Permission', null),
  ('category_repossession', 'Repossession', 'Repossession', null),
  ('feature_solar_water_heating', 'Solar Water Heating', 'Solar water heating', null),
  ('feature_easy_maintenance', 'Easy Maintenance', 'Easy Maintenance', null)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  "nameResale" = EXCLUDED."nameResale",
  "propertyType" = EXCLUDED."propertyType",
  "updatedAt" = now();
