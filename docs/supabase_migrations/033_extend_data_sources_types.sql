-- Migration: Rozszerzenie typów źródeł danych
-- Description: Dodanie typów spatial i funding do constraint data_sources_type_check
-- Date: 2026-01-16

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
  -- Typy API (Agent Winsdurf)
  'api_isap',
  'api_rcl',
  'api_wsa_nsa',
  'api_rio',
  'api_custom',
  -- Typy scraper (Agent Winsdurf)
  'scraper_bip',
  'scraper_dziennik',
  'scraper_custom',
  -- Multimedia
  'youtube',
  -- Nowe typy 2026-01-16
  'spatial',   -- Geoportal, dane przestrzenne
  'funding'    -- Fundusze UE, dotacje
));

COMMENT ON COLUMN data_sources.type IS 'Typ źródła danych - legacy types, API/scraper types, multimedia (youtube), spatial (geoportal), funding (EU funds)';
