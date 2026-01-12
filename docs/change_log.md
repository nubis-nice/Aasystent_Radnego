# Change Log

## 2026-01-12 - Naprawa duplikacji dokumentów w odpowiedziach AI

### Problem: AI pokazuje duplikaty dokumentów w liście wyników

**Problem:** Gdy użytkownik szuka dokumentów, AI pokazywał duplikaty z identycznymi tytułami (np. "Sesja Nr XVI" dwa razy), co było mylące i nieczytelne.

**Rozwiązanie:**

1. **Deduplikacja po tytule** - `document-query-service.ts`:

   - Rozszerzono `deduplicateMatches()` o deduplikację po znormalizowanym tytule
   - Logowanie usuwanych duplikatów

2. **Zaktualizowany system prompt** - `packages/shared/src/types/chat.ts`:

   - Dodano sekcję "PREZENTACJA DOKUMENTÓW"
   - Instrukcje: nigdy nie pokazuj duplikatów, rozróżniaj przez numer/datę/typ

3. **Lepsze formatowanie listy** - `buildConfirmationMessage()`:
   - Każdy dokument ma unikalny identyfikator (data, numer, ID)
   - Pokazuje do 5 dokumentów z informacją o pozostałych
   - Formatowanie Markdown (bold dla tytułów)

**Pliki:**

- `apps/api/src/services/document-query-service.ts`
- `packages/shared/src/types/chat.ts`

**Status:** ✅ Naprawione

---

## 2026-01-12 - Naprawa hardkodowanych modeli Vision w defaults.ts

### Problem: Hardkodowane modele vision w domyślnych konfiguracjach

**Problem:** W pliku `defaults.ts` były hardkodowane modele vision:

- OpenAI: `gpt-4-vision-preview` (przestarzały model)
- Ollama: `llava` (bez możliwości konfiguracji)

**Rozwiązanie:** Zamiana na zmienne środowiskowe z fallbackami.

#### Naprawione pliki

| Plik                              | Zmiana                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `ai/defaults.ts`                  | OpenAI Vision: `gpt-4-vision-preview` → `process.env.OPENAI_VISION_MODEL \|\| "gpt-4o"`   |
| `ai/defaults.ts`                  | Ollama Vision: `llava` → `process.env.OLLAMA_VISION_MODEL \|\| "llava"`                   |
| `ai/ai-config-resolver.ts`        | Fallback vision: `gpt-4-vision-preview` → `process.env.OPENAI_VISION_MODEL \|\| "gpt-4o"` |
| `services/scraper.ts`             | LLM model: hardcoded → `process.env.OPENAI_MODEL \|\| "gpt-4o-mini"`                      |
| `services/intelligent-scraper.ts` | Dodano pole `llmModel` z dynamiczną konfiguracją                                          |

**Status:** ✅ Naprawione

---

## 2026-01-12 - Zwiększone timeouty dla requestów

### Problem: TimeoutError "signal timed out" w Next.js

**Rozwiązanie:** Zwiększono timeouty w `lib/api/chat.ts`:

- `/api/chat/message`: 30s → 180s (3 minuty dla odpowiedzi LLM)
- DELETE conversation: 10s → 60s

**Status:** ✅ Naprawione

---

## 2026-01-12 - Szacowany czas zakończenia transkrypcji

### Nowa funkcjonalność: ETA dla zadań transkrypcji YouTube

**Zmiana:** Panel zadań transkrypcji (`YouTubeTranscriptionPage`) wyświetla teraz szacowany pozostały czas (np. `~5 min`, `~1h 23min`) obliczany na podstawie postępu i czasu od rozpoczęcia.

**Plik:** `apps/frontend/src/app/documents/youtube/page.tsx`

**Status:** ✅ Zaimplementowane

---

## 2026-01-11 - Naprawa hardkodowanych modeli AI

### Problem: Hardkodowane nazwy modeli w pipeline OCR/Vision/LLM

**Problem:** W 7 miejscach kodu były hardkodowane nazwy modeli OpenAI (`gpt-4o`, `gpt-4o-mini`) zamiast używania konfiguracji użytkownika. Powodowało to błąd `404 model 'gpt-4o' not found` gdy użytkownik korzystał z Ollama local.

**Rozwiązanie:** Dodanie pól przechowujących nazwy modeli i użycie ich zamiast hardkodowanych stringów.

#### Naprawione pliki

| Plik                             | Zmiany                                     |
| -------------------------------- | ------------------------------------------ |
| `document-processor.ts`          | Dodano `visionModel`, naprawiono 2 miejsca |
| `youtube-downloader.ts`          | Dodano `llmModel`, naprawiono 2 miejsca    |
| `transcription-job-service.ts`   | Dodano `llmModel`, naprawiono 1 miejsce    |
| `audio-transcriber.ts`           | Dodano `llmModel`, naprawiono 1 miejsce    |
| `semantic-document-discovery.ts` | Dodano `llmModel`, naprawiono 1 miejsce    |

#### Dodatkowe naprawy

- **Test Vision dla Ollama** - zmieniono na test tekstowy (bezpieczny) zamiast obrazowego
- **Filtrowanie modeli wizyjnych** - dodano rozpoznawanie modeli Ollama (llava, qwen-vl, moondream, etc.)

**Status:** ✅ Naprawione

---

## 2026-01-11 - Historia Przetworzonych Dokumentów

### Nowa funkcjonalność: Zarządzanie historią dokumentów OCR i transkrypcji

**Problem:** Użytkownik nie miał dostępu do historii przetworzonych dokumentów, nie mógł przeglądać, formatować ani analizować sentymentu już przetworzonych plików.

**Rozwiązanie:** Nowa strona historii dokumentów z pełnym zarządzaniem.

#### Nowe pliki

- `apps/frontend/src/app/documents/process/history/page.tsx` - Strona historii dokumentów
- `apps/frontend/src/lib/api/document-processing.ts` - API client
- `apps/api/src/services/document-processing-job-service.ts` - Serwis asynchronicznego przetwarzania

#### Rozszerzone pliki

- `apps/api/src/routes/documents.ts` - Nowe endpointy API
- `apps/frontend/src/app/documents/page.tsx` - Link do historii

#### Funkcjonalności strony historii

- **Lista dokumentów** - przeglądanie wszystkich przetworzonych dokumentów
- **Filtrowanie** - po typie (OCR/transkrypcja), wyszukiwanie tekstowe
- **Sortowanie** - najnowsze/najstarsze
- **Podgląd dokumentu** - panel z pełną treścią i metadanymi
- **Eksport MD** - pobieranie sformatowanego dokumentu
- **Analiza sentymentu** - dla transkrypcji (LLM)
- **Dodanie do RAG** - automatyczne lub ręczne
- **Usuwanie** - z potwierdzeniem

#### Nowe endpointy API

- `GET /api/documents/processed` - lista przetworzonych dokumentów
- `GET /api/documents/processed/:id` - szczegóły dokumentu
- `DELETE /api/documents/processed/:id` - usunięcie dokumentu
- `POST /api/documents/processed/:id/analyze-sentiment` - analiza sentymentu
- `POST /api/documents/processed/:id/format` - profesjonalne formatowanie
- `GET /api/documents/jobs` - lista zadań przetwarzania
- `POST /api/documents/process-async` - asynchroniczne przetwarzanie

#### Asynchroniczne przetwarzanie

- Upload pliku z opcjami (sentyment, RAG, formatowanie)
- Przetwarzanie w tle z progress bar
- Automatyczny zapis do RAG (domyślnie włączony)
- Panel zadań z statusem i postępem

