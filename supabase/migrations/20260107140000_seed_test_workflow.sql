DO $$
DECLARE
    v_agency_id UUID;
    v_workflow_id UUID;
BEGIN
    -- 1. Get the first agency found (assumes you are logged in as a user belonging to this agency)
    -- Or you can specify a specific UUID if you know it
    SELECT id INTO v_agency_id FROM public.agencies LIMIT 1;

    IF v_agency_id IS NOT NULL THEN
        -- 2. Ensure Vapi Settings are present (minimal valid config)
        -- Only update if missing to avoid overwriting your real keys if you set them manually
        UPDATE public.agencies
        SET vapi_settings = jsonb_build_object(
            'assistantId', '5b11b405-2f31-4553-a3c1-814b2d1669f1',
            'phoneNumberId', '27d8b1ec-f601-443b-8fef-c0f8b01ae8f6'
        )
        WHERE id = v_agency_id AND (vapi_settings IS NULL OR vapi_settings = '{}'::jsonb);

        -- 3. Create Testing Workflow (Upsert logic)
        -- Remove old version to ensure clean slate
        DELETE FROM public.ai_workflow_templates 
        WHERE agency_id = v_agency_id AND name = 'Auto Call New Leads';

        -- Insert fresh workflow
        INSERT INTO public.ai_workflow_templates (
            agency_id,
            name,
            description,
            trigger_config,
            steps,
            is_active
        ) VALUES (
            v_agency_id,
            'Auto Call New Leads',
            'Automatically calls all new leads immediately.',
            jsonb_build_object(
                'event', 'contact_created',
                'conditions', jsonb_build_object() -- Empty object matches ALL marketing sources
            ),
            jsonb_build_object(
                'nodes', jsonb_build_array(
                    jsonb_build_object(
                        'id', 'node_call_1',
                        'type', 'action',
                        'data', jsonb_build_object(
                            'label', 'Welcome Call',
                            'action', 'call',
                            'config', jsonb_build_object(
                                'forceImmediate', true
                            )
                        ),
                        'position', jsonb_build_object('x', 100, 'y', 100)
                    )
                ),
                'edges', jsonb_build_array()
            ),
            true
        ) RETURNING id INTO v_workflow_id;

        RAISE NOTICE 'Created Test Workflow: Auto Call New Leads (ID: %) for Agency: %', v_workflow_id, v_agency_id;
    ELSE
        RAISE WARNING 'No agency found. Please create an agency first.';
    END IF;
END $$;
