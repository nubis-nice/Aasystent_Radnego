-- 025_add_brave_provider.sql
-- Dodaje Brave Search do listy dozwolonych providerów wyszukiwania semantycznego

-- Usunięcie starego constraint
ALTER TABLE api_configurations DROP CONSTRAINT IF EXISTS api_configurations_provider_check;

-- Dodanie nowego constraint z Brave
ALTER TABLE api_configurations
  ADD CONSTRAINT api_configurations_provider_check CHECK (
    provider IN (
      'openai', 'local', 'azure', 'anthropic', 'other',
      'exa', 'perplexity', 'tavily', 'brave', 'serper', 'firecrawl'
    )
  );
