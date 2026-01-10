-- 024_add_config_type_for_api_configurations.sql
-- Dodaje typ konfiguracji (AI vs semantic search) oraz pola dla providerów wyszukiwania semantycznego

-- 1. Nowe pola i rozszerzenie ograniczeń
ALTER TABLE api_configurations
  ADD COLUMN IF NOT EXISTS config_type TEXT NOT NULL DEFAULT 'ai' CHECK (config_type IN ('ai','semantic')),
  ADD COLUMN IF NOT EXISTS search_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS results_limit INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS provider_meta JSONB;

-- 2. Poszerzenie listy providerów o semantic search
ALTER TABLE api_configurations DROP CONSTRAINT IF EXISTS api_configurations_provider_check;
ALTER TABLE api_configurations
  ADD CONSTRAINT api_configurations_provider_check CHECK (
    provider IN (
      'openai', 'local', 'azure', 'anthropic', 'other',
      'exa', 'perplexity', 'tavily'
    )
  );

-- 3. Indeks na config_type dla filtrowania
CREATE INDEX IF NOT EXISTS idx_api_configurations_type ON api_configurations(config_type);

-- 4. Aktualizacja istniejących rekordów na domyślny typ 'ai'
UPDATE api_configurations SET config_type = 'ai' WHERE config_type IS NULL;
