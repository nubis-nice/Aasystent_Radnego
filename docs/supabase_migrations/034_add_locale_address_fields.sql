-- Migration: Dodanie pól adresowych do user_locale_settings
-- Description: Dodanie kolumn postal_code i county dla pełnych danych adresowych gminy
-- Date: 2026-01-16

-- Dodaj nowe kolumny do tabeli user_locale_settings
ALTER TABLE user_locale_settings 
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS county TEXT;

-- Dodaj komentarze
COMMENT ON COLUMN user_locale_settings.postal_code IS 'Kod pocztowy gminy/miasta (np. 73-220)';
COMMENT ON COLUMN user_locale_settings.county IS 'Powiat (np. choszczeński)';
