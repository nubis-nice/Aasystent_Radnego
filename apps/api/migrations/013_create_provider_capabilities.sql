-- Migration: Create provider_capabilities table
-- Date: 2026-01-09
-- Description: Stores capabilities and default settings for each LLM provider

CREATE TABLE IF NOT EXISTS provider_capabilities (
  provider VARCHAR(50) PRIMARY KEY,
  
  -- Capabilities
  supports_chat BOOLEAN DEFAULT true,
  supports_embeddings BOOLEAN DEFAULT false,
  supports_streaming BOOLEAN DEFAULT true,
  supports_function_calling BOOLEAN DEFAULT false,
  supports_vision BOOLEAN DEFAULT false,
  
  -- Authentication
  auth_methods TEXT[] DEFAULT ARRAY['bearer'],
  
  -- Default endpoints
  default_base_url TEXT,
  default_chat_endpoint TEXT,
  default_embeddings_endpoint TEXT,
  default_models_endpoint TEXT,
  
  -- Rate limits
  rate_limit_rpm INTEGER, -- requests per minute
  rate_limit_tpm INTEGER, -- tokens per minute
  
  -- Documentation
  documentation_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_provider_capabilities_chat 
  ON provider_capabilities(supports_chat) WHERE supports_chat = true;

CREATE INDEX IF NOT EXISTS idx_provider_capabilities_embeddings 
  ON provider_capabilities(supports_embeddings) WHERE supports_embeddings = true;

-- Add comments
COMMENT ON TABLE provider_capabilities IS 'Stores capabilities and default configuration for each LLM provider';
COMMENT ON COLUMN provider_capabilities.auth_methods IS 'Array of supported authentication methods';
COMMENT ON COLUMN provider_capabilities.rate_limit_rpm IS 'Rate limit in requests per minute';
COMMENT ON COLUMN provider_capabilities.rate_limit_tpm IS 'Rate limit in tokens per minute';
