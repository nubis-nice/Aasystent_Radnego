-- Migration: Add Deep Research Providers to provider_capabilities
-- Description: Dodanie Exa, Tavily, Serper, Firecrawl do tabeli provider_capabilities
-- Agent AI "Winsdurf" - umożliwienie dodawania kluczy przez UI

-- Dodaj Exa AI
INSERT INTO provider_capabilities (
  provider,
  supports_chat,
  supports_embeddings,
  supports_streaming,
  supports_function_calling,
  supports_vision,
  default_base_url,
  default_chat_endpoint,
  default_embeddings_endpoint,
  default_models_endpoint,
  auth_methods,
  rate_limit_rpm,
  rate_limit_tpm,
  documentation_url
) VALUES (
  'exa',
  false,
  false,
  false,
  false,
  false,
  'https://api.exa.ai',
  '/search',
  null,
  null,
  ARRAY['api_key'],
  100,
  null,
  'https://docs.exa.ai'
) ON CONFLICT (provider) DO UPDATE SET
  default_base_url = EXCLUDED.default_base_url,
  documentation_url = EXCLUDED.documentation_url;

-- Dodaj Tavily AI
INSERT INTO provider_capabilities (
  provider,
  supports_chat,
  supports_embeddings,
  supports_streaming,
  supports_function_calling,
  supports_vision,
  default_base_url,
  default_chat_endpoint,
  default_embeddings_endpoint,
  default_models_endpoint,
  auth_methods,
  rate_limit_rpm,
  rate_limit_tpm,
  documentation_url
) VALUES (
  'tavily',
  false,
  false,
  false,
  false,
  false,
  'https://api.tavily.com',
  '/search',
  null,
  null,
  ARRAY['api_key'],
  100,
  null,
  'https://docs.tavily.com'
) ON CONFLICT (provider) DO UPDATE SET
  default_base_url = EXCLUDED.default_base_url,
  documentation_url = EXCLUDED.documentation_url;

-- Dodaj Serper (Google Search)
INSERT INTO provider_capabilities (
  provider,
  supports_chat,
  supports_embeddings,
  supports_streaming,
  supports_function_calling,
  supports_vision,
  default_base_url,
  default_chat_endpoint,
  default_embeddings_endpoint,
  default_models_endpoint,
  auth_methods,
  rate_limit_rpm,
  rate_limit_tpm,
  documentation_url
) VALUES (
  'serper',
  false,
  false,
  false,
  false,
  false,
  'https://google.serper.dev',
  '/search',
  null,
  null,
  ARRAY['api_key'],
  50,
  null,
  'https://serper.dev/docs'
) ON CONFLICT (provider) DO UPDATE SET
  default_base_url = EXCLUDED.default_base_url,
  documentation_url = EXCLUDED.documentation_url;

-- Dodaj Firecrawl (Web Scraping)
INSERT INTO provider_capabilities (
  provider,
  supports_chat,
  supports_embeddings,
  supports_streaming,
  supports_function_calling,
  supports_vision,
  default_base_url,
  default_chat_endpoint,
  default_embeddings_endpoint,
  default_models_endpoint,
  auth_methods,
  rate_limit_rpm,
  rate_limit_tpm,
  documentation_url
) VALUES (
  'firecrawl',
  false,
  false,
  false,
  false,
  false,
  'https://api.firecrawl.dev',
  '/scrape',
  null,
  null,
  ARRAY['api_key'],
  60,
  null,
  'https://docs.firecrawl.dev'
) ON CONFLICT (provider) DO UPDATE SET
  default_base_url = EXCLUDED.default_base_url,
  documentation_url = EXCLUDED.documentation_url;

-- Komentarze
COMMENT ON TABLE provider_capabilities IS 'Capabilities i konfiguracja domyślna dla wszystkich providerów (LLM + Deep Research)';
