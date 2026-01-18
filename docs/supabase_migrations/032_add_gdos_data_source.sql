-- Migration: Dodanie GDOŚ jako źródło danych
-- Description: Integracja z Generalną Dyrekcją Ochrony Środowiska (obszary chronione, Natura 2000)

CREATE OR REPLACE FUNCTION add_gdos_source()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO data_sources (
    user_id, name, type, url, fetch_method, scraping_frequency, scraping_enabled,
    api_config, category, tags, priority, jurisdiction,
    enable_embeddings, enable_classification, enable_keyword_extraction, enable_summarization, metadata
  )
  VALUES (
    NEW.id,
    'GDOŚ - Dane Środowiskowe',
    'statistics',
    'https://sdi.gdos.gov.pl',
    'api',
    'weekly',
    true,
    jsonb_build_object(
      'services', jsonb_build_object(
        'wfs', 'https://sdi.gdos.gov.pl/wfs',
        'natura2000', 'https://natura2000.gdos.gov.pl'
      ),
      'layers', jsonb_build_array(
        'FormaOchronyPrzyrody',
        'Natura2000',
        'ParkNarodowy',
        'RezerwatPrzyrody',
        'ParkKrajobrazowy'
      ),
      'rateLimit', jsonb_build_object('maxRequests', 30, 'window', '1min'),
      'cache', jsonb_build_object('enabled', true, 'ttl', 86400)
    ),
    'statistical',
    ARRAY['gdoś', 'natura 2000', 'obszary chronione', 'rezerwaty', 'parki narodowe', 'środowisko'],
    'normal',
    'Rzeczpospolita Polska',
    false, false, true, false,
    jsonb_build_object(
      'description', 'Generalna Dyrekcja Ochrony Środowiska - dane o obszarach chronionych',
      'provider', 'Generalna Dyrekcja Ochrony Środowiska',
      'officialSource', true,
      'integratedWithOrchestrator', true,
      'orchestratorTool', 'gdos_environmental',
      'useCases', ARRAY[
        'Sprawdzanie ograniczeń środowiskowych dla lokalizacji',
        'Weryfikacja obszarów Natura 2000',
        'Analiza oddziaływania na środowisko'
      ]
    )
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS add_user_gdos_source ON auth.users;
CREATE TRIGGER add_user_gdos_source
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION add_gdos_source();

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
        'GDOŚ - Dane Środowiskowe',
        'environmental',
        'https://sdi.gdos.gov.pl',
        'api',
        'weekly',
        true,
        jsonb_build_object(
          'services', jsonb_build_object(
            'wfs', 'https://sdi.gdos.gov.pl/wfs',
            'natura2000', 'https://natura2000.gdos.gov.pl'
          ),
          'layers', jsonb_build_array(
            'FormaOchronyPrzyrody',
            'Natura2000',
            'ParkNarodowy',
            'RezerwatPrzyrody',
            'ParkKrajobrazowy'
          ),
          'rateLimit', jsonb_build_object('maxRequests', 30, 'window', '1min'),
          'cache', jsonb_build_object('enabled', true, 'ttl', 86400)
        ),
        'statistical',
        ARRAY['gdoś', 'natura 2000', 'obszary chronione', 'rezerwaty', 'parki narodowe', 'środowisko'],
        'normal',
        'Rzeczpospolita Polska',
        false, false, true, false,
        jsonb_build_object(
          'description', 'Generalna Dyrekcja Ochrony Środowiska - dane o obszarach chronionych',
          'provider', 'Generalna Dyrekcja Ochrony Środowiska',
          'officialSource', true,
          'integratedWithOrchestrator', true,
          'orchestratorTool', 'gdos_environmental',
          'useCases', ARRAY[
            'Sprawdzanie ograniczeń środowiskowych dla lokalizacji',
            'Weryfikacja obszarów Natura 2000',
            'Analiza oddziaływania na środowisko'
          ]
        )
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_data_sources_gdos ON data_sources (user_id) WHERE url = 'https://sdi.gdos.gov.pl';
