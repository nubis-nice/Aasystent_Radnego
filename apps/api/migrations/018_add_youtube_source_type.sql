-- Migration: Dodanie typu youtube do data_sources
-- Description: Rozszerzenie constraint o typ youtube dla transkrypcji wideo
-- Date: 2026-01-10

-- Usuń stary constraint
ALTER TABLE data_sources DROP CONSTRAINT IF EXISTS data_sources_type_check;

-- Dodaj nowy constraint z typem youtube
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
  'scraper_custom',
  -- Multimedia (2026-01-10)
  'youtube'
));

COMMENT ON COLUMN data_sources.type IS 'Typ źródła danych - legacy types, API/scraper types, oraz multimedia (youtube)';
