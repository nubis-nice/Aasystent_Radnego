-- Migration: Zmiana wymiarów embeddingów z 1536 na 1024 dla BGE-M3
-- Data: 2026-01-11
-- UWAGA: Ta migracja usuwa wszystkie istniejące embeddingi!

-- ============================================================================
-- KROK 1: Usunięcie danych z tabel RAG (testowe dane)
-- ============================================================================

-- Usuń chunki dokumentów (embeddingi)
TRUNCATE TABLE chunks CASCADE;

-- Usuń przetworzone dokumenty ze źródeł danych
DELETE FROM processed_documents WHERE embedding IS NOT NULL;

-- Usuń dane gminne z embeddingami
DELETE FROM municipal_data WHERE embedding IS NOT NULL;

-- ============================================================================
-- KROK 2: Zmiana wymiaru kolumn embedding z 1536 na 1024
-- ============================================================================

-- Tabela chunks (fragmenty dokumentów)
ALTER TABLE chunks 
ALTER COLUMN embedding TYPE vector(1024);

-- Tabela processed_documents
ALTER TABLE processed_documents 
ALTER COLUMN embedding TYPE vector(1024);

-- Tabela municipal_data
ALTER TABLE municipal_data 
ALTER COLUMN embedding TYPE vector(1024);

-- ============================================================================
-- KROK 3: Przebudowa indeksów wektorowych
-- ============================================================================

-- Usuń stare indeksy (jeśli istnieją)
DROP INDEX IF EXISTS idx_chunks_embedding;
DROP INDEX IF EXISTS idx_processed_documents_embedding;
DROP INDEX IF EXISTS idx_municipal_data_embedding;

-- Utwórz nowe indeksy dla 1024 wymiarów
CREATE INDEX idx_chunks_embedding 
ON chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_processed_documents_embedding 
ON processed_documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_municipal_data_embedding 
ON municipal_data USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================================================
-- KROK 4: Aktualizacja funkcji wyszukiwania semantycznego
-- ============================================================================

-- Funkcja match_documents
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE 
    dc.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR d.user_id = filter_user_id)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Funkcja match_documents_filtered
CREATE OR REPLACE FUNCTION match_documents_filtered(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_user_id uuid DEFAULT NULL,
  filter_categories text[] DEFAULT NULL,
  filter_tags text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE 
    dc.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR d.user_id = filter_user_id)
    AND (filter_categories IS NULL OR d.category = ANY(filter_categories))
    AND (filter_tags IS NULL OR d.tags && filter_tags)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Funkcja hybrid_search
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text text,
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_user_id uuid DEFAULT NULL,
  semantic_weight float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float,
  text_rank float,
  combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity,
    ts_rank(to_tsvector('polish', dc.content), plainto_tsquery('polish', query_text)) as text_rank,
    (semantic_weight * (1 - (dc.embedding <=> query_embedding))) + 
    ((1 - semantic_weight) * ts_rank(to_tsvector('polish', dc.content), plainto_tsquery('polish', query_text))) as combined_score
  FROM chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE 
    dc.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR d.user_id = filter_user_id)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Funkcja search_processed_documents
CREATE OR REPLACE FUNCTION search_processed_documents(
  query_embedding vector(1024),
  match_threshold float,
  match_count int,
  filter_user_id uuid,
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

-- Funkcja search_municipal_data
CREATE OR REPLACE FUNCTION search_municipal_data(
  query_embedding vector(1024),
  match_threshold float,
  match_count int,
  filter_user_id uuid
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

-- Funkcja search_chunks
CREATE OR REPLACE FUNCTION search_chunks(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM chunks dc
  WHERE 
    dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- GOTOWE: Baza przygotowana dla BGE-M3 (1024 wymiary)
-- ============================================================================
