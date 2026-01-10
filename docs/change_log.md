# Change Log

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
