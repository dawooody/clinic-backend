CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_user_id_idx
  ON conversations (user_id);

CREATE INDEX IF NOT EXISTS conversations_user_updated_at_idx
  ON conversations (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS chats_conversation_id_created_at_idx
  ON chats (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_summaries_conversation_id_idx
  ON chat_summaries (conversation_id);

DROP TRIGGER IF EXISTS conversations_set_updated_at ON conversations;

CREATE TRIGGER conversations_set_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
