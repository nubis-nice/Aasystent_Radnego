-- Migracja: Schemat ePUAP
-- Data: 2026-01-25
-- Opis: Tabele dla integracji z ePUAP (Elektroniczna Platforma Usług Administracji Publicznej)

-- Tabela wiadomości ePUAP
CREATE TABLE IF NOT EXISTS epuap_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  epuap_message_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  received_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'processed', 'archived')),
  document_type TEXT,
  case_number TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_epuap_messages_user_id ON epuap_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_epuap_messages_status ON epuap_messages(status);
CREATE INDEX IF NOT EXISTS idx_epuap_messages_received_at ON epuap_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_epuap_messages_epuap_id ON epuap_messages(epuap_message_id);

-- Unikalność wiadomości ePUAP per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_epuap_messages_unique 
  ON epuap_messages(user_id, epuap_message_id);

-- Tabela integracji użytkowników (generyczna)
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, integration_type)
);

-- Indeks
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_type 
  ON user_integrations(user_id, integration_type);

-- RLS dla epuap_messages
ALTER TABLE epuap_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own epuap messages"
  ON epuap_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own epuap messages"
  ON epuap_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own epuap messages"
  ON epuap_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own epuap messages"
  ON epuap_messages FOR DELETE
  USING (auth.uid() = user_id);

-- RLS dla user_integrations
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations"
  ON user_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own integrations"
  ON user_integrations FOR ALL
  USING (auth.uid() = user_id);

-- Funkcja do aktualizacji updated_at
CREATE OR REPLACE FUNCTION update_epuap_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggery
CREATE TRIGGER trigger_epuap_messages_updated_at
  BEFORE UPDATE ON epuap_messages
  FOR EACH ROW EXECUTE FUNCTION update_epuap_updated_at();

CREATE TRIGGER trigger_user_integrations_updated_at
  BEFORE UPDATE ON user_integrations
  FOR EACH ROW EXECUTE FUNCTION update_epuap_updated_at();

-- Komentarze
COMMENT ON TABLE epuap_messages IS 'Wiadomości z ePUAP zsynchronizowane dla użytkowników';
COMMENT ON TABLE user_integrations IS 'Konfiguracje integracji zewnętrznych (ePUAP, Google Calendar, etc.)';
COMMENT ON COLUMN epuap_messages.epuap_message_id IS 'ID wiadomości w systemie ePUAP';
COMMENT ON COLUMN epuap_messages.status IS 'Status: new, read, processed, archived';
