-- Create contact groups table
CREATE TABLE IF NOT EXISTS public.contact_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3b82f6', -- Default blue color
    filter_criteria JSONB, -- For future smart groups feature
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    CONSTRAINT contact_groups_name_agency_unique UNIQUE (agency_id, name)
);

-- Create contact group members junction table
CREATE TABLE IF NOT EXISTS public.contact_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.contact_groups(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_by UUID REFERENCES auth.users(id),
    CONSTRAINT contact_group_members_unique UNIQUE (contact_id, group_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contact_groups_agency_id ON public.contact_groups(agency_id);
CREATE INDEX IF NOT EXISTS idx_contact_group_members_contact_id ON public.contact_group_members(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_group_members_group_id ON public.contact_group_members(group_id);

-- Enable RLS
ALTER TABLE public.contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contact_groups
CREATE POLICY "Users can view groups from their agency"
    ON public.contact_groups
    FOR SELECT
    USING (public.is_member_of_agency(agency_id));

CREATE POLICY "Users can create groups in their agency"
    ON public.contact_groups
    FOR INSERT
    WITH CHECK (public.is_member_of_agency(agency_id));

CREATE POLICY "Users can update groups in their agency"
    ON public.contact_groups
    FOR UPDATE
    USING (public.is_member_of_agency(agency_id))
    WITH CHECK (public.is_member_of_agency(agency_id));

CREATE POLICY "Elevated users can delete groups in their agency"
    ON public.contact_groups
    FOR DELETE
    USING (public.has_elevated_role(agency_id));

-- RLS Policies for contact_group_members
CREATE POLICY "Users can view group members from their agency"
    ON public.contact_group_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.contacts c
            WHERE c.id = contact_group_members.contact_id
            AND public.is_member_of_agency(c.agency_id)
        )
    );

CREATE POLICY "Users can add contacts to groups in their agency"
    ON public.contact_group_members
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.contacts c
            WHERE c.id = contact_group_members.contact_id
            AND public.is_member_of_agency(c.agency_id)
        )
    );

CREATE POLICY "Users can remove contacts from groups in their agency"
    ON public.contact_group_members
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.contacts c
            WHERE c.id = contact_group_members.contact_id
            AND public.is_member_of_agency(c.agency_id)
        )
    );

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_contact_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_contact_groups_updated_at
    BEFORE UPDATE ON public.contact_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.update_contact_groups_updated_at();
