-- Migration number: 0005 	 2026-06-07T15:48:53.352Z

-- Create attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  sha256 TEXT,
  thumbnail_key TEXT,
  download_count INTEGER DEFAULT 0,
  scan_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'CLEAN', 'INFECTED'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_r2_key ON attachments(r2_key);
CREATE INDEX IF NOT EXISTS idx_attachments_sha256 ON attachments(sha256);
