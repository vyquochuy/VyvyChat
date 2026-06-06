-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  name TEXT, -- NULL for direct 1-1 chats
  type TEXT NOT NULL, -- 'DIRECT', 'GROUP'
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Create conversation_members table
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'OWNER', 'ADMIN', 'MEMBER'
  joined_at INTEGER NOT NULL,
  last_read_message_id TEXT,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexing for conversation members
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv ON conversation_members(conversation_id);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT,
  type TEXT NOT NULL, -- 'TEXT', 'FILE', 'IMAGE', 'SYSTEM'
  message_state TEXT NOT NULL DEFAULT 'NORMAL', -- 'NORMAL', 'EDITED', 'RECALLED'
  delivery_state TEXT NOT NULL DEFAULT 'SENT', -- 'SENT', 'DELIVERED', 'READ'
  reply_to_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- Paginated query index: (conversation_id, created_at DESC, id DESC) to avoid duplicate timestamps pagination issues
CREATE INDEX IF NOT EXISTS idx_messages_paginated ON messages(conversation_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
