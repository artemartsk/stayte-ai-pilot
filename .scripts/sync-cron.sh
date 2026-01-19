#!/bin/bash
# Cron job script to sync Resales Online listings
# Run this script every 2 minutes to ensure full sync completes

SUPABASE_PROJECT_ID="your-project-id"
FUNCTION_NAME="sync-resales-listings"

# Call the Edge Function
curl -X POST "https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/${FUNCTION_NAME}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json"

# Log completion
echo "[$(date)] Sync triggered" >> /var/log/resales-sync.log
