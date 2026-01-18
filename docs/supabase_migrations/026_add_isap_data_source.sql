-- Migration: Dodanie ISAP (Internetowy System Aktów Prawnych) jako źródło danych
-- Description: Integracja z API Sejmu RP dla aktów prawnych (Dziennik Ustaw, Monitor Polski)

-- Funkcja dodająca ISAP dla istniejących i nowych użytkowników
CREATE OR REPLACE FUNCTION add_isap_source()
RETURNS TRIGGER AS $$
BEGIN
  -- ISAP - Internetowy System Aktów Prawnych (ELI API)
  INSERT INTO data_sources (
    user_id, 
    name, 
    type, 
    url, 
    fetch_method,
    scraping_frequency, 
    scraping_enabled, 
    api_config,
    category, 
    tags, 
    priority, 
    jurisdiction, 
    enable_embeddings,
    enable_classification,
    enable_keyword_extraction,
    enable_summarization,
    metadata
  )
  VALUES (
    NEW.id,
    'ISAP - Internetowy System Aktów Prawnych',
    'legal',
    'https://isap.sejm.gov.pl',
    'api',
    'daily',
    true,
    jsonb_build_object(
      'baseUrl', 'https://api.sejm.gov.pl/eli',
      'requiresAuth', false,
      'endpoints', jsonb_build_object(
        'acts', '/acts/{publisher}/{year}',
        'actDetails', '/acts/{publisher}/{year}/{position}',
        'actText', '/acts/{publisher}/{year}/{position}/text.html',
        'search', '/acts/{publisher}/{year}?title={query}'
      ),
      'publishers', jsonb_build_array('DU', 'MP'),
      'rateLimit', jsonb_build_object(
        'maxRequests', 100,
        'window', '1min'
      ),
      'documentation', 'https://api.sejm.gov.pl/eli/openapi/ui'
    ),
    'statistical',
    ARRAY['ustawy', 'rozporządzenia', 'dziennik_ustaw', 'monitor_polski', 'prawo', 'legislacja', 'ISAP'],
    'high',
    'Rzeczpospolita Polska',
    true,
    true,
    true,
    true,
    jsonb_build_object(
      'description', 'Oficjalne źródło aktów prawnych RP - Dziennik Ustaw i Monitor Polski',
      'dataTypes', ARRAY['ustawy', 'rozporządzenia', 'obwieszczenia', 'akty wykonawcze'],
      'coverage', 'Akty prawne od 1918 roku',
      'updateFrequency', 'Codziennie',
      'officialSource', true,
      'integratedWithOrchestrator', true,
      'orchestratorTool', 'isap_legal'
    )
  )
  ON CONFLICT DO NOTHING;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger dla nowych użytkowników
DROP TRIGGER IF EXISTS add_user_isap_source ON auth.users;
CREATE TRIGGER add_user_isap_source
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION add_isap_source();

-- Dodaj źródło ISAP dla wszystkich istniejących użytkowników
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    BEGIN
    INSERT INTO data_sources (
      user_id, 
      name, 
      type, 
      url, 
      fetch_method,
      scraping_frequency, 
      scraping_enabled, 
      api_config,
      category, 
      tags, 
      priority, 
      jurisdiction, 
      enable_embeddings,
      enable_classification,
      enable_keyword_extraction,
      enable_summarization,
      metadata
    )
    VALUES (
      user_record.id,
      'ISAP - Internetowy System Aktów Prawnych',
      'legal',
      'https://isap.sejm.gov.pl',
      'api',
      'daily',
      true,
      jsonb_build_object(
        'baseUrl', 'https://api.sejm.gov.pl/eli',
        'requiresAuth', false,
        'endpoints', jsonb_build_object(
          'acts', '/acts/{publisher}/{year}',
          'actDetails', '/acts/{publisher}/{year}/{position}',
          'actText', '/acts/{publisher}/{year}/{position}/text.html',
          'search', '/acts/{publisher}/{year}?title={query}'
        ),
        'publishers', jsonb_build_array('DU', 'MP'),
        'rateLimit', jsonb_build_object(
          'maxRequests', 100,
          'window', '1min'
        ),
        'documentation', 'https://api.sejm.gov.pl/eli/openapi/ui'
      ),
      'statistical',
      ARRAY['ustawy', 'rozporządzenia', 'dziennik_ustaw', 'monitor_polski', 'prawo', 'legislacja', 'ISAP'],
      'high',
      'Rzeczpospolita Polska',
      true,
      true,
      true,
      true,
      jsonb_build_object(
        'description', 'Oficjalne źródło aktów prawnych RP - Dziennik Ustaw i Monitor Polski',
        'dataTypes', ARRAY['ustawy', 'rozporządzenia', 'obwieszczenia', 'akty wykonawcze'],
        'coverage', 'Akty prawne od 1918 roku',
        'updateFrequency', 'Codziennie',
        'officialSource', true,
        'integratedWithOrchestrator', true,
        'orchestratorTool', 'isap_legal'
      )
    )
    ON CONFLICT DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Failed to add ISAP for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Indeks dla szybszego wyszukiwania źródeł ISAP
CREATE INDEX IF NOT EXISTS idx_data_sources_isap 
ON data_sources (user_id) 
WHERE url = 'https://isap.sejm.gov.pl';

COMMENT ON FUNCTION add_isap_source() IS 'Funkcja dodająca źródło ISAP (Internetowy System Aktów Prawnych) dla użytkownika';
