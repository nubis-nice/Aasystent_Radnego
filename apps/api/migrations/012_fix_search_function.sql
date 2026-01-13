-- ============================================================================
-- MIGRACJA 012: Naprawa funkcji search_processed_documents
-- Problem: Funkcja nie zwracała document_type, publish_date, summary
-- ============================================================================

-- Usuń stare wersje funkcji
DROP FUNCTION IF EXISTS search_processed_documents(vector, float, int, uuid, text);
DROP FUNCTION IF EXISTS search_processed_documents(vector, double precision, integer, uuid, text);
DROP FUNCTION IF EXISTS search_processed_documents(vector, float, int, uuid, text[]);
DROP FUNCTION IF EXISTS search_processed_documents(vector, double precision, integer, uuid);

-- Nowa funkcja z wszystkimi potrzebnymi kolumnami
CREATE OR REPLACE FUNCTION search_processed_documents(
  query_embedding vector(1024),
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

-- Napraw też search_municipal_data
DROP FUNCTION IF EXISTS search_municipal_data(vector, float, int, uuid);
DROP FUNCTION IF EXISTS search_municipal_data(vector, double precision, integer, uuid);

CREATE OR REPLACE FUNCTION search_municipal_data(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 20,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  data_type text,
  source_url text,
  publish_date timestamptz,
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
    md.publish_date,
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
-- GOTOWE: Funkcje naprawione
-- ============================================================================
