-- Migration: 027_document_jobs
-- Description: Tabela do śledzenia zadań przetwarzania dokumentów (OCR/transkrypcja)
-- Date: 2026-01-24

-- Tabela document_jobs
CREATE TABLE IF NOT EXISTS document_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_id TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indeksy
CREATE INDEX idx_document_jobs_user_id ON document_jobs(user_id);
CREATE INDEX idx_document_jobs_status ON document_jobs(status);
CREATE INDEX idx_document_jobs_created_at ON document_jobs(created_at DESC);

-- RLS
ALTER TABLE document_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: użytkownik widzi tylko swoje joby
CREATE POLICY "Users can view own document jobs"
  ON document_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: użytkownik może usuwać tylko swoje joby
CREATE POLICY "Users can delete own document jobs"
  ON document_jobs FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: service role może wszystko (dla workera)
CREATE POLICY "Service role full access"
  ON document_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- Komentarz
COMMENT ON TABLE document_jobs IS 'Zadania przetwarzania dokumentów (OCR/transkrypcja) z kolejki Redis';
