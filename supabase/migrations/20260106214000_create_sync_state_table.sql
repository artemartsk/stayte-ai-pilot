-- Create table to track sync progress
CREATE TABLE IF NOT EXISTS sync_state (
  filter_id TEXT PRIMARY KEY,
  last_synced_page INTEGER NOT NULL DEFAULT 0,
  total_pages INTEGER,
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  properties_count INTEGER
);

-- Allow Edge Functions to read/write
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to sync_state" ON sync_state;

CREATE POLICY "Allow service role full access to sync_state"
ON sync_state FOR ALL
USING (true)
WITH CHECK (true);

COMMENT ON TABLE sync_state IS 'Tracks pagination state for Resales Online sync to prevent reprocessing same pages';
