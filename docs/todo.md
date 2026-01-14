# TODO (produkt + technologia)

## Stan aktualny (2026-01-09)

### Co działa (deployment local dev)

- **Infrastruktura**: Docker Compose (Postgres pgvector, Redis, Adminer) działa na localhost.
- **Frontend**: Next.js (app router) na `localhost:3000` — kompletny panel z nawigacją.
- **API**: Fastify na `localhost:3001` — pełne API z endpointami dla dokumentów, analiz, czatu, researchu.
- **Worker**: BullMQ + Redis — joby ekstrakcji, analizy i wykrywania relacji.
- **Repo**: npm workspaces (apps/api, apps/frontend, apps/worker, packages/shared).

### Co zostało zrobione

- [x] Utworzyć **Frontend** (panel webowy + czat) jako osobną aplikację.
- [x] Utworzyć **Backend API** (REST) jako osobny serwis.
- [x] Utworzyć **Backend Worker** jako odseparowany proces/usługę (kolejka zadań BullMQ/Redis).
- [x] Podstawa infrastruktury (Docker Compose, Postgres, Redis, Adminer).
- [x] Strona startowa frontendu (zamiast template Next.js).
- [x] **API**: endpoints dla dokumentów, analiz, Q&A; integracja z OpenAI; walidacja Zod.
- [x] **Worker**: pipeline ingest → ekstrakcja multimodalna → metadane → analiza → embedding.
- [x] **Frontend**: panel dokumentów, czat z cytatami, UI do przesyłania plików.
- [x] **Baza danych**: schematy `Document`, `Chunk`, `Analysis`; migracje (17 plików SQL).
- [x] **Konfiguracja**: `.env` z kluczami OpenAI; bezpieczne zarządzanie sekretami.

### Co czeka na zrobienie (priorytety)

- [x] **Migracje bazy** - WSZYSTKIE ZAIMPLEMENTOWANE (audyt 2026-01-09, 24 tabele, 17 funkcji)
- [ ] **Konfiguracja .env** - zmienne środowiskowe (OPENAI*API_KEY, SUPABASE*\*)
- [ ] **Test z dokumentami** - test czatu i analiz z prawdziwymi dokumentami
- [ ] **Adaptery API**: Implementacja konkretnych adapterów dla ISAP, WSA/NSA, RIO (obecnie placeholder).
- [ ] **Transkrypcja**: Sesje rady (audio/wideo) - ASR + segmentacja czasowa.

## Hierarchia i Wyszukiwanie (2026-01-14)

- [x] Opracowanie hierarchii ważności dokumentów (`docs/document_hierarchy.md`).
- [x] Aktualizacja wag w `document-scorer.ts`.
- [x] Aktualizacja dokumentacji normalizacji danych.
- [x] Implementacja logiki wypełniania `hierarchyLevel` w `DocumentNormalizer`.

---

## Frontend: konkretne zadania (2025-12-26)

### Etap 1: Podstawa (TailwindCSS + struktura)

- [x] Instalacja TailwindCSS + konfiguracja (tailwind.config.js, postcss)
- [x] Utworzenie struktury folderów zgodnie z `docs/frontend_build_plan.md`
- [x] Komponenty UI bazowe (button, input, modal) w `components/ui/`
- [x] Layout główny (header, sidebar) w `components/layout/`
- [x] Aktualizacja globals.css o Tailwind

### Etap 2: Logowanie (Supabase Auth)

- [x] Stworzenie projektu Supabase (MCP)
- [x] Instalacja @supabase/supabase-js
- [x] Konfiguracja Supabase client w `lib/supabase/client.ts`
- [x] Funkcje auth w `lib/supabase/auth.ts`
- [x] Formularze logowania/rejestracji w `components/auth/`
- [x] Auth guard i middleware do ochrony routes
- [x] Routes: `/login`, `/reset-password`, `/change-password` (grupa `(auth)`)

### Etap 3: Dokumenty (UI)

- [x] Struktura routes: `/documents`, `/documents/[id]`, `/documents/upload`
- [x] Layout dla `/documents` z Header + Sidebar
- [x] Lista dokumentów (placeholder z filtrami, paginacją)
- [x] Podgląd dokumentu (metadane, treść, analizy)
- [x] Upload pliku (drag & drop, progress, walidacja)
- [x] Komponenty dokumentów w `components/documents/`

### Etap 4: Czat z cytatami

