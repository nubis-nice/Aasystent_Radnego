# Plan Refactoringu - Konfiguracja API i Reasoning Engine

## Cel

Uproszczenie konfiguracji API do wsparcia tylko protokołu OpenAI API, dodanie zarządzania modelami embedding i transkrypcji, oraz implementacja diagnostyki Reasoning Engine.

## Zakres Zmian

### 1. Wsparcie tylko OpenAI API Protocol

**Obecny stan:**

- Wsparcie dla wielu providerów: OpenAI, Google, Anthropic, Azure, Moonshot, DeepSeek, Cohere, Mistral, Groq, Perplexity, Together, HuggingFace, Replicate, Local, Other
- Różne adaptery dla różnych providerów
- Skomplikowana logika wyboru base URL i nagłówków

**Docelowy stan:**

- Wsparcie tylko dla providerów zgodnych z OpenAI API:
  - **OpenAI** (oficjalny)
  - **Local** (Ollama, LM Studio, vLLM, etc.)
  - **Other** (dowolny endpoint zgodny z OpenAI API)
- Usunięcie providerów: Google, Anthropic, Azure, Moonshot, DeepSeek, Cohere, Mistral, Groq, Perplexity, Together, HuggingFace, Replicate

**Pliki do modyfikacji:**

- `packages/shared/src/types/provider.ts` - ProviderType
- `apps/frontend/src/app/settings/api/page.tsx` - UI
- `apps/frontend/src/lib/supabase/api-config.ts` - funkcje zarządzania
- `apps/api/src/routes/chat.ts` - usunięcie logiki dla innych providerów
- `apps/api/src/routes/api-models.ts` - uproszczenie
- `apps/api/src/providers/` - usunięcie niepotrzebnych adapterów

### 2. Usunięcie Skanowania Modeli

**Obecny stan:**

- Endpoint `/api/models/:configId` do pobierania listy modeli z providera
- Funkcja `fetchAvailableModels` w frontend
- Przycisk "Skanuj modele" w UI

**Docelowy stan:**

- Usunięcie endpointu `/api/models/:configId`
- Usunięcie funkcji skanowania z UI
- Modele wybierane z predefiniowanej listy lub wpisywane ręcznie

**Pliki do modyfikacji:**

- `apps/api/src/routes/api-models.ts` - usunięcie endpointu
- `apps/frontend/src/app/settings/api/page.tsx` - usunięcie przycisku i logiki

### 3. Zarządzanie Modelami Embedding i Transkrypcji

**Obecny stan:**

- Model embedding: hardcoded `text-embedding-3-small` w kodzie
- Model transkrypcji: hardcoded w `youtube-downloader.ts`
- Brak możliwości zmiany przez użytkownika

**Docelowy stan:**

- Pole `embedding_model` w konfiguracji API (już istnieje w DB)
- Nowe pole `transcription_model` w konfiguracji API
- UI do wyboru modeli:
  - **Embedding**: text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002
  - **Transkrypcja**: whisper-1 (OpenAI), whisper-large-v3 (local)
- Wykorzystanie tych modeli w:
  - RAG pipeline (embedding)
  - YouTube transkrypcja (transcription)
  - Document processing (embedding)

**Pliki do modyfikacji:**

- `apps/api/migrations/` - nowa migracja dla `transcription_model`
- `packages/shared/src/types/provider.ts` - dodanie `transcription_model`
- `apps/frontend/src/app/settings/api/page.tsx` - UI dla modeli
- `apps/api/src/routes/chat.ts` - użycie embedding_model z config
- `apps/api/src/routes/youtube.ts` - użycie transcription_model z config
- `apps/api/src/services/document-processor.ts` - użycie embedding_model
- `apps/api/src/services/unified-data-service.ts` - użycie embedding_model

### 4. Diagnostyka Reasoning Engine

**Obecny stan:**

- Brak informacji o statusie narzędzi AI
- Brak diagnostyki RAG, Research, YouTube
- Użytkownik nie wie czy systemy działają poprawnie

**Docelowy stan:**

- Endpoint `/api/diagnostics/reasoning-engine` zwracający:
  ```typescript
  {
    rag: {
      status: "healthy" | "degraded" | "error",
      documentsCount: number,
      embeddingsCount: number,
      lastIndexed: string,
      message: string
    },
    research: {
      status: "healthy" | "degraded" | "error",
      providers: {
        exa: boolean,
        tavily: boolean,
        serper: boolean
      },
      message: string
    },
    transcription: {
      status: "healthy" | "degraded" | "error",
      model: string,
      message: string
    },
    embedding: {
      status: "healthy" | "degraded" | "error",
      model: string,
      dimensions: number,
      message: string
    }
  }
  ```

**Pliki do utworzenia:**

- `apps/api/src/routes/diagnostics.ts` - nowy endpoint

### 5. Kontrolki Statusu w ChatPage

**Obecny stan:**

- Brak wizualnej informacji o statusie systemów
- Użytkownik nie wie czy RAG/Research działają

