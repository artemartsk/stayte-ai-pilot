-- Insert 10 contacts with American names into the default agency
-- Replace with actual agency_id from your agencies table

INSERT INTO contacts (
  agency_id,
  first_name,
  last_name,
  primary_email,
  emails,
  primary_phone,
  phones,
  current_status
) VALUES
  (
    (SELECT id FROM agencies LIMIT 1),
    'John',
    'Smith',
    'john.smith@email.com',
    ARRAY['john.smith@email.com']::citext[],
    '+1-555-0101',
    ARRAY['+1-555-0101'],
    'new'
  ),
  (
    (SELECT id FROM agencies LIMIT 1),
    'Emma',
    'Johnson',
    'emma.johnson@email.com',
    ARRAY['emma.johnson@email.com']::citext[],
    '+1-555-0102',
    ARRAY['+1-555-0102'],
    'new'
  ),
  (
    (SELECT id FROM agencies LIMIT 1),
    'Michael',
    'Williams',
    'michael.williams@email.com',
    ARRAY['michael.williams@email.com']::citext[],
    '+1-555-0103',
    ARRAY['+1-555-0103'],
    'new'
  ),
  (
    (SELECT id FROM agencies LIMIT 1),
    'Sarah',
    'Brown',
    'sarah.brown@email.com',
    ARRAY['sarah.brown@email.com']::citext[],
    '+1-555-0104',
    ARRAY['+1-555-0104'],
    'new'
  ),
  (
    (SELECT id FROM agencies LIMIT 1),
    'David',
    'Jones',
    'david.jones@email.com',
    ARRAY['david.jones@email.com']::citext[],
    '+1-555-0105',
    ARRAY['+1-555-0105'],
    'new'
  ),
  (
    (SELECT id FROM agencies LIMIT 1),
    'Jessica',
    'Garcia',
    'jessica.garcia@email.com',
    ARRAY['jessica.garcia@email.com']::citext[],
    '+1-555-0106',
    ARRAY['+1-555-0106'],
    'new'
  ),
  (
    (SELECT id FROM agencies LIMIT 1),
    'James',
    'Martinez',
    'james.martinez@email.com',
    ARRAY['james.martinez@email.com']::citext[],
    '+1-555-0107',
    ARRAY['+1-555-0107'],
    'new'
  ),
  (
    (SELECT id FROM agencies LIMIT 1),
    'Ashley',
    'Rodriguez',
    'ashley.rodriguez@email.com',
    ARRAY['ashley.rodriguez@email.com']::citext[],
    '+1-555-0108',
    ARRAY['+1-555-0108'],
    'new'
  ),
  (
    (SELECT id FROM agencies LIMIT 1),
    'Robert',
    'Davis',
    'robert.davis@email.com',
    ARRAY['robert.davis@email.com']::citext[],
    '+1-555-0109',
    ARRAY['+1-555-0109'],
    'new'
  ),
  (
    (SELECT id FROM agencies LIMIT 1),
    'Emily',
    'Miller',
    'emily.miller@email.com',
    ARRAY['emily.miller@email.com']::citext[],
    '+1-555-0110',
    ARRAY['+1-555-0110'],
    'new'
  );