-- ============================================
-- Migracja: Dodanie brakujących kolumn do api_configurations
-- Data: 2026-01-11
-- Opis: Dodaje kolumny embedding_model, transcription_model, vision_model, config_type
-- ============================================

-- 1. Dodaj kolumnę config_type
ALTER TABLE api_configurations 
ADD COLUMN IF NOT EXISTS config_type VARCHAR(20) DEFAULT 'ai';

-- 2. Dodaj kolumnę embedding_model
ALTER TABLE api_configurations 
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100);

-- 3. Dodaj kolumnę transcription_model
ALTER TABLE api_configurations 
ADD COLUMN IF NOT EXISTS transcription_model VARCHAR(100);

-- 4. Dodaj kolumnę vision_model
ALTER TABLE api_configurations 
ADD COLUMN IF NOT EXISTS vision_model VARCHAR(100);

-- 5. Dodaj kolumnę tts_model
ALTER TABLE api_configurations 
ADD COLUMN IF NOT EXISTS tts_model VARCHAR(100);

-- 6. Dodaj kolumny dla semantic search providers
ALTER TABLE api_configurations 
ADD COLUMN IF NOT EXISTS search_endpoint TEXT;

ALTER TABLE api_configurations 
ADD COLUMN IF NOT EXISTS results_limit INTEGER DEFAULT 10;

-- 7. Dodaj kolumnę provider_meta dla dodatkowych ustawień
ALTER TABLE api_configurations 
ADD COLUMN IF NOT EXISTS provider_meta JSONB;

-- 8. Dodaj kolumny dla szyfrowania AES-256-GCM
ALTER TABLE api_configurations 
ADD COLUMN IF NOT EXISTS encryption_iv TEXT;

-- 9. Dodaj kolumny dla statusu połączenia
ALTER TABLE api_configurations 
ADD COLUMN IF NOT EXISTS connection_status VARCHAR(20) DEFAULT 'unknown';

ALTER TABLE api_configurations 
ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMPTZ;

ALTER TABLE api_configurations 
ADD COLUMN IF NOT EXISTS last_test_result JSONB;

-- 10. Rozszerz CHECK constraint dla provider (jeśli istnieje)
-- Najpierw usuń stary constraint
ALTER TABLE api_configurations 
DROP CONSTRAINT IF EXISTS api_configurations_provider_check;

-- Dodaj nowy constraint z rozszerzoną listą providerów
ALTER TABLE api_configurations 
ADD CONSTRAINT api_configurations_provider_check 
CHECK (provider IN ('openai', 'local', 'azure', 'anthropic', 'other', 'custom', 'exa', 'perplexity', 'tavily'));

-- Komentarze
COMMENT ON COLUMN api_configurations.config_type IS 'Typ konfiguracji: ai (modele AI) lub semantic (wyszukiwanie semantyczne)';
COMMENT ON COLUMN api_configurations.embedding_model IS 'Model do generowania embeddingów (np. text-embedding-3-small)';
COMMENT ON COLUMN api_configurations.transcription_model IS 'Model do transkrypcji audio (np. whisper-1)';
COMMENT ON COLUMN api_configurations.vision_model IS 'Model do analizy obrazów (np. gpt-4-vision)';
COMMENT ON COLUMN api_configurations.tts_model IS 'Model do syntezy mowy (np. tts-1)';
COMMENT ON COLUMN api_configurations.connection_status IS 'Status połączenia: unknown, working, failed';

-- Koniec migracji
