-- Migration: 036_create_background_tasks
-- Description: Tabela do śledzenia statusów zadań w tle (transkrypcje, OCR, scraping)
-- Używana z Supabase Realtime do real-time aktualizacji w Dashboard

CREATE TABLE IF NOT EXISTS background_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Typ zadania
    task_type TEXT NOT NULL CHECK (task_type IN ('transcription', 'ocr', 'scraping', 'embedding', 'analysis')),
    
    -- Status zadania
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    
    -- Dane zadania
    title TEXT NOT NULL,
    description TEXT,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    
    -- Błąd (jeśli failed)
    error_message TEXT,
    
    -- Metadane (np. URL źródła, ID dokumentu)
    metadata JSONB DEFAULT '{}',
    
    -- Timestampy
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX idx_background_tasks_user_id ON background_tasks(user_id);
CREATE INDEX idx_background_tasks_status ON background_tasks(status);
CREATE INDEX idx_background_tasks_user_status ON background_tasks(user_id, status);
CREATE INDEX idx_background_tasks_created_at ON background_tasks(created_at DESC);

-- RLS
ALTER TABLE background_tasks ENABLE ROW LEVEL SECURITY;

-- Polityki RLS
CREATE POLICY "Users can view own tasks"
    ON background_tasks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all tasks"
    ON background_tasks FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Trigger do aktualizacji updated_at
CREATE OR REPLACE FUNCTION update_background_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_background_tasks_updated_at
    BEFORE UPDATE ON background_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_background_tasks_updated_at();

-- Włącz Realtime dla tej tabeli
ALTER PUBLICATION supabase_realtime ADD TABLE background_tasks;

-- Komentarz
COMMENT ON TABLE background_tasks IS 'Tabela do śledzenia zadań w tle z Supabase Realtime';
