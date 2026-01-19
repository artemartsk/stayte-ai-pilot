-- Migration: Workflow Execution Engine
-- Adds trigger_config to workflows and creates workflow_runs table

-- 0. Add marketing_source column to contacts (for lead source filtering)
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS marketing_source TEXT;

COMMENT ON COLUMN public.contacts.marketing_source IS 'Lead source: dynamically managed per agency';

-- 0.1 Create lead_sources table for dynamic source options
CREATE TABLE IF NOT EXISTS public.lead_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    color TEXT DEFAULT '#6b7280',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agency_id, name)
);

-- RLS for lead_sources
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view lead sources for their agency" ON public.lead_sources;
CREATE POLICY "Users can view lead sources for their agency"
    ON public.lead_sources FOR SELECT
    USING (agency_id IN (SELECT agency_id FROM public.memberships WHERE user_id = auth.uid() AND active = true));

DROP POLICY IF EXISTS "Admins can manage lead sources" ON public.lead_sources;
CREATE POLICY "Admins can manage lead sources"
    ON public.lead_sources FOR ALL
    USING (agency_id IN (SELECT agency_id FROM public.memberships WHERE user_id = auth.uid() AND active = true AND role IN ('admin', 'owner')));

-- 1. Add trigger_config column to ai_workflow_templates
ALTER TABLE public.ai_workflow_templates 
ADD COLUMN IF NOT EXISTS trigger_config JSONB DEFAULT '{}';

COMMENT ON COLUMN public.ai_workflow_templates.trigger_config IS 
'Trigger configuration: {"event": "contact_created|contact_updated|manual", "conditions": {...}}';

-- 2. Create workflow_runs table to track active executions
CREATE TABLE IF NOT EXISTS public.workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.ai_workflow_templates(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    current_node_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'waiting', 'completed', 'failed')),
    started_at TIMESTAMPTZ DEFAULT now(),
    next_run_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    context JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_next_run ON public.workflow_runs(next_run_at) WHERE status IN ('pending', 'waiting');
CREATE INDEX IF NOT EXISTS idx_workflow_runs_contact ON public.workflow_runs(contact_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON public.workflow_runs(workflow_id);

-- RLS
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view workflow runs for their agency" ON public.workflow_runs;
CREATE POLICY "Users can view workflow runs for their agency"
    ON public.workflow_runs FOR SELECT
    USING (agency_id IN (SELECT agency_id FROM public.memberships WHERE user_id = auth.uid() AND active = true));

DROP POLICY IF EXISTS "Users can manage workflow runs for their agency" ON public.workflow_runs;
CREATE POLICY "Users can manage workflow runs for their agency"
    ON public.workflow_runs FOR ALL
    USING (agency_id IN (SELECT agency_id FROM public.memberships WHERE user_id = auth.uid() AND active = true));

-- 3. Function to check and start workflows on contact changes
CREATE OR REPLACE FUNCTION public.check_workflow_triggers()
RETURNS TRIGGER AS $$
DECLARE
    workflow RECORD;
    trigger_event TEXT;
    conditions JSONB;
    start_node_id TEXT;
BEGIN
    -- Determine event type
    IF TG_OP = 'INSERT' THEN
        trigger_event := 'contact_created';
    ELSE
        trigger_event := 'contact_updated';
    END IF;

    -- Find matching workflows for this agency
    FOR workflow IN
        SELECT wt.id, wt.steps, wt.trigger_config
        FROM public.ai_workflow_templates wt
        WHERE wt.agency_id = NEW.agency_id
        AND wt.trigger_config->>'event' = trigger_event
    LOOP
        -- Skip if steps is null or not properly structured
        IF workflow.steps IS NULL OR workflow.steps->'nodes' IS NULL OR 
           jsonb_typeof(workflow.steps->'nodes') != 'array' THEN
            CONTINUE;
        END IF;

        conditions := workflow.trigger_config->'conditions';
        
        -- Check conditions (marketing_source match)
        IF conditions IS NULL OR conditions = '{}'::jsonb THEN
            -- No conditions = match all
            NULL;
        ELSIF conditions->>'marketing_source' IS NOT NULL THEN
            -- Check if contact's marketing_source matches
            IF NEW.marketing_source IS NULL OR 
               NEW.marketing_source IS DISTINCT FROM conditions->>'marketing_source' THEN
                CONTINUE; -- Skip this workflow
            END IF;
        END IF;

        -- Find first node in workflow
        start_node_id := workflow.steps->'nodes'->0->>'id';
        
        IF start_node_id IS NOT NULL THEN
            -- Check if already running for this contact+workflow
            IF NOT EXISTS (
                SELECT 1 FROM public.workflow_runs 
                WHERE workflow_id = workflow.id 
                AND contact_id = NEW.id 
                AND status NOT IN ('completed', 'failed')
            ) THEN
                -- Start new workflow run
                INSERT INTO public.workflow_runs (workflow_id, contact_id, agency_id, current_node_id, status)
                VALUES (workflow.id, NEW.id, NEW.agency_id, start_node_id, 'pending');
            END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger on contacts table
DROP TRIGGER IF EXISTS trigger_workflow_on_contact ON public.contacts;
CREATE TRIGGER trigger_workflow_on_contact
    AFTER INSERT OR UPDATE ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.check_workflow_triggers();

-- 5. Update timestamp function
CREATE OR REPLACE FUNCTION public.update_workflow_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workflow_runs_updated_at ON public.workflow_runs;
CREATE TRIGGER update_workflow_runs_updated_at
    BEFORE UPDATE ON public.workflow_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_workflow_runs_updated_at();
