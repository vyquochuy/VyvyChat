-- Phase 6: Add E2EE key management columns to users table

-- Add current active key fields to users
ALTER TABLE users ADD COLUMN public_key TEXT;
ALTER TABLE users ADD COLUMN encrypted_private_key TEXT;
ALTER TABLE users ADD COLUMN recovery_salt TEXT;
ALTER TABLE users ADD COLUMN key_version INTEGER DEFAULT 1;

-- Create key history table to support key rotation and decryption of old messages
CREATE TABLE IF NOT EXISTS user_public_keys (
  user_id TEXT NOT NULL,
  key_version INTEGER NOT NULL,
  public_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key_version),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Fast lookup index for resolving a specific key version when decrypting old messages
CREATE INDEX IF NOT EXISTS idx_user_public_keys_lookup ON user_public_keys(user_id, key_version);
