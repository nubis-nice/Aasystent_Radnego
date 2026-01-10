-- Migration: Fix all data sources configurations
-- Description: Dodanie konfiguracji dla WSZYSTKICH źródeł danych (nie tylko wybranych typów)
-- Agent AI "Winsdurf" - naprawa nieaktywnych źródeł

-- Krok 1: Ustaw fetch_method dla wszystkich źródeł
UPDATE data_sources
SET fetch_method = CASE 
  WHEN type = 'api_isap' THEN 'api'
  ELSE 'scraping'
END
WHERE fetch_method IS NULL;

-- Krok 2: Dodaj scraping_config dla źródeł bez konfiguracji (wszystkie typy)
UPDATE data_sources
SET scraping_config = jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, h2, .title, .heading, .post-title, .article-title',
    'content', 'article, .content, .main, main, .post-content, .article-content, .entry-content',
    'date', 'time, .date, .publish-date, .post-date, .entry-date',
    'author', '.author, .post-author, .entry-author',
    'category', '.category, .post-category, .tags'
  ),
  'pagination', jsonb_build_object(
    'enabled', true,
    'selector', '.pagination a, .next-page, a[rel="next"], .page-numbers',
    'maxPages', 10
  ),
  'waitForSelector', '.content, article, main, .post-content',
  'timeout', 30000,
  'userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
)
WHERE fetch_method = 'scraping' 
  AND (scraping_config IS NULL OR scraping_config = '{}');

-- Krok 3: Aktywuj scraping dla wszystkich źródeł
UPDATE data_sources
SET scraping_enabled = true
WHERE scraping_enabled = false OR scraping_enabled IS NULL;

-- Krok 4: Ustaw domyślną częstotliwość scrapingu
UPDATE data_sources
SET scraping_frequency = 'daily'
WHERE scraping_frequency IS NULL;

-- Krok 5: Dodaj specjalizowane konfiguracje dla różnych typów źródeł

-- BIP (Biuletyn Informacji Publicznej)
UPDATE data_sources
SET scraping_config = scraping_config || jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1.title, .document-title, .bip-title',
    'content', '.document-content, .bip-content, article',
    'date', '.document-date, .bip-date, time',
    'documentNumber', '.document-number, .bip-number'
  )
)
WHERE type IN ('bip', 'scraper_bip')
  AND fetch_method = 'scraping';

-- Gminy (Municipality)
UPDATE data_sources
SET scraping_config = scraping_config || jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .news-title, .announcement-title',
    'content', '.news-content, .announcement-content, article',
    'date', '.news-date, .announcement-date, time',
    'category', '.news-category, .announcement-category'
  )
)
WHERE type = 'municipality'
  AND fetch_method = 'scraping';

-- Radni (Councilor)
UPDATE data_sources
SET scraping_config = scraping_config || jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .councilor-name, .profile-name',
    'content', '.councilor-bio, .profile-content, article',
    'contact', '.councilor-contact, .contact-info',
    'committee', '.councilor-committee, .committees'
  )
)
WHERE type = 'councilor'
  AND fetch_method = 'scraping';

-- Statystyki (Statistics)
UPDATE data_sources
SET scraping_config = scraping_config || jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .stat-title, .data-title',
    'content', '.stat-content, .data-content, table, .statistics',
    'date', '.stat-date, .data-date, time',
    'source', '.stat-source, .data-source'
  )
)
WHERE type = 'statistics'
  AND fetch_method = 'scraping';

-- Akty prawne (Legal)
UPDATE data_sources
SET scraping_config = scraping_config || jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .act-title, .legal-title',
    'content', '.act-content, .legal-content, article',
    'date', '.act-date, .legal-date, time',
    'documentNumber', '.act-number, .legal-number',
    'status', '.act-status, .legal-status'
  )
)
WHERE type = 'legal'
  AND fetch_method = 'scraping';

-- Parki narodowe (National Park)
UPDATE data_sources
SET scraping_config = scraping_config || jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .park-title, .news-title',
    'content', '.park-content, .news-content, article',
    'date', '.park-date, .news-date, time',
    'category', '.park-category, .news-category'
  )
)
WHERE type = 'national_park'
  AND fetch_method = 'scraping';

-- Szpitale (Hospital)
UPDATE data_sources
SET scraping_config = scraping_config || jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .hospital-title, .news-title',
    'content', '.hospital-content, .news-content, article',
    'date', '.hospital-date, .news-date, time',
    'department', '.hospital-department, .department'
  )
)
WHERE type = 'hospital'
  AND fetch_method = 'scraping';

-- Szkoły (School)
UPDATE data_sources
SET scraping_config = scraping_config || jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .school-title, .news-title',
    'content', '.school-content, .news-content, article',
    'date', '.school-date, .news-date, time',
    'category', '.school-category, .news-category'
  )
)
WHERE type = 'school'
  AND fetch_method = 'scraping';

-- Kultura (Cultural)
UPDATE data_sources
SET scraping_config = scraping_config || jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .event-title, .cultural-title',
    'content', '.event-content, .cultural-content, article',
    'date', '.event-date, .cultural-date, time',
    'location', '.event-location, .cultural-location'
  )
)
WHERE type = 'cultural'
  AND fetch_method = 'scraping';

-- Środowisko (Environmental)
UPDATE data_sources
SET scraping_config = scraping_config || jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .env-title, .news-title',
    'content', '.env-content, .news-content, article',
    'date', '.env-date, .news-date, time',
    'category', '.env-category, .news-category'
  )
)
WHERE type = 'environmental'
  AND fetch_method = 'scraping';

-- Transport (Transport)
UPDATE data_sources
SET scraping_config = scraping_config || jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .transport-title, .news-title',
    'content', '.transport-content, .news-content, article',
    'date', '.transport-date, .news-date, time',
    'route', '.transport-route, .route'
  )
)
WHERE type = 'transport'
  AND fetch_method = 'scraping';

-- Służby ratunkowe (Emergency)
UPDATE data_sources
SET scraping_config = scraping_config || jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, .emergency-title, .alert-title',
    'content', '.emergency-content, .alert-content, article',
    'date', '.emergency-date, .alert-date, time',
    'severity', '.emergency-severity, .alert-level'
  )
)
WHERE type = 'emergency'
  AND fetch_method = 'scraping';

-- Niestandardowe (Custom)
UPDATE data_sources
SET scraping_config = scraping_config || jsonb_build_object(
  'selectors', jsonb_build_object(
    'title', 'h1, h2, .title, .heading',
    'content', 'article, .content, .main, main',
    'date', 'time, .date, .publish-date'
  )
)
WHERE type = 'custom'
  AND fetch_method = 'scraping';

-- Komentarze
COMMENT ON COLUMN data_sources.fetch_method IS 'Metoda pobierania: api, scraping, hybrid';
COMMENT ON COLUMN data_sources.scraping_config IS 'Konfiguracja scrapingu (selektory CSS, paginacja) w formacie JSONB';
COMMENT ON COLUMN data_sources.scraping_enabled IS 'Czy scraping jest włączony dla tego źródła';
COMMENT ON COLUMN data_sources.scraping_frequency IS 'Częstotliwość scrapingu: hourly, daily, weekly, monthly, manual';
