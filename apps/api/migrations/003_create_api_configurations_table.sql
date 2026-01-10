-- ============================================
-- Migracja: Tabela konfiguracji API
-- Data: 2024-12-27
-- Opis: Przechowywanie kluczy API dla OpenAI, lokalnych modeli i innych providerów
-- ============================================

-- 1. Tabela api_configurations
CREATE TABLE IF NOT EXISTS api_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'local', 'azure', 'anthropic', 'other')),
  name VARCHAR(255) NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  base_url TEXT,
  model_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_api_configurations_user ON api_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_api_configurations_active ON api_configurations(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_api_configurations_default ON api_configurations(user_id, is_default);

ALTER TABLE api_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own API configurations" ON api_configurations;
CREATE POLICY "Users can manage own API configurations" ON api_configurations FOR ALL USING (auth.uid() = user_id);

-- 2. Trigger dla updated_at
DROP TRIGGER IF EXISTS update_api_configurations_updated_at ON api_configurations;
CREATE TRIGGER update_api_configurations_updated_at 
BEFORE UPDATE ON api_configurations 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 3. Funkcja zapewniająca tylko jedną domyślną konfigurację na użytkownika
CREATE OR REPLACE FUNCTION ensure_single_default_api_config()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE api_configurations 
    SET is_default = false 
    WHERE user_id = NEW.user_id 
    AND id != NEW.id 
    AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_default_api_config_trigger ON api_configurations;
CREATE TRIGGER ensure_single_default_api_config_trigger
BEFORE INSERT OR UPDATE ON api_configurations
FOR EACH ROW
EXECUTE FUNCTION ensure_single_default_api_config();

-- Koniec migracji