**Status:** ✅ Zaimplementowane

---

## 2026-01-11 - Adaptacyjny Normalizer Audio dla STT

### Nowa funkcjonalność: Inteligentna analiza i preprocessing audio przed transkrypcją

**Problem:** Nagrania z sesji rady mają różną jakość - różni mówcy, różne odległości od mikrofonu, szumy z sali, dudnienia. To wpływa negatywnie na jakość transkrypcji.

**Rozwiązanie:** Adaptacyjny pipeline audio z automatyczną analizą i doborem parametrów filtrów FFmpeg.

#### Nowe pliki

- `apps/api/src/services/audio-analyzer.ts` - Analiza parametrów audio (ffprobe + loudnorm)

#### Rozszerzone pliki

- `apps/api/src/services/audio-preprocessor.ts` - Nowa metoda `preprocessAdaptive()`
- `apps/api/src/services/youtube-downloader.ts` - Integracja preprocessingu
- `apps/api/src/services/transcription-job-service.ts` - Status "preprocessing"

#### AudioAnalyzer - Analiza audio

**Zbierane metryki:**

- `meanVolume` / `maxVolume` - głośność (dB)
- `integratedLoudness` - głośność EBU R128 (LUFS)
- `loudnessRange` - zakres dynamiki (LU)
- `truePeak` - szczytowa głośność (dBTP)
- `dynamicRange` - różnica max-mean

**Wykrywane problemy:**

- `too_quiet` - zbyt cichy sygnał
- `too_loud` / `clipping` - przesterowanie
- `high_dynamic_range` - duże różnice głośności (różni mówcy)
- `noise` - szum tła
- `low_quality` - niska jakość źródła

#### Adaptacyjny Pipeline FFmpeg

**Filtry (w kolejności):**

1. **Gain boost** - wzmocnienie dla cichych nagrań
2. **Highpass** (80-120 Hz) - usuwa dudnienia z sali
3. **Lowpass** (8-12 kHz) - usuwa szumy wysokoczęstotliwościowe
4. **AFFTDN** - adaptacyjna redukcja szumów FFT
5. **Equalizer** - wzmocnienie pasma mowy (350Hz, 2.5kHz, 5kHz)
6. **De-esser** - redukcja sybilantów (s, sz, ć)
7. **Compressor** - wyrównanie dynamiki
8. **Loudnorm** - normalizacja EBU R128 do -16 LUFS
9. **Resample** - 16kHz mono (optymalny dla Whisper)

#### Adaptacja parametrów

| Wykryty problem      | Akcja                             |
| -------------------- | --------------------------------- |
| `too_quiet`          | Gain boost +10-20dB               |
| `high_dynamic_range` | Kompresja ratio 5-6:1             |
| `noise`              | Noise floor -20dB, highpass 120Hz |
| `clipping`           | Brak gain, wcześniejsza kompresja |
| `low_quality`        | Lowpass 8kHz, bez de-esser        |

#### Integracja

Preprocessing jest automatycznie włączony w `transcribeAndAnalyze()`:

```typescript
const result = await downloader.transcribeAndAnalyze(
  audioPath,
  videoId,
  videoTitle,
  videoUrl,
  true // enablePreprocessing
);
```

Wynik zawiera `audioAnalysis` z wykrytymi problemami i zastosowanymi filtrami.

**Status:** ✅ Zaimplementowane

---

## 2026-01-11 - Asynchroniczna Transkrypcja YouTube z Zapisem do RAG

### Nowa funkcjonalność: Przetwarzanie transkrypcji w tle z automatycznym zapisem do bazy wiedzy

**Problem:** Podczas transkrypcji filmów YouTube użytkownik musiał czekać na zakończenie procesu i nie mógł wykonywać innych czynności. Transkrypcje nie były automatycznie zapisywane do bazy RAG.

**Rozwiązanie:** Asynchroniczny system transkrypcji z:

- Przetwarzaniem w tle (użytkownik może kontynuować pracę)
- Automatycznym zapisem do RAG w kategorii "transkrypcje"
- Identyfikacją mówców po imieniu i nazwisku
- Profesjonalnym formatowaniem dokumentu z ekspresją i sentymentem
- Powiązaniem z Sesjami Rady

#### Backend - TranscriptionJobService (`transcription-job-service.ts`):

**Funkcje:**

- `createJob()` - tworzy zadanie transkrypcji i uruchamia asynchronicznie
- `getJob()` - pobiera status zadania
- `getUserJobs()` - lista zadań użytkownika
- `processJob()` - główna logika przetwarzania (download → transcribe → analyze → save)

**Identyfikacja mówców:**

- Pobiera listę radnych z bazy `council_members`
- Używa LLM do identyfikacji mówców na podstawie kontekstu wypowiedzi
- Rozpoznaje: Przewodniczący, Burmistrz, Skarbnik, Sekretarz, Radni

**Formatowanie dokumentu:**

- Profesjonalny protokół z sesji w Markdown
- Sekcje: Podsumowanie, Uczestnicy, Przebieg sesji, Pełna transkrypcja
- Ekspresja: emoji dla emocji, wskaźniki napięcia (🔥⚡)
- Metryki: napięcie, wiarygodność dla ważnych wypowiedzi

**Zapis do RAG:**

- Kategoria: `transkrypcja`
- Embedding dla wyszukiwania semantycznego
- Metadata: sessionId, duration, speakerCount, sentiment, speakers
- Słowa kluczowe: uchwała, budżet, głosowanie, komisja, etc.

#### Nowe endpointy API (`youtube.ts`):

- `POST /api/youtube/transcribe-async` - rozpoczyna asynchroniczną transkrypcję
- `GET /api/youtube/job/:jobId` - status zadania
- `GET /api/youtube/jobs` - lista zadań użytkownika

#### Frontend - YouTubeTranscriptionPage:

**Nowe opcje transkrypcji:**

- 🚀 Tryb asynchroniczny (zalecany) - przetwarzanie w tle
- 👤 Identyfikacja mówców - rozpoznawanie radnych
- 🎭 Analiza sentymentu - emocje i napięcie

**Panel zadań:**

- Wyświetla aktywne i zakończone zadania
- Progress bar z etapami: Pobieranie → Transkrypcja → Analiza → Zapisywanie
- Status: ✅ Zakończone, ❌ Błąd, ⏳ W trakcie
- Polling co 3 sekundy dla aktywnych zadań

#### Nowe pliki:

- `apps/api/src/services/transcription-job-service.ts` - serwis asynchronicznych zadań
- Rozszerzenie `apps/api/src/routes/youtube.ts` - nowe endpointy
- Rozszerzenie `apps/frontend/src/lib/api/youtube-sessions.ts` - funkcje API
- Rozszerzenie `apps/frontend/src/app/documents/youtube/page.tsx` - nowy UI

**Status:** ✅ Zaimplementowane

---

## 2026-01-11 - Naprawa ConfigurationModal i zapisu do bazy

### Naprawione błędy:

1. **Zapis embedding_model i transcription_model do bazy** - dodano brakujące pola do funkcji `createApiConfiguration` i `updateApiConfiguration`
2. **Nowy profesjonalny AIConfigurationModal** - przeprojektowany modal z zakładkami dla każdej funkcji AI (LLM, Embeddings, Vision, STT, TTS)
3. **Naprawiono hardcoded modele embedding** w serwisach:
   - `semantic-document-discovery.ts`
   - `document-analysis-service.ts`
   - `document-query-service.ts`
   - `legal-search-api.ts`
   - `document-processor.ts`
   - `intelligent-scraper.ts`
   - `chat.ts`
