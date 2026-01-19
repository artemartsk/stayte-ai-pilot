
-- Create 8 test auth users for agents
DO $$
DECLARE
  agent_ids uuid[] := ARRAY[
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid()
  ];
  agent_names text[] := ARRAY[
    'Sarah Johnson',
    'Michael Chen',
    'Emma Davis',
    'James Wilson',
    'Olivia Martinez',
    'David Brown',
    'Sophia Taylor',
    'Daniel Anderson'
  ];
  agent_emails text[] := ARRAY[
    'sarah.johnson@test.com',
    'michael.chen@test.com',
    'emma.davis@test.com',
    'james.wilson@test.com',
    'olivia.martinez@test.com',
    'david.brown@test.com',
    'sophia.taylor@test.com',
    'daniel.anderson@test.com'
  ];
  i integer;
BEGIN
  -- Insert auth users
  FOR i IN 1..8 LOOP
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      agent_ids[i],
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      agent_emails[i],
      crypt('password123', gen_salt('bf')),
      now(),
      jsonb_build_object('full_name', agent_names[i]),
      now(),
      now(),
      '',
      ''
    );

    -- Insert profile
    INSERT INTO profiles (id, full_name, agency_id, role, phone)
    VALUES (
      agent_ids[i],
      agent_names[i],
      '00000000-0000-0000-0000-000000000001',
      'agent',
      '+1-555-010' || i
    );

    -- Insert membership
    INSERT INTO memberships (agency_id, user_id, role, active)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      agent_ids[i],
      'agent',
      true
    );
  END LOOP;

  -- Distribute contacts among all agents (including the 2 existing + 8 new = 10 total)
  WITH agent_list AS (
    SELECT m.user_id, ROW_NUMBER() OVER (ORDER BY p.full_name) as agent_num
    FROM memberships m
    JOIN profiles p ON p.id = m.user_id
    WHERE m.agency_id = '00000000-0000-0000-0000-000000000001'
      AND m.active = true
  ),
  contacts_list AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as contact_num
    FROM contacts
    WHERE agency_id = '00000000-0000-0000-0000-000000000001'
  )
  UPDATE contacts c
  SET assignee_id = (
    SELECT user_id
    FROM agent_list
    WHERE agent_num = ((cl.contact_num - 1) % 10 + 1)
  )
  FROM contacts_list cl
  WHERE c.id = cl.id;
END $$;
