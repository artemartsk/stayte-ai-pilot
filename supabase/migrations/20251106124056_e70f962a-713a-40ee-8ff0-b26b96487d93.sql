-- Обновление статуса сделки Emily Miller на qualified и обновление первой выборки
UPDATE deals 
SET status = 'qualified',
    segment = 'hot',
    updated_at = NOW()
WHERE id = '022ba431-6c15-483b-bbe2-be70b9d59294';

-- Обновляем первую выборку с полными данными в property_snapshot
UPDATE selection_items si
SET property_snapshot = CASE si.property_id
  WHEN 'f93455bd-84af-414b-b196-d19d3ba5cfd7' THEN jsonb_build_object(
    'name', 'Modern Seaview Apartment — Marbella',
    'address', 'Av. Ricardo Soriano, Marbella',
    'price', 475000,
    'bedrooms', 2,
    'bathrooms', 2.0,
    'built_size', 110,
    'pictures', ARRAY['https://images.unsplash.com/photo-1493809842364-78817add7ffb', 'https://images.unsplash.com/photo-1501183638710-841dd1904471'],
    'type', 'APARTMENT'
  )
  WHEN '11bc2f35-4f56-49c7-b929-6ba5735291d0' THEN jsonb_build_object(
    'name', 'Contemporary Villa with Pool — Estepona',
    'address', 'Camino del Reloj, Estepona',
    'price', 1450000,
    'bedrooms', 4,
    'bathrooms', 3.5,
    'built_size', 320,
    'pictures', ARRAY['https://images.unsplash.com/photo-1507089947368-19c1da9775ae'],
    'type', 'HOUSE'
  )
  WHEN '1f3c9889-bf54-410d-abd9-b64670f07b00' THEN jsonb_build_object(
    'name', 'Luxury Townhouse — Marbella',
    'address', 'Nueva Andalucía, Marbella',
    'price', 790000,
    'bedrooms', 3,
    'bathrooms', 2.5,
    'built_size', 185,
    'pictures', ARRAY['https://images.unsplash.com/photo-1512917774080-9991f1c4c750'],
    'type', 'HOUSE'
  )
  ELSE si.property_snapshot
END
WHERE si.selection_id IN (
  SELECT sb.id 
  FROM selection_batches sb 
  WHERE sb.deal_id = '022ba431-6c15-483b-bbe2-be70b9d59294' 
  AND sb.summary = 'Premium coastal properties matching your criteria'
);