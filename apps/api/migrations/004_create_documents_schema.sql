-- ============================================
-- Migracja: Schemat dokumentów i analiz
-- Data: 2026-01-09
-- Opis: Tabele dla dokumentów, chunków, analiz i embeddingów
-- ============================================

-- Włącz rozszerzenie pgvector dla embeddingów
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Tabela documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_hash VARCHAR(64) NOT NULL UNIQUE,
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
  tags TEXT[],
  
  -- Ekstrakcja
  extracted_text TEXT,
  extraction_quality_score DECIMAL(3,2),
  extraction_method VARCHAR(50),
  
  -- Timestampy
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(document_date);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);

-- 2. Tabela chunks (fragmenty dokumentów dla RAG)
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  
  -- Embedding dla wyszukiwania semantycznego
  embedding vector(1536),
  
  -- Metadane chunku
  page_number INTEGER,
  section_title TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 3. Tabela analyses (analizy dokumentów)
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('summary', 'key_points', 'risk_scan', 'legal_check')),
  
  -- Wyniki analizy
  result JSONB NOT NULL,
  confidence_score DECIMAL(3,2),
  
  -- Metadane
  model_used VARCHAR(100),
  prompt_version VARCHAR(20),
  tokens_used INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(document_id, analysis_type)
);

CREATE INDEX IF NOT EXISTS idx_analyses_document ON analyses(document_id);
CREATE INDEX IF NOT EXISTS idx_analyses_type ON analyses(analysis_type);

-- 4. Tabela document_relations (powiązania między dokumentami)
CREATE TABLE IF NOT EXISTS document_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) NOT NULL CHECK (relation_type IN ('amends', 'repeals', 'implements', 'references')),
  
  -- Szczegóły relacji
  description TEXT,
  confidence_score DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(source_document_id, target_document_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_relations_source ON document_relations(source_document_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON document_relations(target_document_id);

-- 5. Tabela processing_jobs (śledzenie zadań)
CREATE TABLE IF NOT EXISTS processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('extraction', 'analysis', 'embedding', 'relation_detection')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  
  -- Szczegóły wykonania
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadane
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_document ON processing_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON processing_jobs(job_type);

-- 6. Trigger dla updated_at
CREATE TRIGGER update_documents_updated_at 
BEFORE UPDATE ON documents 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at 
BEFORE UPDATE ON processing_jobs 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 7. Funkcja wyszukiwania semantycznego
CREATE OR REPLACE FUNCTION search_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  content text,
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
    1 - (c.embedding <=> query_embedding) as similarity
  FROM chunks c
  WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Koniec migracji
