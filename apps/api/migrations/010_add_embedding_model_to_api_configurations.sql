-- ============================================
-- Migracja: Dodanie pola embedding_model do api_configurations
-- Data: 2026-01-09
-- Opis: Umożliwia wybór modelu do generowania embeddingów
-- ============================================

-- Dodaj kolumnę embedding_model
ALTER TABLE api_configurations 
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small';

-- Dodaj komentarz
COMMENT ON COLUMN api_configurations.embedding_model IS 'Model używany do generowania embeddingów (np. text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002)';
