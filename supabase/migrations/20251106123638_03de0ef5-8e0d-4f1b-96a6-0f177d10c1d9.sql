-- Insert property selection for Emily Miller's existing deal
WITH new_selection AS (
  INSERT INTO selection_batches (
    id,
    deal_id,
    agency_id,
    kind,
    status,
    item_count,
    summary,
    created_at
  ) VALUES (
    gen_random_uuid(),
    '022ba431-6c15-483b-bbe2-be70b9d59294',
    '00000000-0000-0000-0000-000000000001',
    'hot',
    'sent',
    3,
    'Premium coastal properties matching your criteria',
    now()
  )
  RETURNING id
)
INSERT INTO selection_items (
  selection_id,
  property_id,
  rank,
  explanation
)
SELECT 
  new_selection.id,
  property_id,
  rank,
  explanation
FROM new_selection, (VALUES
  ('f93455bd-84af-414b-b196-d19d3ba5cfd7', 1, 'Beautiful sea view villa with modern amenities'),
  ('11bc2f35-4f56-49c7-b929-6ba5735291d0', 2, 'Spacious apartment in gated community'),
  ('1f3c9889-bf54-410d-abd9-b64670f07b00', 3, 'Luxury townhouse with private pool')
) AS props(property_id, rank, explanation);