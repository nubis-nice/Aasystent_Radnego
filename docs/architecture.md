# Architektura: Asystent Radnego (Gmina Drawno)

## 1. Cel systemu

System automatyzuje obieg dokumentów Rady Miejskiej (pozyskanie, ekstrakcja treści multimodalnym LLM, analiza, wyszukiwanie) i udostępnia Radnemu panel/czat do pracy z materiałami wraz z cytatami oraz sygnałami ryzyk.

## 2. Założenia niefunkcjonalne (inwarianty)

- **Deterministyczność**: domyślnie `temperature=0`, wersjonowanie promptów.
- **Kontrakty danych**: wszystkie wejścia/wyjścia walidowane (Zod), wersjonowane (`v1`).
- **Fail fast**: błąd, gdy brak tekstu po ekstrakcji / brak metadanych krytycznych / uszkodzony plik.
- **Obserwowalność**: logi JSON z `traceId`, czasy etapów, statusy jobów.
- **Bezpieczeństwo**: klucze API tylko w zmiennych środowiskowych; brak danych wrażliwych w logach.

## 3. Stos technologiczny (docelowo)

## 3.1. Repozytorium (monorepo)

Projekt jest utrzymywany jako monorepo (**npm workspaces**) z osobnymi aplikacjami uruchomieniowymi w `apps/*` (frontend/api/worker) oraz współdzielonym kodem w `packages/*`.

- **Runtime**: Node.js LTS
- **Język**: TypeScript
- **Backend**: Fastify (lub NestJS + Fastify)
- **Kolejka**: BullMQ + Redis
- **DB**: PostgreSQL + pgvector
- **Ekstrakcja treści z dokumentów/skanów**: multimodalny LLM (OpenAI)
- **LLM**: OpenAI + tool calling
- **UI**: panel webowy (np. Next.js) + czat

## 4. Moduły i odpowiedzialności

### 4.0. System źródeł danych (Data Sources) - Agent Winsdurf

**Założenia strategiczne:**
Agent AI "Winsdurf" oparty na aktualnych, zewnętrznych źródłach prawa zamiast lokalnego kontekstu MCP.

**Architektura API-first:**

**WARSTWA 1 - Źródła danych (API / scraping):**

- **ISAP API (Sejm RP)** - REST API ELI (Dziennik Ustaw, Monitor Polski)
  - Endpoint: `https://api.sejm.gov.pl/eli`
  - Serwis: `ISAPApiService`
  - Routes: `/api/isap/*`
- **GUS BDL API** - REST API Bank Danych Lokalnych
  - Endpoint: `https://bdl.stat.gov.pl/api/v1`
  - Serwis: `GUSApiService`
  - Routes: `/api/gus/*`
- **EU Funds** - Portal Funduszy Europejskich, Mapa Dotacji
  - Serwis: `EUFundsService`
  - Routes: `/api/eu-funds/*`
- RCL - akty wykonawcze
- WSA/NSA - orzecznictwo (scraping)
- RIO - uchwały i rozstrzygnięcia nadzorcze (scraping)
- BIP JST - scraping
- Dzienniki Urzędowe Województw - scraping

**WARSTWA 2 - Adaptery pobierania:**

- `BaseDataFetcher` - bazowa klasa
- `ApiDataFetcher` - uniwersalny klient API (OAuth2, API key, Basic, Bearer)
- `ScraperDataFetcher` - web scraping z Cheerio
- `UnifiedDataService` - orkiestrator łączący API i scraping

**WARSTWA 3 - Silniki analityczne:**

- Legal Search API - wyszukiwanie prawne (fulltext + semantic)
- Legal Reasoning Engine - analiza prawna z ryzykami
- Budget Analysis Engine - analiza budżetowa i wykrywanie anomalii

**Typy źródeł:**

- `api_isap`, `api_rcl`, `api_wsa_nsa`, `api_rio` - źródła prawne
- `scraper_bip`, `scraper_dziennik`, `scraper_custom` - scraping
- `api_custom` - niestandardowe API

**Metody pobierania:**

- `api` - REST API z konfiguracją (auth, pagination, response mapping)
- `scraping` - web scraping z selektorami CSS
- `hybrid` - kombinacja API i scrapingu

### 4.0.1. Inteligentny Scraping z AI (2026-01-14)

