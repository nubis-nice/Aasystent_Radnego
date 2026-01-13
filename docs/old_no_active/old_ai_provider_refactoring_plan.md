# Plan Refaktoringu Obsługi Providerów AI

**Data:** 2026-01-11  
**Status:** W trakcie implementacji  
**Priorytet:** Wysoki

---

## 1. Cel Refaktoringu

Centralizacja i unifikacja obsługi providerów AI z podziałem na **5 niezależnych funkcji**:

- **LLM** - modele językowe (chat)
- **Embeddings** - wektory semantyczne
- **Vision** - analiza obrazów
- **STT** - Speech-to-Text (transkrypcja)
- **TTS** - Text-to-Speech (synteza mowy)

---

## 2. Architektura Docelowa

### 2.1 Struktura Katalogów

```
apps/api/src/ai/
├── index.ts                    # Eksport publiczny
├── defaults.ts                 # Presety konfiguracji (OpenAI, Ollama, Custom)
├── types.ts                    # Typy i interfejsy
├── ai-config-resolver.ts       # Resolver konfiguracji z cache
├── ai-client-factory.ts        # Fabryka klientów AI (singleton)
└── clients/
    ├── llm-client.ts           # Klient LLM
    ├── embeddings-client.ts    # Klient embeddingów
    ├── vision-client.ts        # Klient vision
    ├── stt-client.ts           # Klient STT
    └── tts-client.ts           # Klient TTS
```

### 2.2 Schemat Bazy Danych

```sql
-- Tabela główna konfiguracji AI
CREATE TABLE ai_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  preset VARCHAR(50) NOT NULL,        -- 'openai', 'ollama', 'custom'

  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);

-- Tabela providerów dla każdej funkcji AI
CREATE TABLE ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES ai_configurations(id) ON DELETE CASCADE,

  function_type VARCHAR(20) NOT NULL,   -- 'llm', 'embeddings', 'vision', 'stt', 'tts'

  provider VARCHAR(50) NOT NULL,
  api_protocol VARCHAR(20) DEFAULT 'openai_compatible',

  base_url TEXT NOT NULL,
  endpoint TEXT,

  api_key_encrypted TEXT,
  encryption_iv TEXT,
  auth_method VARCHAR(20) DEFAULT 'bearer',
  custom_headers JSONB,

  model_name VARCHAR(100) NOT NULL,

  timeout_seconds INTEGER DEFAULT 30,
  max_retries INTEGER DEFAULT 3,

  is_enabled BOOLEAN DEFAULT true,
  last_test_at TIMESTAMPTZ,
  last_test_status VARCHAR(20),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(config_id, function_type)
);

-- Indeksy
CREATE INDEX idx_ai_configs_user_default ON ai_configurations(user_id, is_default);
CREATE INDEX idx_ai_providers_config ON ai_providers(config_id);
```

---

## 3. Presety Konfiguracji

### 3.1 OpenAI

| Funkcja    | Base URL          | Model                  | Auth   |
| ---------- | ----------------- | ---------------------- | ------ |
| LLM        | api.openai.com/v1 | gpt-4-turbo-preview    | Bearer |
| Embeddings | api.openai.com/v1 | text-embedding-3-small | Bearer |
| Vision     | api.openai.com/v1 | gpt-4-vision-preview   | Bearer |
| STT        | api.openai.com/v1 | whisper-1              | Bearer |
| TTS        | api.openai.com/v1 | tts-1                  | Bearer |

### 3.2 Ollama (Local)

| Funkcja    | Base URL           | Model                         | Auth |
| ---------- | ------------------ | ----------------------------- | ---- |
| LLM        | localhost:11434/v1 | llama3.2                      | None |
| Embeddings | localhost:11434/v1 | nomic-embed-text              | None |
| Vision     | localhost:11434/v1 | llava                         | None |
| STT        | localhost:8000/v1  | Systran/faster-whisper-medium | None |
| TTS        | localhost:5000     | pl_PL-gosia-medium            | None |

### 3.3 Custom

Wszystkie pola konfigurowalne przez użytkownika z wyborem protokołu API:

- OpenAI Compatible
- Anthropic
- Custom

---

## 4. Plan Implementacji

### Faza 1: Infrastruktura (Dzień 1)

- [x] Dokumentacja projektowa
- [ ] Utworzenie struktury katalogów `ai/`
- [ ] Implementacja `types.ts`
- [ ] Implementacja `defaults.ts`
- [ ] Migracja bazy danych

### Faza 2: Core (Dzień 1-2)

- [ ] Implementacja `AIConfigResolver`
- [ ] Implementacja `AIClientFactory`
- [ ] Testy jednostkowe

### Faza 3: Klienty (Dzień 2)

- [ ] `LLMClient`
- [ ] `EmbeddingsClient`
- [ ] `VisionClient`
- [ ] `STTClient`
- [ ] `TTSClient`

### Faza 4: Migracja Serwisów (Dzień 3-5)

1. `youtube-downloader.ts` - STT
2. `audio-transcriber.ts` - STT
3. `chat.ts` - LLM + Embeddings
4. Pozostałe serwisy

### Faza 5: Frontend (Dzień 5-6)

- [ ] Modal konfiguracji z zakładkami
- [ ] Strona ustawień API
- [ ] Testy E2E

---

## 5. Korzyści

| Korzyść             | Opis                                 |
| ------------------- | ------------------------------------ |
| **Centralizacja**   | Jeden punkt zarządzania konfiguracją |
| **Elastyczność**    | Różne providery dla różnych funkcji  |
| **Niezależność**    | LLM z Ollama + STT z OpenAI          |
| **Cache**           | Klienty cache'owane per użytkownik   |
| **Testowalność**    | Łatwe mockowanie                     |
| **-500 linii kodu** | Usunięcie duplikacji                 |

---

## 6. Migracja Istniejących Danych

Istniejąca tabela `api_configurations` zostanie zachowana dla kompatybilności wstecznej.
Nowe tabele `ai_configurations` i `ai_providers` będą używane równolegle.

Po pełnej migracji stara tabela zostanie oznaczona jako deprecated.

---

**Autor:** AI Assistant  
**Wersja:** 2.0  
**Ostatnia aktualizacja:** 2026-01-11
