-- ============================================================================
-- Migracja: Zmiana wymiarowości embeddingów z 1024 na 768
-- Model: nomic-embed-text (Ollama) generuje 768 wymiarów
-- ============================================================================

-- 1. Wyczyść istniejące embeddingi (niezgodne wymiary)
UPDATE processed_documents SET embedding = NULL;
UPDATE municipal_data SET embedding = NULL;

-- 2. Zmień wymiar kolumn embedding na 768
ALTER TABLE processed_documents ALTER COLUMN embedding TYPE vector(768);
ALTER TABLE municipal_data ALTER COLUMN embedding TYPE vector(768);

-- 3. Przebuduj indeksy
DROP INDEX IF EXISTS idx_processed_documents_embedding;
DROP INDEX IF EXISTS idx_municipal_data_embedding;

CREATE INDEX idx_processed_documents_embedding 
ON processed_documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_municipal_data_embedding 
ON municipal_data USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 4. Zaktualizuj funkcje wyszukiwania

-- search_processed_documents
DROP FUNCTION IF EXISTS search_processed_documents(vector, float, int, uuid, text[]);

CREATE OR REPLACE FUNCTION search_processed_documents(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 20,
  filter_user_id uuid DEFAULT NULL,
  filter_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_type text,
  title text,
  content text,
  summary text,
  source_url text,
  publish_date timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.id,
    pd.document_type,
    pd.title,
    pd.content,
    pd.summary,
    pd.source_url,
    pd.publish_date,
    1 - (pd.embedding <=> query_embedding) as similarity
  FROM processed_documents pd
  WHERE
    pd.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR pd.user_id = filter_user_id)
    AND (filter_types IS NULL OR pd.document_type = ANY(filter_types))
    AND 1 - (pd.embedding <=> query_embedding) > match_threshold
  ORDER BY pd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- search_municipal_data
DROP FUNCTION IF EXISTS search_municipal_data(vector, float, int, uuid);

CREATE OR REPLACE FUNCTION search_municipal_data(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 20,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  data_type text,
  title text,
  content text,
  source_url text,
  meeting_date timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    md.id,
    md.data_type,
    md.title,
    md.content,
    md.source_url,
    md.meeting_date,
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

-- match_documents
DROP FUNCTION IF EXISTS match_documents(vector, float, int, uuid);

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
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
    1 - (pd.embedding <=> query_embedding) as similarity
  FROM processed_documents pd
  WHERE
    pd.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR pd.user_id = filter_user_id)
    AND 1 - (pd.embedding <=> query_embedding) > match_threshold
  ORDER BY pd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- UWAGA: Po wykonaniu migracji należy przeindeksować dokumenty!
-- Uruchom: npx tsx scripts/reindex.ts
-- ============================================================================
