-- Fix search_path security warnings for the new functions
CREATE OR REPLACE FUNCTION assign_deal_to_contact_agent()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If primary_agent_id is not set, use the contact's assignee_id
  IF NEW.primary_agent_id IS NULL THEN
    SELECT assignee_id INTO NEW.primary_agent_id
    FROM contacts
    WHERE id = NEW.contact_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_deal_agent_on_contact_reassign()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a contact's assignee changes, update all their deals
  IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    UPDATE deals
    SET primary_agent_id = NEW.assignee_id
    WHERE contact_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;