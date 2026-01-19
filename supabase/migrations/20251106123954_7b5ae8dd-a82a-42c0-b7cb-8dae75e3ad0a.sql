-- Добавление выборок 2 и 3 для Emily Miller
-- Deal ID: 022ba431-6c15-483b-bbe2-be70b9d59294

-- Выборка 2: Семейные дома и виллы (sent 7 days ago)
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
  'hot',
  'sent',
  'Family homes with garden and pool',
  4,
  'ai',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
);

-- Получаем ID второй выборки и добавляем items
WITH batch2 AS (
  SELECT id FROM selection_batches 
  WHERE deal_id = '022ba431-6c15-483b-bbe2-be70b9d59294'
  AND summary = 'Family homes with garden and pool'
  LIMIT 1
)
INSERT INTO selection_items (id, selection_id, property_id, rank, explanation, property_snapshot)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM batch2),
  '11bc2f35-4f56-49c7-b929-6ba5735291d0',
  1,
  'Contemporary villa with pool in Estepona',
  jsonb_build_object(
    'name', 'Contemporary Villa with Pool — Estepona',
    'address', 'Camino del Reloj, Estepona',
    'price', 1450000,
    'bedrooms', 4,
    'bathrooms', 3.5,
    'built_size', 320,
    'pictures', ARRAY['https://images.unsplash.com/photo-1507089947368-19c1da9775ae', 'https://images.unsplash.com/photo-1505692794403-34d4982c1e1c'],
    'type', 'HOUSE'
  )
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM batch2),
  '135db24d-29ce-4b08-86a5-55cb9755fce0',
  2,
  'Andalusian style house in Mijas Pueblo',
  jsonb_build_object(
    'name', 'Andalusian Style House — Mijas Pueblo',
    'address', 'Calle Málaga, Mijas',
    'price', 625000,
    'bedrooms', 3,
    'bathrooms', 2.0,
    'built_size', 190,
    'pictures', ARRAY['https://images.unsplash.com/photo-1499955085172-a104c9463ece', 'https://images.unsplash.com/photo-1505692794403-34d4982c1e1c'],
    'type', 'HOUSE'
  )
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM batch2),
  'cc4eaef2-5f18-4176-a017-817dcf9b2fb5',
  3,
  'Family house near beach in Fuengirola',
  jsonb_build_object(
    'name', 'Family House Near Beach — Fuengirola',
    'address', 'Av. de Mijas, Fuengirola',
    'price', 565000,
    'bedrooms', 3,
    'bathrooms', 2.5,
    'built_size', 210,
    'pictures', ARRAY['https://images.unsplash.com/photo-1505691938895-1758d7feb511', 'https://images.unsplash.com/photo-1502005229762-cf1b2da7c3f5'],
    'type', 'HOUSE'
  )
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM batch2),
  '8157b993-651f-40ab-8cf9-0786adbeda6f',
  4,
  'Spacious golf frontline villa for large family',
  jsonb_build_object(
    'name', 'Golf Frontline Villa — Nueva Andalucía',
    'address', 'Av. del Prado, Marbella',
    'price', 2850000,
    'bedrooms', 5,
    'bathrooms', 5.5,
    'built_size', 560,
    'pictures', ARRAY['https://images.unsplash.com/photo-1536376072261-38c6b3947d8e', 'https://images.unsplash.com/photo-1505691723518-36a1fc42e12a'],
    'type', 'HOUSE'
  );