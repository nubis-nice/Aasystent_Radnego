-- Migration: Rozszerzenie data_sources o konfigurację API clients
-- Description: Dodanie pól dla uniwersalnego systemu pobierania danych (API + scraping)
-- Agent AI "Winsdurf" - architektura bez MCP, tylko API/scraping

-- Dodaj nowe kolumny do data_sources
ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS fetch_method TEXT DEFAULT 'scraping' CHECK (fetch_method IN ('api', 'scraping', 'hybrid')),
  ADD COLUMN IF NOT EXISTS api_config JSONB,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other' CHECK (category IN ('legal', 'administrative', 'financial', 'statistical', 'other')),
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS jurisdiction TEXT,
  ADD COLUMN IF NOT EXISTS legal_scope TEXT[],
  ADD COLUMN IF NOT EXISTS enable_embeddings BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_classification BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_keyword_extraction BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_summarization BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cron_expression TEXT,
  ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT;

-- Dodaj indeksy dla nowych kolumn
CREATE INDEX IF NOT EXISTS idx_data_sources_fetch_method ON data_sources(fetch_method);
CREATE INDEX IF NOT EXISTS idx_data_sources_category ON data_sources(category);
CREATE INDEX IF NOT EXISTS idx_data_sources_priority ON data_sources(priority);
CREATE INDEX IF NOT EXISTS idx_data_sources_tags ON data_sources USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_data_sources_legal_scope ON data_sources USING GIN(legal_scope);

-- Zaktualizuj istniejące źródła - ustaw fetch_method na podstawie typu
UPDATE data_sources
SET fetch_method = CASE
  WHEN type IN ('api_isap', 'api_rcl', 'api_wsa_nsa', 'api_rio', 'api_custom') THEN 'api'
  WHEN type IN ('scraper_bip', 'scraper_dziennik', 'scraper_custom') THEN 'scraping'
  ELSE 'scraping'
END
WHERE fetch_method IS NULL;

-- Zaktualizuj kategorie na podstawie typu
UPDATE data_sources
SET category = CASE
  WHEN type IN ('api_isap', 'api_rcl', 'api_wsa_nsa', 'api_rio', 'legal') THEN 'legal'
  WHEN type IN ('scraper_bip', 'municipality', 'councilor') THEN 'administrative'
  WHEN type = 'statistics' THEN 'statistical'
  ELSE 'other'
END
WHERE category = 'other';

-- Zaktualizuj priorytety
UPDATE data_sources
SET priority = CASE
  WHEN type IN ('api_rio', 'api_wsa_nsa') THEN 'critical'
  WHEN type IN ('api_isap', 'scraper_bip') THEN 'high'
  ELSE 'normal'
END
WHERE priority = 'normal';

-- Dodaj tagi na podstawie typu
UPDATE data_sources
SET tags = CASE
  WHEN type = 'api_isap' THEN ARRAY['prawo', 'ustawy', 'rozporządzenia', 'ISAP']
  WHEN type = 'api_wsa_nsa' THEN ARRAY['orzecznictwo', 'sądy administracyjne', 'WSA', 'NSA']
  WHEN type = 'api_rio' THEN ARRAY['RIO', 'nadzór', 'finanse publiczne']
  WHEN type = 'scraper_bip' THEN ARRAY['BIP', 'samorząd', 'uchwały']
  WHEN type = 'municipality' THEN ARRAY['gmina', 'aktualności']
  WHEN type = 'legal' THEN ARRAY['prawo', 'akty prawne']
  WHEN type = 'statistics' THEN ARRAY['statystyki', 'dane']
  ELSE ARRAY['inne']
END
WHERE tags = '{}';

-- Funkcja do walidacji api_config
CREATE OR REPLACE FUNCTION validate_api_config()
RETURNS TRIGGER AS $$
BEGIN
  -- Jeśli fetch_method to 'api' lub 'hybrid', api_config musi być ustawiony
  IF NEW.fetch_method IN ('api', 'hybrid') AND NEW.api_config IS NULL THEN
    RAISE EXCEPTION 'api_config is required when fetch_method is api or hybrid';
  END IF;
  
  -- Jeśli fetch_method to 'scraping' lub 'hybrid', scraping_config musi być ustawiony
  IF NEW.fetch_method IN ('scraping', 'hybrid') AND NEW.scraping_config IS NULL THEN
    RAISE EXCEPTION 'scraping_config is required when fetch_method is scraping or hybrid';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger do walidacji konfiguracji
