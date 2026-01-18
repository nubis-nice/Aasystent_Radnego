-- Migration: Dodanie KRS jako źródło danych
-- Description: Integracja z Krajowym Rejestrem Sądowym

CREATE OR REPLACE FUNCTION add_krs_source()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO data_sources (
    user_id, name, type, url, fetch_method, scraping_frequency, scraping_enabled,
    api_config, category, tags, priority, jurisdiction,
    enable_embeddings, enable_classification, enable_keyword_extraction, enable_summarization, metadata
  )
  VALUES (
    NEW.id,
    'KRS - Krajowy Rejestr Sądowy',
    'statistics',
    'https://api-krs.ms.gov.pl',
    'api',
    'daily',
    true,
    jsonb_build_object(
      'endpoints', jsonb_build_object(
        'search', '/api/krs/Wyszukaj',
        'entity', '/api/krs/OdpisAktualny',
        'byNip', '/api/krs/OdpisAktualny/nip',
        'byRegon', '/api/krs/OdpisAktualny/regon'
      ),
      'rateLimit', jsonb_build_object('maxRequests', 50, 'window', '1min'),
      'cache', jsonb_build_object('enabled', true, 'ttl', 3600)
    ),
    'statistical',
    ARRAY['krs', 'spółki', 'stowarzyszenia', 'fundacje', 'przedsiębiorstwa', 'rejestr sądowy'],
    'normal',
    'Rzeczpospolita Polska',
    false, false, true, false,
    jsonb_build_object(
      'description', 'Krajowy Rejestr Sądowy - rejestr przedsiębiorców, stowarzyszeń, fundacji',
      'provider', 'Ministerstwo Sprawiedliwości',
      'officialSource', true,
      'integratedWithOrchestrator', true,
      'orchestratorTool', 'krs_registry'
    )
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS add_user_krs_source ON auth.users;
CREATE TRIGGER add_user_krs_source
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION add_krs_source();

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
        'KRS - Krajowy Rejestr Sądowy',
        'registry',
        'https://api-krs.ms.gov.pl',
        'api',
        'daily',
        true,
        jsonb_build_object(
          'endpoints', jsonb_build_object(
            'search', '/api/krs/Wyszukaj',
            'entity', '/api/krs/OdpisAktualny',
            'byNip', '/api/krs/OdpisAktualny/nip',
            'byRegon', '/api/krs/OdpisAktualny/regon'
          ),
          'rateLimit', jsonb_build_object('maxRequests', 50, 'window', '1min'),
          'cache', jsonb_build_object('enabled', true, 'ttl', 3600)
        ),
        'statistical',
        ARRAY['krs', 'spółki', 'stowarzyszenia', 'fundacje', 'przedsiębiorstwa', 'rejestr sądowy'],
        'normal',
        'Rzeczpospolita Polska',
        false, false, true, false,
        jsonb_build_object(
          'description', 'Krajowy Rejestr Sądowy - rejestr przedsiębiorców, stowarzyszeń, fundacji',
          'provider', 'Ministerstwo Sprawiedliwości',
          'officialSource', true,
          'integratedWithOrchestrator', true,
          'orchestratorTool', 'krs_registry'
        )
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_data_sources_krs ON data_sources (user_id) WHERE url = 'https://api-krs.ms.gov.pl';
