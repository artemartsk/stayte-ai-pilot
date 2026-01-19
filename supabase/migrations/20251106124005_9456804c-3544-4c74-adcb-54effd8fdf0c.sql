-- Выборка 3: Доступные варианты (draft, 1 день назад)
INSERT INTO selection_batches (
  id,
  agency_id,
  deal_id,
  kind,
  status,
  summary,
  item_count,
  created_by,
  created_at,
  sent_at
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  '022ba431-6c15-483b-bbe2-be70b9d59294',
  'nurture',
  'draft',
  'Affordable apartments for first purchase',
  3,
  'agent',
  NOW() - INTERVAL '1 day',
  NULL
);

WITH batch3 AS (
  SELECT id FROM selection_batches 
  WHERE deal_id = '022ba431-6c15-483b-bbe2-be70b9d59294'
  AND summary = 'Affordable apartments for first purchase'
  LIMIT 1
)
INSERT INTO selection_items (id, selection_id, property_id, rank, explanation, property_snapshot)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM batch3),
  '1f3c9889-bf54-410d-abd9-b64670f07b00',
  1,
  'Cozy flat in old town Malaga',
  jsonb_build_object(
    'name', 'Old Town Cozy Flat — Málaga',
    'address', 'Calle Granada, Málaga',
    'price', 289000,
    'bedrooms', 1,
    'bathrooms', 1.0,
    'built_size', 58,
    'pictures', ARRAY['https://images.unsplash.com/photo-1523217582562-09d0def993a6', 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488'],
    'type', 'APARTMENT'
  )
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM batch3),
  '2d3d67b5-2ba4-4b9d-97e3-f928ff9fc8e8',
  2,
  'Scandinavian loft in Soho Malaga',
  jsonb_build_object(
    'name', 'Scandinavian Loft — Soho Málaga',
    'address', 'Calle Tomás Heredia, Málaga',
    'price', 355000,
    'bedrooms', 1,
    'bathrooms', 1.0,
    'built_size', 74,
    'pictures', ARRAY['https://images.unsplash.com/photo-1522708323590-a3f2a49bdb3b', 'https://images.unsplash.com/photo-1501183638710-841dd1904471'],
    'type', 'APARTMENT'
  )
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM batch3),
  '9ba24892-4b26-4de7-b2ab-8b3f1a2bd3ae',
  3,
  'Modern apartment with seaview at good price',
  jsonb_build_object(
    'name', 'Penthouse with Rooftop — Marbella Center',
    'address', 'Calle Notario Luis Oliver, Marbella',
    'price', 790000,
    'bedrooms', 3,
    'bathrooms', 2.0,
    'built_size', 180,
    'pictures', ARRAY['https://images.unsplash.com/photo-1512917774080-9991f1c4c750', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'],
    'type', 'APARTMENT'
  );