-- Migration: Tworzenie tabeli user_ai_settings
-- Description: Przechowuje preferencje personalizacji AI dla każdego użytkownika
-- Date: 2026-01-16

CREATE TABLE IF NOT EXISTS user_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_name TEXT DEFAULT 'Asystent',
  response_style TEXT DEFAULT 'formal' CHECK (response_style IN ('formal', 'casual', 'concise', 'detailed')),
  personality TEXT,
  special_instructions TEXT,
  temperature DECIMAL(2,1) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 1),
  max_tokens INTEGER DEFAULT 2048 CHECK (max_tokens > 0 AND max_tokens <= 8192),
  include_emoji BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'pl' CHECK (language IN ('pl', 'en')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indeks dla szybkiego wyszukiwania po user_id
CREATE INDEX IF NOT EXISTS idx_user_ai_settings_user_id ON user_ai_settings(user_id);

-- RLS policies
ALTER TABLE user_ai_settings ENABLE ROW LEVEL SECURITY;

-- Użytkownik może odczytywać tylko swoje ustawienia
CREATE POLICY "Users can view own ai settings"
  ON user_ai_settings FOR SELECT
  USING (auth.uid() = user_id);

-- Użytkownik może tworzyć tylko swoje ustawienia
CREATE POLICY "Users can insert own ai settings"
  ON user_ai_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Użytkownik może aktualizować tylko swoje ustawienia
CREATE POLICY "Users can update own ai settings"
  ON user_ai_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger do automatycznej aktualizacji updated_at
CREATE OR REPLACE FUNCTION update_user_ai_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_ai_settings_updated_at
  BEFORE UPDATE ON user_ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_ai_settings_updated_at();

-- Komentarze
COMMENT ON TABLE user_ai_settings IS 'Ustawienia personalizacji AI dla użytkowników';
COMMENT ON COLUMN user_ai_settings.response_style IS 'Styl odpowiedzi: formal, casual, concise, detailed';
COMMENT ON COLUMN user_ai_settings.personality IS 'Opis osobowości asystenta AI';
COMMENT ON COLUMN user_ai_settings.special_instructions IS 'Specjalne instrukcje dla AI';
COMMENT ON COLUMN user_ai_settings.temperature IS 'Parametr kreatywności (0-1)';
COMMENT ON COLUMN user_ai_settings.include_emoji IS 'Czy używać emoji w odpowiedziach';