4. **Naprawiono logikę RAG w chat.ts** - teraz używa `getEmbeddingsClient()` z `AIClientFactory`

### Nowe pliki:

- `apps/frontend/src/components/providers/AIConfigurationModal.tsx` - nowy profesjonalny modal konfiguracji
- `apps/frontend/src/components/providers/AIConnectionTester.tsx` - komponent do testowania każdej funkcji AI osobno
- `apps/api/migrations/004_add_missing_columns_api_configurations.sql` - migracja dodająca brakujące kolumny

### Nowe endpointy API:

- `POST /api/test/function` - testuje pojedynczą funkcję AI (LLM, Embeddings, Vision, STT, TTS) z podaną konfiguracją

### Zaktualizowane interfejsy:

- `ApiConfiguration` - dodano `embedding_model` i `transcription_model`
- `ApiConfigurationInput` - dodano `vision_model`
- `ApiConfigurationUpdate` - dodano `embedding_model` i `transcription_model`

---

## 2026-01-11 - Kontynuacja Refaktoringu Providerów AI

### Zmigrowane serwisy do nowej architektury AIClientFactory:

| Serwis                           | Status | Klienty AI                                    |
| -------------------------------- | ------ | --------------------------------------------- |
| `youtube-downloader.ts`          | ✅     | `getSTTClient`, `getLLMClient`                |
| `audio-transcriber.ts`           | ✅     | `getSTTClient`, `getLLMClient`                |
| `document-processor.ts`          | ✅     | `getVisionClient`, `getEmbeddingsClient`      |
| `intelligent-scraper.ts`         | ✅     | `getLLMClient`, `getEmbeddingsClient`         |
| `deep-research-service.ts`       | ✅     | `getLLMClient`                                |
| `document-analysis-service.ts`   | ✅     | `getLLMClient`, `getEmbeddingsClient`         |
| `semantic-document-discovery.ts` | ✅     | `getLLMClient`, `getEmbeddingsClient`         |
| `youtube-session-service.ts`     | ✅     | `getLLMClient`                                |
| `budget-analysis-engine.ts`      | ✅     | `getLLMClient`                                |
| `legal-reasoning-engine.ts`      | ✅     | `getLLMClient`                                |
| `legal-search-api.ts`            | ✅     | `getEmbeddingsClient`                         |
| `document-query-service.ts`      | ✅     | `getEmbeddingsClient`                         |
| `chat.ts`                        | ⚠️     | Przywrócono oryginalną wersję z `@ts-nocheck` |

### Nowe pliki pomocnicze:

- `apps/api/src/ai/chat-helpers.ts` - Bridge dla chat.ts

### Statystyki refaktoringu:

- **11 serwisów** w pełni zmigrowanych
- **1 serwis** (chat.ts) z tymczasowym obejściem
- Usunięto ~500 linii zduplikowanego kodu konfiguracji API
- Centralizacja w `AIClientFactory` z cache'owaniem (5 min TTL)

---

## 2026-01-11 - Refaktoring Architektury Providerów AI

### Nowa funkcjonalność: Centralna fabryka klientów AI z presetami

**Problem:** 19 serwisów miało zduplikowaną logikę konfiguracji OpenAI (~50 linii kodu każdy), niespójne obsługi providerów (Ollama, OpenAI), brak rozdzielenia funkcji AI (LLM, Embeddings, STT, TTS, Vision).

**Rozwiązanie:** Nowa architektura `apps/api/src/ai/` z centralną fabryką klientów:

#### Nowa struktura katalogów:

```
apps/api/src/ai/
├── index.ts                    # Eksport publiczny
├── types.ts                    # Typy i interfejsy
├── defaults.ts                 # Presety konfiguracji
├── ai-config-resolver.ts       # Resolver konfiguracji z cache
└── ai-client-factory.ts        # Fabryka klientów AI (singleton)
```

#### Presety konfiguracji (defaults.ts):

- **OpenAI** - pełna konfiguracja OpenAI API (LLM, Embeddings, Vision, STT, TTS)
- **Ollama (Local)** - lokalne modele + faster-whisper-server dla STT
- **Custom** - dowolny endpoint z wyborem protokołu API

#### 5 niezależnych funkcji AI:

| Funkcja    | Opis                | OpenAI                 | Ollama                |
| ---------- | ------------------- | ---------------------- | --------------------- |
| LLM        | Chat/completions    | gpt-4-turbo            | llama3.2              |
| Embeddings | Wektory semantyczne | text-embedding-3-small | nomic-embed-text      |
| Vision     | Analiza obrazów     | gpt-4-vision           | llava                 |
| STT        | Speech-to-Text      | whisper-1              | faster-whisper-medium |
| TTS        | Text-to-Speech      | tts-1                  | piper                 |

#### AIClientFactory - użycie:

```typescript
// PRZED (50 linii w każdym serwisie):
const { data: config } = await supabase.from("api_configurations")...
const decodedApiKey = Buffer.from(config.api_key_encrypted, "base64")...
this.openai = new OpenAI({ apiKey, baseURL });

// PO (1 linia):
const sttClient = await getSTTClient(userId);
```

#### Migracja bazy danych:

- `docs/supabase_migrations/020_create_ai_configurations.sql`
- Nowe tabele: `ai_configurations`, `ai_providers`
- RLS policies dla bezpieczeństwa
- Trigger dla jednej domyślnej konfiguracji per użytkownik

#### Zmigrowane serwisy:

- `youtube-downloader.ts` - używa `getSTTClient()` i `getLLMClient()`

**Nowe pliki:**

- `apps/api/src/ai/types.ts`
- `apps/api/src/ai/defaults.ts`
- `apps/api/src/ai/ai-config-resolver.ts`
- `apps/api/src/ai/ai-client-factory.ts`
- `apps/api/src/ai/index.ts`
- `docs/supabase_migrations/020_create_ai_configurations.sql`
- `docs/ai_provider_refactoring_plan.md`

**Zaktualizowane pliki:**

- `apps/api/src/services/youtube-downloader.ts` - refaktoring do nowej architektury
- `docs/architecture.md` - sekcja 7 o providerach AI
- `docs/todo.md` - sekcja o refaktoringu

**Korzyści:**

- Centralizacja konfiguracji AI
- Cache klientów (5 min TTL)
- Niezależna konfiguracja każdej funkcji AI
- Fallback do zmiennych środowiskowych
- Kompatybilność wsteczna ze starą tabelą `api_configurations`

**Status:** ✅ Infrastruktura zaimplementowana, youtube-downloader zmigrowany

---

## 2026-01-11 - Inteligentne Wykrywanie Dokumentów w Chacie

### Nowa funkcjonalność: DocumentQueryService - wykrywanie dokumentów bez przekazywania pełnej treści

**Problem:** Przy analizie dokumentu cała treść + załączników była przekazywana do LLM jako prompt, powodując przekroczenie limitu tokenów.

**Rozwiązanie:** Nowy przepływ analizy dokumentów:

#### Nowy przepływ:

```
1. Użytkownik pisze wiadomość z ID/nazwą dokumentu
2. DocumentQueryService wykrywa referencje (UUID, druk, uchwała, protokół, sesja)
3. Szukaj w RAG (processed_documents)
4. Jeśli znaleziono → "Znalazłem dokument X. Analizować?" (potwierdzenie)
5. Jeśli TAK → pobierz CHUNKI (nie pełną treść!) + relacje z Document Graph
6. Jeśli NIE → fallback do intelligent scraping → Exa semantic search
```

