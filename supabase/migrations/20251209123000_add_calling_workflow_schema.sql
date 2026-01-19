-- 1. Create task_status enum if not exists
DO $$ BEGIN
    CREATE TYPE public.task_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agency_id UUID NOT NULL,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_at TIMESTAMP WITH TIME ZONE,
    assignee_id UUID, -- References auth.users?
    status public.task_status NOT NULL DEFAULT 'open',
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_agency_contact_status_due_idx ON public.tasks(agency_id, contact_id, status, due_at);

-- 3. Add calling workflow columns to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS call_attempts INTEGER DEFAULT 0;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS call_today_count INTEGER DEFAULT 0;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_call_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS qualification_status TEXT DEFAULT 'new';

-- 4. Create contact_communications (log)
CREATE TABLE IF NOT EXISTS public.contact_communications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL,
    channel TEXT NOT NULL, -- 'ai_call', 'wa', etc
    direction TEXT NOT NULL, -- 'in', 'out'
    status TEXT NOT NULL, -- 'sent', 'delivered', 'no-answer', 'busy', 'answer'
    payload JSONB, -- { recordingUrl, transcript, etc }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comms_contact_created_idx ON public.contact_communications(contact_id, created_at DESC);
