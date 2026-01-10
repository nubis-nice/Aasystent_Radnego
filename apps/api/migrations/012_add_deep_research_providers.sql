-- Migration: Deep Research Providers w API Configurations
-- Description: Dodanie providerów Exa, Tavily, Serper do api_configurations
-- Agent AI "Winsdurf" - Deep Internet Researcher

-- Krok 1: Usuń stary constraint
ALTER TABLE api_configurations DROP CONSTRAINT IF EXISTS api_configurations_provider_check;

-- Krok 2: Dodaj nowy constraint z rozszerzoną listą providerów
ALTER TABLE api_configurations ADD CONSTRAINT api_configurations_provider_check 
CHECK (provider IN (
  -- Istniejące providery (z migracji 003)
  'openai',
  'local',
  'azure',
  'anthropic',
  'other',
  -- Dodatkowe providery AI (mogą już istnieć w bazie)
  'google',
  'moonshot',
  'deepseek',
  'qwen',
  'zhipu',
  'baichuan',
  'mistral',
  'cohere',
  'together',
  'groq',
  -- Deep Research providery (nowe)
  'exa',
  'tavily',
  'serper',
  'firecrawl'
));

-- Dodaj komentarz
COMMENT ON COLUMN api_configurations.provider IS 'Provider API: openai, local, azure, anthropic, google, moonshot, deepseek, qwen, zhipu, baichuan, mistral, cohere, together, groq, exa, tavily, serper, firecrawl, other';
