-- Unique constraint to prevent duplicated documents per user and URL
CREATE UNIQUE INDEX IF NOT EXISTS uq_processed_documents_user_url
  ON processed_documents(user_id, source_url);