**Zasada:** Wszystkie dane strukturalne (daty, miejsca, encje) są wyodrębniane przez AI, nie przez regex.

**Przepływ danych:**

```text
IntelligentScraper.analyzeContentWithLLM()
  └─ extractedDates, extractedEntities, keyTopics, summary
     └─ metadata.llmAnalysis w scraped_content
        └─ processToRAG() → processed_documents.metadata
           ├─ Frontend: FormattedDocumentContent (wyświetla dane AI)
           └─ calendar-auto-import (importuje tylko z danych AI)
```

**Struktura `metadata.llmAnalysis`:**

- `relevanceScore` (0-100) - ocena przydatności dla radnego
- `contentType` - typ treści (sesja/kalendarz/uchwała/protokół)
- `summary` - krótkie podsumowanie
- `keyTopics` - kluczowe tematy
- `extractedDates` - daty wyodrębnione z treści
- `extractedEntities` - encje (miejsca, osoby, komisje)
- `isRelevantForCouncilor` - flaga przydatności
- `recommendedAction` - scrape/skip/priority

**Korzyści:**

- Jedno źródło prawdy dla dat/miejsc sesji
- Spójność między widokiem dokumentu a kalendarzem
- AI rozumie kontekst lepiej niż regex

### 4.1. Ingest (pobieranie)

- Pobiera dokumenty z zewnętrznych źródeł przez `UnifiedDataService`.
- Deduplikacja: `hash` treści + URL.
- Zapis surowych danych w `scraped_content`.

### 4.2. Normalizer

- Identyfikuje format (PDF/DOCX/skan).
- Konwersja do formatu roboczego (jeśli potrzebne).

### 4.3. Ekstrakcja treści (multimodal)

- Ekstrakcja tekstu i struktury z PDF/skanów przez multimodalny LLM.
- `qualityScore` + walidacja minimalnej jakości.

### 4.4. Metadane

- Tytuł, numer, data, autor, temat/tags.
- Źródło i identyfikatory.
- **Hierarchia Ważności** (1-5):
  - Poziom 1: Akty prawne, budżet (100-90 pkt)
  - Poziom 2: Protokoły, transkrypcje (89-70 pkt)
  - Poziom 3: Opinie, analizy (69-50 pkt)
  - Poziom 4: Administracyjne (49-30 pkt)
  - Poziom 5: Załączniki, tło (<30 pkt)
  - Szczegóły: `docs/document_hierarchy.md`

### 4.5. Index/RAG

- Chunking + embedding (OpenAI embedding).
- Przechowywanie wektorów w pgvector.

### 4.6. Analizy

- Streszczenie, kluczowe punkty.
- Powiązania uchwał.
- Skan ryzyk (MVP: heurystyki + cytaty).

### 4.7. Transkrypcja sesji rady (audio/wideo)

- Pobranie/załadowanie nagrań sesji rady.
- Transkrypcja (ASR) w OpenAI Whisper + segmentacja czasowa.
- Indeksowanie transkryptu do wyszukiwania i Q&A.
- **Timeout STT**: lokalny serwer faster-whisper otrzymuje limit 600 s (pole `timeout_seconds` w `api_configurations`) aby długie nagrania (>1h) nie kończyły się błędem `Request timed out`.

### 4.7.1. Zaawansowana Transkrypcja z Analizą (2026-01-10)

**Obsługiwane formaty:** MP3, WAV, OGG, M4A, FLAC, AAC, MP4, WebM, MKV, AVI, MOV

**Funkcje:**

- **Transkrypcja Whisper** - rozpoznawanie mowy z timestampami
- **Identyfikacja rozmówców** - Speaker 1, 2, 3... na podstawie kontekstu
- **Analiza sentymentu** - pozytywny/neutralny/negatywny dla każdej wypowiedzi
- **Emocje** - rozpoznawanie emocji (😊😢😠😨🤔)
- **Napięcie emocjonalne** - skala 1-10
- **Detekcja wiarygodności** - analiza lingwistyczna kłamstwa (% + emoji)

**Wskaźniki wiarygodności:**

- 90-100% ✅ - Wysoka wiarygodność
- 70-89% 🟢 - Prawdopodobnie prawda
- 50-69% 🟡 - Niepewne
- 30-49% ⚠️ - Podejrzane
- 0-29% 🔴 - Niska wiarygodność

**Analiza bazuje na:**

