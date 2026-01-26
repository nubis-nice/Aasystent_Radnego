-- ============================================
-- Migracja: Synchronizacja z External Supabase
-- Data: 2026-01-26
-- Opis: Dodanie brakujących tabel z external Supabase
-- ============================================

-- 1. audit_logs - logi audytu
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;
CREATE POLICY "Users can view own audit logs" ON audit_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role can manage audit logs" ON audit_logs;
CREATE POLICY "Service role can manage audit logs" ON audit_logs FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 2. password_reset_tokens - tokeny resetowania hasła
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage reset tokens" ON password_reset_tokens;
CREATE POLICY "Service role can manage reset tokens" ON password_reset_tokens FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. profiles - profile użytkowników (legacy, kompatybilność)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'radny')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    force_password_change BOOLEAN DEFAULT false,
    last_login TIMESTAMPTZ
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 4. document_jobs - zadania przetwarzania dokumentów
CREATE TABLE IF NOT EXISTS document_jobs (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_document_jobs_user_id ON document_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_document_jobs_status ON document_jobs(status);

ALTER TABLE document_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own document jobs" ON document_jobs;
CREATE POLICY "Users can manage own document jobs" ON document_jobs FOR ALL USING (auth.uid() = user_id);

-- 5. transcription_jobs - zadania transkrypcji
CREATE TABLE IF NOT EXISTS transcription_jobs (
    id TEXT NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    video_title TEXT NOT NULL,
    session_id TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    progress INTEGER DEFAULT 0 NOT NULL,
    progress_message TEXT,
    include_sentiment BOOLEAN DEFAULT true NOT NULL,
    identify_speakers BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ,
    error TEXT,
    result_document_id UUID,
    audio_issues JSONB,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_user_id ON transcription_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_status ON transcription_jobs(status);

ALTER TABLE transcription_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own transcription jobs" ON transcription_jobs;
CREATE POLICY "Users can manage own transcription jobs" ON transcription_jobs FOR ALL USING (auth.uid() = user_id);

-- 6. user_voice_settings - ustawienia głosowe
CREATE TABLE IF NOT EXISTS user_voice_settings (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    wake_word VARCHAR(50) DEFAULT 'Asystencie',
    continuous_mode BOOLEAN DEFAULT false,
    auto_tts BOOLEAN DEFAULT true,
    tts_voice VARCHAR(50) DEFAULT 'pl-PL-MarekNeural',
    tts_speed DOUBLE PRECISION DEFAULT 1.0 CHECK (tts_speed >= 0.5 AND tts_speed <= 2.0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_voice_settings_user_id ON user_voice_settings(user_id);

ALTER TABLE user_voice_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own voice settings" ON user_voice_settings;
CREATE POLICY "Users can manage own voice settings" ON user_voice_settings FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE user_voice_settings IS 'Ustawienia obsługi głosowej (wake word, TTS, itp.)';

-- 7. voice_commands - historia komend głosowych
CREATE TABLE IF NOT EXISTS voice_commands (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transcription TEXT NOT NULL,
    intent TEXT CHECK (intent IN ('navigation', 'search', 'chat', 'control', 'unknown')),
    confidence DOUBLE PRECISION DEFAULT 0,
    action JSONB,
    executed BOOLEAN DEFAULT false,
    execution_result JSONB,
    audio_duration_ms INTEGER,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_commands_user_id ON voice_commands(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_commands_created_at ON voice_commands(created_at DESC);

ALTER TABLE voice_commands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own voice commands" ON voice_commands;
CREATE POLICY "Users can manage own voice commands" ON voice_commands FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE voice_commands IS 'Historia komend głosowych użytkowników';

-- 8. voice_macros - makra głosowe
CREATE TABLE IF NOT EXISTS voice_macros (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trigger_phrase TEXT NOT NULL,
    description TEXT,
    actions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_macros_user_id ON voice_macros(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_macros_trigger_phrase ON voice_macros(trigger_phrase);

ALTER TABLE voice_macros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own voice macros" ON voice_macros;
CREATE POLICY "Users can manage own voice macros" ON voice_macros FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE voice_macros IS 'Makra głosowe użytkowników';

-- Trigger dla updated_at na nowych tabelach
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_voice_settings_updated_at ON user_voice_settings;
CREATE TRIGGER update_user_voice_settings_updated_at 
  BEFORE UPDATE ON user_voice_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_voice_macros_updated_at ON voice_macros;
CREATE TRIGGER update_voice_macros_updated_at 
  BEFORE UPDATE ON voice_macros 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Uprawnienia dla ról Supabase
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_logs TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_tokens TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON document_jobs TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON transcription_jobs TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_voice_settings TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON voice_commands TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON voice_macros TO anon, authenticated, service_role;

-- Koniec migracji
