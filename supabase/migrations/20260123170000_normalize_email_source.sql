-- Migration: Normalize 'email' lead source to 'Email'
-- Description: Fixes case mismatch preventing workflows from triggering.

UPDATE public.contacts 
SET marketing_source = 'Email' 
WHERE marketing_source = 'email';

-- Verify the fix for the specific user mentioned (optional logic, but safe to include generic update)
