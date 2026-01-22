-- Enable RLS on all relevant public tables
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_property_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

-- 1. Reference Data (Public/Auth Read)
-- Locations
DROP POLICY IF EXISTS "Authenticated users can view locations" ON locations;
CREATE POLICY "Authenticated users can view locations"
    ON locations FOR SELECT
    TO authenticated
    USING (true);

-- Features
DROP POLICY IF EXISTS "Authenticated users can view features" ON features;
CREATE POLICY "Authenticated users can view features"
    ON features FOR SELECT
    TO authenticated
    USING (true);

-- 2. User Data
-- Memberships
DROP POLICY IF EXISTS "Users can view own memberships" ON memberships;
CREATE POLICY "Users can view own memberships"
    ON memberships FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- 3. Agency Data (Agency Isolation)
-- Agencies
DROP POLICY IF EXISTS "Users can view own agency" ON agencies;
CREATE POLICY "Users can view own agency"
    ON agencies FOR SELECT
    TO authenticated
    USING (public.is_member_of_agency(id));

-- Contacts
DROP POLICY IF EXISTS "Users can view contacts of their agency" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts for their agency" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts of their agency" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts of their agency" ON contacts;

CREATE POLICY "Users can view contacts of their agency"
    ON contacts FOR SELECT
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

CREATE POLICY "Users can insert contacts for their agency"
    ON contacts FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_agency(agency_id));

CREATE POLICY "Users can update contacts of their agency"
    ON contacts FOR UPDATE
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

CREATE POLICY "Users can delete contacts of their agency"
    ON contacts FOR DELETE
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

-- Deals
DROP POLICY IF EXISTS "Users can view deals of their agency" ON deals;
DROP POLICY IF EXISTS "Users can insert deals for their agency" ON deals;
DROP POLICY IF EXISTS "Users can update deals of their agency" ON deals;

CREATE POLICY "Users can view deals of their agency"
    ON deals FOR SELECT
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

CREATE POLICY "Users can insert deals for their agency"
    ON deals FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_agency(agency_id));

CREATE POLICY "Users can update deals of their agency"
    ON deals FOR UPDATE
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

-- Activities
-- Drop potentially conflicting old policy name if known
DROP POLICY IF EXISTS "Users can view their agency activities" ON activities;
DROP POLICY IF EXISTS "Users can view activities of their agency" ON activities;
DROP POLICY IF EXISTS "Users can insert activities for their agency" ON activities;

CREATE POLICY "Users can view activities of their agency"
    ON activities FOR SELECT
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

CREATE POLICY "Users can insert activities for their agency"
    ON activities FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_agency(agency_id));

-- AI Tasks
DROP POLICY IF EXISTS "Users can view ai_tasks of their agency" ON ai_tasks;
CREATE POLICY "Users can view ai_tasks of their agency"
    ON ai_tasks FOR SELECT
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

-- AI Workflow Templates
DROP POLICY IF EXISTS "Users can view ai_workflow_templates of their agency" ON ai_workflow_templates;
CREATE POLICY "Users can view ai_workflow_templates of their agency"
    ON ai_workflow_templates FOR SELECT
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

-- Chat Messages
DROP POLICY IF EXISTS "Users can view chat_messages of their agency" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert chat_messages for their agency" ON chat_messages;

CREATE POLICY "Users can view chat_messages of their agency"
    ON chat_messages FOR SELECT
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

CREATE POLICY "Users can insert chat_messages for their agency"
    ON chat_messages FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_agency(agency_id));

-- Contact Communications
DROP POLICY IF EXISTS "Users can view contact_communications of their agency" ON contact_communications;
CREATE POLICY "Users can view contact_communications of their agency"
    ON contact_communications FOR SELECT
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

-- Contact Profiles
DROP POLICY IF EXISTS "Users can view contact_profiles of their agency" ON contact_profiles;
CREATE POLICY "Users can view contact_profiles of their agency"
    ON contact_profiles FOR SELECT
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

-- Lead Sources
DROP POLICY IF EXISTS "Users can view lead_sources of their agency" ON lead_sources;
CREATE POLICY "Users can view lead_sources of their agency"
    ON lead_sources FOR SELECT
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

-- Tasks
DROP POLICY IF EXISTS "Users can view tasks of their agency" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks for their agency" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks of their agency" ON tasks;

CREATE POLICY "Users can view tasks of their agency"
    ON tasks FOR SELECT
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

CREATE POLICY "Users can insert tasks for their agency"
    ON tasks FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_agency(agency_id));

CREATE POLICY "Users can update tasks of their agency"
    ON tasks FOR UPDATE
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

-- Workflow Runs
DROP POLICY IF EXISTS "Users can view workflow_runs of their agency" ON workflow_runs;
CREATE POLICY "Users can view workflow_runs of their agency"
    ON workflow_runs FOR SELECT
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

-- 4. Dependent Tables (No agency_id, rely on join)

-- Contact Group Members
DROP POLICY IF EXISTS "Users can view contact_group_members of their agency" ON contact_group_members;
CREATE POLICY "Users can view contact_group_members of their agency"
    ON contact_group_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.contact_groups cg 
            WHERE cg.id = contact_group_members.group_id 
            AND public.is_member_of_agency(cg.agency_id)
        )
    );

-- Contact Property History
DROP POLICY IF EXISTS "Users can view contact_property_history of their agency" ON contact_property_history;
CREATE POLICY "Users can view contact_property_history of their agency"
    ON contact_property_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.contacts c
            WHERE c.id = contact_property_history.contact_id
            AND public.is_member_of_agency(c.agency_id)
        )
    );
