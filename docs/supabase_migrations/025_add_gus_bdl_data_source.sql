-- Migration: Dodanie GUS Bank Danych Lokalnych jako źródło danych
-- Description: Integracja z API GUS dla statystyk samorządowych

-- Funkcja dodająca GUS BDL dla istniejących i nowych użytkowników
CREATE OR REPLACE FUNCTION add_gus_bdl_source()
RETURNS TRIGGER AS $$
BEGIN
  -- GUS - Bank Danych Lokalnych (API)
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
    'GUS - Bank Danych Lokalnych',
    'statistics',
    'https://bdl.stat.gov.pl',
    'api',
    'weekly',
    true,
    jsonb_build_object(
      'baseUrl', 'https://bdl.stat.gov.pl/api/v1',
      'requiresAuth', true,
      'authType', 'header',
      'authHeader', 'X-ClientId',
      'endpoints', jsonb_build_object(
        'units', '/units',
        'variables', '/variables',
        'data', '/data',
        'subjects', '/subjects'
      ),
      'rateLimit', jsonb_build_object(
        'maxRequests', 500,
        'window', '15min'
      ),
      'cache', jsonb_build_object(
        'enabled', true,
        'ttl', 86400
      )
    ),
    'statistical',
    ARRAY['GUS', 'statystyki', 'demografia', 'finanse', 'gminy', 'powiaty', 'BDL'],
    'normal',
    'Rzeczpospolita Polska',
    false,  -- Dane statystyczne nie wymagają embeddingów
    false,  -- Nie klasyfikujemy statystyk
    true,   -- Słowa kluczowe mogą być przydatne
    false,  -- Nie generujemy streszczeń
    jsonb_build_object(
      'description', 'Bank Danych Lokalnych - największa w Polsce baza danych statystycznych o gospodarce, społeczeństwie i środowisku',
      'dataTypes', jsonb_build_array(
        'demografia',
        'finanse publiczne',
        'rynek pracy',
        'edukacja',
        'infrastruktura',
        'środowisko',
        'kultura',
        'turystyka'
      ),
      'territorialLevels', jsonb_build_array(
        'Polska',
        'Województwa',
        'Powiaty', 
        'Gminy'
      ),
      'apiDocumentation', 'https://api.stat.gov.pl/Home/BdlApi',
      'registrationRequired', true,
      'registrationUrl', 'https://api.stat.gov.pl/Home/BdlApi'
    )
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger dla nowych użytkowników
DROP TRIGGER IF EXISTS add_user_gus_bdl_source ON auth.users;
CREATE TRIGGER add_user_gus_bdl_source
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION add_gus_bdl_source();

-- Dodaj GUS BDL dla wszystkich istniejących użytkowników
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
        'GUS - Bank Danych Lokalnych',
        'statistics',
        'https://bdl.stat.gov.pl',
        'api',
        'weekly',
        true,
        jsonb_build_object(
          'baseUrl', 'https://bdl.stat.gov.pl/api/v1',
          'requiresAuth', true,
          'authType', 'header',
          'authHeader', 'X-ClientId',
          'endpoints', jsonb_build_object(
            'units', '/units',
            'variables', '/variables',
            'data', '/data',
            'subjects', '/subjects'
          ),
          'rateLimit', jsonb_build_object(
            'maxRequests', 500,
            'window', '15min'
          ),
          'cache', jsonb_build_object(
            'enabled', true,
            'ttl', 86400
          )
        ),
        'statistical',
        ARRAY['GUS', 'statystyki', 'demografia', 'finanse', 'gminy', 'powiaty', 'BDL'],
        'normal',
        'Rzeczpospolita Polska',
        false,
        false,
        true,
        false,
        jsonb_build_object(
          'description', 'Bank Danych Lokalnych - największa w Polsce baza danych statystycznych o gospodarce, społeczeństwie i środowisku',
          'dataTypes', jsonb_build_array(
            'demografia',
            'finanse publiczne',
            'rynek pracy',
            'edukacja',
            'infrastruktura',
            'środowisko',
            'kultura',
            'turystyka'
          ),
          'territorialLevels', jsonb_build_array(
            'Polska',
            'Województwa',
            'Powiaty', 
            'Gminy'
          ),
          'apiDocumentation', 'https://api.stat.gov.pl/Home/BdlApi',
          'registrationRequired', true,
          'registrationUrl', 'https://api.stat.gov.pl/Home/BdlApi'
        )
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Failed to add GUS BDL for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

COMMENT ON COLUMN data_sources.api_config IS 'Konfiguracja API client: baseUrl, requiresAuth, authType, authHeader, endpoints, rateLimit, cache';