#### DocumentQueryService (`document-query-service.ts`):

**Wykrywane referencje:**

- UUID (ID dokumentu): `a1b2c3d4-e5f6-...`
- Druki: `druk nr 109`, `(druk 110)`
- Uchwały: `uchwała XV/123/2024`
- Protokoły: `protokół z sesji XIV`
- Sesje: `sesja nr 15`, `XV sesja`
- Nazwy w cudzysłowach: `"Porządek obrad..."`

**Metody wyszukiwania:**

- `findDocumentById()` - dokładne dopasowanie po UUID
- `findDocumentsByTitle()` - fulltext search po tytule
- `findDocumentsSemantic()` - semantic search z embeddings

**Kontekst dokumentu (bez pełnej treści!):**

- `relevantChunks` - tylko relevantne fragmenty (max 5 chunków × 1000 znaków)
- `relatedDocuments` - powiązane dokumenty z Document Graph
- `attachments` - załączniki z relacji

#### Integracja z chat.ts:

**Przed (problem):**

```typescript
// Cała treść dokumentu przekazywana do LLM
content: mainDocument.content; // 50000+ znaków = 20000+ tokenów
```

**Po (rozwiązanie):**

```typescript
// Tylko relevantne chunki
content: documentContext.relevantChunks.map((c) => c.content).join("\n\n");
// Max 5000 znaków = ~2000 tokenów
```

**Nowe pliki:**

- `apps/api/src/services/document-query-service.ts`

**Zmienione pliki:**

- `apps/api/src/routes/chat.ts` - integracja DocumentQueryService

**Szacowane oszczędności:**

- Redukcja tokenów kontekstu: 80-90% (z 20000 do 2000 tokenów)
- Eliminacja błędów "context length exceeded"

**Status:** ✅ Zaimplementowane

---

## 2026-01-11 - System Kompresji Kontekstu AI i Batch Embeddings

### Nowa funkcjonalność: Optymalizacja kosztów tokenów AI

**Problem:** Wysokie koszty tokenów AI przy długich konwersacjach i dużych dokumentach RAG.

**Rozwiązanie:** Dwupoziomowy system optymalizacji:

#### 1. Context Compressor (`context-compressor.ts`)

**Funkcje:**

- **Estymacja tokenów** - bez zewnętrznych bibliotek (~2.5 znaku/token dla polskiego)
- **Kompresja dokumentów RAG** - sortowanie wg relevance, skracanie z zachowaniem struktury
- **Summaryzacja historii** - ostatnie 4 wiadomości w pełni, starsze → podsumowanie
- **Limity modeli** - automatyczne dostosowanie do gpt-4o (128k), gpt-4 (8k), claude (200k)

**Budżet tokenów:**

- System prompt: stały
- RAG context: 65% elastycznego budżetu
- Historia: 35% elastycznego budżetu
- Twardy limit: 6000 tokenów dla bezpieczeństwa

**Logi oszczędności:**

```
[Chat] Context optimization: {
  originalTokens: 15420,
  compressedTokens: 6200,
  savedTokens: 9220,
  savingsPercent: "60%"
}
```

#### 2. Batch Embedding Service (`batch-embedding-service.ts`)

**OpenAI Batch API - 50% taniej:**

- Asynchroniczne przetwarzanie (do 24h, zazwyczaj szybciej)
- Osobna pula rate limits
- Max 50,000 requestów/batch, 300,000 tokenów sumowanych

**Użycie:**

- ✅ Przetwarzanie dokumentów (worker)
- ✅ Indeksowanie źródeł danych
- ✅ Re-embedding przy zmianie modelu
- ❌ Chat w czasie rzeczywistym (sync API)

**API:**

```typescript
const batchService = new BatchEmbeddingService(apiKey);
const batchId = await batchService.createBatchJob(requests);
const results = await batchService.waitForCompletion(batchId);
```

#### 3. Batch Embedding dla długich wiadomości (chat.ts)

**Problem:** Wiadomość użytkownika > 8192 tokenów powodowała błąd embeddingu.

**Rozwiązanie:** `generateBatchEmbedding()`:

- Dzieli tekst na chunki (18000 znaków) z overlap (500 znaków)
- Batch API dla wszystkich chunków jednocześnie
- Agregacja: średnia ważona wektorów + normalizacja L2

**Nowe pliki:**

- `apps/api/src/services/context-compressor.ts`
- `apps/api/src/services/batch-embedding-service.ts`

**Zmienione pliki:**

- `apps/api/src/routes/chat.ts` - integracja kompresji i batch embeddingu

**Szacowane oszczędności:**

- Kompresja kontekstu: 40-60% tokenów
- Batch API dla dokumentów: 50% kosztów embeddingów

**Status:** ✅ Zaimplementowane

---

## 2026-01-11 - Naprawa PDF Processing

### Naprawa błędu wersji pdfjs-dist

**Problem:** `The API version "5.4.530" does not match the Worker version "5.4.296"`

**Przyczyna:** Konflikt wersji między `pdf-parse` (5.4.296) i `pdf-to-png-converter` (5.4.530).

**Rozwiązanie:** Dodano `overrides` w `package.json`:

```json
"overrides": {
  "pdfjs-dist": "5.4.530"
}
```

### Naprawa OCR z Tesseract.js + Sharp

**Implementacja adaptacyjnej normalizacji obrazów:**

- Analiza statystyk obrazu (brightness, contrast, sharpness, noise)
- Dynamiczne dostosowanie parametrów Sharp
- Fallback do GPT-4 Vision przy niskiej jakości OCR

**Status:** ✅ Zaimplementowane

---

## 2026-01-10 - Graf Powiązań Dokumentów (Document Graph)

### Nowa funkcjonalność: System relacji między dokumentami

**Problem:** Brak możliwości śledzenia powiązań między dokumentami (referencje, nowelizacje, załączniki).

**Rozwiązanie:** Graf dokumentów w PostgreSQL (alternatywa dla Apache AGE):

**Typy relacji:**

- `references` - dokument referencjonuje inny (druk, uchwała)
- `amends` - nowelizacja dokumentu
- `supersedes` - zastąpienie dokumentu
- `implements` - implementacja (uchwała wykonawcza)
- `contains` - zawieranie (sesja → protokół)
- `attachment` - załącznik
- `related` - ogólne powiązanie
- `responds_to` - odpowiedź
- `derived_from` - pochodny

**Funkcje SQL:**

- `get_related_documents(id, depth, strength)` - BFS traversal grafu
- `find_document_path(source, target)` - najkrótsza ścieżka
- `detect_document_references(id)` - automatyczne wykrywanie referencji

**API Endpoints:**

- `GET /api/documents/:id/related` - powiązane dokumenty
- `GET /api/documents/:id/relations` - bezpośrednie relacje
- `GET /api/documents/path?source=&target=` - ścieżka między dokumentami
- `POST /api/documents/:id/detect-references` - wykryj referencje
- `POST /api/documents/:id/relations` - dodaj relację
- `GET /api/documents/graph/stats` - statystyki grafu

**Nowe pliki:**

- `apps/api/migrations/023_document_graph_relations.sql`
- `apps/api/src/services/document-graph-service.ts`
- `apps/api/src/routes/document-graph.ts`

---

## 2026-01-10 - Zaawansowane Grupowanie Dokumentów

