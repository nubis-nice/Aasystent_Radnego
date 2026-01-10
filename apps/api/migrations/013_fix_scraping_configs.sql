-- Migration: Naprawa konfiguracji scrapingu dla istniejących źródeł
-- Description: Dodanie domyślnych scraping_config dla źródeł bez konfiguracji
-- Agent AI "Winsdurf" - fix dla statusu "invalid"

-- Aktualizuj źródła typu api_isap
UPDATE data_sources
SET scraping_config = jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .title',
    'content', 'article, .content, main',
    'date', 'time, .date, .published'
  ),
  'pagination', jsonb_build_object(
    'enabled', true,
    'selector', '.pagination a, .next',
    'maxPages', 10
  ),
  'waitForSelector', 'body',
  'timeout', 30000
)
WHERE type = 'api_isap' AND (scraping_config IS NULL OR scraping_config = '{}');

-- Aktualizuj źródła typu municipality
UPDATE data_sources
SET scraping_config = jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .title, .post-title',
    'content', 'article, .content, .post-content, main',
    'date', 'time, .date, .published, .post-date'
  ),
  'pagination', jsonb_build_object(
    'enabled', true,
    'selector', '.pagination a, .next, a[rel="next"]',
    'maxPages', 5
  ),
  'waitForSelector', 'body',
  'timeout', 30000
)
WHERE type = 'municipality' AND (scraping_config IS NULL OR scraping_config = '{}');

-- Aktualizuj źródła typu scraper_bip
UPDATE data_sources
SET scraping_config = jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .title, .document-title',
    'content', 'article, .content, .document-content, main',
    'date', 'time, .date, .published'
  ),
  'pagination', jsonb_build_object(
    'enabled', true,
    'selector', '.pagination a, .next',
    'maxPages', 10
  ),
  'waitForSelector', 'body',
  'timeout', 30000
)
WHERE type = 'scraper_bip' AND (scraping_config IS NULL OR scraping_config = '{}');

-- Aktualizuj źródła typu councilor
UPDATE data_sources
SET scraping_config = jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .title, .post-title',
    'content', 'article, .content, .post-content',
    'date', 'time, .date, .published'
  ),
  'pagination', jsonb_build_object(
    'enabled', false
  ),
  'waitForSelector', 'body',
  'timeout', 30000
)
WHERE type = 'councilor' AND (scraping_config IS NULL OR scraping_config = '{}');

-- Aktualizuj źródła typu statistics
UPDATE data_sources
SET scraping_config = jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .title, .stat-title',
    'content', 'table, .data, .statistics, main',
    'date', 'time, .date, .updated'
  ),
  'pagination', jsonb_build_object(
    'enabled', false
  ),
  'waitForSelector', 'body',
  'timeout', 30000
)
WHERE type = 'statistics' AND (scraping_config IS NULL OR scraping_config = '{}');

-- Aktualizuj źródła typu legal
UPDATE data_sources
SET scraping_config = jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .title, .act-title',
    'content', 'article, .content, .act-content, main',
    'date', 'time, .date, .published, .effective-date'
  ),
  'pagination', jsonb_build_object(
    'enabled', true,
    'selector', '.pagination a, .next',
    'maxPages', 20
  ),
  'waitForSelector', 'body',
  'timeout', 30000
)
WHERE type = 'legal' AND (scraping_config IS NULL OR scraping_config = '{}');

-- Ustaw fetch_method na 'scraping' dla źródeł bez tej wartości
UPDATE data_sources
SET fetch_method = 'scraping'
WHERE fetch_method IS NULL;

-- Aktywuj scraping dla wszystkich źródeł
UPDATE data_sources
SET scraping_enabled = true
WHERE scraping_enabled IS NULL;

-- Komentarz
COMMENT ON COLUMN data_sources.scraping_config IS 'Konfiguracja scrapingu (selektory CSS, paginacja, timeout) w formacie JSONB';
