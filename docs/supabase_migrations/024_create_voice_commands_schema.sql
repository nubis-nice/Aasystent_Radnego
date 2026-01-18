-- ============================================================================
-- Voice Commands Schema
-- ============================================================================
-- Tabele i funkcje obsługujące system komend głosowych
-- Data utworzenia: 2026-01-16

-- ============================================================================
-- 1. Tabela: voice_commands
-- ============================================================================
-- Historia wszystkich komend głosowych użytkownika

CREATE TABLE IF NOT EXISTS voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Transkrypcja i intencja
  transcription TEXT NOT NULL,
  intent TEXT CHECK (intent IN ('navigation', 'search', 'chat', 'control', 'unknown')),
  confidence FLOAT DEFAULT 0,
  
  -- Akcja i wynik
  action JSONB,
  executed BOOLEAN DEFAULT false,
  execution_result JSONB,
  
  -- Metadane
  audio_duration_ms INTEGER,
  processing_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_voice_commands_user_id ON voice_commands(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_commands_created_at ON voice_commands(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_commands_intent ON voice_commands(intent);
CREATE INDEX IF NOT EXISTS idx_voice_commands_executed ON voice_commands(executed);

-- RLS (Row Level Security)
ALTER TABLE voice_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own voice commands" ON voice_commands;
CREATE POLICY "Users can view own voice commands"
  ON voice_commands FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own voice commands" ON voice_commands;
CREATE POLICY "Users can insert own voice commands"
  ON voice_commands FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own voice commands" ON voice_commands;
CREATE POLICY "Users can update own voice commands"
  ON voice_commands FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own voice commands" ON voice_commands;
CREATE POLICY "Users can delete own voice commands"
  ON voice_commands FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 2. Tabela: voice_macros
-- ============================================================================
-- Niestandardowe komendy głosowe zdefiniowane przez użytkownika

CREATE TABLE IF NOT EXISTS voice_macros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Definicja makra
  trigger_phrase TEXT NOT NULL,
  description TEXT,
  actions JSONB NOT NULL, -- Tablica akcji do wykonania
  
  -- Konfiguracja
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Wyższa wartość = wyższy priorytet
  
  -- Statystyki
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint (warunkowy)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'voice_macros_trigger_unique'
  ) THEN
    ALTER TABLE voice_macros ADD CONSTRAINT voice_macros_trigger_unique UNIQUE (user_id, trigger_phrase);
  END IF;
END $$;

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_voice_macros_user_id ON voice_macros(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_macros_is_active ON voice_macros(is_active);
CREATE INDEX IF NOT EXISTS idx_voice_macros_trigger_phrase ON voice_macros(trigger_phrase);

-- RLS
ALTER TABLE voice_macros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own voice macros" ON voice_macros;
CREATE POLICY "Users can manage own voice macros"
  ON voice_macros FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. Tabela: user_voice_settings
-- ============================================================================
-- Ustawienia obsługi głosowej użytkownika (zgodnie z wzorcem z 002_create_user_settings_tables.sql)

CREATE TABLE IF NOT EXISTS user_voice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Ustawienia głosowe
  wake_word VARCHAR(50) DEFAULT 'Asystencie',
  continuous_mode BOOLEAN DEFAULT false,
  auto_tts BOOLEAN DEFAULT true,
  tts_voice VARCHAR(50) DEFAULT 'pl-PL-MarekNeural',
  tts_speed FLOAT DEFAULT 1.0 CHECK (tts_speed >= 0.5 AND tts_speed <= 2.0),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Indeks
CREATE INDEX IF NOT EXISTS idx_voice_settings_user ON user_voice_settings(user_id);

-- RLS
ALTER TABLE user_voice_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own voice settings" ON user_voice_settings;
CREATE POLICY "Users can manage own voice settings"
  ON user_voice_settings FOR ALL
  USING (auth.uid() = user_id);

-- Trigger dla updated_at
DROP TRIGGER IF EXISTS update_voice_settings_updated_at ON user_voice_settings;
CREATE TRIGGER update_voice_settings_updated_at 
  BEFORE UPDATE ON user_voice_settings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Funkcje pomocnicze
-- ============================================================================

-- Funkcja: Pobranie statystyk komend głosowych
CREATE OR REPLACE FUNCTION get_voice_command_stats(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_commands', COUNT(*),
    'executed_commands', COUNT(*) FILTER (WHERE executed = true),
    'by_intent', json_object_agg(
      COALESCE(intent, 'unknown'),
      COUNT(*)
    ),
    'avg_confidence', ROUND(AVG(confidence)::numeric, 2),
    'recent_commands', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT 
          transcription,
          intent,
          confidence,
          executed,
          created_at
        FROM voice_commands
        WHERE user_id = p_user_id
          AND created_at >= NOW() - INTERVAL '1 day' * p_days
        ORDER BY created_at DESC
        LIMIT 10
      ) t
    )
  )
  INTO v_result
  FROM voice_commands
  WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '1 day' * p_days;
  
  RETURN COALESCE(v_result, '{}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funkcja: Czyszczenie starych komend głosowych
CREATE OR REPLACE FUNCTION cleanup_old_voice_commands(p_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM voice_commands
  WHERE created_at < NOW() - INTERVAL '1 day' * p_days;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funkcja: Update timestamp dla voice_macros
CREATE OR REPLACE FUNCTION update_voice_macro_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger dla automatycznej aktualizacji updated_at
DROP TRIGGER IF EXISTS trigger_update_voice_macro_timestamp ON voice_macros;
CREATE TRIGGER trigger_update_voice_macro_timestamp
  BEFORE UPDATE ON voice_macros
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_macro_timestamp();

-- ============================================================================
-- 5. Seeding - Przykładowe makra
-- ============================================================================

-- Funkcja do utworzenia przykładowych makr dla nowego użytkownika
CREATE OR REPLACE FUNCTION seed_default_voice_macros(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Makro: Poranek radnego
  INSERT INTO voice_macros (user_id, trigger_phrase, description, actions, priority)
  VALUES (
    p_user_id,
    'poranek radnego',
    'Otwiera dashboard, czat i kalendarz',
    '[
      {"type": "navigate", "path": "/dashboard"},
      {"type": "wait", "duration": 500},
      {"type": "tts", "text": "Witaj! Przygotowuję widok poranny."}
    ]'::jsonb,
    10
  ) ON CONFLICT (user_id, trigger_phrase) DO NOTHING;
  
  -- Makro: Sprawdź uchwały
  INSERT INTO voice_macros (user_id, trigger_phrase, description, actions, priority)
  VALUES (
    p_user_id,
    'sprawdź uchwały',
    'Przechodzi do dokumentów i wyszukuje najnowsze uchwały',
    '[
      {"type": "navigate", "path": "/documents"},
      {"type": "wait", "duration": 300},
      {"type": "search", "query": "uchwała", "filter": "recent"}
    ]'::jsonb,
    8
  ) ON CONFLICT (user_id, trigger_phrase) DO NOTHING;
  
  -- Makro: Pomoc
  INSERT INTO voice_macros (user_id, trigger_phrase, description, actions, priority)
  VALUES (
    p_user_id,
    'pomoc głosowa',
    'Wyświetla listę dostępnych komend głosowych',
    '[
      {"type": "tts", "text": "Dostępne komendy: otwórz dokumenty, znajdź uchwałę, zapytaj o budżet, przejdź do ustawień"},
      {"type": "show_help", "category": "voice"}
    ]'::jsonb,
    5
  ) ON CONFLICT (user_id, trigger_phrase) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Gotowe!
-- ============================================================================

COMMENT ON TABLE voice_commands IS 'Historia komend głosowych użytkowników';
COMMENT ON TABLE voice_macros IS 'Niestandardowe makra głosowe zdefiniowane przez użytkowników';
COMMENT ON TABLE user_voice_settings IS 'Ustawienia obsługi głosowej (wake word, TTS, itp.)';
