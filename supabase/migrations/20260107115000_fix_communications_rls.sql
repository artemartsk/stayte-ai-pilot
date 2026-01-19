-- Add missing columns to contact_communications
ALTER TABLE public.contact_communications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.contact_communications ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Enable RLS
ALTER TABLE public.contact_communications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their agency communications" ON public.contact_communications;
DROP POLICY IF EXISTS "Service role full access" ON public.contact_communications;

-- Allow authenticated users to read communications from their agency
CREATE POLICY "Users can view their agency communications"
ON public.contact_communications
FOR SELECT
TO authenticated
USING (
  agency_id IN (
    SELECT agency_id FROM public.memberships 
    WHERE user_id = auth.uid() AND active = true
  )
);

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role full access"
ON public.contact_communications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Also enable RLS on activities table if not already done
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their agency activities" ON public.activities;

CREATE POLICY "Users can view their agency activities"
ON public.activities
FOR SELECT
TO authenticated
USING (
  agency_id IN (
    SELECT agency_id FROM public.memberships 
    WHERE user_id = auth.uid() AND active = true
  )
);
