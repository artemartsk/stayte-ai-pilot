-- Migration: Update Cron Job to execute Workflow Steps
-- Description: Changes the scheduled job to call 'execute-workflow-step' every minute.

-- Enable pg_net extension if not enabled (required for http calls)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unscheduling old jobs to avoid duplicates or conflicts
SELECT cron.unschedule('schedule-calls-job');
SELECT cron.unschedule('execute-workflows-job');

-- Schedule the new job to run every minute
-- Note: Requires service_role key integration or anon key for public, but workflows should be secure.
-- We use a placeholder URL which must be valid for the project.
-- Since this is SQL, we can't inject Env Vars easily, so we assume standard Supabase internal logic 
-- or user must replace these.

SELECT cron.schedule(
    'execute-workflows-job',        -- unique name
    '* * * * *',                   -- every minute
    $$
    select
        net.http_post(
            url:='https://project-ref.supabase.co/functions/v1/execute-workflow-step',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer service-role-key"}'::jsonb,
            body:='{}'::jsonb
        ) as request_id;
    $$
);
