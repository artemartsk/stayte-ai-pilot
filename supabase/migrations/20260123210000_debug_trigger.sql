-- Migration: Add Debug Logs and Verbose Trigger Logic
-- Description: Creates a debug_logs table and instrument the trigger to log exactly what it sees and why it decides to skip or start.

CREATE TABLE IF NOT EXISTS public.debug_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    source TEXT,
    message TEXT,
    data JSONB
);

CREATE OR REPLACE FUNCTION public.check_workflow_triggers()
RETURNS TRIGGER AS $$
DECLARE
    workflow RECORD;
    trigger_event TEXT;
    conditions JSONB;
    start_node_id TEXT;
    marketing_source_clean TEXT;
BEGIN
    -- Determine event type
    IF TG_OP = 'INSERT' THEN
        trigger_event := 'contact_created';
    ELSE
        trigger_event := 'contact_updated';
    END IF;

    -- Clean marketing source for comparison
    marketing_source_clean := LOWER(COALESCE(NEW.marketing_source, ''));

    -- Log entry
    INSERT INTO public.debug_logs (source, message, data)
    VALUES ('trigger', 'Trigger fired', jsonb_build_object(
        'contact_id', NEW.id, 
        'event', trigger_event, 
        'marketing_source', NEW.marketing_source,
        'agency_id', NEW.agency_id
    ));

    -- Find matching workflows for this agency
    FOR workflow IN
        SELECT wt.id, wt.name, wt.steps, wt.trigger_config
        FROM public.ai_workflow_templates wt
        WHERE wt.agency_id = NEW.agency_id
        AND wt.trigger_config->>'event' = trigger_event
    LOOP
        -- Log potential match
        INSERT INTO public.debug_logs (source, message, data)
        VALUES ('trigger', 'Checking workflow', jsonb_build_object('workflow_id', workflow.id, 'name', workflow.name));

        -- Skip if steps is null or not properly structured
        IF workflow.steps IS NULL OR workflow.steps->'nodes' IS NULL OR 
           jsonb_typeof(workflow.steps->'nodes') != 'array' THEN
             INSERT INTO public.debug_logs (source, message, data)
             VALUES ('trigger', 'Skip: Invalid steps', jsonb_build_object('workflow_id', workflow.id));
            CONTINUE;
        END IF;

        conditions := workflow.trigger_config->'conditions';
        
        -- Check conditions (marketing_source match) - CASE INSENSITIVE
        IF conditions IS NULL OR conditions = '{}'::jsonb THEN
             -- match
        ELSIF conditions->>'marketing_source' IS NOT NULL THEN
            IF marketing_source_clean IS DISTINCT FROM LOWER(conditions->>'marketing_source') THEN
                INSERT INTO public.debug_logs (source, message, data)
                VALUES ('trigger', 'Skip: Source mismatch', jsonb_build_object(
                    'workflow_source', conditions->>'marketing_source',
                    'contact_source', NEW.marketing_source
                ));
                CONTINUE; -- Skip this workflow
            END IF;
        END IF;

        -- Find first node in workflow
        -- Try to find a node that has NO incoming edges (true start)
        -- Fallback to first node in array
        start_node_id := workflow.steps->'nodes'->0->>'id';
        
        IF start_node_id IS NOT NULL THEN
            -- Check if already running
            IF NOT EXISTS (
                SELECT 1 FROM public.workflow_runs 
                WHERE workflow_id = workflow.id 
                AND contact_id = NEW.id 
                AND status NOT IN ('completed', 'failed')
            ) THEN
                -- Start new workflow run
                INSERT INTO public.workflow_runs (workflow_id, contact_id, agency_id, current_node_id, status)
                VALUES (workflow.id, NEW.id, NEW.agency_id, start_node_id, 'pending');

                INSERT INTO public.debug_logs (source, message, data)
                VALUES ('trigger', 'SUCCESS: Started workflow', jsonb_build_object('workflow_id', workflow.id, 'contact_id', NEW.id));
            ELSE
                 INSERT INTO public.debug_logs (source, message, data)
                 VALUES ('trigger', 'Skip: Already running', jsonb_build_object('workflow_id', workflow.id));
            END IF;
        ELSE
             INSERT INTO public.debug_logs (source, message, data)
             VALUES ('trigger', 'Skip: No start node found', jsonb_build_object('workflow_id', workflow.id));
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