- [x] Route `/chat` z layoutem czatu
- [x] Layout dla `/chat` z Header + Sidebar
- [x] Interfejs czatu (wiadomości, pole tekstowe, cytaty)
- [x] Tooltip z cytatem przy odpowiedziach AI
- [x] Historia czatu i export
- [x] Integracja z backend API
- [x] **Inteligentny Asystent Radnego z AI** (GPT-4 + RAG)
  - [x] System promptów (prawnik, analityk, działacz, organizator)
  - [x] RAG z dokumentami użytkownika (pgvector)
  - [x] Middleware auth i endpoints API
  - [x] Frontend z loading states i error handling
  - [ ] Uruchomienie migracji bazy danych (005_create_chat_schema.sql)
  - [ ] Konfiguracja zmiennych środowiskowych (OPENAI_API_KEY)
  - [ ] Test z prawdziwymi dokumentami

### Etap 5: Ustawienia i zarządzanie

- [x] Route `/settings` z kafelkami
- [x] Layout dla `/settings` z Header + Sidebar
- [x] `/settings/profile` - Profil użytkownika
- [x] `/settings/api` - **Konfiguracja API** (OpenAI, lokalne modele)
- [x] `/settings/notifications` - Powiadomienia
- [x] `/settings/appearance` - Wygląd
- [x] `/settings/locale` - Język i region
- [x] `/settings/privacy` - Prywatność

### Etap 6: Panel Admina

- [x] Route `/admin/users` - Zarządzanie użytkownikami
- [x] Layout dla `/admin` z guard
- [x] `/admin/users/new` - Formularz dodawania użytkownika
- [x] `/admin/users/[id]` - Formularz edycji użytkownika

### Etap 7: Polish i optymalizacja

- [x] Responsywność (mobile/desktop)
- [x] Dark mode (toggle)
- [x] Animacje i przejścia
- [x] Walidacja formularzy (React Hook Form + Zod)
- [x] Error handling i loading states
- [x] SEO i metadane

---

## MVP (Etap 1–2) ✅ UKOŃCZONE

