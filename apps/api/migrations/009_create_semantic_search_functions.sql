-- Migration: Funkcje RPC dla semantic search
-- Description: Funkcje do wyszukiwania semantycznego z pgvector
-- Agent AI "Winsdurf" - Legal Search API

-- Funkcja do wyszukiwania dokumentów przez similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  document_type text,
  publish_date date,
  source_url text,
  keywords text[],
  metadata jsonb,
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
    pd.document_type,
    pd.publish_date,
    pd.source_url,
    pd.keywords,
    pd.metadata,
    1 - (pd.embedding <=> query_embedding) AS similarity
  FROM processed_documents pd
  WHERE 
    pd.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR pd.user_id = filter_user_id)
    AND 1 - (pd.embedding <=> query_embedding) > match_threshold
  ORDER BY pd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Funkcja do wyszukiwania z filtrami
CREATE OR REPLACE FUNCTION match_documents_filtered(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_user_id uuid DEFAULT NULL,
  filter_document_types text[] DEFAULT NULL,
  filter_date_from date DEFAULT NULL,
  filter_date_to date DEFAULT NULL,
  filter_keywords text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  document_type text,
  publish_date date,
  source_url text,
  keywords text[],
  metadata jsonb,
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
    pd.document_type,
    pd.publish_date,
    pd.source_url,
    pd.keywords,
    pd.metadata,
    1 - (pd.embedding <=> query_embedding) AS similarity
  FROM processed_documents pd
  WHERE 
    pd.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR pd.user_id = filter_user_id)
    AND (filter_document_types IS NULL OR pd.document_type = ANY(filter_document_types))
    AND (filter_date_from IS NULL OR pd.publish_date >= filter_date_from)
    AND (filter_date_to IS NULL OR pd.publish_date <= filter_date_to)
    AND (filter_keywords IS NULL OR pd.keywords && filter_keywords)
    AND 1 - (pd.embedding <=> query_embedding) > match_threshold
  ORDER BY pd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Funkcja do hybrid search (semantic + fulltext)
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_user_id uuid DEFAULT NULL,
  semantic_weight float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  document_type text,
  publish_date date,
  source_url text,
  keywords text[],
  metadata jsonb,
  similarity float,
  text_rank float,
  combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_results AS (
    SELECT
      pd.id,
      pd.title,
      pd.content,
      pd.document_type,
      pd.publish_date,
      pd.source_url,
      pd.keywords,
      pd.metadata,
      1 - (pd.embedding <=> query_embedding) AS similarity
    FROM processed_documents pd
    WHERE 
      pd.embedding IS NOT NULL
      AND (filter_user_id IS NULL OR pd.user_id = filter_user_id)
      AND 1 - (pd.embedding <=> query_embedding) > match_threshold
  ),
  fulltext_results AS (
    SELECT
      pd.id,
      ts_rank(
        to_tsvector('simple', COALESCE(pd.title, '') || ' ' || COALESCE(pd.content, '')),
        plainto_tsquery('simple', query_text)
      ) AS text_rank
    FROM processed_documents pd
    WHERE 
      (filter_user_id IS NULL OR pd.user_id = filter_user_id)
      AND (
        to_tsvector('simple', COALESCE(pd.title, '') || ' ' || COALESCE(pd.content, ''))
        @@ plainto_tsquery('simple', query_text)
      )
  )
  SELECT
    sr.id,
    sr.title,
    sr.content,
    sr.document_type,
    sr.publish_date,
    sr.source_url,
    sr.keywords,
    sr.metadata,
    sr.similarity,
    COALESCE(fr.text_rank, 0) AS text_rank,
    (sr.similarity * semantic_weight + COALESCE(fr.text_rank, 0) * (1 - semantic_weight)) AS combined_score
  FROM semantic_results sr
  LEFT JOIN fulltext_results fr ON sr.id = fr.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Indeks dla full-text search (jeśli nie istnieje)
CREATE INDEX IF NOT EXISTS idx_processed_documents_fts 
ON processed_documents 
USING GIN (to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content, '')));

-- Komentarze
COMMENT ON FUNCTION match_documents IS 'Wyszukiwanie semantyczne dokumentów przez vector similarity';
COMMENT ON FUNCTION match_documents_filtered IS 'Wyszukiwanie semantyczne z filtrami (typy dokumentów, daty, słowa kluczowe)';
COMMENT ON FUNCTION hybrid_search IS 'Hybrydowe wyszukiwanie łączące semantic search i full-text search';
