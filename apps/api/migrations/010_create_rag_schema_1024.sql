-- ============================================
-- Migracja: Schemat RAG z embeddingami 1024 (BGE-M3)
-- Data: 2026-01-12
-- Opis: Aktualizuje istniejące tabele i tworzy brakujące
-- ============================================

-- Włącz rozszerzenie pgvector dla embeddingów
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- KROK 0: Dodaj brakujące kolumny do istniejących tabel
-- ============================================================================

-- Dodaj source_type do processed_documents jeśli nie istnieje
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'processed_documents' AND column_name = 'source_type') THEN
    ALTER TABLE processed_documents ADD COLUMN source_type TEXT DEFAULT 'unknown';
  END IF;
END $$;

-- Zmień wymiar embedding w processed_documents na 1024 (jeśli tabela istnieje)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'processed_documents') THEN
    -- Usuń stare dane z embeddingami (niekompatybilne wymiary)
    UPDATE processed_documents SET embedding = NULL;
    -- Zmień typ kolumny
    ALTER TABLE processed_documents ALTER COLUMN embedding TYPE vector(1024);
  END IF;
END $$;

-- Zmień wymiar embedding w municipal_data na 1024 (jeśli tabela istnieje)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'municipal_data') THEN
    UPDATE municipal_data SET embedding = NULL;
    ALTER TABLE municipal_data ALTER COLUMN embedding TYPE vector(1024);
  END IF;
END $$;

-- ============================================================================
-- 1. TABELA DOCUMENTS (główne dokumenty)
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_hash VARCHAR(64) NOT NULL,
  source_url TEXT,
  filename VARCHAR(500) NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Metadane dokumentu
  title TEXT,
  document_number VARCHAR(100),
  document_date DATE,
  author VARCHAR(255),
  department VARCHAR(255),
  document_type VARCHAR(100),
  category VARCHAR(100),
  tags TEXT[],
  
  -- Ekstrakcja
  extracted_text TEXT,
  extraction_quality_score DECIMAL(3,2),
  extraction_method VARCHAR(50),
  
  -- Timestampy
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  UNIQUE(user_id, file_hash)
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(document_date);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);

-- ============================================================================
-- 2. TABELA CHUNKS (fragmenty dokumentów dla RAG) - 1024 wymiary
-- ============================================================================

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  
  -- Embedding dla wyszukiwania semantycznego - BGE-M3 (1024 wymiary)
  embedding vector(1024),
  
  -- Metadane chunku
  page_number INTEGER,
  section_title TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- 3. TABELA ANALYSES (analizy dokumentów)
-- ============================================================================

CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('summary', 'key_points', 'risk_scan', 'legal_check')),
  
  -- Wyniki analizy
  result JSONB NOT NULL,
  confidence_score DECIMAL(3,2),
  
  -- Metadane
  model_used VARCHAR(100),
  processing_time_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyses_document ON analyses(document_id);
CREATE INDEX IF NOT EXISTS idx_analyses_type ON analyses(analysis_type);

-- ============================================================================
-- 4. TABELA PROCESSING_JOBS (śledzenie zadań)
-- ============================================================================

CREATE TABLE IF NOT EXISTS processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('extraction', 'analysis', 'embedding', 'relation_detection')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  
  -- Szczegóły
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Timestampy
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_document ON processing_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status);

-- ============================================================================
-- 5. TABELA MUNICIPAL_DATA (dane gminne) - 1024 wymiary
-- ============================================================================

CREATE TABLE IF NOT EXISTS municipal_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL, -- 'meeting', 'resolution', 'announcement', 'news'
  title TEXT NOT NULL,
  content TEXT,
  source_url TEXT,
  external_id TEXT,
  meeting_date TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(1024) -- BGE-M3 (1024 wymiary)
);

CREATE INDEX IF NOT EXISTS idx_municipal_data_user_id ON municipal_data(user_id);
CREATE INDEX IF NOT EXISTS idx_municipal_data_type ON municipal_data(data_type);
CREATE INDEX IF NOT EXISTS idx_municipal_data_embedding ON municipal_data USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- 6. TABELA DATA_SOURCES (źródła danych do scrapingu)
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('bip', 'website', 'rss', 'api')),
  scraping_enabled BOOLEAN DEFAULT true,
  scraping_interval_hours INTEGER DEFAULT 24,
  last_scraped_at TIMESTAMPTZ,
  next_scrape_at TIMESTAMPTZ,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_sources_user_id ON data_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_data_sources_next_scrape ON data_sources(next_scrape_at) WHERE scraping_enabled = true;

-- ============================================================================
-- 7. TABELA SCRAPED_CONTENT (surowe dane ze scrapingu)
-- ============================================================================

CREATE TABLE IF NOT EXISTS scraped_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  raw_content TEXT,
  content_hash TEXT,
  content_type TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_scraped_content_source ON scraped_content(source_id);
CREATE INDEX IF NOT EXISTS idx_scraped_content_hash ON scraped_content(content_hash);
CREATE INDEX IF NOT EXISTS idx_scraped_content_scraped_at ON scraped_content(scraped_at DESC);

-- ============================================================================
-- 8. TABELA PROCESSED_DOCUMENTS (przetworzone dokumenty) - 1024 wymiary
-- ============================================================================

CREATE TABLE IF NOT EXISTS processed_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_content_id UUID REFERENCES scraped_content(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  source_type TEXT NOT NULL,
  keywords TEXT[],
  publish_date TIMESTAMPTZ,
  source_url TEXT,
  embedding vector(1024), -- BGE-M3 (1024 wymiary)
  metadata JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_documents_user ON processed_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_processed_documents_source ON processed_documents(scraped_content_id);
CREATE INDEX IF NOT EXISTS idx_processed_documents_type ON processed_documents(source_type);
CREATE INDEX IF NOT EXISTS idx_processed_documents_embedding ON processed_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- 9. TABELA SCRAPING_LOGS (logi scrapingu)
-- ============================================================================

CREATE TABLE IF NOT EXISTS scraping_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial', 'skipped')),
  documents_found INTEGER DEFAULT 0,
  documents_new INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scraping_logs_source ON scraping_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_scraping_logs_started ON scraping_logs(started_at DESC);

-- ============================================================================
-- 10. FUNKCJE WYSZUKIWANIA SEMANTYCZNEGO (1024 wymiary)
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
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  FROM chunks c
  JOIN documents d ON c.document_id = d.id
  WHERE 
    c.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR d.user_id = filter_user_id)
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
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
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  FROM chunks c
  WHERE 
    c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Funkcja search_processed_documents
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

-- Funkcja search_municipal_data
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
-- GOTOWE: Schemat RAG z BGE-M3 (1024 wymiary)
-- ============================================================================