### Nowa funkcjonalność: Kaskadowe grupowanie i schematy wyświetlania

**Problem:** Dokumenty były wyświetlane jako płaska lista bez logicznego grupowania.

**Rozwiązanie:** System zaawansowanego grupowania dokumentów:

**5 schematów grupowania:**

- **Płaska lista** - tradycyjny widok bez grupowania
- **Kaskadowe (Sesje/Komisje)** - hierarchia: Sesje Rady > Komisje > Inne dokumenty
- **Według typu** - grupowanie: Uchwały, Protokoły, Aktualności, etc.
- **Według daty** - grupowanie miesięczne
- **Powiązane dokumenty** - grupowanie na podstawie referencji w treści

**Automatyczne wykrywanie:**

- Sesje Rady z numerem (rzymski/arabski)
- Nazwy komisji
- Referencje do druków, uchwał, protokołów

**UI:**

- Rozwijane/zwijane grupy
- Zliczanie dokumentów w grupach
- Zapisywanie domyślnego schematu w preferencjach użytkownika

**Nowe pliki:**

- `apps/frontend/src/lib/documents/grouping.ts` - logika grupowania
- `apps/frontend/src/components/documents/DocumentGroupView.tsx` - komponent UI
- `apps/api/migrations/022_add_grouping_scheme_preference.sql` - migracja bazy

**Zmienione pliki:**

- `apps/frontend/src/app/documents/page.tsx` - integracja grupowania

---

## 2026-01-10 - Profesjonalna Analiza Dokumentów z RAG

### Nowa funkcjonalność: Pełna analiza dokumentów z kontekstem RAG i Deep Research

**Problem:** Poprzednia metoda analizy przekazywała tylko podstawowy prompt bez kontekstu druków i załączników.

**Rozwiązanie:** Nowy system profesjonalnej analizy dokumentów:

**Backend - DocumentAnalysisService:**

- `DocumentAnalysisService` - nowy serwis analizy dokumentów
- Automatyczne wykrywanie referencji (druki, załączniki, uchwały, protokoły)
- Wyszukiwanie referencji w RAG (baza wiedzy)
- Integracja z Deep Research dla brakujących druków
- Generowanie profesjonalnego promptu analizy

**Wykrywane referencje:**

- Druki: `(druk nr 109)`, `druki nr 109, 110, 111`
- Uchwały: `uchwała XV/123/2024`
- Załączniki: `załącznik nr 1`
- Protokoły: `protokół z sesji XIV`
- Pliki PDF: `(PDF, 192.29Kb)`

**Flow analizy:**

1. Pobierz dokument z RAG po ID
2. Wyodrębnij referencje z treści (regex)
3. Szukaj referencji w RAG (semantic search)
4. Jeśli brakuje - szukaj przez Deep Research (internet)
5. Zbuduj pełny kontekst z treścią znalezionych druków
6. Generuj profesjonalny prompt z system promptem

**Frontend - powiadomienia w chacie:**

- Wyświetlanie informacji o znalezionych/brakujących drukach
- Profesjonalne formatowanie powiadomienia
- Automatyczne wysyłanie promptu analizy

**Nowe pliki:**

- `apps/api/src/services/document-analysis-service.ts`

**Zmienione pliki:**

- `apps/api/src/routes/documents.ts` - nowy endpoint analyze
- `apps/frontend/src/app/documents/page.tsx` - handleAnalyze
- `apps/frontend/src/app/chat/page.tsx` - obsługa analizy
- `apps/frontend/src/lib/api/documents-list.ts` - typy

**Status:** ✅ Zaimplementowane

---

## 2026-01-10 - Inteligentny System Dokumentów v2

### Nowa funkcjonalność: Scoring, kolorystyka, analiza AI, zaawansowane filtry

**Backend - Scoring dokumentów:**

- `DocumentScorer` - serwis algorytmu ważności dokumentów
- Scoring wielowymiarowy: typeScore, relevanceScore, urgencyScore, recencyScore
- Priorytetyzacja: critical (🔴), high (🟠), medium (🔵), low (⚪)
- Słowa kluczowe radnego: sesja, uchwała, budżet, komisja, głosowanie
- Bonus za nadchodzące sesje (< 7 dni: +30 pkt)

**Backend - Endpoint analizy:**

- `POST /api/documents/:id/analyze` - analiza przez reasoning engine
- Generuje prompt analizy dla AI
- Zwraca kontekst do przekierowania do chatu

**Frontend - Kolorystyka według priorytetu:**

- Karty dokumentów z tłem kolorowym według ważności
- Pasek priorytetu na górze karty
- Badge ze score (punkty)
- Przycisk "Analizuj" → przekierowanie do chatu AI

**Frontend - Zaawansowane filtry:**

- Filtr priorytetu (critical/high/medium/low)
- Sortowanie: wg ważności, daty, nazwy
- Zakres dat: tydzień/miesiąc/rok
- Aktywne filtry jako chipy z możliwością usunięcia
- Lepsza kolorystyka (gradient slate)

**Frontend - Strona upload dokumentów:**

- `/documents/upload` - drag & drop upload
- Obsługa: PDF, DOCX, JPG, PNG, WEBP, TXT, MD
- Progress upload z wizualizacją
- Automatyczne OCR dla skanów
- Zapis do RAG z wyborem typu dokumentu

**Nowe pliki:**

- `apps/api/src/services/document-scorer.ts`
- `apps/frontend/src/app/documents/upload/page.tsx`

**Zmienione pliki:**

- `apps/api/src/routes/documents.ts` - nowe endpointy
- `apps/frontend/src/app/documents/page.tsx` - nowy UI
- `apps/frontend/src/lib/api/documents-list.ts` - rozszerzone typy

**Status:** ✅ Zaimplementowane

---

## 2026-01-10 - OCR dla skanowanych PDF

### Naprawa przetwarzania PDF bez warstwy tekstowej

**Problem:** PDF-y zawierające tylko skany (obrazy) nie były prawidłowo odczytywane.

**Rozwiązanie:**

- Dodano `pdf-to-png-converter` do konwersji stron PDF na obrazy
- `processPDFWithOCR` konwertuje każdą stronę na PNG
- Obrazy wysyłane do GPT-4 Vision dla OCR
- Automatyczna detekcja: tekst < 100 znaków → OCR

**Flow przetwarzania:**

1. Próba ekstrakcji tekstu przez pdf-parse
2. Jeśli tekst < 100 znaków → uznaj za skan
3. Konwersja PDF → PNG (viewportScale: 2.0)
4. OCR każdej strony przez GPT-4 Vision
5. Połączenie tekstu ze wszystkich stron

**Nowe zależności:**

- `pdf-to-png-converter` - konwersja PDF na obrazy

**Status:** ✅ Zaimplementowane

---

## 2026-01-10 - Narzędzie YouTube Sesje Rady

### Nowa funkcjonalność: Przeglądanie i transkrypcja sesji rady z YouTube

**Implementacja:**

- `YouTubeSessionService` - serwis do scrapowania listy wideo z kanału YouTube
- `YouTubeSessionTool` - komponent React do wyboru sesji
- Endpoint API `GET /api/youtube/sessions` - pobieranie listy sesji
- Przycisk YouTube w pasku wejściowym ChatPage

**Funkcje:**

- Scraping listy filmów z kanału YouTube Rady
- Filtrowanie tylko sesji (słowa kluczowe: sesja, rada, obrady)
- Wyświetlanie miniaturek, tytułów, dat i czasów trwania
- Wybór sesji do transkrypcji
- Instrukcje pobierania audio do transkrypcji

