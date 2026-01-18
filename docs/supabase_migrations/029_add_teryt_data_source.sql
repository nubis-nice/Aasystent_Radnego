-- Migration: Dodanie TERYT jako źródło danych
-- Description: Integracja z rejestrem TERYT GUS (jednostki terytorialne)

CREATE OR REPLACE FUNCTION add_teryt_source()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO data_sources (
    user_id, name, type, url, fetch_method, scraping_frequency, scraping_enabled,
    api_config, category, tags, priority, jurisdiction,
    enable_embeddings, enable_classification, enable_keyword_extraction, enable_summarization, metadata
  )
  VALUES (
    NEW.id,
    'TERYT - Rejestr Jednostek Terytorialnych',
    'statistics',
    'https://api-teryt.stat.gov.pl',
    'api',
    'monthly',
    true,
    jsonb_build_object(
      'endpoints', jsonb_build_object(
        'voivodeships', '/api/terc/wojewodztwa',
        'counties', '/api/terc/powiaty',
        'municipalities', '/api/terc/gminy',
        'streets', '/api/simc/ulice'
      ),
      'rateLimit', jsonb_build_object('maxRequests', 100, 'window', '1min'),
      'cache', jsonb_build_object('enabled', true, 'ttl', 86400)
    ),
    'statistical',
    ARRAY['teryt', 'gminy', 'powiaty', 'województwa', 'jednostki terytorialne', 'GUS'],
    'normal',
    'Rzeczpospolita Polska',
    false, false, true, false,
    jsonb_build_object(
      'description', 'Krajowy Rejestr Urzędowy Podziału Terytorialnego Kraju',
      'provider', 'Główny Urząd Statystyczny',
      'officialSource', true,
      'integratedWithOrchestrator', true,
      'orchestratorTool', 'teryt_registry'
    )
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS add_user_teryt_source ON auth.users;
CREATE TRIGGER add_user_teryt_source
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION add_teryt_source();

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
        'TERYT - Rejestr Jednostek Terytorialnych',
        'registry',
        'https://api-teryt.stat.gov.pl',
        'api',
        'monthly',
        true,
        jsonb_build_object(
          'endpoints', jsonb_build_object(
            'voivodeships', '/api/terc/wojewodztwa',
            'counties', '/api/terc/powiaty',
            'municipalities', '/api/terc/gminy',
            'streets', '/api/simc/ulice'
          ),
          'rateLimit', jsonb_build_object('maxRequests', 100, 'window', '1min'),
          'cache', jsonb_build_object('enabled', true, 'ttl', 86400)
        ),
        'statistical',
        ARRAY['teryt', 'gminy', 'powiaty', 'województwa', 'jednostki terytorialne', 'GUS'],
        'normal',
        'Rzeczpospolita Polska',
        false, false, true, false,
        jsonb_build_object(
          'description', 'Krajowy Rejestr Urzędowy Podziału Terytorialnego Kraju',
          'provider', 'Główny Urząd Statystyczny',
          'officialSource', true,
          'integratedWithOrchestrator', true,
          'orchestratorTool', 'teryt_registry'
        )
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_data_sources_teryt ON data_sources (user_id) WHERE url = 'https://api-teryt.stat.gov.pl';
