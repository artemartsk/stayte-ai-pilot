-- Создание выборок недвижимости для Анны Ивановой
-- Contact ID: 26825651-046b-4c2f-967b-1a2d869d1fbc
-- Deal ID: 50e5c49b-8b82-4e98-b548-6ceb9b658be1
-- Agency ID: 00000000-0000-0000-0000-000000000001

-- Выборка 1: Премиум недвижимость с видом на море
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
  '50e5c49b-8b82-4e98-b548-6ceb9b658be1',
  'ai_generated',
  'sent',
  'Подборка премиальных объектов с видом на море и современным дизайном',
  5,
  'ai',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days'
);

-- Сохраняем ID первой выборки
WITH batch1 AS (
  SELECT id FROM selection_batches 
  WHERE deal_id = '50e5c49b-8b82-4e98-b548-6ceb9b658be1'
  ORDER BY created_at DESC LIMIT 1
)
INSERT INTO selection_items (id, selection_id, property_id, rank, explanation, property_snapshot)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM batch1),
  '9ba24892-4b26-4de7-b2ab-8b3f1a2bd3ae',
  1,
  'Пентхаус в центре Марбельи с террасой на крыше. Идеален для инвестиций.',
  jsonb_build_object(
    'name', 'Penthouse with Rooftop — Marbella Center',
    'address', 'Calle Notario Luis Oliver, Marbella',
    'price', 790000,
    'bedrooms', 3,
    'bathrooms', 2.0,
    'built_size', 180,
    'pictures', ARRAY['https://images.unsplash.com/photo-1512917774080-9991f1c4c750', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'],
    'type', 'APARTMENT'
  )
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM batch1),
  'f93455bd-84af-414b-b196-d19d3ba5cfd7',
  2,
  'Современная квартира с видом на море в Марбелье',
  jsonb_build_object(
    'name', 'Modern Seaview Apartment — Marbella',
    'address', 'Av. Ricardo Soriano, Marbella',
    'price', 475000,
    'bedrooms', 2,
    'bathrooms', 2.0,
    'built_size', 110,
    'pictures', ARRAY['https://images.unsplash.com/photo-1493809842364-78817add7ffb', 'https://images.unsplash.com/photo-1501183638710-841dd1904471'],
    'type', 'APARTMENT'
  )
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM batch1),
  'db938b65-1142-4468-a05e-bf82fbba435e',
  3,
  'Роскошная вилла на первой линии пляжа в восточной части Марбельи',
  jsonb_build_object(
    'name', 'Luxury Beachfront Villa — Marbella East',
    'address', 'Urb. Los Monteros, Marbella',
    'price', 6850000,
    'bedrooms', 6,
    'bathrooms', 7.0,
    'built_size', 950,
    'pictures', ARRAY['https://images.unsplash.com/photo-1507089947368-19c1da9775ae', 'https://images.unsplash.com/photo-1493809842364-78817add7ffb'],
    'type', 'HOUSE'
  )
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM batch1),
  '3eaab016-a614-4593-80c5-c5942f4441bd',
  4,
  'Новая застройка в Сан Педро с качественной отделкой',
  jsonb_build_object(
    'name', 'New Development 2BR — San Pedro',
    'address', 'Av. Pablo Ruiz Picasso, San Pedro Alcántara',
    'price', 520000,
    'bedrooms', 2,
    'bathrooms', 2.0,
    'built_size', 110,
    'pictures', ARRAY['https://images.unsplash.com/photo-1523217582562-09d0def993a6', 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488'],
    'type', 'APARTMENT'
  )
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM batch1),
  '8157b993-651f-40ab-8cf9-0786adbeda6f',
  5,
  'Вилла на первой линии гольфа в Nueva Andalucía',
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

-- Выборка 2: Семейные дома и виллы
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
  '50e5c49b-8b82-4e98-b548-6ceb9b658be1',
  'ai_generated',
  'sent',
  'Семейные дома с садом и бассейном',
  4,
  'ai',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
);

WITH batch2 AS (
  SELECT id FROM selection_batches 
  WHERE deal_id = '50e5c49b-8b82-4e98-b548-6ceb9b658be1'
  ORDER BY created_at DESC LIMIT 1
)
INSERT INTO selection_items (id, selection_id, property_id, rank, explanation, property_snapshot)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM batch2),
  '11bc2f35-4f56-49c7-b929-6ba5735291d0',
  1,
  'Современная вилла с бассейном в Эстепоне',
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
  'Дом в андалузском стиле в Михас Пуэбло',
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
  'Семейный дом рядом с пляжем в Фуэнхироле',
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
  'Просторная вилла на гольфе для большой семьи',
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

-- Выборка 3: Бюджетные варианты
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
  '50e5c49b-8b82-4e98-b548-6ceb9b658be1',
  'manual',
  'draft',
  'Доступные квартиры для первой покупки',
  3,
  'agent',
  NOW() - INTERVAL '1 day',
  NULL
);

WITH batch3 AS (
  SELECT id FROM selection_batches 
  WHERE deal_id = '50e5c49b-8b82-4e98-b548-6ceb9b658be1'
  ORDER BY created_at DESC LIMIT 1
)
INSERT INTO selection_items (id, selection_id, property_id, rank, explanation, property_snapshot)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM batch3),
  '1f3c9889-bf54-410d-abd9-b64670f07b00',
  1,
  'Уютная квартира в старом городе Малаги',
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
  'Скандинавский лофт в районе Сохо Малаги',
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
  'f93455bd-84af-414b-b196-d19d3ba5cfd7',
  3,
  'Современная квартира с видом на море по хорошей цене',
  jsonb_build_object(
    'name', 'Modern Seaview Apartment — Marbella',
    'address', 'Av. Ricardo Soriano, Marbella',
    'price', 475000,
    'bedrooms', 2,
    'bathrooms', 2.0,
    'built_size', 110,
    'pictures', ARRAY['https://images.unsplash.com/photo-1493809842364-78817add7ffb', 'https://images.unsplash.com/photo-1501183638710-841dd1904471'],
    'type', 'APARTMENT'
  );
