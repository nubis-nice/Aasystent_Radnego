-- ============================================
-- Migracja: Tabela ustawień AI użytkownika
-- Data: 2025-01-26
-- Opis: Tworzenie tabeli user_ai_settings dla personalizacji asystenta AI
-- ============================================

-- 1. Tabela user_ai_settings (jeśli nie istnieje)
CREATE TABLE IF NOT EXISTS user_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_name TEXT DEFAULT 'Stefan',
  voice_enabled BOOLEAN DEFAULT true,
  response_style TEXT DEFAULT 'professional',
  personality TEXT DEFAULT 'helpful',
  special_instructions TEXT,
  temperature NUMERIC DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048 CHECK (max_tokens > 0 AND max_tokens <= 16384),
  include_emoji BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'pl',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Dodaj brakujące kolumny jeśli tabela już istnieje
ALTER TABLE user_ai_settings ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 2048 CHECK (max_tokens > 0 AND max_tokens <= 16384);
ALTER TABLE user_ai_settings ADD COLUMN IF NOT EXISTS voice_enabled BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_ai_settings_user ON user_ai_settings(user_id);

-- 2. RLS
ALTER TABLE user_ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own AI settings" ON user_ai_settings;
CREATE POLICY "Users can manage own AI settings" ON user_ai_settings FOR ALL USING (auth.uid() = user_id);

-- 3. Trigger dla updated_at
DROP TRIGGER IF EXISTS update_ai_settings_updated_at ON user_ai_settings;
CREATE TRIGGER update_ai_settings_updated_at BEFORE UPDATE ON user_ai_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Aktualizacja funkcji initialize_user_settings (dodanie AI settings)
CREATE OR REPLACE FUNCTION initialize_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Użytkownik'))
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO user_notification_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO user_appearance_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO user_locale_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO user_privacy_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO user_ai_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Inicjalizacja dla istniejących użytkowników
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    INSERT INTO user_ai_settings (user_id)
    VALUES (user_record.id)
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;

-- Koniec migracji
