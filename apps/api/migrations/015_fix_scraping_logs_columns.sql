-- Migration: Fix scraping_logs columns
-- Description: Dodanie kolumny items_fetched dla kompatybilności z UnifiedDataService
-- Agent AI "Winsdurf" - naprawa struktury tabeli

-- Dodaj kolumnę items_fetched jako alias dla items_scraped
ALTER TABLE scraping_logs 
ADD COLUMN IF NOT EXISTS items_fetched INTEGER DEFAULT 0;

-- Skopiuj wartości z items_scraped do items_fetched (dla istniejących rekordów)
UPDATE scraping_logs 
SET items_fetched = items_scraped 
WHERE items_fetched IS NULL OR items_fetched = 0;

-- Komentarz
COMMENT ON COLUMN scraping_logs.items_fetched IS 'Liczba pobranych elementów (alias dla items_scraped)';
COMMENT ON COLUMN scraping_logs.items_scraped IS 'Liczba zescrapowanych elementów';
COMMENT ON COLUMN scraping_logs.items_processed IS 'Liczba przetworzonych elementów';
