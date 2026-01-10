-- Migration: Add api_config for API sources
-- Description: Dodanie konfiguracji API dla źródeł typu api_isap
-- Agent AI "Winsdurf" - naprawa scrapingu źródeł API

-- Aktualizuj źródła typu api_isap z konfiguracją API Sejmu
UPDATE data_sources
SET 
  api_config = jsonb_build_object(
    'baseUrl', 'https://api.sejm.gov.pl',
    'endpoint', 'eli/acts',
    'method', 'GET',
    'queryParams', jsonb_build_object(
      'limit', '50',
      'offset', '0'
    ),
    'headers', jsonb_build_object(
      'Accept', 'application/json'
    ),
    'authentication', jsonb_build_object(
      'type', 'none'
    ),
    'responseMapping', jsonb_build_object(
      'dataPath', 'items',
      'titlePath', 'title',
      'contentPath', 'description',
      'urlPath', 'url',
      'datePath', 'publishedDate'
    ),
    'pagination', jsonb_build_object(
      'enabled', true,
      'type', 'offset',
      'limitParam', 'limit',
      'offsetParam', 'offset',
      'pageSize', 50,
      'maxPages', 10
    )
  ),
  fetch_method = 'api'
WHERE type = 'api_isap' AND (api_config IS NULL OR api_config = '{}');

-- Komentarz
COMMENT ON COLUMN data_sources.api_config IS 'Konfiguracja API (baseUrl, endpoint, authentication, responseMapping) w formacie JSONB';
COMMENT ON COLUMN data_sources.fetch_method IS 'Metoda pobierania: api, scraping, hybrid';