**Docelowy stan:**

- Kontrolki statusu w nagłówku chatu:
  - 🟢 RAG (zielony = działa, żółty = degraded, czerwony = error)
  - 🟢 Research (status providerów)
  - 🟢 Embedding (model i status)
  - 🟢 Transcription (model i status)
- Tooltip z szczegółami po najechaniu
- Odświeżanie co 30s lub na żądanie

**Pliki do modyfikacji:**

- `apps/frontend/src/app/chat/page.tsx` - dodanie kontrolek statusu
- `apps/frontend/src/components/chat/SystemStatus.tsx` - nowy komponent

## Harmonogram Implementacji

### Faza 1: Uproszczenie Providerów (1-2h)

1. Modyfikacja `ProviderType` - tylko openai, local, other
2. Usunięcie niepotrzebnych adapterów
3. Uproszczenie logiki w chat.ts i api-models.ts
4. Update UI - usunięcie opcji dla innych providerów

### Faza 2: Usunięcie Skanowania Modeli (30min)

1. Usunięcie endpointu `/api/models/:configId`
2. Usunięcie UI dla skanowania
3. Predefiniowana lista modeli OpenAI

### Faza 3: Modele Embedding i Transkrypcji (2h)

1. Migracja DB - dodanie `transcription_model`
2. Update shared types
3. UI dla wyboru modeli
4. Integracja w RAG pipeline
5. Integracja w YouTube transkrypcji

### Faza 4: Diagnostyka (2-3h)

1. Endpoint diagnostyki
2. Logika sprawdzania statusu każdego systemu
3. Komponent SystemStatus w frontend
4. Integracja w ChatPage

### Faza 5: Testy i Dokumentacja (1h)

1. Testy manulane wszystkich zmian
2. Aktualizacja dokumentacji
3. Update changelog

## Opis Działania Narzędzi AI

### RAG (Retrieval Augmented Generation)

**Cel:** Dostarczanie AI kontekstu z dokumentów użytkownika

**Pipeline:**

1. **Scraping** - pobieranie HTML ze stron BIP/Gminy
2. **PDF Download** - pobieranie załączników PDF
3. **Text Extraction** - ekstrakcja tekstu (OCR dla skanów)
4. **Embedding Generation** - generowanie wektorów semantycznych
5. **Storage** - zapis do `processed_documents`
6. **Search** - wyszukiwanie podobnych dokumentów przez `search_processed_documents`
7. **Context Injection** - dodanie kontekstu do promptu AI

**Modele:**

- Embedding: `text-embedding-3-small` (1536 wymiarów)
- OCR: `gpt-4o` (Vision API)

**Diagnostyka:**

- Liczba dokumentów w bazie
- Liczba dokumentów z embeddingami
- Data ostatniej indeksacji
- Status połączenia z OpenAI

### Deep Research

**Cel:** Wyszukiwanie informacji w internecie

**Providery:**

1. **Exa** - semantyczne wyszukiwanie, crawling
2. **Tavily** - research API
3. **Serper** - Google Search API

**Pipeline:**

1. Analiza zapytania użytkownika
2. Wybór odpowiednich providerów
3. Równoległe wyszukiwanie
4. Agregacja i ranking wyników
5. Synteza odpowiedzi

**Diagnostyka:**

- Status każdego providera (klucz API, połączenie)
- Liczba zapytań w ostatniej godzinie
- Rate limiting status

### YouTube Transcription

**Cel:** Transkrypcja i analiza sesji rady z YouTube

**Pipeline:**

1. **Download** - pobieranie audio przez `yt-dlp`
2. **Transcription** - Whisper API
3. **Correction** - GPT-4o do poprawy transkrypcji
4. **Analysis** - sentiment analysis, kluczowe tematy
5. **Export** - markdown z timestampami

**Modele:**

- Transkrypcja: `whisper-1` (OpenAI)
- Korekta: `gpt-4o`

**Diagnostyka:**

- Status yt-dlp
- Status Whisper API
- Ostatnia transkrypcja

### Document Processing

**Cel:** Przetwarzanie uploadowanych plików

**Typy:**

- PDF (text + OCR)
- DOCX
- Obrazy (OCR)
- Tekst

**Pipeline:**

1. **Upload** - przyjęcie pliku
2. **Type Detection** - rozpoznanie typu
3. **Text Extraction** - odpowiednia metoda
4. **Embedding** - generowanie wektorów
5. **RAG Storage** - zapis do bazy

**Diagnostyka:**

- Liczba przetworzonych plików
- Typy plików
- Błędy przetwarzania

## Metryki Sukcesu

- ✅ Tylko OpenAI API protocol
- ✅ Brak skanowania modeli
- ✅ Zarządzanie modelami embedding i transkrypcji
- ✅ Diagnostyka wszystkich systemów AI
- ✅ Wizualne kontrolki statusu w UI
- ✅ Dokumentacja zaktualizowana
