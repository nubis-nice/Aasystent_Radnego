-- ============================================
-- Migracja: Bezpieczna aktualizacja embeddingów do 1024 (BGE-M3)
-- Data: 2026-01-12
-- Uruchom tę migrację KROK PO KROKU w Supabase SQL Editor
-- ============================================

-- KROK 1: Sprawdź jakie tabele istnieją
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('documents', 'chunks', 'processed_documents', 'municipal_data');

-- KROK 2: Sprawdź kolumny w processed_documents
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'processed_documents';
