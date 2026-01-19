
-- Create chat_messages table
CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "contact_id" uuid,
    "agency_id" uuid,
    "direction" text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    "channel" text NOT NULL DEFAULT 'whatsapp',
    "content" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- Enable RLS
ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS chat_messages_contact_id_idx ON public.chat_messages (contact_id);
CREATE INDEX IF NOT EXISTS chat_messages_agency_id_idx ON public.chat_messages (agency_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON public.chat_messages (created_at DESC);

-- Foreign Keys
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_contact_id_fkey') THEN
        ALTER TABLE "public"."chat_messages" 
        ADD CONSTRAINT "chat_messages_contact_id_fkey" 
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_agency_id_fkey') THEN
        ALTER TABLE "public"."chat_messages" 
        ADD CONSTRAINT "chat_messages_agency_id_fkey" 
        FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Policies
CREATE POLICY "Enable read access for authenticated users" 
ON "public"."chat_messages" FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable insert for authenticated users" 
ON "public"."chat_messages" FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Add AI Auto-Reply setting to Agencies (if not exists)
-- Or maybe it should be in `twilio_settings` jsonb column?
-- The user asked for "Enable AI Auto-Reply" switch.
-- I'll assume it's stored in `twilio_settings` which is JSONB, so no schema change needed there.