DROP TRIGGER IF EXISTS validate_data_source_config ON data_sources;
CREATE TRIGGER validate_data_source_config
  BEFORE INSERT OR UPDATE ON data_sources
  FOR EACH ROW
  EXECUTE FUNCTION validate_api_config();

-- Dodaj przykładowe źródła API dla nowych użytkowników
CREATE OR REPLACE FUNCTION create_default_api_sources()
RETURNS TRIGGER AS $$
BEGIN
  -- ISAP - Internetowy System Aktów Prawnych (scraping, bo nie ma publicznego API)
  INSERT INTO data_sources (
    user_id, name, type, url, fetch_method, 
    scraping_frequency, scraping_enabled, scraping_config,
    category, tags, priority, jurisdiction, legal_scope
  )
  VALUES (
    NEW.id,
    'ISAP - Internetowy System Aktów Prawnych',
    'api_isap',
    'https://isap.sejm.gov.pl',
    'scraping',
    'weekly',
    false,
    jsonb_build_object(
      'maxPages', 50,
      'maxDepth', 2,
      'delayMs', 2000,
      'selectors', jsonb_build_object(
        'documentList', '.act-list .act-item, table.acts tr',
        'title', 'h1.act-title, .title',
        'content', '.act-content, .content',
        'date', '.act-date, .date'
      ),
      'urlPatterns', jsonb_build_object(
        'include', jsonb_build_array('isap.sejm.gov.pl'),
        'exclude', jsonb_build_array('login', 'admin')
      )
    ),
    'legal',
    ARRAY['prawo', 'ustawy', 'rozporządzenia', 'ISAP'],
    'high',
    'Rzeczpospolita Polska',
    ARRAY['prawo powszechnie obowiązujące']
  );

  -- Monitor Polski
  INSERT INTO data_sources (
    user_id, name, type, url, fetch_method,
    scraping_frequency, scraping_enabled, scraping_config,
    category, tags, priority, jurisdiction, legal_scope
  )
  VALUES (
    NEW.id,
    'Monitor Polski - Dziennik Urzędowy RP',
    'scraper_dziennik',
    'https://monitorpolski.gov.pl',
    'scraping',
    'weekly',
    false,
    jsonb_build_object(
      'maxPages', 30,
      'maxDepth', 2,
      'delayMs', 2000,
      'selectors', jsonb_build_object(
        'documentList', '.document-list .item',
        'title', 'h2.title',
        'content', '.content',
        'date', '.date'
      )
    ),
    'legal',
    ARRAY['Monitor Polski', 'dziennik urzędowy', 'akty wykonawcze'],
    'high',
    'Rzeczpospolita Polska',
    ARRAY['akty wykonawcze']
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger do tworzenia domyślnych źródeł API
DROP TRIGGER IF EXISTS create_user_default_api_sources ON auth.users;
CREATE TRIGGER create_user_default_api_sources
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_api_sources();

-- Komentarze
COMMENT ON COLUMN data_sources.fetch_method IS 'Metoda pobierania danych: api, scraping, hybrid';
COMMENT ON COLUMN data_sources.api_config IS 'Konfiguracja API client (JSON): baseUrl, endpoint, headers, auth, pagination, responseMapping';
COMMENT ON COLUMN data_sources.category IS 'Kategoria źródła: legal, administrative, financial, statistical, other';
COMMENT ON COLUMN data_sources.tags IS 'Tagi dla łatwiejszego wyszukiwania i filtrowania';
COMMENT ON COLUMN data_sources.priority IS 'Priorytet źródła: low, normal, high, critical';
COMMENT ON COLUMN data_sources.jurisdiction IS 'Jurysdykcja (np. gmina Drawno, województwo zachodniopomorskie)';
COMMENT ON COLUMN data_sources.legal_scope IS 'Zakres prawny (np. budżet, podatki, planowanie przestrzenne)';
COMMENT ON COLUMN data_sources.enable_embeddings IS 'Czy generować embeddingi dla dokumentów z tego źródła';
COMMENT ON COLUMN data_sources.enable_classification IS 'Czy klasyfikować dokumenty z tego źródła';
COMMENT ON COLUMN data_sources.enable_keyword_extraction IS 'Czy wyciągać słowa kluczowe z dokumentów';
COMMENT ON COLUMN data_sources.enable_summarization IS 'Czy generować streszczenia dokumentów';