**Nowe pliki:**

- `apps/api/src/services/youtube-session-service.ts`
- `apps/api/src/routes/youtube.ts`
- `apps/frontend/src/lib/api/youtube-sessions.ts`
- `apps/frontend/src/components/chat/YouTubeSessionTool.tsx`

**Kanał YouTube:** `https://www.youtube.com/channel/UCte9IfWItqpLBqGYxepOweQ`

**Status:** ✅ Zaimplementowane

---

## 2026-01-10 - Transkrypcja Audio/Video z Analizą Sentymentu

### Nowa funkcjonalność: Zaawansowana transkrypcja

**Implementacja:**

- `DocumentProcessor` rozszerzony o obsługę audio/video
- Transkrypcja przez OpenAI Whisper API
- Analiza sentymentu i detekcja kłamstwa przez GPT-4
- Identyfikacja rozmówców (Speaker 1, 2, 3...)

**Obsługiwane formaty:**

- Audio: MP3, WAV, OGG, M4A, FLAC, AAC
- Video: MP4, WebM, MKV, AVI, MOV
- Max rozmiar: 25 MB (limit Whisper API)

**Funkcje analizy:**

- Sentyment: pozytywny/neutralny/negatywny
- Emocje: 😊😢😠😨🤔
- Napięcie emocjonalne: skala 1-10
- Wiarygodność: % + emoji (✅🟢🟡⚠️🔴)

**Nowe pliki:**

- `apps/api/src/services/audio-transcriber.ts` - serwis transkrypcji
- Rozszerzenie `DocumentUploadButton` o audio/video

**Endpoint API:**

- `POST /api/documents/transcribe` - transkrypcja z analizą

**YouTube jako źródło danych:**

- Dodano YouTube do predefiniowanych źródeł w DataSourcesPage

**Status:** ✅ Zaimplementowane

---

## 2026-01-09 (noc) - Przetwarzanie dokumentów z OCR

### Nowa funkcjonalność: OCR z GPT-4 Vision

**Implementacja:**

- `DocumentProcessor` - serwis przetwarzania dokumentów
- OCR przez GPT-4 Vision (gpt-4o)
- Ekstrakcja tekstu z PDF, DOCX, TXT

**Obsługiwane formaty:**

- Obrazy: JPG, PNG, GIF, BMP, WebP
- Dokumenty: PDF, DOCX, TXT, MD
- Max rozmiar: 10 MB

**Nowe pliki:**

- `apps/api/src/services/document-processor.ts`
- `apps/frontend/src/components/chat/DocumentUploadButton.tsx`
- `apps/frontend/src/lib/api/document-processor.ts`

**Endpoint API:**

- `POST /api/documents/process` - przetwarzanie z OCR
- `POST /api/documents/save-to-rag` - zapis do bazy wiedzy

**Status:** ✅ Zaimplementowane

---

## 2026-01-09 (noc) - Naprawa Scrapera

### Problem: "Crawled 0 documents"

**Przyczyna:** `ScraperDataFetcher` wymagał `scraperConfig` w konstruktorze, ale źródła danych nie miały tej konfiguracji w bazie.

**Rozwiązanie:**

1. Dodano domyślną konfigurację `DEFAULT_SCRAPER_CONFIG` z uniwersalnymi selektorami
2. Zmieniono konstruktor, aby używał domyślnej konfiguracji gdy brak `scraperConfig`
3. Dodano szczegółowe logowanie do diagnozy problemów

**Domyślne selektory:**

- `title`: "h1, h2, .title, .entry-title, .post-title"
- `content`: "article, .content, .entry-content, main, #content, .post-content, body"
- `documentList`: "article, .post, .news-item, .item, li"

**Test:** Scraping https://zgwrp.pl - pobrano 10 dokumentów, przetworzono 10 z embeddingami.

**Zmienione pliki:**

- `apps/api/src/services/data-fetchers/scraper-fetcher.ts`

**Status:** ✅ Scraper działa poprawnie

---

## 2026-01-09 (noc) - Naprawa Dashboard API

### Problem: "Failed to fetch" na Dashboard

**Przyczyny (wielokrotne):**

1. Brakowało endpointu `/api/dashboard/stats` w backendzie API
2. Token autoryzacyjny nie był wysyłany z frontendu
3. CORS blokował requesty z proxy URL

**Rozwiązanie:**

1. Utworzono `apps/api/src/routes/dashboard.ts` z endpointem `/api/dashboard/stats`
2. Zarejestrowano w `apps/api/src/index.ts` jako protected route
3. Usunięto duplikat z `apps/api/src/routes/chat.ts`
4. Naprawiono `apps/frontend/src/lib/api/dashboard.ts` - bezpośredni import supabase
5. Naprawiono `apps/frontend/src/app/dashboard/page.tsx` - przekazywanie tokenu do API
6. Zmieniono CORS na `origin: true` dla development

**Endpoint zwraca:**

- `documentsCount` - liczba dokumentów użytkownika
- `documentsThisWeek` - dokumenty z ostatniego tygodnia
- `conversationsCount` - liczba konwersacji AI
- `messagesCount` - liczba wiadomości
- `recentActivity` - ostatnia aktywność (dokumenty + konwersacje)

**Status:** ✅ Dashboard działa poprawnie

---

## 2026-01-09 (noc) - Audyt Supabase i dokumentacji

### Test stanu migracji Supabase

**Projekt:** `asystent-radnego` (rgcegixkrigqxtiuuial) - ACTIVE_HEALTHY

**Migracje zarejestrowane w systemie (4):**

- `20251226223229_create_profiles_table`
- `20251226234645_create_password_reset_tokens`
- `20251226234650_create_audit_logs`
- `20260109050009_create_chat_schema`

**Tabele w schemacie public (24) - WSZYSTKIE ISTNIEJĄ:**

- `api_configurations` ✅
- `api_test_history` ✅
- `audit_logs` ✅
- `calendar_events` ✅
- `conversations` ✅
- `data_sources` ✅
- `gis_notification_logs` ✅
- `gis_notification_settings` ✅
- `gis_notifications` ✅
- `messages` ✅
- `municipal_data` ✅
- `password_reset_tokens` ✅
- `processed_documents` ✅
- `profiles` ✅
- `provider_capabilities` ✅
- `research_reports` ✅
- `scraped_content` ✅
- `scraping_logs` ✅
- `user_appearance_settings` ✅
- `user_locale_settings` ✅
- `user_notification_settings` ✅
- `user_privacy_settings` ✅
- `user_profiles` ✅
- `user_settings_complete` ✅

**Funkcje semantic search (5) - WSZYSTKIE ISTNIEJĄ:**

- `match_documents` ✅
- `match_documents_filtered` ✅
- `search_municipal_data` ✅
- `search_processed_documents` ✅
- `hybrid_search` ✅

**Funkcje pomocnicze:**

- `calculate_next_scrape` ✅
- `cleanup_expired_tokens` ✅
- `cleanup_old_notifications` ✅
- `cleanup_old_test_history` ✅
- `create_default_api_sources` ✅
- `create_default_data_sources` ✅
- `create_default_notification_settings` ✅
- `create_document_notification` ✅
- `ensure_single_default_api_config` ✅
- `get_unread_notifications` ✅
- `initialize_user_settings` ✅
- `log_user_action` ✅
- `mark_notifications_as_read` ✅
- `update_conversation_timestamp` ✅
- `update_next_scrape_time` ✅
- `update_updated_at_column` ✅
- `validate_api_config` ✅

