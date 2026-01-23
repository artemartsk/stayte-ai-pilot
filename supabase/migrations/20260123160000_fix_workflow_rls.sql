
-- Fix RLS policies for ai_workflow_templates
-- The previous migration enabled RLS but only added a SELECT policy.
-- We need INSERT, UPDATE, and DELETE policies to allow managing workflows.

CREATE POLICY "Users can insert ai_workflow_templates for their agency"
    ON ai_workflow_templates FOR INSERT
    TO authenticated
    WITH CHECK (public.is_member_of_agency(agency_id));

CREATE POLICY "Users can update ai_workflow_templates of their agency"
    ON ai_workflow_templates FOR UPDATE
    TO authenticated
    USING (public.is_member_of_agency(agency_id));

CREATE POLICY "Users can delete ai_workflow_templates of their agency"
    ON ai_workflow_templates FOR DELETE
    TO authenticated
    USING (public.is_member_of_agency(agency_id));
