-- ═══════════════════════════════════════════════════════════════════════════
-- Migracja: Nowa architektura konfiguracji providerów AI
-- Data: 2026-01-11
-- Opis: Tabele dla multi-provider AI z podziałem na funkcje (LLM, Embeddings, Vision, STT, TTS)
-- ═══════════════════════════════════════════════════════════════════════════

-- Tabela główna konfiguracji AI
CREATE TABLE IF NOT EXISTS ai_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Identyfikacja
  name VARCHAR(100) NOT NULL,
  preset VARCHAR(50) NOT NULL DEFAULT 'custom', -- 'openai', 'ollama', 'custom'
  
  -- Status
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, name)
);

-- Tabela providerów dla każdej funkcji AI
CREATE TABLE IF NOT EXISTS ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES ai_configurations(id) ON DELETE CASCADE,
  
  -- Typ funkcji AI
  function_type VARCHAR(20) NOT NULL, -- 'llm', 'embeddings', 'vision', 'stt', 'tts'
  
  -- Konfiguracja providera
  provider VARCHAR(50) NOT NULL,
  api_protocol VARCHAR(20) DEFAULT 'openai_compatible', -- 'openai_compatible', 'anthropic', 'custom'
  
  -- Endpoint
  base_url TEXT NOT NULL,
  endpoint TEXT,
  
  -- Uwierzytelnianie
  api_key_encrypted TEXT,
  encryption_iv TEXT,
  auth_method VARCHAR(20) DEFAULT 'bearer', -- 'bearer', 'api-key', 'none', 'custom'
  custom_headers JSONB,
  
  -- Model
  model_name VARCHAR(100) NOT NULL,
  
  -- Ustawienia
  timeout_seconds INTEGER DEFAULT 30,
  max_retries INTEGER DEFAULT 3,
  
  -- Status
  is_enabled BOOLEAN DEFAULT true,
  last_test_at TIMESTAMPTZ,
  last_test_status VARCHAR(20), -- 'success', 'failed', 'pending', 'testing'
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Każda funkcja może mieć tylko jednego providera w konfiguracji
  UNIQUE(config_id, function_type)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Indeksy
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_ai_configs_user_id ON ai_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_configs_user_default ON ai_configurations(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_ai_configs_user_active ON ai_configurations(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ai_providers_config_id ON ai_providers(config_id);
CREATE INDEX IF NOT EXISTS idx_ai_providers_function_type ON ai_providers(config_id, function_type);

-- ═══════════════════════════════════════════════════════════════════════════
-- Trigger: Automatyczna aktualizacja updated_at
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_ai_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_ai_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_configurations_updated_at ON ai_configurations;
CREATE TRIGGER trigger_ai_configurations_updated_at
  BEFORE UPDATE ON ai_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_configurations_updated_at();

DROP TRIGGER IF EXISTS trigger_ai_providers_updated_at ON ai_providers;
CREATE TRIGGER trigger_ai_providers_updated_at
  BEFORE UPDATE ON ai_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_providers_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- Trigger: Tylko jedna domyślna konfiguracja per użytkownik
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ensure_single_default_ai_config()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE ai_configurations
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_default_ai_config ON ai_configurations;
CREATE TRIGGER trigger_ensure_single_default_ai_config
  BEFORE INSERT OR UPDATE ON ai_configurations
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_ai_config();

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS (Row Level Security)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE ai_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;

-- Polityki dla ai_configurations
DROP POLICY IF EXISTS ai_configurations_select_own ON ai_configurations;
CREATE POLICY ai_configurations_select_own ON ai_configurations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_configurations_insert_own ON ai_configurations;
CREATE POLICY ai_configurations_insert_own ON ai_configurations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_configurations_update_own ON ai_configurations;
CREATE POLICY ai_configurations_update_own ON ai_configurations
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_configurations_delete_own ON ai_configurations;
CREATE POLICY ai_configurations_delete_own ON ai_configurations
  FOR DELETE USING (auth.uid() = user_id);

-- Polityki dla ai_providers (przez relację z ai_configurations)
DROP POLICY IF EXISTS ai_providers_select_own ON ai_providers;
CREATE POLICY ai_providers_select_own ON ai_providers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_configurations
      WHERE ai_configurations.id = ai_providers.config_id
        AND ai_configurations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_providers_insert_own ON ai_providers;
CREATE POLICY ai_providers_insert_own ON ai_providers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_configurations
      WHERE ai_configurations.id = ai_providers.config_id
        AND ai_configurations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_providers_update_own ON ai_providers;
CREATE POLICY ai_providers_update_own ON ai_providers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM ai_configurations
      WHERE ai_configurations.id = ai_providers.config_id
        AND ai_configurations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_providers_delete_own ON ai_providers;
CREATE POLICY ai_providers_delete_own ON ai_providers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM ai_configurations
      WHERE ai_configurations.id = ai_providers.config_id
        AND ai_configurations.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- Komentarze
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE ai_configurations IS 'Główne konfiguracje AI użytkowników (presety)';
COMMENT ON TABLE ai_providers IS 'Konfiguracja providerów dla każdej funkcji AI (LLM, Embeddings, Vision, STT, TTS)';

COMMENT ON COLUMN ai_configurations.preset IS 'Identyfikator presetu: openai, ollama, custom';
COMMENT ON COLUMN ai_configurations.is_default IS 'Czy to domyślna konfiguracja użytkownika';

COMMENT ON COLUMN ai_providers.function_type IS 'Typ funkcji AI: llm, embeddings, vision, stt, tts';
COMMENT ON COLUMN ai_providers.api_protocol IS 'Protokół API: openai_compatible, anthropic, custom';
COMMENT ON COLUMN ai_providers.auth_method IS 'Metoda uwierzytelniania: bearer, api-key, none, custom';