- [x] Potwierdzić źródła dokumentów dla Drawna (BIP/system „Rada") i metodę pobierania.
- [x] Zdefiniować kontrakt `Document`/`Metadata` (Zod) i strategię deduplikacji (hash + URL).
- [x] Utworzyć **Frontend** (panel webowy + czat) jako osobną aplikację.
- [x] Utworzyć **Backend API** (REST) jako osobny serwis.
- [x] Utworzyć **Backend Worker** jako odseparowany proces/usługę (kolejka zadań BullMQ/Redis) do ekstrakcji treści multimodalnej, analiz, embeddingów, raportów, transkrypcji.
- [x] Pipeline: pobranie -> ekstrakcja treści multimodalna (PDF/skan) -> zapis tekstu -> metadane.
- [x] Streszczenie + kluczowe punkty (OpenAI, `temperature=0`).
- [x] Chunking + embedding + indeks pgvector.
- [x] Q&A z cytatami (RAG) - **Zaimplementowane w czacie AI**
- [x] Panel: lista dokumentów + podgląd + wynik analizy.

## Inteligentny Czat AI - Status

### Zaimplementowane (Faza 1)

- [x] Architektura systemu i dokumentacja
- [x] Schemat bazy danych (conversations, messages, municipal_data, calendar_events)
- [x] Typy TypeScript dla czatu
- [x] Backend API endpoints (/api/chat/message, /conversations, etc.)
- [x] Middleware auth (weryfikacja tokenu Supabase)
- [x] System promptów AI (Asystent Radnego: prawnik, analityk, działacz, organizator)
- [x] RAG z dokumentami użytkownika (semantic search pgvector)
- [x] RAG z danymi gminy (przygotowane, wymaga scrapera)
- [x] Frontend czatu z integracją API
- [x] Loading states i error handling
- [x] Cytaty ze źródeł z relevance score

### Do uruchomienia (wymagane)

- [x] Uruchomienie migracji - **WSZYSTKIE ZAIMPLEMENTOWANE** (audyt 2026-01-09)
- [ ] Konfiguracja zmiennych środowiskowych w `apps/api/.env`:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - OPENAI_API_KEY
  - OPENAI_MODEL
- [ ] Test czatu z prawdziwymi dokumentami

### Następne fazy (opcjonalne)

- [x] Strona ustawień źródeł danych (`/settings/data-sources`) - **2026-01-09**
- [x] API endpoints dla zarządzania źródłami danych - **2026-01-09**
- [ ] Web scraper dla strony gminy/BIP (implementacja logiki scrapingu)
- [ ] Worker job dla automatycznego scrapingu
- [ ] Integracja Google Calendar
- [ ] Powiadomienia o terminach i spotkaniach

### Dokumentacja

- `docs/chat_ai_architecture.md` - Pełna architektura
- `docs/chat_implementation_status.md` - Szczegółowy status
- `docs/setup_instructions.md` - Instrukcja konfiguracji
- `docs/quick_start_chat.md` - Quick start (8 minut)

## Sesje rady (audio/wideo)

- [ ] Ustalić źródło nagrań sesji (BIP/transmisje/YouTube/pliki) i sposób pobierania.
- [ ] Transkrypcja nagrań sesji (ASR) + segmentacja czasowa.
- [ ] Indeksowanie transkryptów do wyszukiwania i Q&A.

## Etap 3 (powiązania i zmiany) - CZĘŚCIOWO ZAIMPLEMENTOWANE

- [x] Wykrywanie odniesień do innych uchwał (regex + analiza kontekstu) - **Worker job: relations.ts**
- [ ] Linkowanie „zmienia/uchyla/wykonuje".
- [ ] Porównywanie wersji / projekt vs uchwała.

## Etap 4 (ryzyka) ZAIMPLEMENTOWANE

- [x] `legal_risk_scan` – sygnały/heurystyki + cytaty - **Legal Reasoning Engine**
- [x] Repozytorium wiedzy prawnej - **Legal Search API (fulltext/semantic/hybrid)**

## Etap 5 (raporty) - W TRAKCIE

- [ ] Raport tygodniowy/miesięczny.
- [ ] Brief na sesję/komisję.
- [ ] Alerty o nowych dokumentach i wysokim ryzyku.

---

## Refaktoring Providerów AI (2026-01-11) - W TRAKCIE

### Cel

Centralizacja obsługi providerów AI z podziałem na 5 niezależnych funkcji:

- **LLM** - modele językowe (chat)
- **Embeddings** - wektory semantyczne
- **Vision** - analiza obrazów
- **STT** - Speech-to-Text (transkrypcja)
- **TTS** - Text-to-Speech (synteza mowy)

### Presety

- **OpenAI** - pełna konfiguracja OpenAI API
- **Ollama (Local)** - lokalne modele + faster-whisper-server dla STT
- **Custom** - dowolny endpoint z wyborem protokołu API

### Zadania

- [x] Dokumentacja projektowa (`docs/ai_provider_refactoring_plan.md`)
- [x] Aktualizacja `docs/architecture.md`
- [ ] Utworzenie struktury `apps/api/src/ai/`
- [ ] Implementacja `defaults.ts` z presetami
- [ ] Implementacja `types.ts`
- [ ] Migracja bazy danych (tabele `ai_configurations`, `ai_providers`)
- [ ] Implementacja `AIConfigResolver`
- [ ] Implementacja `AIClientFactory`
- [ ] Klienty: `LLMClient`, `EmbeddingsClient`, `VisionClient`, `STTClient`, `TTSClient`
- [ ] Migracja serwisów (youtube-downloader, audio-transcriber, chat, ...)
- [ ] Frontend - modal konfiguracji z zakładkami

### Dokumentacja

- `docs/ai_provider_refactoring_plan.md` - Szczegółowy plan

---

## Deep Internet Researcher ZAIMPLEMENTOWANE (2026-01-09)

- [x] **Backend**: `DeepResearchService` z multi-provider orchestration
- [x] **Providers**: Exa AI, Tavily AI, Serper (Google)
- [x] **Frontend**: `/research` - kompletny UI z historią
- [x] **API Routes**: `/api/research`, `/api/research/history`, `/api/research/:id`
- [x] **Typy**: `DeepResearchRequest`, `DeepResearchReport`, `ResearchResult`
- [x] **Migracje**: `011_create_research_reports.sql`

## Analizy Prawne ZAIMPLEMENTOWANE (2026-01-09)

- [x] **Legal Search API**: wyszukiwanie fulltext/semantic/hybrid
- [x] **Legal Reasoning Engine**: analiza legalności, ryzyk finansowych, proceduralnych
- [x] **Budget Analysis Engine**: analiza budżetowa, wykrywanie anomalii
- [x] **Frontend**: `/analysis` - UI z tabami (wyszukiwanie, analiza prawna, budżetowa)
- [x] **API Routes**: `/api/legal/search`, `/api/legal/reasoning`, `/api/legal/budget-analysis`