- Spójność wypowiedzi
- Wahania, zmiany zdania
- Nadmierne szczegóły lub ich brak
- Unikanie odpowiedzi
- Kontekst lingwistyczny

### 4.8. Scenopisy sesji rady

- Generowanie scenopisu na bazie transkryptu (agenda -> tematy -> wypowiedzi -> wnioski/decyzje).
- Wersje: krótkie podsumowanie oraz szczegółowy przebieg.

### 4.9. UI / Chat / Dashboard

- Lista dokumentów i analiz.
- Q&A z cytatami.
- Raporty okresowe.
- **Dashboard**: nagłówek łączy tytuł sekcji z kartami statystyk (dokumenty, konwersacje, zapytania AI, aktywność tygodnia) w jednym komponencie z gradientowym tłem.
- **Kalendarz**: widget wspiera tryby miesiąc/tydzień; widok tygodniowy ma 7 kolumn z sekcją wydarzeń całodziennych i blokami 6‑godzinnymi przewijanymi bez widocznych pasków.

## 4.10. Voice Command Processor - Stefan 2.0 (2026-01-16)

System obsługi głosowej umożliwiający sterowanie aplikacją za pomocą komend głosowych.

**Stefan 2.0 - Tryb czuwania:**

- Wake word: **"Hej Stefan"** (warianty: "Hey Stefan", "Cześć Stefan", "Ok Stefan")
- Słowo wykonania: **"wykonaj"**, "tak", "potwierdź"
- Tryby: `off` → `standby` → `active` → `processing`

**Akcje głosowe (`VoiceActionService`):**

| Kategoria  | Akcje                                                               |
| ---------- | ------------------------------------------------------------------- |
| Kalendarz  | `calendar_add`, `calendar_list`, `calendar_edit`, `calendar_delete` |
| Zadania    | `task_add`, `task_list`, `task_complete`                            |
| Alerty     | `alert_check`, `alert_dismiss`                                      |
| Dokumenty  | `document_search`, `document_open`                                  |
| QuickTools | `quick_tool` (interpelacja, pismo, protokół, budżet)                |
| Nawigacja  | `navigate` (pulpit, dokumenty, czat, ustawienia)                    |

**Komponenty:**

- `apps/api/src/services/voice-action-service.ts` - serwis akcji głosowych
- `apps/api/src/routes/voice.ts` - endpointy `/voice/action`, `/voice/detect-wake-word`
- `apps/frontend/src/contexts/VoiceContext.tsx` - globalny kontekst głosowy
- `apps/frontend/src/components/layout/sidebar.tsx` - `StefanVoiceButton`

**Narzędzia AI Orchestrator:**

- `search_documents`
- `get_document`
- `get_document_citations`
- `summarize_document`
- `qa_over_documents`
- `find_related_resolutions`
- `generate_weekly_report`
- `generate_session_brief`
- `legal_risk_scan`
- `transcribe_session_recording`
- `generate_session_screenplay`

## 6. Model danych (skrót)

- `Document`, `DocumentVersion`, `ExtractedText`, `Metadata`, `Chunk`, `Analysis`, `Recording`, `Transcript`, `Screenplay`

## 7. Konfiguracja Providerów AI (2026-01-11)

### 7.1 Architektura Multi-Provider

System obsługuje wielu providerów AI z podziałem na **5 niezależnych funkcji**:

| Funkcja        | Opis                   | Przykładowe providery          |
| -------------- | ---------------------- | ------------------------------ |
| **LLM**        | Modele językowe (chat) | OpenAI, Ollama, Anthropic      |
| **Embeddings** | Wektory semantyczne    | OpenAI, Ollama                 |
| **Vision**     | Analiza obrazów        | OpenAI GPT-4V, Ollama LLaVA    |
| **STT**        | Speech-to-Text         | OpenAI Whisper, faster-whisper |
| **TTS**        | Text-to-Speech         | OpenAI TTS, Piper              |

### 7.2 Presety Konfiguracji

- **OpenAI** - pełna konfiguracja OpenAI API
- **Ollama (Local)** - lokalne modele + faster-whisper-server dla STT
- **Custom** - dowolny endpoint z wyborem protokołu API

### 7.3 Struktura Kodu

