-- Fix workflow trigger to correctly identify the start node by finding the node with no incoming edges

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
            IF NEW.marketing_source IS NULL OR 
               NEW.marketing_source IS DISTINCT FROM conditions->>'marketing_source' THEN
                CONTINUE; -- Skip this workflow
            END IF;
        END IF;

        -- Find start node: The node ID that is NOT a target in any edge
        -- We extract all node IDs and exclude those that appear as 'target' in edges
        
        WITH 
        nodes_cte AS (
            SELECT value->>'id' as id 
            FROM jsonb_array_elements(workflow.steps->'nodes')
        ),
        edges_cte AS (
            SELECT value->>'target' as target 
            FROM jsonb_array_elements(workflow.steps->'edges')
        )
        SELECT id INTO start_node_id
        FROM nodes_cte
        WHERE id NOT IN (SELECT target FROM edges_cte WHERE target IS NOT NULL)
        LIMIT 1;

        -- Fallback if cyclic or empty edges but nodes exist (pick first node)
        IF start_node_id IS NULL THEN
            start_node_id := workflow.steps->'nodes'->0->>'id';
        END IF;
        
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
