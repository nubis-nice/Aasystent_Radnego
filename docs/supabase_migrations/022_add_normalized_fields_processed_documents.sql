-- ============================================================================
-- Migration: Add normalized fields to processed_documents
-- Purpose: Enable intelligent search with normalized session numbers and dates
-- Date: 2026-01-14
-- ============================================================================

-- ============================================================================
-- STEP 1: Add new columns for normalized data
-- ============================================================================

-- Numer sesji jako liczba (nie tekst) - ułatwia filtrowanie i sortowanie
ALTER TABLE processed_documents 
ADD COLUMN IF NOT EXISTS session_number INTEGER;

-- Znormalizowany tytuł (np. "Sesja 23" zamiast "Sesja Nr XXIII | Urząd...")
ALTER TABLE processed_documents 
ADD COLUMN IF NOT EXISTS normalized_title VARCHAR(500);

-- Data publikacji/sesji wyodrębniona z treści (nie data scrapingu)
ALTER TABLE processed_documents 
ADD COLUMN IF NOT EXISTS normalized_publish_date DATE;

-- Numer dokumentu (np. "XV/123/24" dla uchwał)
ALTER TABLE processed_documents 
ADD COLUMN IF NOT EXISTS document_number VARCHAR(100);

-- Typ sesji: ordinary, extraordinary, budget, constituent
ALTER TABLE processed_documents 
ADD COLUMN IF NOT EXISTS session_type VARCHAR(50);

-- Confidence score normalizacji (0-100)
ALTER TABLE processed_documents 
ADD COLUMN IF NOT EXISTS normalization_confidence INTEGER DEFAULT 0;

-- Czy dokument został znormalizowany przez LLM
ALTER TABLE processed_documents 
ADD COLUMN IF NOT EXISTS is_normalized BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- STEP 2: Create indexes for fast searching
-- ============================================================================

-- Index dla wyszukiwania po numerze sesji
CREATE INDEX IF NOT EXISTS idx_processed_docs_session_number 
ON processed_documents (user_id, session_number) 
WHERE session_number IS NOT NULL;

-- Index dla wyszukiwania po dacie publikacji
CREATE INDEX IF NOT EXISTS idx_processed_docs_normalized_date 
ON processed_documents (user_id, normalized_publish_date DESC NULLS LAST);

-- Index dla wyszukiwania po znormalizowanym tytule
CREATE INDEX IF NOT EXISTS idx_processed_docs_normalized_title 
ON processed_documents (user_id, lower(normalized_title)) 
WHERE normalized_title IS NOT NULL;

-- Index kompozytowy dla typowych zapytań (typ + data + sesja)
CREATE INDEX IF NOT EXISTS idx_processed_docs_search_combo 
ON processed_documents (user_id, document_type, normalized_publish_date DESC NULLS LAST, session_number);

-- ============================================================================
-- STEP 3: Create function to extract session number from title
-- ============================================================================

CREATE OR REPLACE FUNCTION extract_session_number(title TEXT)
RETURNS INTEGER AS $$
DECLARE
  match_result TEXT;
  roman_num TEXT;
  arabic_num INTEGER;
BEGIN
  -- Próbuj znaleźć numer arabski: "sesja 23", "sesji 23", "Sesja Nr 23"
  match_result := substring(title FROM '(?i)sesj[iaęy]\s+(?:nr\.?\s*)?(\d{1,3})');
  IF match_result IS NOT NULL THEN
    arabic_num := match_result::INTEGER;
    IF arabic_num > 0 AND arabic_num <= 200 THEN
      RETURN arabic_num;
    END IF;
  END IF;
  
  -- Próbuj znaleźć numer rzymski: "Sesja XXIII", "Nr XXIII", "XXIII sesja"
  match_result := substring(title FROM '(?i)(?:sesj[iaęy]\s+(?:nr\.?\s*)?|nr\.?\s*)([IVXLC]{1,10})');
  IF match_result IS NOT NULL THEN
    roman_num := upper(match_result);
    -- Konwersja rzymskich na arabskie
    arabic_num := 0;
    -- Prosta konwersja dla typowych numerów sesji (1-100)
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'C', ''))) * 100;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'XC', ''))) / 2 * 90;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'L', ''))) * 50;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'XL', ''))) / 2 * 40;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'X', ''))) * 10;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'IX', ''))) / 2 * 9;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'V', ''))) * 5;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'IV', ''))) / 2 * 4;
    arabic_num := arabic_num + (length(roman_num) - length(replace(roman_num, 'I', '')));
    
    IF arabic_num > 0 AND arabic_num <= 200 THEN
      RETURN arabic_num;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- STEP 4: Create function to normalize title
-- ============================================================================

CREATE OR REPLACE FUNCTION normalize_document_title(title TEXT, session_num INTEGER)
RETURNS TEXT AS $$
DECLARE
  normalized TEXT;
BEGIN
  -- Usuń sufiks " | Urząd Miejski..." i podobne
  normalized := regexp_replace(title, '\s*\|.*$', '', 'i');
  
  -- Usuń "System Rada" i podobne
  normalized := regexp_replace(normalized, '\s*-?\s*System\s+Rada.*$', '', 'i');
  
  -- Jeśli mamy numer sesji, zunifikuj format
  IF session_num IS NOT NULL THEN
    -- Zamień różne formaty na "Sesja X"
    normalized := regexp_replace(normalized, '(?i)sesj[iaęy]\s+(?:nr\.?\s*)?[IVXLC0-9]+', 'Sesja ' || session_num::TEXT, 'g');
  END IF;
  
  -- Trim i normalizacja spacji
  normalized := trim(regexp_replace(normalized, '\s+', ' ', 'g'));
  
  RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- STEP 5: Backfill existing documents with extracted session numbers
-- ============================================================================

-- Wyodrębnij numer sesji z istniejących dokumentów
UPDATE processed_documents 
SET session_number = extract_session_number(title)
WHERE session_number IS NULL 
  AND title IS NOT NULL;

-- Ustaw znormalizowany tytuł
UPDATE processed_documents 
SET normalized_title = normalize_document_title(title, session_number)
WHERE normalized_title IS NULL 
  AND title IS NOT NULL;

-- Skopiuj publish_date do normalized_publish_date jeśli istnieje
UPDATE processed_documents 
SET normalized_publish_date = publish_date::DATE
WHERE normalized_publish_date IS NULL 
  AND publish_date IS NOT NULL;

-- Oznacz jako częściowo znormalizowane (przez SQL, nie LLM)
UPDATE processed_documents 
SET is_normalized = TRUE,
    normalization_confidence = 60  -- Średnia pewność dla auto-ekstrakcji
WHERE session_number IS NOT NULL 
   OR normalized_title IS NOT NULL;

-- ============================================================================
-- STEP 6: Verification
-- ============================================================================

DO $$
DECLARE
  total_docs INTEGER;
  docs_with_session INTEGER;
  docs_with_normalized_title INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_docs FROM processed_documents;
  SELECT COUNT(*) INTO docs_with_session FROM processed_documents WHERE session_number IS NOT NULL;
  SELECT COUNT(*) INTO docs_with_normalized_title FROM processed_documents WHERE normalized_title IS NOT NULL;
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  Total documents: %', total_docs;
  RAISE NOTICE '  Documents with session_number: %', docs_with_session;
  RAISE NOTICE '  Documents with normalized_title: %', docs_with_normalized_title;
END $$;
