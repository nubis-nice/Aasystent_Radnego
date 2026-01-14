-- ============================================
-- Migracja: Rozszerzenie preferencji dokumentów o nowe filtry
-- Data: 2026-01-14
-- Opis: Dodanie kolumn dla pełnej konfiguracji filtrów wyszukiwarki
-- ============================================

-- 1. Usunięcie starego CHECK constraint dla default_sort_by
ALTER TABLE user_document_preferences
DROP CONSTRAINT IF EXISTS user_document_preferences_default_sort_by_check;

-- 2. Dodanie nowego CHECK constraint z nowymi wartościami sortowania
ALTER TABLE user_document_preferences
ADD CONSTRAINT user_document_preferences_default_sort_by_check 
CHECK (default_sort_by IN ('date', 'title', 'number', 'score', 'chronological', 'priority', 'type', 'relevance'));

-- 3. Migracja starych wartości na nowe
UPDATE user_document_preferences 
SET default_sort_by = 'date' 
WHERE default_sort_by = 'chronological';

UPDATE user_document_preferences 
SET default_sort_by = 'score' 
WHERE default_sort_by = 'priority' OR default_sort_by = 'relevance';

UPDATE user_document_preferences 
SET default_sort_by = 'title' 
WHERE default_sort_by = 'type';

-- 4. Dodanie nowych kolumn dla filtrów
ALTER TABLE user_document_preferences
ADD COLUMN IF NOT EXISTS default_document_type VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS default_priority VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS default_date_range VARCHAR(20) DEFAULT NULL;

-- 5. CHECK constraints dla nowych kolumn
ALTER TABLE user_document_preferences
ADD CONSTRAINT user_document_preferences_default_priority_check
CHECK (default_priority IS NULL OR default_priority IN ('critical', 'high', 'medium', 'low'));

ALTER TABLE user_document_preferences
ADD CONSTRAINT user_document_preferences_default_date_range_check
CHECK (default_date_range IS NULL OR default_date_range IN ('week', 'month', 'year'));

-- 6. Komentarze
COMMENT ON COLUMN user_document_preferences.default_document_type IS 
  'Domyślny typ dokumentu do filtrowania, np. resolution, protocol, news';

COMMENT ON COLUMN user_document_preferences.default_priority IS 
  'Domyślny priorytet do filtrowania: critical, high, medium, low';

COMMENT ON COLUMN user_document_preferences.default_date_range IS 
  'Domyślny zakres dat: week, month, year';

-- Koniec migracji
