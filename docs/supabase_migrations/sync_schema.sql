-- Synchronizacja schematu z external Supabase
-- Data: 2026-01-26

-- background_tasks - brakujące kolumny
ALTER TABLE background_tasks ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE background_tasks ADD COLUMN IF NOT EXISTS task_type TEXT;
ALTER TABLE background_tasks ADD COLUMN IF NOT EXISTS error_message TEXT;

-- processed_documents - brakujące kolumny (już dodane wcześniej)
ALTER TABLE processed_documents ADD COLUMN IF NOT EXISTS normalized_title VARCHAR(500);
ALTER TABLE processed_documents ADD COLUMN IF NOT EXISTS normalized_publish_date DATE;
ALTER TABLE processed_documents ADD COLUMN IF NOT EXISTS document_number VARCHAR(100);
ALTER TABLE processed_documents ADD COLUMN IF NOT EXISTS session_type VARCHAR(50);
ALTER TABLE processed_documents ADD COLUMN IF NOT EXISTS normalization_confidence INTEGER DEFAULT 0;
ALTER TABLE processed_documents ADD COLUMN IF NOT EXISTS is_normalized BOOLEAN DEFAULT false;

-- document_jobs - brakujące kolumny
ALTER TABLE document_jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- data_sources - brakujące kolumny
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;

-- scraped_content - brakujące kolumny
ALTER TABLE scraped_content ADD COLUMN IF NOT EXISTS extraction_method TEXT;
ALTER TABLE scraped_content ADD COLUMN IF NOT EXISTS ocr_confidence DECIMAL(5,2);

-- api_configurations - już zsynchronizowane wcześniej (gus provider dodany)

-- Uprawnienia
GRANT SELECT, INSERT, UPDATE, DELETE ON background_tasks TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON processed_documents TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON document_jobs TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON data_sources TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON scraped_content TO anon, authenticated, service_role;

-- Koniec synchronizacji
