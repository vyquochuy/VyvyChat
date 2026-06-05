-- Add uid column as nullable first to support existing users (if any)
ALTER TABLE users ADD COLUMN uid INTEGER;

-- Update existing rows (if any) with sequential UIDs starting from 10000000 using SQLite rowid
UPDATE users SET uid = 9999999 + rowid WHERE uid IS NULL;

-- Create unique index on uid column to prevent duplicates and speed up lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
