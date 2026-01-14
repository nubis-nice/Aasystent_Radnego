-- ============================================================================
-- Migration: Add unique constraints to processed_documents
-- Purpose: Prevent duplicate documents in RAG database
-- Date: 2026-01-14
-- ============================================================================

-- ============================================================================
-- STEP 1: Identify and remove existing duplicates (keep newest)
-- ============================================================================

-- Create temporary table with duplicates to delete
CREATE TEMP TABLE duplicates_to_delete AS
WITH ranked_docs AS (
  SELECT 
    id,
    user_id,
    source_url,
    title,
    processed_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, source_url 
      ORDER BY processed_at DESC
    ) as rn
  FROM processed_documents
  WHERE source_url IS NOT NULL
)
SELECT id FROM ranked_docs WHERE rn > 1;

-- Log how many duplicates will be deleted
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM duplicates_to_delete;
  RAISE NOTICE 'Deleting % duplicate documents (by source_url)', dup_count;
END $$;

-- Delete duplicates (keeping the newest one)
DELETE FROM processed_documents 
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- Drop temp table
DROP TABLE duplicates_to_delete;

-- ============================================================================
-- STEP 2: Add unique index for source_url per user
-- Using partial index to handle NULL source_url values
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_documents_unique_source_url 
ON processed_documents (user_id, source_url) 
WHERE source_url IS NOT NULL;

-- ============================================================================
-- STEP 3: Add index for faster duplicate lookups by title
-- Not unique because titles can legitimately repeat across document types
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_processed_documents_title_lookup
ON processed_documents (user_id, document_type, lower(title));

-- ============================================================================
-- STEP 4: Add constraint to prevent empty source_url
-- ============================================================================

ALTER TABLE processed_documents
ADD CONSTRAINT chk_source_url_not_empty
CHECK (source_url IS NULL OR length(trim(source_url)) > 0);

-- ============================================================================
-- STEP 5: Add trigger to normalize source_url before insert/update
-- ============================================================================

CREATE OR REPLACE FUNCTION normalize_source_url()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove trailing slashes and normalize URL
  IF NEW.source_url IS NOT NULL THEN
    NEW.source_url = rtrim(trim(NEW.source_url), '/');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_source_url ON processed_documents;
CREATE TRIGGER trg_normalize_source_url
  BEFORE INSERT OR UPDATE ON processed_documents
  FOR EACH ROW
  EXECUTE FUNCTION normalize_source_url();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show current duplicate count (should be 0 after migration)
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT user_id, source_url, COUNT(*) as cnt
    FROM processed_documents
    WHERE source_url IS NOT NULL
    GROUP BY user_id, source_url
    HAVING COUNT(*) > 1
  ) dups;
  
  IF dup_count > 0 THEN
    RAISE WARNING 'Still have % duplicate source_url groups!', dup_count;
  ELSE
    RAISE NOTICE 'SUCCESS: No duplicate source_urls found';
  END IF;
END $$;
