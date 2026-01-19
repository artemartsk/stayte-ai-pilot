-- Добавление активностей для Emily Miller
INSERT INTO activities (
  agency_id,
  contact_id,
  deal_id,
  actor_id,
  type,
  payload,
  created_at
) VALUES 
  -- 1. Создание контакта
  (
    '00000000-0000-0000-0000-000000000001',
    'e0dbc5be-c0ee-4ea7-87cb-2c750fe43a94',
    '022ba431-6c15-483b-bbe2-be70b9d59294',
    NULL,
    'contact_created',
    jsonb_build_object('source', 'web_form', 'campaign', 'costa_del_sol_2024'),
    NOW() - INTERVAL '14 days'
  ),
  -- 2. Отправка первой выборки
  (
    '00000000-0000-0000-0000-000000000001',
    'e0dbc5be-c0ee-4ea7-87cb-2c750fe43a94',
    '022ba431-6c15-483b-bbe2-be70b9d59294',
    NULL,
    'selection_sent',
    jsonb_build_object('selection_count', 3, 'summary', 'Premium coastal properties matching your criteria'),
    NOW() - INTERVAL '10 days'
  ),
  -- 3. Открытие письма
  (
    '00000000-0000-0000-0000-000000000001',
    'e0dbc5be-c0ee-4ea7-87cb-2c750fe43a94',
    '022ba431-6c15-483b-bbe2-be70b9d59294',
    NULL,
    'email_opened',
    jsonb_build_object('subject', 'Your personalized property selection'),
    NOW() - INTERVAL '9 days'
  ),
  -- 4. Просмотр объекта
  (
    '00000000-0000-0000-0000-000000000001',
    'e0dbc5be-c0ee-4ea7-87cb-2c750fe43a94',
    '022ba431-6c15-483b-bbe2-be70b9d59294',
    NULL,
    'property_viewed',
    jsonb_build_object('property_id', 'f93455bd-84af-414b-b196-d19d3ba5cfd7', 'property_name', 'Modern Seaview Apartment'),
    NOW() - INTERVAL '9 days'
  ),
  -- 5. Отправка второй выборки
  (
    '00000000-0000-0000-0000-000000000001',
    'e0dbc5be-c0ee-4ea7-87cb-2c750fe43a94',
    '022ba431-6c15-483b-bbe2-be70b9d59294',
    NULL,
    'selection_sent',
    jsonb_build_object('selection_count', 4, 'summary', 'Family homes with garden and pool'),
    NOW() - INTERVAL '7 days'
  ),
  -- 6. Ответ клиента
  (
    '00000000-0000-0000-0000-000000000001',
    'e0dbc5be-c0ee-4ea7-87cb-2c750fe43a94',
    '022ba431-6c15-483b-bbe2-be70b9d59294',
    NULL,
    'client_replied',
    jsonb_build_object('message', 'I love the contemporary villa in Estepona! Can we schedule a viewing?', 'channel', 'email'),
    NOW() - INTERVAL '6 days'
  ),
  -- 7. Звонок агента
  (
    '00000000-0000-0000-0000-000000000001',
    'e0dbc5be-c0ee-4ea7-87cb-2c750fe43a94',
    '022ba431-6c15-483b-bbe2-be70b9d59294',
    NULL,
    'call_completed',
    jsonb_build_object('duration_minutes', 25, 'outcome', 'scheduled_viewing', 'notes', 'Very interested in properties with sea view and pool'),
    NOW() - INTERVAL '5 days'
  ),
  -- 8. Планирование просмотра
  (
    '00000000-0000-0000-0000-000000000001',
    'e0dbc5be-c0ee-4ea7-87cb-2c750fe43a94',
    '022ba431-6c15-483b-bbe2-be70b9d59294',
    NULL,
    'viewing_scheduled',
    jsonb_build_object('property_id', '11bc2f35-4f56-49c7-b929-6ba5735291d0', 'date', NOW() + INTERVAL '3 days', 'property_name', 'Contemporary Villa with Pool'),
    NOW() - INTERVAL '4 days'
  ),
  -- 9. Обновление статуса
  (
    '00000000-0000-0000-0000-000000000001',
    'e0dbc5be-c0ee-4ea7-87cb-2c750fe43a94',
    '022ba431-6c15-483b-bbe2-be70b9d59294',
    NULL,
    'status_changed',
    jsonb_build_object('from', 'ai_contacting', 'to', 'qualified', 'reason', 'Active engagement and viewing scheduled'),
    NOW() - INTERVAL '4 days'
  ),
  -- 10. Заметка агента
  (
    '00000000-0000-0000-0000-000000000001',
    'e0dbc5be-c0ee-4ea7-87cb-2c750fe43a94',
    '022ba431-6c15-483b-bbe2-be70b9d59294',
    NULL,
    'note_added',
    jsonb_build_object('note', 'Client is very responsive and has clear preferences. Budget confirmed at 300-500k EUR. Looking for move-in ready property.'),
    NOW() - INTERVAL '3 days'
  );