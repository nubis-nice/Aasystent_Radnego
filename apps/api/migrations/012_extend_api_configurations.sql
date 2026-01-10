-- Migration: Extend api_configurations table
-- Date: 2026-01-09
-- Description: Adds new columns for provider capabilities, encryption, and connection status

-- Add new columns to api_configurations
ALTER TABLE api_configurations
  -- Provider version
  ADD COLUMN IF NOT EXISTS provider_version VARCHAR(20),
  
  -- Enhanced encryption
  ADD COLUMN IF NOT EXISTS encryption_iv TEXT,
  
  -- Custom endpoints
  ADD COLUMN IF NOT EXISTS chat_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS embeddings_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS models_endpoint TEXT,
  
  -- Models
  ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100),
  
  -- Authentication
  ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) DEFAULT 'bearer',
  ADD COLUMN IF NOT EXISTS custom_headers JSONB,
  
  -- Configuration
  ADD COLUMN IF NOT EXISTS timeout_seconds INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
  
  -- Connection status
  ADD COLUMN IF NOT EXISTS connection_status VARCHAR(20) DEFAULT 'untested',
  ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_test_result JSONB;

-- Add check constraint for auth_method
ALTER TABLE api_configurations
  DROP CONSTRAINT IF EXISTS check_auth_method;

ALTER TABLE api_configurations
  ADD CONSTRAINT check_auth_method 
  CHECK (auth_method IN ('bearer', 'api-key', 'oauth', 'custom'));

-- Add check constraint for connection_status
ALTER TABLE api_configurations
  DROP CONSTRAINT IF EXISTS check_connection_status;

ALTER TABLE api_configurations
  ADD CONSTRAINT check_connection_status 
  CHECK (connection_status IN ('untested', 'working', 'failed', 'testing'));

-- Update existing provider constraint to include new providers
ALTER TABLE api_configurations
  DROP CONSTRAINT IF EXISTS api_configurations_provider_check;

ALTER TABLE api_configurations
  ADD CONSTRAINT api_configurations_provider_check 
  CHECK (provider IN (
    'openai', 
    'local', 
    'azure', 
    'anthropic', 
    'google', 
    'moonshot', 
    'deepseek',
    'cohere',
    'mistral',
    'huggingface',
    'replicate',
    'together',
    'perplexity',
    'groq',
    'other'
  ));

-- Create index for connection status queries
CREATE INDEX IF NOT EXISTS idx_api_configurations_status 
  ON api_configurations(user_id, connection_status);

-- Create index for last_test_at
CREATE INDEX IF NOT EXISTS idx_api_configurations_last_test 
  ON api_configurations(user_id, last_test_at DESC);

-- Add comment to table
COMMENT ON COLUMN api_configurations.provider_version IS 'API version for the provider (e.g., v1, v1beta)';
COMMENT ON COLUMN api_configurations.encryption_iv IS 'Initialization vector for AES-256-GCM encryption';
COMMENT ON COLUMN api_configurations.auth_method IS 'Authentication method: bearer, api-key, oauth, custom';
COMMENT ON COLUMN api_configurations.connection_status IS 'Last known connection status: untested, working, failed, testing';
COMMENT ON COLUMN api_configurations.last_test_result IS 'JSON with details of last connection test';
