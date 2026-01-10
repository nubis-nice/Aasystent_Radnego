-- ============================================
-- Migracja: Rozszerzenie listy providerów API
-- Data: 2026-01-09
-- Opis: Dodanie nowych providerów: Google, Kimi K2, DeepSeek, Qwen, GLM, Mistral, Groq itd.
-- ============================================

-- Usunięcie starego constraintu CHECK
ALTER TABLE api_configurations DROP CONSTRAINT IF EXISTS api_configurations_provider_check;

-- Dodanie nowego constraintu z rozszerzoną listą providerów
ALTER TABLE api_configurations ADD CONSTRAINT api_configurations_provider_check 
CHECK (provider IN (
  -- OpenAI i kompatybilne
  'openai', 'azure', 'local',
  -- Anthropic
  'anthropic',
  -- Google
  'google',
  -- Chińscy providerzy
  'moonshot',   -- Kimi K2
  'deepseek',   -- DeepSeek
  'qwen',       -- Alibaba Qwen
  'zhipu',      -- Zhipu AI (GLM)
  'baichuan',   -- Baichuan
  -- Inni providerzy
  'mistral',    -- Mistral AI
  'cohere',     -- Cohere
  'together',   -- Together AI
  'groq',       -- Groq
  'other'       -- Inne OpenAI-compatible
));

-- Koniec migracji
