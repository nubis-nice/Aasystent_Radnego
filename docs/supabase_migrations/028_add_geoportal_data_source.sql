-- Migration: Dodanie Geoportal jako źródło danych
-- Description: Integracja z Geoportal.gov.pl dla danych przestrzennych (działki, MPZP, granice)

-- Funkcja dodająca Geoportal dla istniejących i nowych użytkowników
CREATE OR REPLACE FUNCTION add_geoportal_source()
RETURNS TRIGGER AS $$
BEGIN
  -- Geoportal - Dane przestrzenne
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
    'Geoportal - Dane Przestrzenne',
    'spatial',
    'https://geoportal.gov.pl',
    'api',
    'weekly',
    true,
    jsonb_build_object(
      'services', jsonb_build_object(
        'ULDK', 'https://uldk.gugik.gov.pl',
        'PRG', 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries',
        'EMUiA', 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/EMUiA/WFS/Addresses',
        'BDOT', 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/BDOT/WFS/Topographic'
      ),
      'capabilities', jsonb_build_array(
        'parcel_search',
        'address_geocoding',
        'administrative_boundaries',
        'spatial_plans',
        'orthophoto'
      ),
      'rateLimit', jsonb_build_object(
        'maxRequests', 100,
        'window', '1min'
      ),
      'cache', jsonb_build_object(
        'enabled', true,
        'ttl', 3600
      )
    ),
    'statistical',
    ARRAY['geoportal', 'działki', 'MPZP', 'mapy', 'nieruchomości', 'granice', 'gminy', 'WMS', 'WFS'],
    'normal',
    'Rzeczpospolita Polska',
    false,
    false,
    true,
    false,
    jsonb_build_object(
      'description', 'Krajowy portal danych przestrzennych - działki, plany zagospodarowania, granice administracyjne',
      'dataTypes', jsonb_build_array(
        'działki ewidencyjne',
        'adresy',
        'granice administracyjne',
        'plany zagospodarowania przestrzennego',
        'ortofotomapy'
      ),
      'provider', 'Główny Urząd Geodezji i Kartografii',
      'officialSource', true,
      'integratedWithOrchestrator', true,
      'orchestratorTool', 'geoportal_spatial',
      'useCases', ARRAY[
        'Wyszukiwanie działek po numerze lub lokalizacji',
        'Sprawdzanie MPZP dla nieruchomości',
        'Weryfikacja granic administracyjnych',
        'Geokodowanie adresów'
      ]
    )
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger dla nowych użytkowników
DROP TRIGGER IF EXISTS add_user_geoportal_source ON auth.users;
CREATE TRIGGER add_user_geoportal_source
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION add_geoportal_source();

-- Dodaj źródło Geoportal dla wszystkich istniejących użytkowników
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
      'Geoportal - Dane Przestrzenne',
      'spatial',
      'https://geoportal.gov.pl',
      'api',
      'weekly',
      true,
      jsonb_build_object(
        'services', jsonb_build_object(
          'ULDK', 'https://uldk.gugik.gov.pl',
          'PRG', 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries',
          'EMUiA', 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/EMUiA/WFS/Addresses',
          'BDOT', 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/BDOT/WFS/Topographic'
        ),
        'capabilities', jsonb_build_array(
          'parcel_search',
          'address_geocoding',
          'administrative_boundaries',
          'spatial_plans',
          'orthophoto'
        ),
        'rateLimit', jsonb_build_object(
          'maxRequests', 100,
          'window', '1min'
        ),
        'cache', jsonb_build_object(
          'enabled', true,
          'ttl', 3600
        )
      ),
      'statistical',
      ARRAY['geoportal', 'działki', 'MPZP', 'mapy', 'nieruchomości', 'granice', 'gminy', 'WMS', 'WFS'],
      'normal',
      'Rzeczpospolita Polska',
      false,
      false,
      true,
      false,
      jsonb_build_object(
        'description', 'Krajowy portal danych przestrzennych - działki, plany zagospodarowania, granice administracyjne',
        'dataTypes', jsonb_build_array(
          'działki ewidencyjne',
          'adresy',
          'granice administracyjne',
          'plany zagospodarowania przestrzennego',
          'ortofotomapy'
        ),
        'provider', 'Główny Urząd Geodezji i Kartografii',
        'officialSource', true,
        'integratedWithOrchestrator', true,
        'orchestratorTool', 'geoportal_spatial',
        'useCases', ARRAY[
          'Wyszukiwanie działek po numerze lub lokalizacji',
          'Sprawdzanie MPZP dla nieruchomości',
          'Weryfikacja granic administracyjnych',
          'Geokodowanie adresów'
        ]
      )
    )
    ON CONFLICT DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Failed to add Geoportal for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Indeks dla szybszego wyszukiwania źródeł Geoportal
CREATE INDEX IF NOT EXISTS idx_data_sources_geoportal 
ON data_sources (user_id) 
WHERE url = 'https://geoportal.gov.pl';

COMMENT ON FUNCTION add_geoportal_source() IS 'Funkcja dodająca źródło Geoportal (dane przestrzenne) dla użytkownika';
