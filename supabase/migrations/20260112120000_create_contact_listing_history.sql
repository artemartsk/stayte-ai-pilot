
-- Create table to track which properties have been sent to which contact
-- This prevents sending the same property multiple times in nurture sequences
create table if not exists public.contact_property_history (
    id uuid not null default gen_random_uuid(),
    contact_id uuid not null references public.contacts(id) on delete cascade,
    property_id uuid not null references public.properties(id) on delete cascade,
    sent_at timestamptz not null default now(),
    workflow_step_id text, -- optional reference to the step that sent it
    
    constraint contact_property_history_pkey primary key (id)
);

-- Add index for faster lookups
create index if not exists idx_contact_property_history_contact_id on public.contact_property_history(contact_id);
create index if not exists idx_contact_property_history_property_id on public.contact_property_history(property_id);

-- Enable RLS
alter table public.contact_property_history enable row level security;

-- Policies (allow read/write for authenticated users)
create policy "Authenticated users can select contact_property_history"
    on public.contact_property_history for select
    to authenticated
    using (true);

create policy "Authenticated users can insert contact_property_history"
    on public.contact_property_history for insert
    to authenticated
    with check (true);
