-- Import konfiguracji API z External Supabase
-- User ID lokalny: 2a35546a-7b24-4631-882c-056e38129d92

-- Ollama (główna konfiguracja AI)
INSERT INTO api_configurations (
  id, user_id, provider, name, api_key_encrypted, base_url, model_name, 
  is_active, is_default, created_at, updated_at, embedding_model, 
  auth_method, timeout_seconds, max_retries, connection_status, 
  transcription_model, config_type, results_limit, provider_meta, 
  vision_model, tts_model
) VALUES (
  'a1391f9e-69ff-40e2-95a0-77f4a783fd9c', 
  '2a35546a-7b24-4631-882c-056e38129d92', 
  'local', 
  'Ollama', 
  'MTIwMmM2ZGE3M2U5NDAyMDhlYTdlNGMyZTA5NjYxODUuSGg1VFIwRG9Ua0FlNzNtRVliWXNMOG1F', 
  '', 
  'gpt-oss:120b-cloud', 
  true, 
  true, 
  NOW(), 
  NOW(), 
  'bge-m3', 
  'bearer', 
  600, 
  3, 
  'untested', 
  'Systran/faster-whisper-medium', 
  'ai', 
  5, 
  '{"tts_voice": "pl-PL-ZofiaNeural", "llm_enabled": true, "stt_enabled": true, "tts_enabled": true, "stt_base_url": "http://localhost:8001/v1", "tts_base_url": "http://localhost:8001/v1", "tts_provider": "edge-tts", "vision_enabled": true, "embeddings_enabled": true}'::jsonb, 
  'qwen3-vl:235b-instruct-cloud', 
  'edge-tts:pl-PL-MarekNeural'
) ON CONFLICT (id) DO NOTHING;

-- Exa (semantic search - disabled)
INSERT INTO api_configurations (
  id, user_id, provider, name, api_key_encrypted, base_url, 
  is_active, is_default, created_at, updated_at, embedding_model, 
  auth_method, timeout_seconds, max_retries, connection_status, 
  transcription_model, config_type, search_endpoint, results_limit
) VALUES (
  '8796011b-7803-4d48-b4a9-d475d7d79894', 
  '2a35546a-7b24-4631-882c-056e38129d92', 
  'exa', 
  'Exa', 
  'YmM4OWQ1NWUtYWY0Ni00MGZhLTkyMWUtODE1YTY5YmExNDhl', 
  '', 
  false, 
  false, 
  NOW(), 
  NOW(), 
  'text-embedding-3-small', 
  'bearer', 
  30, 
  3, 
  'failed', 
  'whisper-1', 
  'semantic', 
  '/search', 
  5
) ON CONFLICT (id) DO NOTHING;
