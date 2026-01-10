-- Migration: Chat System
-- Description: Tabele dla systemu czatu AI z historią konwersacji

-- Konwersacje
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

-- Wiadomości w konwersacji
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Dane ze strony gminy/miasta
CREATE TABLE IF NOT EXISTS municipal_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL, -- 'meeting', 'resolution', 'announcement', 'news'
  title TEXT NOT NULL,
  content TEXT,
  source_url TEXT,
  meeting_date TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536) -- dla semantic search
);

CREATE INDEX idx_municipal_data_user_id ON municipal_data(user_id);
CREATE INDEX idx_municipal_data_type ON municipal_data(data_type);
CREATE INDEX idx_municipal_data_meeting_date ON municipal_data(meeting_date);
CREATE INDEX idx_municipal_data_embedding ON municipal_data USING ivfflat (embedding vector_cosine_ops);

-- Wydarzenia z kalendarza
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  attendees JSONB DEFAULT '[]'::jsonb,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_google_id ON calendar_events(google_event_id);

-- Dodaj kolumny do user_profiles dla ustawień gminy
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS municipality_name TEXT,
ADD COLUMN IF NOT EXISTS municipality_type TEXT CHECK (municipality_type IN ('gmina', 'miasto', 'powiat')),
ADD COLUMN IF NOT EXISTS bip_url TEXT,
ADD COLUMN IF NOT EXISTS council_page_url TEXT,
ADD COLUMN IF NOT EXISTS scraping_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS scraping_frequency TEXT DEFAULT 'daily' CHECK (scraping_frequency IN ('daily', 'weekly'));

-- Funkcja do automatycznego aktualizowania updated_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations 
  SET updated_at = NOW() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger dla aktualizacji czasu konwersacji przy nowej wiadomości
CREATE TRIGGER update_conversation_on_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_timestamp();

-- RLS Policies

-- Conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Municipal Data
ALTER TABLE municipal_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own municipal data"
  ON municipal_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own municipal data"
  ON municipal_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own municipal data"
  ON municipal_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own municipal data"
  ON municipal_data FOR DELETE
  USING (auth.uid() = user_id);

-- Calendar Events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar events"
  ON calendar_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own calendar events"
  ON calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar events"
  ON calendar_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar events"
  ON calendar_events FOR DELETE
  USING (auth.uid() = user_id);

-- Funkcja do wyszukiwania semantycznego w danych gminy
CREATE OR REPLACE FUNCTION search_municipal_data(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_user_id uuid
)
RETURNS TABLE (
  id uuid,
  data_type text,
  title text,
  content text,
  source_url text,
  meeting_date timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    municipal_data.id,
    municipal_data.data_type,
    municipal_data.title,
    municipal_data.content,
    municipal_data.source_url,
    municipal_data.meeting_date,
    1 - (municipal_data.embedding <=> query_embedding) as similarity
  FROM municipal_data
  WHERE municipal_data.user_id = filter_user_id
    AND 1 - (municipal_data.embedding <=> query_embedding) > match_threshold
  ORDER BY municipal_data.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON TABLE conversations IS 'Historia konwersacji użytkowników z AI';
COMMENT ON TABLE messages IS 'Wiadomości w konwersacjach';
COMMENT ON TABLE municipal_data IS 'Dane ze strony gminy/miasta (scraping)';
COMMENT ON TABLE calendar_events IS 'Wydarzenia z kalendarza Google';
