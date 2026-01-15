# Asystent Radnego – Gmina Drawno (MVP 2026-01-14)

## Misja produktu

Agent „Windsurf” dostarcza radnym i urzędnikom kompletny obraz dokumentów samorządowych:

- automatycznie zbiera materiały z BIP, ISAP, RIO, WSA/NSA, Dzienników Wojewódzkich oraz z uploadów;
- wykonuje ekstrakcję, normalizację oraz analizę prawną/budżetową;
- udostępnia interfejs webowy (Next.js) i API (Fastify) z czatem RAG, wyszukiwarką i raportami;
- wykrywa ryzyka (braki podstawy prawnej, przeterminowane akty, konflikt z budżetem) i wskazuje źródła.

System **nie zastępuje** prawnika – generuje audytowalne wnioski i cytaty.

## Główne role użytkowników

1. **Radni** – przeglądają dokumenty przed sesją, korzystają z czatu oraz raportów sesyjnych.
2. **Urzędnicy/sekretariat** – konfigurują źródła danych, monitorują pipeline ingest/analiza.
3. **Audytorzy** – przeglądają raporty ryzyk i historię decyzji (traceId + cytaty).

## Kluczowe komponenty techniczne

- **Backend API (apps/api)** – Fastify + TypeScript, Supabase PostgreSQL + pgvector.
- **Frontend (apps/frontend)** – Next.js 14 (app router), TailwindCSS, Auth przez Supabase.
- **Worker (apps/worker)** – BullMQ + Redis, pipeline ingest → OCR/Vision → analiza → embedding → relacje.
- **Shared** – pakiet typów i kontraktów (Zod schemas).

## Cechy wyróżniające

- Multi-provider AI (OpenAI, Ollama/local, Groq, itp.) sterowane przez `AIClientFactory`.
- Deep Internet Researcher (Exa, Tavily, Serper, Brave) z historią zapytań i logami.
- Deterministyczny pipeline (temperature=0, traceId, cytaty).
- Jedna baza (Supabase) – łatwy audyt i kopie zapasowe.

## Priorytety rozwoju

1. Produkcyjne uruchomienie adapterów ISAP/WSA/RIO + ePUAP live sync.
2. Automatyczne testy czatu na realnych dokumentach (scenariusze Drawno).
3. Raporty cykliczne (tygodniowe/miesięczne) i alerty o krytycznych ryzykach.
