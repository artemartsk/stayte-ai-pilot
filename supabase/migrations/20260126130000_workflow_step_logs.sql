-- Migration: Create workflow_step_logs table
-- Stores history of all workflow step executions for visibility in UI

CREATE TABLE IF NOT EXISTS public.workflow_step_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id UUID REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'started',
    result JSONB,
    error_message TEXT,
    scheduled_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_contact ON public.workflow_step_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_run ON public.workflow_step_logs(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_agency ON public.workflow_step_logs(agency_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_created ON public.workflow_step_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.workflow_step_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view step logs of their agency" ON public.workflow_step_logs;
CREATE POLICY "Users can view step logs of their agency"
    ON public.workflow_step_logs FOR SELECT
    USING (agency_id IN (SELECT agency_id FROM public.memberships WHERE user_id = auth.uid() AND active = true));

DROP POLICY IF EXISTS "Service role can manage step logs" ON public.workflow_step_logs;
CREATE POLICY "Service role can manage step logs"
    ON public.workflow_step_logs FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.workflow_step_logs TO authenticated;
GRANT ALL ON public.workflow_step_logs TO service_role;
