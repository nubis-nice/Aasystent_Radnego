-- Migration: Dodanie EU Funds (Fundusze Europejskie) jako źródło danych
-- Description: Integracja z portalami funduszy UE - Mapa Dotacji, Portal FE, Baza Konkurencyjności

-- Funkcja dodająca EU Funds dla istniejących i nowych użytkowników
CREATE OR REPLACE FUNCTION add_eu_funds_source()
RETURNS TRIGGER AS $$
BEGIN
  -- EU Funds - Portal Funduszy Europejskich
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
    'Fundusze Europejskie - Portal i Mapa Dotacji',
    'funding',
    'https://www.funduszeeuropejskie.gov.pl',
    'api',
    'daily',
    true,
    jsonb_build_object(
      'sources', jsonb_build_array(
        jsonb_build_object(
          'name', 'Portal Funduszy Europejskich',
          'url', 'https://www.funduszeeuropejskie.gov.pl',
          'type', 'competitions'
        ),
        jsonb_build_object(
          'name', 'Mapa Dotacji UE',
          'url', 'https://mapadotacji.gov.pl',
          'type', 'projects'
        ),
        jsonb_build_object(
          'name', 'Baza Konkurencyjności',
          'url', 'https://bazakonkurencyjnosci.funduszeeuropejskie.gov.pl',
          'type', 'offers'
        )
      ),
      'programs', jsonb_build_array(
        'FENG', 'FERS', 'FEnIKS', 'FERC', 'Interreg', 'KPO'
      ),
      'rateLimit', jsonb_build_object(
        'maxRequests', 50,
        'window', '1min'
      )
    ),
    'statistical',
    ARRAY['dotacje', 'fundusze_europejskie', 'nabory', 'konkursy', 'dofinansowanie', 'ue', 'projekty', 'EU_Funds'],
    'high',
    'Unia Europejska',
    true,
    true,
    true,
    true,
    jsonb_build_object(
      'description', 'Źródło informacji o funduszach europejskich, aktualnych naborach i projektach',
      'dataTypes', ARRAY['konkursy', 'nabory', 'projekty', 'dotacje', 'zapytania_ofertowe'],
      'coverage', 'Perspektywa 2021-2027 i archiwalne',
      'updateFrequency', 'Codziennie',
      'officialSource', true,
      'integratedWithOrchestrator', true,
      'orchestratorTool', 'eu_funds',
      'useCases', ARRAY[
        'Wyszukiwanie aktualnych naborów',
        'Analiza projektów w regionie',
        'Identyfikacja możliwości dofinansowania',
        'Monitoring terminów konkursów'
      ]
    )
  )
  ON CONFLICT DO NOTHING;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger dla nowych użytkowników
DROP TRIGGER IF EXISTS add_user_eu_funds_source ON auth.users;
CREATE TRIGGER add_user_eu_funds_source
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION add_eu_funds_source();

-- Dodaj źródło EU Funds dla wszystkich istniejących użytkowników
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
      'Fundusze Europejskie - Portal i Mapa Dotacji',
      'funding',
      'https://www.funduszeeuropejskie.gov.pl',
      'api',
      'daily',
      true,
      jsonb_build_object(
        'sources', jsonb_build_array(
          jsonb_build_object(
            'name', 'Portal Funduszy Europejskich',
            'url', 'https://www.funduszeeuropejskie.gov.pl',
            'type', 'competitions'
          ),
          jsonb_build_object(
            'name', 'Mapa Dotacji UE',
            'url', 'https://mapadotacji.gov.pl',
            'type', 'projects'
          ),
          jsonb_build_object(
            'name', 'Baza Konkurencyjności',
            'url', 'https://bazakonkurencyjnosci.funduszeeuropejskie.gov.pl',
            'type', 'offers'
          )
        ),
        'programs', jsonb_build_array(
          'FENG', 'FERS', 'FEnIKS', 'FERC', 'Interreg', 'KPO'
        ),
        'rateLimit', jsonb_build_object(
          'maxRequests', 50,
          'window', '1min'
        )
      ),
      'statistical',
      ARRAY['dotacje', 'fundusze_europejskie', 'nabory', 'konkursy', 'dofinansowanie', 'ue', 'projekty', 'EU_Funds'],
      'high',
      'Unia Europejska',
      true,
      true,
      true,
      true,
      jsonb_build_object(
        'description', 'Źródło informacji o funduszach europejskich, aktualnych naborach i projektach',
        'dataTypes', ARRAY['konkursy', 'nabory', 'projekty', 'dotacje', 'zapytania_ofertowe'],
        'coverage', 'Perspektywa 2021-2027 i archiwalne',
        'updateFrequency', 'Codziennie',
        'officialSource', true,
        'integratedWithOrchestrator', true,
        'orchestratorTool', 'eu_funds',
        'useCases', ARRAY[
          'Wyszukiwanie aktualnych naborów',
          'Analiza projektów w regionie',
          'Identyfikacja możliwości dofinansowania',
          'Monitoring terminów konkursów'
        ]
      )
    )
    ON CONFLICT DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Failed to add EU Funds for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Indeks dla szybszego wyszukiwania źródeł EU Funds
CREATE INDEX IF NOT EXISTS idx_data_sources_eu_funds 
ON data_sources (user_id) 
WHERE url = 'https://www.funduszeeuropejskie.gov.pl';

-- Indeks dla wyszukiwania po kategorii statistical (funding)
CREATE INDEX IF NOT EXISTS idx_data_sources_category_funding
ON data_sources (user_id, category)
WHERE category = 'statistical' AND type = 'funding';

COMMENT ON FUNCTION add_eu_funds_source() IS 'Funkcja dodająca źródło Funduszy Europejskich dla użytkownika';
