-- Migration: Add group_id to contacts table (single group per contact)

-- 1. Add group_id column to contacts table
ALTER TABLE public.contacts 
ADD COLUMN group_id uuid NULL;

-- 2. Add foreign key constraint
ALTER TABLE public.contacts 
ADD CONSTRAINT contacts_group_id_fkey 
FOREIGN KEY (group_id) REFERENCES public.contact_groups(id) ON DELETE SET NULL;

-- 3. Migrate existing data from contact_group_members (take any group if multiple exist)
UPDATE public.contacts c
SET group_id = (
    SELECT group_id 
    FROM public.contact_group_members cgm 
    WHERE cgm.contact_id = c.id 
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM public.contact_group_members cgm WHERE cgm.contact_id = c.id
);

-- 4. Create index for faster lookups
CREATE INDEX IF NOT EXISTS contacts_group_id_idx ON public.contacts(group_id);

-- 5. Drop the contact_group_members table (optional - uncomment when ready)
-- DROP TABLE IF EXISTS public.contact_group_members;
