-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  user_id_1 TEXT NOT NULL,
  user_id_2 TEXT NOT NULL,
  status TEXT NOT NULL, -- 'PENDING', 'ACCEPTED', 'BLOCKED'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id_1, user_id_2)
);

-- Indexing for friendships
CREATE INDEX IF NOT EXISTS idx_friendships_user_1 ON friendships(user_id_1);
CREATE INDEX IF NOT EXISTS idx_friendships_user_2 ON friendships(user_id_2);
CREATE INDEX IF NOT EXISTS idx_friendships_users ON friendships(user_id_1, user_id_2);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read INTEGER DEFAULT 0, -- 0 = false, 1 = true
  type TEXT NOT NULL, -- 'FRIEND_REQUEST', 'SYSTEM'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexing for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
