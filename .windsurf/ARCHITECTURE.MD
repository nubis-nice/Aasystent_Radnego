# Architektura — źródło prawdy (MVP 2026-01-14)

## Monorepo i główne komponenty

- **apps/api** – Fastify + TypeScript. Udostępnia REST API (auth, documents, chat, legal-analysis, deep-research, youtube, diagnostics, providers). Operuje na Supabase (PostgreSQL + pgvector) oraz Redisie.
- **apps/frontend** – Next.js 14 (app router) + TailwindCSS. Zawiera panel (dashboard, documents, chat, analysis, research, settings, admin).
- **apps/worker** – BullMQ + Redis. Realizuje pipeline ingest → ekstrakcja → analiza → embedding → relacje.
- **packages/shared** – typy i schematy (Zod) współdzielone między serwisami.

Repo używa **npm workspaces**, `tsconfig.base.json` i współdzielonych lintów (`eslint.config.mjs`).

## Warstwa pozyskiwania danych (Data Sources)

Źródła: BIP (Drawno), ISAP, RIO, WSA/NSA, Dzienniki Wojewódzkie, ePUAP (plan), pliki uploadowane przez użytkownika.

Pipeline:

1. `UnifiedDataService` orkiestruje `ApiDataFetcher` (REST/OAuth/api-key) oraz `ScraperDataFetcher` (Cheerio).
2. Surowe materiały trafiają do `scraped_content` (Supabase) wraz z metadanymi źródła.
3. Deduplikacja `hash(content) + source_url`.

## Przetwarzanie dokumentów

1. **DocumentProcessor** (worker) identyfikuje formaty (PDF/DOCX/skan), uruchamia OCR (Tesseract/Qwen VLL) lub Vision model (dynamiczny wybór przez AIClientFactory) i zapisuje czysty tekst.
2. **DocumentNormalizer** (LLM + heurystyki) standaryzuje tytuły, numery uchwał, daty publikacji oraz przypisuje `hierarchyLevel` zgodny z `docs/document_hierarchy.md`.
3. **DocumentAnalysisService** generuje streszczenia, słowa kluczowe, wykrywa referencje (`extractReferences`) oraz automatycznie pobiera brakujące materiały.
4. **BatchEmbeddingService** chunkuje treść i zapisuje embeddingi do pgvector.

## Inteligentny Scraping (tylko AI)

**Zasada:** Wszystkie dane strukturalne (daty, miejsca, encje) są wyodrębniane przez AI, nie przez regex.

- **IntelligentScraper.analyzeContentWithLLM()** wyodrębnia: `extractedDates`, `extractedEntities`, `keyTopics`, `summary`
- Dane zapisywane w `metadata.llmAnalysis` (scraped_content → processed_documents)
- Frontend (`FormattedDocumentContent`) i `calendar-auto-import` używają wyłącznie danych z AI
- Usunięto wszystkie fallbacki regex - brak danych AI = brak importu do kalendarza

## Warstwa wiedzy i RAG

- **processed_documents**, **chunks**, **analyses**, **research_reports** – jedyne źródło prawdy (Supabase PostgreSQL).
- Wektory i metadane zasilają `DocumentQueryService`, `SemanticDocumentDiscovery`, `DocumentScorer`.
- Wyszukiwanie zawsze stosuje kolejność: RAG → Session Discovery → Deep Research → Legal Search (ISAP/CBOSA).

## Warstwa AI (multi-provider)

- **AIClientFactory** i **AIConfigResolver** wybierają providera/model dla funkcji: `llm`, `embeddings`, `vision`, `stt`, `tts`. Konfiguracja pochodzi z `api_configurations` / `ai_configurations` lub fallback `.env`.
- Obsługiwani providerzy: OpenAI, Ollama/local, Google, Anthropic, Mistral, Groq, Together, Moonshot, DeepSeek itp. (lista w `apps/api/src/ai/`).
- `DeepResearchService` dynamicznie ładuje Exa, Tavily, Serper, Brave, Firecrawl (jeśli klucze aktywne). Wyniki są logowane i archiwizowane w `research_reports`.
- `AI Tool Orchestrator` decyduje, czy użyć `deep_research`, `rag_search`, `legal_analysis`, `youtube_search`, `document_fetch`, `budget_analysis` itp.

## Moduły specjalistyczne

- **Legal Search API** – zapytania fulltext/semantic/hybrid do zbiorów prawa.
- **Legal Reasoning Engine** – analiza legalności, kompetencji, ryzyk proceduralnych.
- **Budget Analysis Engine** – klasyfikacja budżetowa, wykrywanie przesunięć i niespójności WPF/RIO.
- **Session Discovery Service + YouTubeSessionService** – odnajdywanie i transkrypcja nagrań sesji (auto-trigger według reguł relevancji).
- **Intelligent Scraper / Scraper V2** – crawling + filtracja AI (`checkDocumentRelevance` + regexy).

## Interfejs użytkownika i API

- Fastify rejestruje trasy w `apps/api/src/routes/*.ts`. `authMiddleware` chroni większość `/api/*`.
- Frontend Next.js zapewnia spójny layout (header, sidebar, dark mode) oraz dedykowane widoki: dokumenty, czat, research, analizy, ustawienia, admin.
- API eksponuje health-check (`/health`), test routes, dashboard metrics i diagnostykę providerów AI.

## Infrastruktura i operacje

- **Supabase** (PostgreSQL + pgvector, auth, storage) – jedyna baza danych. Migracje SQL w `apps/api/migrations`.
- **Redis 7 (Docker)** – cache + kolejki BullMQ.
- **Faster-Whisper Server (Docker)** – fallback STT on-prem.
- **Adminer (dev-only)** – podgląd DB.
- Pliki `.env` per aplikacja (API/Frontend/Worker) definiują adresy Supabase, klucze OpenAI, porty itp. Wszystkie sekrety przechowujemy poza repo.
- Logging: `pino-pretty` (API), śledzenie `traceId`, czasy przetwarzania i nazwy narzędzi.

## Inwarianty i zasady

- Determinizm (`temperature=0`, brak losowości bez seed).
- Każda odpowiedź musi zawierać cytowane źródła i być odtwarzalna (logi + ID dokumentów).
- AI nigdy nie omija `UnifiedDataService` ani RAG.
- Braki danych → `UNKNOWN`; zakaz zgadywania prawa.
- Po każdej zmianie w kodzie aktualizujemy `docs/architecture.md`, `docs/todo.md`, `docs/change_log.md`.
