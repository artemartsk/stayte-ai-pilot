-- Update existing deals to assign them to the same agent as their contact
UPDATE deals d
SET primary_agent_id = c.assignee_id
FROM contacts c
WHERE d.contact_id = c.id 
  AND d.primary_agent_id IS NULL 
  AND c.assignee_id IS NOT NULL;

-- Create a function to automatically assign deal to contact's agent
CREATE OR REPLACE FUNCTION assign_deal_to_contact_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- If primary_agent_id is not set, use the contact's assignee_id
  IF NEW.primary_agent_id IS NULL THEN
    SELECT assignee_id INTO NEW.primary_agent_id
    FROM contacts
    WHERE id = NEW.contact_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-assign deals on insert
DROP TRIGGER IF EXISTS auto_assign_deal_agent ON deals;
CREATE TRIGGER auto_assign_deal_agent
  BEFORE INSERT ON deals
  FOR EACH ROW
  EXECUTE FUNCTION assign_deal_to_contact_agent();

-- Create trigger to update deal agent when contact is reassigned
CREATE OR REPLACE FUNCTION update_deal_agent_on_contact_reassign()
RETURNS TRIGGER AS $$
BEGIN
  -- When a contact's assignee changes, update all their deals
  IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    UPDATE deals
    SET primary_agent_id = NEW.assignee_id
    WHERE contact_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_deal_agent_on_contact_update ON contacts;
CREATE TRIGGER sync_deal_agent_on_contact_update
  AFTER UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_agent_on_contact_reassign();