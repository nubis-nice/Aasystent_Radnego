# Design Decisions

## 2026-01-14 — Inteligentny Scraping (tylko AI, bez regex)

- Wszystkie dane strukturalne (daty, miejsca, encje) są wyodrębniane przez AI (`IntelligentScraper.analyzeContentWithLLM()`), nie przez regex.
- Usunięto `extractDateFromTitle()` i inne fallbacki regex z `calendar-auto-import.ts` i `FormattedDocumentContent`.
- Powód: spójność danych między widokiem dokumentu a kalendarzem; AI rozumie kontekst lepiej niż regex.
- Wpływ: jeśli AI nie wyodrębni daty/miejsca, dokument nie zostanie zaimportowany do kalendarza (fail-safe).

## 2026-01-14 — Dynamic Deep Research providers

- `DeepResearchService` **zawsze** ładuje konfiguracje Exa/Tavily/Serper/Brave/Firecrawl z tabeli `api_configurations`.
- Powód: indywidualne klucze użytkowników oraz możliwość szybkiego wyłączania providerów.
- Wpływ: brak twardych zależności w kodzie, konieczny monitoring aktywnych kluczy i logowanie braków.

## 2026-01-14 — Jeden backend (Supabase PostgreSQL) dla całego ruchu

- Supabase (PostgreSQL + pgvector) jest jedyną bazą: dokumenty, embeddings, konfiguracje, raporty.
- Powód: audytowalność danych i brak vendor lock-in na wektorowej bazie SaaS.
- Wpływ: wszystkie migracje muszą przechodzić przez Supabase, worker korzysta z tych samych schematów.

## 2026-01-14 — Deterministyczne logowanie pipeline’u

- API i worker logują `traceId`, źródło danych i nazwę narzędzia (np. `deep_research`, `rag_search`, `session_discovery`).
- Powód: możliwość odtworzenia analizy/odpowiedzi w audycie.
- Wpływ: zakaz silent-fail, każdy wyjątek musi być zwrócony z kodem błędu i ID logu.

## 2026-01-11 — Multi-LLM architecture

Oddzieliliśmy:

- OCR
- Vision
- LLM reasoning

Powód:

- lepsza wydajność
- możliwość uruchamiania części lokalnie
- izolacja danych prawnych

Wpływ:

- więcej komponentów
- znacznie większa kontrola i niezawodność

## 2026-01-11 — RAG with pgvector

Używamy PostgreSQL + pgvector zamiast zewnętrznej bazy wektorowej.

Powód:

- zgodność z wymogami prawnymi
- łatwiejsze kopie zapasowe
- jedno źródło prawdy
