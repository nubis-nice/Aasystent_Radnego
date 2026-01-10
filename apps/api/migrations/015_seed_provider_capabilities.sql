-- Migration: Seed provider_capabilities with initial data
-- Date: 2026-01-09
-- Description: Populates provider_capabilities table with known LLM providers

INSERT INTO provider_capabilities (
  provider,
  supports_chat,
  supports_embeddings,
  supports_streaming,
  supports_function_calling,
  supports_vision,
  auth_methods,
  default_base_url,
  default_chat_endpoint,
  default_embeddings_endpoint,
  default_models_endpoint,
  rate_limit_rpm,
  rate_limit_tpm,
  documentation_url
) VALUES
  -- OpenAI
  (
    'openai',
    true,
    true,
    true,
    true,
    true,
    ARRAY['bearer'],
    'https://api.openai.com/v1',
    '/chat/completions',
    '/embeddings',
    '/models',
    3500,
    90000,
    'https://platform.openai.com/docs/api-reference'
  ),
  
  -- Google Gemini
  (
    'google',
    true,
    true,
    true,
    true,
    true,
    ARRAY['api-key', 'bearer'],
    'https://generativelanguage.googleapis.com/v1beta',
    '/openai/chat/completions',
    '/openai/embeddings',
    '/models',
    60,
    32000,
    'https://ai.google.dev/docs'
  ),
  
  -- Anthropic Claude
  (
    'anthropic',
    true,
    false,
    true,
    true,
    true,
    ARRAY['api-key'],
    'https://api.anthropic.com/v1',
    '/messages',
    NULL,
    NULL,
    50,
    40000,
    'https://docs.anthropic.com/claude/reference'
  ),
  
  -- Azure OpenAI
  (
    'azure',
    true,
    true,
    true,
    true,
    true,
    ARRAY['bearer'],
    NULL, -- User must provide their deployment URL
    '/chat/completions',
    '/embeddings',
    '/models',
    120,
    120000,
    'https://learn.microsoft.com/azure/ai-services/openai/'
  ),
  
  -- Moonshot AI
  (
    'moonshot',
    true,
    false,
    true,
    true,
    false,
    ARRAY['bearer'],
    'https://api.moonshot.cn/v1',
    '/chat/completions',
    NULL,
    '/models',
    60,
    NULL,
    'https://platform.moonshot.cn/docs'
  ),
  
  -- DeepSeek
  (
    'deepseek',
    true,
    false,
    true,
    true,
    false,
    ARRAY['bearer'],
    'https://api.deepseek.com/v1',
    '/chat/completions',
    NULL,
    '/models',
    60,
    NULL,
    'https://platform.deepseek.com/docs'
  ),
  
  -- Cohere
  (
    'cohere',
    true,
    true,
    true,
    false,
    false,
    ARRAY['bearer'],
    'https://api.cohere.ai/v1',
    '/chat',
    '/embed',
    '/models',
    100,
    NULL,
    'https://docs.cohere.com/reference/about'
  ),
  
  -- Mistral AI
  (
    'mistral',
    true,
    true,
    true,
    true,
    false,
    ARRAY['bearer'],
    'https://api.mistral.ai/v1',
    '/chat/completions',
    '/embeddings',
    '/models',
    NULL,
    NULL,
    'https://docs.mistral.ai/api/'
  ),
  
  -- Groq
  (
    'groq',
    true,
    false,
    true,
    true,
    false,
    ARRAY['bearer'],
    'https://api.groq.com/openai/v1',
    '/chat/completions',
    NULL,
    '/models',
    30,
    NULL,
    'https://console.groq.com/docs'
  ),
  
  -- Perplexity
  (
    'perplexity',
    true,
    false,
    true,
    false,
    false,
    ARRAY['bearer'],
    'https://api.perplexity.ai',
    '/chat/completions',
    NULL,
    '/models',
    50,
    NULL,
    'https://docs.perplexity.ai/'
  ),
  
  -- Together AI
  (
    'together',
    true,
    true,
    true,
    false,
    false,
    ARRAY['bearer'],
    'https://api.together.xyz/v1',
    '/chat/completions',
    '/embeddings',
    '/models',
    60,
    NULL,
    'https://docs.together.ai/reference'
  ),
  
  -- Hugging Face
  (
    'huggingface',
    true,
    true,
    true,
    false,
    false,
    ARRAY['bearer'],
    'https://api-inference.huggingface.co',
    '/models',
    '/feature-extraction',
    '/models',
    NULL,
    NULL,
    'https://huggingface.co/docs/api-inference'
  ),
  
  -- Replicate
  (
    'replicate',
    true,
    false,
    true,
    false,
    true,
    ARRAY['bearer'],
    'https://api.replicate.com/v1',
    '/predictions',
    NULL,
    '/models',
    NULL,
    NULL,
    'https://replicate.com/docs/reference/http'
  ),
  
  -- Local Model (Ollama, LM Studio, etc.)
  (
    'local',
    true,
    true,
    true,
    false,
    false,
    ARRAY['bearer', 'custom'],
    'http://localhost:11434',
    '/api/chat',
    '/api/embeddings',
    '/api/tags',
    NULL,
    NULL,
    'https://github.com/ollama/ollama/blob/main/docs/api.md'
  ),
  
  -- Other (custom provider)
  (
    'other',
    true,
    false,
    true,
    false,
    false,
    ARRAY['bearer', 'api-key', 'custom'],
    NULL,
    '/chat/completions',
    NULL,
    '/models',
    NULL,
    NULL,
    NULL
  )
ON CONFLICT (provider) DO UPDATE SET
  supports_chat = EXCLUDED.supports_chat,
  supports_embeddings = EXCLUDED.supports_embeddings,
  supports_streaming = EXCLUDED.supports_streaming,
  supports_function_calling = EXCLUDED.supports_function_calling,
  supports_vision = EXCLUDED.supports_vision,
  auth_methods = EXCLUDED.auth_methods,
  default_base_url = EXCLUDED.default_base_url,
  default_chat_endpoint = EXCLUDED.default_chat_endpoint,
  default_embeddings_endpoint = EXCLUDED.default_embeddings_endpoint,
  default_models_endpoint = EXCLUDED.default_models_endpoint,
  rate_limit_rpm = EXCLUDED.rate_limit_rpm,
  rate_limit_tpm = EXCLUDED.rate_limit_tpm,
  documentation_url = EXCLUDED.documentation_url,
  updated_at = NOW();
