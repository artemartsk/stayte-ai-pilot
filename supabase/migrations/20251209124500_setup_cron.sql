-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the cron job
-- Replace <PROJECT_REF> and <ANON_OR_SERVICE_KEY> with actual values
-- You can find PROJECT_REF in your Supabase URL: https://matches.supabase.co
-- For key, simple 'Bearer <anon_key>' usually works for public funcs, 
-- but for secured funcs use service_role.
-- Since this function calls internal logic, it's safer to use service_role.

SELECT cron.schedule(
    'schedule-calls-job',           -- unique name
    '0 * * * *',                   -- cron schedule (e.g., every hour)
    $$
    select
        net.http_post(
            url:='https://<PROJECT_REF>.supabase.co/functions/v1/schedule-calls',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
            body:='{}'::jsonb
        ) as request_id;
    $$
);

-- To check status:
-- select * from cron.job_run_details;