**Dane w bazie:**

- conversations: 96 wierszy
- api_configurations: 3 wiersze
- mfa_amr_claims: 3 wiersze (auth)
- refresh_tokens: 14 wierszy (auth)

**Wniosek:** Wszystkie migracje z `apps/api/migrations/` zostały już zastosowane bezpośrednio przez SQL Editor w Supabase Dashboard. System jest w pełni gotowy do działania - baza danych jest kompletna.

**Status:** ✅ BAZA DANYCH GOTOWA - nie ma potrzeby uruchamiania migracji.

---

### Audyt kodu i synchronizacja dokumentacji

**Przeprowadzono pełną analizę kodu projektu** i zaktualizowano dokumentację, aby odzwierciedlała rzeczywisty stan implementacji.

**Zaimplementowane moduły (dotychczas nieudokumentowane):**

1. **Deep Internet Researcher** - kompletny system researchu internetowego:

   - `DeepResearchService` - orkiestrator multi-provider
   - Providers: Exa AI, Tavily AI, Serper (Google)
   - Frontend: `/research` z historią raportów
   - API: `/api/research`, `/api/research/history`, `/api/research/:id`
   - Typy: `DeepResearchRequest`, `DeepResearchReport`, `ResearchResult`
   - Migracja: `011_create_research_reports.sql`

2. **Analizy Prawne** - UI dla silników analitycznych:

   - Frontend: `/analysis` z tabami (wyszukiwanie, analiza prawna, budżetowa)
   - Integracja z Legal Search API, Legal Reasoning Engine, Budget Analysis Engine

3. **Worker Jobs** - kompletne joby przetwarzania:

   - `extraction.ts` - ekstrakcja tekstu z PDF/skanów (multimodal LLM)
   - `analysis.ts` - streszczenie + skanowanie ryzyk
   - `relations.ts` - wykrywanie relacji między dokumentami

4. **Research Providers** - adaptery dla zewnętrznych API:
   - `exa-provider.ts` - Exa AI (neural search)
   - `tavily-provider.ts` - Tavily AI (advanced search)
   - `serper-provider.ts` - Serper (Google Search API)

**Zaktualizowane pliki dokumentacji:**

- `docs/todo.md` - oznaczono zaimplementowane funkcje, dodano nowe sekcje
- `docs/architecture.md` - dodano szczegółowy stan implementacji

**Status:** MVP ukończone, system gotowy do testów z prawdziwymi dokumentami.

---

## 2026-01-09 (wieczór)

### Refactoring systemu źródeł danych - architektura API-first (Agent Winsdurf)

**Założenia strategiczne:**
Agent AI "Winsdurf" nie jest chatbotem informacyjnym, lecz agentem analityczno-kontrolnym wspierającym Radnego w:

- Kontroli legalności, zasadności i skutków uchwał
- Wykrywaniu ryzyk prawnych, finansowych i proceduralnych
- Dostarczaniu argumentów i pytań kontrolnych

**Kluczowa zmiana:** System oparty na aktualnych, zewnętrznych źródłach prawa zamiast lokalnego kontekstu MCP.

**Zaimplementowane komponenty:**

1. **Nowa struktura typów** (`packages/shared/src/types/data-sources-api.ts`):

   - `DataSourceType` - typy źródeł (api_isap, api_wsa_nsa, api_rio, scraper_bip, etc.)
   - `ApiClientConfig` - konfiguracja klientów API (auth, pagination, response mapping)
   - `ScraperConfig` - konfiguracja scrapingu (selektory, URL patterns, JavaScript)
   - `DataSourceConfig` - ujednolicona konfiguracja źródeł
   - `FetchedDocument` - struktura pobranych dokumentów z klasyfikacją prawną
   - `LegalSearchQuery/Result` - wyszukiwanie prawne (fulltext, semantic, hybrid)
   - `LegalReasoningRequest/Response` - analiza prawna z ryzykami
   - `BudgetAnalysisRequest/Result` - analiza budżetowa

2. **Adaptery pobierania danych:**

   - `BaseDataFetcher` - bazowa klasa dla wszystkich fetchers
   - `ApiDataFetcher` - uniwersalny klient API (OAuth2, API key, Basic, Bearer)
   - `ScraperDataFetcher` - web scraping z Cheerio
   - `UnifiedDataService` - orkiestrator łączący API i scraping

3. **Migracja bazy danych** (`008_update_data_sources_for_api.sql`):

   - Dodano `fetch_method` (api, scraping, hybrid)
   - Dodano `api_config` (JSONB) dla konfiguracji API clients
   - Dodano `category` (legal, administrative, financial, statistical, other)
   - Dodano `tags`, `priority`, `jurisdiction`, `legal_scope`
   - Dodano flagi przetwarzania: `enable_embeddings`, `enable_classification`, etc.
   - Dodano `cron_expression`, `last_success_at`, `last_error_at`
   - Walidacja konfiguracji przez trigger
   - Domyślne źródła API dla nowych użytkowników (ISAP, Monitor Polski)

4. **Backend API:**

   - Zaktualizowano `/api/data-sources/:id/scrape` - używa `UnifiedDataService`
   - Obsługa zarówno API jak i scrapingu przez jeden endpoint

5. **Frontend:**
   - Rozszerzono modal dodawania źródła o nowe typy:
     - Źródła prawne: ISAP, WSA/NSA, RIO, Dziennik Urzędowy
     - Źródła samorządowe: BIP, strona gminy, portal radnego
     - Inne: statystyki (GUS), niestandardowe
   - Dodano wybór metody pobierania: Scraping, API, Hybrydowa

**Predefiniowane źródła:**

- ISAP - Internetowy System Aktów Prawnych (scraping)
- WSA/NSA - Orzecznictwo sądów administracyjnych (scraping)
- RIO - Regionalna Izba Obrachunkowa (scraping)
- BIP - Biuletyn Informacji Publicznej (scraping, template)

**Silniki analityczne (zaimplementowane):**

1. **Legal Search API** (`apps/api/src/services/legal-search-api.ts`):

   - Wyszukiwanie pełnotekstowe (fulltext) - szybkie wyszukiwanie po słowach kluczowych
   - Wyszukiwanie semantyczne (semantic) - wyszukiwanie po znaczeniu z AI embeddings
   - Wyszukiwanie hybrydowe (hybrid) - łączy oba podejścia
   - Filtrowanie: daty, typy dokumentów, jurysdykcja, zakres prawny
   - Generowanie excerptów i highlights

2. **Legal Reasoning Engine** (`apps/api/src/services/legal-reasoning-engine.ts`):

   - Analiza legalności - zgodność z prawem, podstawy prawne, delegacje
   - Analiza ryzyka finansowego - zgodność z budżetem, WPF, stanowiska RIO
   - Analiza zgodności proceduralnej - tryb uchwalania, konsultacje, terminy
   - Analiza kompleksowa - pełna analiza prawna, finansowa i proceduralna
   - Wykrywanie ryzyk z poziomami: low, medium, high, critical
   - Cytaty i podstawy prawne z dokumentów

3. **Budget Analysis Engine** (`apps/api/src/services/budget-analysis-engine.ts`):
   - Analiza zmian - wykrywa przesunięcia środków i zmiany ukryte
   - Analiza zgodności - sprawdza zgodność z ustawą o finansach publicznych
   - Analiza ryzyk - identyfikuje ryzyka finansowe i proceduralne
   - Porównanie dokumentów - porównuje projekt vs uchwała
   - Referencje do uchwał RIO

