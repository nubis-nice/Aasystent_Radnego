-- ============================================
-- Migracja: Dodanie schematu grupowania do preferencji dokumentów
-- Data: 2026-01-10
-- Opis: Dodanie kolumny default_grouping_scheme dla różnych schematów wyświetlania
-- ============================================

-- Dodanie kolumny dla schematu grupowania
ALTER TABLE user_document_preferences
ADD COLUMN IF NOT EXISTS default_grouping_scheme VARCHAR(30) DEFAULT 'cascade'
  CHECK (default_grouping_scheme IN ('flat', 'cascade', 'by_type', 'by_date', 'by_reference'));

COMMENT ON COLUMN user_document_preferences.default_grouping_scheme IS 
  'Schemat grupowania dokumentów: flat (płaska lista), cascade (sesje/komisje), by_type (typ dokumentu), by_date (data), by_reference (powiązania)';

-- Aktualizacja istniejących rekordów na domyślny schemat cascade
UPDATE user_document_preferences 
SET default_grouping_scheme = 'cascade' 
WHERE default_grouping_scheme IS NULL;
