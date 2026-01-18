-- Migration: Dodanie CEIDG jako źródło danych
-- Description: Integracja z Centralną Ewidencją Działalności Gospodarczej

CREATE OR REPLACE FUNCTION add_ceidg_source()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO data_sources (
    user_id, name, type, url, fetch_method, scraping_frequency, scraping_enabled,
    api_config, category, tags, priority, jurisdiction,
    enable_embeddings, enable_classification, enable_keyword_extraction, enable_summarization, metadata
  )
  VALUES (
    NEW.id,
    'CEIDG - Ewidencja Działalności Gospodarczej',
    'statistics',
    'https://dane.biznes.gov.pl',
    'api',
    'daily',
    true,
    jsonb_build_object(
      'endpoints', jsonb_build_object(
        'search', '/api/ceidg/v2/firmy',
        'byNip', '/api/ceidg/v2/firmy?nip=',
        'byRegon', '/api/ceidg/v2/firmy?regon='
      ),
      'requiresApiKey', true,
      'rateLimit', jsonb_build_object('maxRequests', 100, 'window', '1min'),
      'cache', jsonb_build_object('enabled', true, 'ttl', 3600)
    ),
    'statistical',
    ARRAY['ceidg', 'jednoosobowa działalność', 'przedsiębiorcy', 'firmy', 'NIP', 'REGON'],
    'normal',
    'Rzeczpospolita Polska',
    false, false, true, false,
    jsonb_build_object(
      'description', 'Centralna Ewidencja i Informacja o Działalności Gospodarczej',
      'provider', 'Ministerstwo Rozwoju i Technologii',
      'officialSource', true,
      'integratedWithOrchestrator', true,
      'orchestratorTool', 'ceidg_registry'
    )
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS add_user_ceidg_source ON auth.users;
CREATE TRIGGER add_user_ceidg_source
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION add_ceidg_source();

DO $$
DECLARE user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    BEGIN
      INSERT INTO data_sources (
        user_id, name, type, url, fetch_method, scraping_frequency, scraping_enabled,
        api_config, category, tags, priority, jurisdiction,
        enable_embeddings, enable_classification, enable_keyword_extraction, enable_summarization, metadata
      )
      VALUES (
        user_record.id,
        'CEIDG - Ewidencja Działalności Gospodarczej',
        'registry',
        'https://dane.biznes.gov.pl',
        'api',
        'daily',
        true,
        jsonb_build_object(
          'endpoints', jsonb_build_object(
            'search', '/api/ceidg/v2/firmy',
            'byNip', '/api/ceidg/v2/firmy?nip=',
            'byRegon', '/api/ceidg/v2/firmy?regon='
          ),
          'requiresApiKey', true,
          'rateLimit', jsonb_build_object('maxRequests', 100, 'window', '1min'),
          'cache', jsonb_build_object('enabled', true, 'ttl', 3600)
        ),
        'statistical',
        ARRAY['ceidg', 'jednoosobowa działalność', 'przedsiębiorcy', 'firmy', 'NIP', 'REGON'],
        'normal',
        'Rzeczpospolita Polska',
        false, false, true, false,
        jsonb_build_object(
          'description', 'Centralna Ewidencja i Informacja o Działalności Gospodarczej',
          'provider', 'Ministerstwo Rozwoju i Technologii',
          'officialSource', true,
          'integratedWithOrchestrator', true,
          'orchestratorTool', 'ceidg_registry'
        )
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_data_sources_ceidg ON data_sources (user_id) WHERE url = 'https://dane.biznes.gov.pl';