**Backend API** (`apps/api/src/routes/legal-analysis.ts`):

- `POST /api/legal/search` - wyszukiwanie prawne
- `POST /api/legal/reasoning` - analiza prawna z ryzykami
- `POST /api/legal/budget-analysis` - analiza budżetowa
- `GET /api/legal/analysis-types` - lista dostępnych typów analiz

**Frontend API Client** (`apps/frontend/src/lib/api/legal-analysis.ts`):

- `searchLegal()` - wyszukiwanie prawne
- `analyzeLegal()` - analiza prawna
- `analyzeBudget()` - analiza budżetowa
- `getAnalysisTypes()` - typy analiz

**Następne kroki:**

- Implementacja konkretnych adapterów API dla ISAP, WSA/NSA, RIO
- Utworzenie UI dla analiz prawnych i budżetowych
- Funkcja RPC `match_documents` w Supabase dla semantic search
- Testy integracyjne całego systemu

**Status:** Architektura i silniki analityczne gotowe, wymaga UI i testów.

---

## 2026-01-09 (rano)

### Naprawa przepływu danych scrapera i wybór modeli AI

**Problem:** Scraper używał nieistniejącej tabeli `api_keys` zamiast `api_configurations`, przez co nie mógł pobrać klucza OpenAI z bazy danych.

**Rozwiązanie:**

- Zmiana w `scraper-v2.ts` - użycie tabeli `api_configurations` z warunkami `is_active=true`, `is_default=true`
- Zmiana w `data-sources.ts` (seed-test-data) - ta sama poprawka
- Dodanie obsługi modelu embeddings z konfiguracji użytkownika

**Nowe funkcje w Ustawieniach → Konfiguracja API:**

- **Wybór modelu AI** (GPT-4, GPT-3.5, lokalne modele)
- **Wybór modelu Embeddings** (text-embedding-3-small, text-embedding-3-large, ada-002)

**Migracja:** `010_add_embedding_model_to_api_configurations.sql`

---

### Web Scraper v2 - kompletna reimplementacja

**Problem:** Poprzedni scraper był nieskuteczny:

- Pobierał tylko 1 stronę (brak crawlowania linków)
- Używał regex zamiast DOM parser
- Nie obsługiwał stron dynamicznych (JS)
- Wszystkie funkcje były identyczne

**Rozwiązanie:** Nowy `scraper-v2.ts` z:

- **Cheerio** - profesjonalne parsowanie HTML (jQuery-like API)
- **Link crawler** - rekurencyjne przeszukiwanie stron (maxPages, maxDepth)
- **Priorytetyzacja URL** - ważne strony (uchwały, protokoły) crawlowane pierwsze
- **Deduplikacja** - hash content do unikania duplikatów
- **Rate limiting** - opóźnienia między requestami
- **Konfiguracja per-source** - różne selektory dla BIP, gmin, portali prawnych

**Nowe pliki:**

- `apps/api/src/services/scraper-v2.ts` - nowy scraper
- `docs/scraper_integration_plan.md` - dokumentacja i plan

**Domyślne konfiguracje dla:**

- BIP (50 stron, 3 poziomy głębokości)
- Strony gmin (30 stron, 2 poziomy)
- Portale prawne (20 stron, rate limit 2s)
- Statystyki, portale samorządowe

**Status: Scraper v2 podłączony do endpointu `/api/data-sources/:id/scrape`**

---

### Naprawienie autoryzacji Supabase OAuth

- Naprawiono konfigurację Supabase (Site URL: `http://localhost:3000`, Redirect URLs)
- Dodano `onAuthStateChange` listener do strony login - automatyczne przekierowanie po zalogowaniu
- Naprawiono frontend API clients (`dashboard.ts`, `documents-list.ts`) - zmiana z `x-user-id` na `Authorization: Bearer <token>`
- Backend middleware waliduje token Supabase i dodaje `x-user-id` do requestów
- Usunięto pliki debugowe z katalogu głównego projektu

**Status: Logowanie przez Google OAuth działa poprawnie.**

### API źródeł danych (Data Sources)

- Utworzono backend API endpoints w `apps/api/src/routes/data-sources.ts`:
  - `GET /api/data-sources` - lista źródeł użytkownika
  - `GET /api/data-sources/:id` - szczegóły źródła
  - `POST /api/data-sources` - dodanie nowego źródła
  - `PATCH /api/data-sources/:id` - aktualizacja źródła
  - `DELETE /api/data-sources/:id` - usunięcie źródła
  - `POST /api/data-sources/:id/scrape` - uruchomienie scrapingu
  - `GET /api/data-sources/documents` - lista dokumentów
  - `GET /api/data-sources/stats` - statystyki
- Utworzono frontend API client w `apps/frontend/src/lib/api/data-sources.ts`
- Zintegrowano stronę `/settings/data-sources` z backendem

**Status: API gotowe, strona zintegrowana z rzeczywistymi danymi.**

---

## 2025-12-26

- Dodano `docs/PLAN_BUDOWY_AGENTA_AI.md` (plan budowy agenta analizy dokumentów Rady).
- Zaktualizowano plan o:
  - OpenAI jako warstwę LLM
  - konfigurację API przez zmienne środowiskowe (bez klucza w repo)
  - projekt narzędzi (tool calling) dla zadań Radnego
  - rozdzielenie systemu na Frontend oraz Backend (API + odseparowany Worker)
  - zastąpienie OCR ekstrakcją treści multimodalnym LLM
  - dodanie funkcji transkrypcji nagrań sesji rady oraz generowania scenopisów
- Zaktualizowano frontend (Next.js): podmieniono domyślną stronę startową na minimalny landing page i ustawiono metadane aplikacji.
- Stan deploymentu (local dev):
  - Infrastruktura Docker Compose (Postgres pgvector, Redis, Adminer) działa na localhost.
  - Frontend Next.js na `localhost:3000` (landing „Asystent Radnego”).
  - API Fastify na `localhost:3001` (endpoint `/health`).
  - Worker BullMQ + Redis (placeholder, loguje joby).
  - Repo z npm workspaces (apps/api, apps/frontend, apps/worker, packages/shared).
- Dodano dokumentację w `/docs`:
  - `architecture.md`
  - `todo.md` (z sekcją „Stan aktualny”)
  - `change_log.md`
- **2025-12-26**:
  - Utworzono `frontend_build_plan.md`.
  - Zaktualizowano `todo.md` o zadania frontendowe.
  - Skonfigurowano projekt Supabase (MCP) i wygenerowano klucze.
  - Skonfigurowano TailwindCSS v4 (migracja z v3, naprawa błędów CSS).
  - Utworzono nową stronę główną (`page.tsx`) i usunięto domyślne style Next.js.
  - Zweryfikowano działanie infrastruktury Docker (Postgres, Redis, Adminer działają poprawnie).
  - Wdrożono funkcje backendowe (Auth, Worker handlers).

### Weryfikacja deploymentu (2025-12-26)

- **API**: `curl http://localhost:3001/health` → `{"status":"ok"}`
- **Frontend**: `curl http://localhost:3000` → renderuje landing „Asystent Radnego”
- **Infrastruktura**: Docker Compose (Postgres pgvector, Redis, Adminer) działa (healthy).
- **Worker**: procesy Node.js widoczne, połączenia z Redis nawiązane (ESTABLISHED).
- **Porty**: 3000, 3001, 5433, 6379, 8080 nasłuchują.

**Status deploymentu: Gotowy do dalszej implementacji.**
