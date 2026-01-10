-- Migration: Research Reports Table
-- Description: Tabela dla raportów z Deep Internet Researcher
-- Agent AI "Winsdurf" - Deep Internet Researcher

-- Tabela raportów researchu
CREATE TABLE IF NOT EXISTS research_reports (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  research_type TEXT NOT NULL CHECK (research_type IN ('legal', 'financial', 'procedural', 'general')),
  depth TEXT NOT NULL CHECK (depth IN ('quick', 'standard', 'deep')),
  summary TEXT NOT NULL,
  key_findings TEXT[] DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '[]',
  sources JSONB NOT NULL DEFAULT '[]',
  related_queries TEXT[] DEFAULT '{}',
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  processing_time INTEGER NOT NULL, -- milliseconds
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX idx_research_reports_user_id ON research_reports(user_id);
CREATE INDEX idx_research_reports_research_type ON research_reports(research_type);
CREATE INDEX idx_research_reports_created_at ON research_reports(created_at DESC);
CREATE INDEX idx_research_reports_confidence ON research_reports(confidence DESC);

-- RLS Policies
ALTER TABLE research_reports ENABLE ROW LEVEL SECURITY;

-- Użytkownicy mogą widzieć tylko swoje raporty
CREATE POLICY "Users can view own research reports"
  ON research_reports FOR SELECT
  USING (auth.uid() = user_id);

-- Użytkownicy mogą tworzyć swoje raporty
CREATE POLICY "Users can create own research reports"
  ON research_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Użytkownicy mogą usuwać swoje raporty
CREATE POLICY "Users can delete own research reports"
  ON research_reports FOR DELETE
  USING (auth.uid() = user_id);

-- Komentarze
COMMENT ON TABLE research_reports IS 'Raporty z Deep Internet Researcher - zaawansowany research internetowy';
COMMENT ON COLUMN research_reports.query IS 'Zapytanie użytkownika';
COMMENT ON COLUMN research_reports.research_type IS 'Typ researchu: legal, financial, procedural, general';
COMMENT ON COLUMN research_reports.depth IS 'Głębokość researchu: quick (5 źródeł), standard (20), deep (50+)';
COMMENT ON COLUMN research_reports.summary IS 'Podsumowanie wygenerowane przez AI';
COMMENT ON COLUMN research_reports.key_findings IS 'Kluczowe ustalenia (3-5 punktów)';
COMMENT ON COLUMN research_reports.results IS 'Wyniki researchu w formacie JSON';
COMMENT ON COLUMN research_reports.sources IS 'Statystyki źródeł (provider, count, avg_relevance)';
COMMENT ON COLUMN research_reports.related_queries IS 'Powiązane zapytania sugerowane przez AI';
COMMENT ON COLUMN research_reports.confidence IS 'Poziom pewności wyniku (0-1)';
COMMENT ON COLUMN research_reports.processing_time IS 'Czas przetwarzania w milisekundach';