```text
apps/api/src/ai/
├── index.ts                    # Eksport publiczny
├── defaults.ts                 # Presety konfiguracji
├── types.ts                    # Typy i interfejsy
├── ai-config-resolver.ts       # Resolver konfiguracji z cache
├── ai-client-factory.ts        # Fabryka klientów AI
└── clients/
    ├── llm-client.ts           # Klient LLM
    ├── embeddings-client.ts    # Klient embeddingów
    ├── vision-client.ts        # Klient vision
    ├── stt-client.ts           # Klient STT
    └── tts-client.ts           # Klient TTS
```

### 7.4 Baza Danych

- `ai_configurations` - główna konfiguracja użytkownika (preset, is_default)
- `ai_providers` - konfiguracja każdej funkcji AI (LLM, Embeddings, Vision, STT, TTS)

### 7.5 Zmienne Środowiskowe (fallback)

- `OPENAI_API_KEY` (w `.env`, nie commitować)
- `OPENAI_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- opcjonalnie: `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID`

Szczegóły: `.windsurf/base_rules.md` (zasady budowania aplikacji)

## 8. Granice odpowiedzialności

- System dostarcza **wsparcie analityczne** i sygnały ryzyk; nie zastępuje opinii prawnej.

---

## 9. Observability & DevOps (2026-01-14)

- **TraceId everywhere** – API i worker logują `traceId`, nazwę narzędzia (`tool=deep_research`, `tool=rag_search`, `tool=session_discovery`), czas trwania i status. Błędy HTTP zawsze zwracają `errorId` = `traceId`.
- **Monitoring pipeline’u** – BullMQ publikuje metryki jobów (czas start/stop, retry, failure_reason) do Redis/Prometheus. Dashboard operacyjny śledzi: liczbę dokumentów w ingest, błędy OCR, błędy DeepResearch, rozmiar kolejek.
- **Konfiguracja środowisk** – osobne `.env` dla `apps/api`, `apps/frontend`, `apps/worker`. Sekrety zarządzamy poza repo (Doppler/1Password). `api_configurations` przechowuje zaszyfrowane klucze providerów i deterministycznie kontroluje, którzy providerzy są aktywni.
- **Release checklist** – lint + type-check, smoke test `/health`, test zapytania RAG, test DeepResearch (mock provider). Deployment lokalny: `npm run dev`; produkcyjny: docker-compose profile `api`, `frontend`, `worker`.
- **Alerty operacyjne** – brak dostępu do Supabase, błędy 5xx dla `/api/research`, kolejka BullMQ > 50 jobów, brak nowych dokumentów >24h. Alerty trafiają do kanału #windsurf-ops oraz do właściciela zmiany.

## Stan implementacji (2026-01-24)

### Co działa (deployment local dev)

- **Infrastruktura**: Docker Compose (Redis, Speaches STT) + Supabase PostgreSQL (cloud).
- **Frontend**: Next.js 14 (app router) na `localhost:3000` — kompletny panel.
- **API**: Fastify na `localhost:3001` — 25 route files, 67 services.
- **Worker**: BullMQ + Redis — 6 job handlers.
- **Repo**: npm workspaces (apps/api, apps/frontend, apps/worker, packages/shared).
- **Migracje**: 42 pliki SQL w `apps/api/migrations/`.

### Kluczowe moduły

- **AI System** (`apps/api/src/ai/`): AIClientFactory, AIConfigResolver, defaults, types
- **Transkrypcja**: TranscriptionQueue (Redis), TranscriptionWorker, TranscriptionRecovery
- **Voice**: VoiceActionService, VoiceIntentDetector, voice routes
- **Research**: DeepResearchService + 4 providery (Exa, Brave, Tavily, Serper)
- **Legal**: LegalSearchApi, LegalReasoningEngine, BudgetAnalysisEngine
- **Scraping**: IntelligentScraper, ScraperV2, UnifiedDataService
- **OCR/Vision**: DocumentProcessor, VisionQueue, VisionOptimizer

### API Routes (25 plików)

auth, chat, dashboard, data-sources, deep-research, diagnostics, document-graph, documents, eu-funds, gdos, geoportal, gus, isap, krs, legal-analysis, providers, teryt, voice, youtube, ceidg, api-models, test-api, test

### Worker Jobs (6)

extraction, analysis, relations, vision-ocr, youtube-transcription, scraping

### Frontend Pages

`/dashboard`, `/documents`, `/documents/youtube`, `/chat`, `/analysis`, `/research`, `/calendar`, `/settings/*`, `/admin/users`
