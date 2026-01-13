-- ============================================================================
-- MIGRACJA 013: Optymalizacja bazy RAG
-- Cel: Czyszczenie i optymalizacja embeddingów
-- ============================================================================

-- KROK 1: Usuń dokumenty bez treści (błędy OCR)
DELETE FROM processed_documents 
WHERE content IS NULL OR length(content) < 50;

-- KROK 2: Usuń duplikaty (zachowaj najnowszy)
DELETE FROM processed_documents a
USING processed_documents b
WHERE a.id < b.id 
  AND a.title = b.title 
  AND a.user_id = b.user_id
  AND a.document_type = b.document_type;

-- KROK 3: Wyczyść wszystkie embeddingi (do regeneracji)
UPDATE processed_documents SET embedding = NULL;
UPDATE municipal_data SET embedding = NULL;

-- KROK 4: Dodaj indeksy dla szybszego wyszukiwania
CREATE INDEX IF NOT EXISTS idx_processed_docs_user_type 
  ON processed_documents(user_id, document_type);

CREATE INDEX IF NOT EXISTS idx_processed_docs_title_search 
  ON processed_documents USING gin(to_tsvector('simple', coalesce(title, '')));

CREATE INDEX IF NOT EXISTS idx_processed_docs_content_search 
  ON processed_documents USING gin(to_tsvector('simple', coalesce(content, '')));

-- KROK 5: Indeks dla embeddingów (IVFFlat - szybsze wyszukiwanie)
-- Wymaga minimum 100 dokumentów z embeddingami
-- DROP INDEX IF EXISTS idx_processed_docs_embedding;
-- CREATE INDEX idx_processed_docs_embedding 
--   ON processed_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- KROK 6: Vacuum dla odzyskania miejsca
-- UWAGA: VACUUM musi być uruchomiony POZA transakcją (osobno w SQL Editor)
-- VACUUM ANALYZE processed_documents;
-- VACUUM ANALYZE municipal_data;

-- ============================================================================
-- STATYSTYKI PO OPTYMALIZACJI
-- ============================================================================
SELECT 
  'processed_documents' as table_name,
  COUNT(*) as total_rows,
  COUNT(embedding) as with_embedding,
  COUNT(*) - COUNT(embedding) as without_embedding,
  pg_size_pretty(pg_total_relation_size('processed_documents')) as table_size
FROM processed_documents
UNION ALL
SELECT 
  'municipal_data',
  COUNT(*),
  COUNT(embedding),
  COUNT(*) - COUNT(embedding),
  pg_size_pretty(pg_total_relation_size('municipal_data'))
FROM municipal_data;
