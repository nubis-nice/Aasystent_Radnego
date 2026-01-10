-- Migration: Add transcription_model to api_configurations
-- Agent AI "Windsurf" - API Configuration Enhancement
-- Execute in Supabase SQL Editor: https://supabase.com/dashboard/project/rgcegixkrigqxtiuuial/sql

-- Add transcription_model column
ALTER TABLE api_configurations
ADD COLUMN IF NOT EXISTS transcription_model VARCHAR(100) DEFAULT 'whisper-1';

-- Update existing configurations with default transcription model
UPDATE api_configurations
SET transcription_model = 'whisper-1'
WHERE transcription_model IS NULL;

-- Add comment
COMMENT ON COLUMN api_configurations.transcription_model IS 'Model used for audio transcription (e.g., whisper-1, whisper-large-v3)';

-- Verify migration
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'api_configurations' 
  AND column_name = 'transcription_model';
