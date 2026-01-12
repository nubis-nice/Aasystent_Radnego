-- ============================================
-- Migracja: Aktualizacja embeddingów do 1024 (BGE-M3)
-- Data: 2026-01-12
-- Tabele: municipal_data, processed_documents
-- ============================================

-- Włącz rozszerzenie pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. Wyczyść stare embeddingi (niekompatybilne wymiary)
-- ============================================================================

UPDATE processed_documents SET embedding = NULL;
UPDATE municipal_data SET embedding = NULL;

-- ============================================================================
-- 2. Zmień wymiar kolumn embedding na 1024
-- ============================================================================

ALTER TABLE processed_documents ALTER COLUMN embedding TYPE vector(1024);
ALTER TABLE municipal_data ALTER COLUMN embedding TYPE vector(1024);

-- ============================================================================
-- 3. Przebuduj indeksy
-- ============================================================================

DROP INDEX IF EXISTS idx_processed_documents_embedding;
DROP INDEX IF EXISTS idx_municipal_data_embedding;

CREATE INDEX idx_processed_documents_embedding 
ON processed_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_municipal_data_embedding 
ON municipal_data USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- 4. Funkcje wyszukiwania (1024 wymiary)
-- ============================================================================

-- Usuń stare funkcje
DROP FUNCTION IF EXISTS search_processed_documents(vector, float, int, uuid, text);
DROP FUNCTION IF EXISTS search_processed_documents(vector, double precision, integer, uuid, text);
DROP FUNCTION IF EXISTS search_municipal_data(vector, float, int, uuid);
DROP FUNCTION IF EXISTS search_municipal_data(vector, double precision, integer, uuid);

CREATE OR REPLACE FUNCTION search_processed_documents(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_user_id uuid DEFAULT NULL,
  filter_source_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  source_type text,
  source_url text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.id,
    pd.title,
    pd.content,
    pd.source_type,
    pd.source_url,
    1 - (pd.embedding <=> query_embedding) as similarity
  FROM processed_documents pd
  WHERE 
    pd.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR pd.user_id = filter_user_id)
    AND (filter_source_type IS NULL OR pd.source_type = filter_source_type)
    AND 1 - (pd.embedding <=> query_embedding) > match_threshold
  ORDER BY pd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION search_municipal_data(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  data_type text,
  source_url text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    md.id,
    md.title,
    md.content,
    md.data_type,
    md.source_url,
    1 - (md.embedding <=> query_embedding) as similarity
  FROM municipal_data md
  WHERE 
    md.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR md.user_id = filter_user_id)
    AND 1 - (md.embedding <=> query_embedding) > match_threshold
  ORDER BY md.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- GOTOWE: Embeddingi zaktualizowane do 1024 wymiarów (BGE-M3)
-- ============================================================================
