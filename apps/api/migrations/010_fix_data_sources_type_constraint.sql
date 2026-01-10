-- Migration: Naprawa constraint data_sources_type_check
-- Description: Rozszerzenie dozwolonych wartości typu źródła o nowe typy API i scraper
-- Agent AI "Winsdurf" - fix dla błędu "violates check constraint"

-- Usuń stary constraint
ALTER TABLE data_sources DROP CONSTRAINT IF EXISTS data_sources_type_check;

-- Dodaj nowy constraint z rozszerzoną listą typów
ALTER TABLE data_sources ADD CONSTRAINT data_sources_type_check 
CHECK (type IN (
  -- Oryginalne typy (kompatybilność wsteczna)
  'municipality',
  'bip',
  'legal',
  'councilor',
  'statistics',
  'national_park',
  'hospital',
  'school',
  'cultural',
  'environmental',
  'transport',
  'emergency',
  'custom',
  -- Nowe typy API (Agent Winsdurf)
  'api_isap',
  'api_rcl',
  'api_wsa_nsa',
  'api_rio',
  'api_custom',
  -- Nowe typy scraper (Agent Winsdurf)
  'scraper_bip',
  'scraper_dziennik',
  'scraper_custom'
));

-- Dodaj komentarz do tabeli
COMMENT ON COLUMN data_sources.type IS 'Typ źródła danych - legacy types (municipality, bip, legal, etc.) lub nowe typy API/scraper (api_isap, scraper_bip, etc.)';
