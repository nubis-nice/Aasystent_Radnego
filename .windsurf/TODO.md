# Cel operacyjny (MVP 2026-01-24)

Automatyzacja pozyskiwania i analizy dokumentów JST z pełnym śledzeniem źródeł.

## 🔴 Do zrobienia

### Krytyczne

- [x] Adaptery NSA/WSA + RIO (nsa-api-service.ts, rio-api-service.ts)
- [x] Testy E2E czatu i dokumentów (chat-with-documents.spec.ts) — 39 testów

### Ważne

- [x] ePUAP live sync + webhooki (epuap-service.ts)
- [x] Raporty cykliczne + powiadomienia (scheduled-reports-service.ts)
- [x] Linkowanie uchwał "zmienia/uchyla/wykonuje" (document-graph-service.ts)

### Normalne

- [x] Monitoring traceId/log ingestion (trace-id.ts middleware)

## ✅ Ukończone

### CI/CD

- [x] GitHub Actions: Lint + TypeCheck + Build
- [x] Vercel Deploy (staging/production)
- [x] Setup Vitest dla testów jednostkowych
- [x] Testy jednostkowe: ai-client-factory (12), document-processor (28), document-scorer (11), tool-prompt-service (13), deep-research-service (7), api-health (6) — **77 testów**
- [x] Testy E2E: Playwright (login, chat, documents, chat-with-documents) — **39 testów**

### Źródła i ingest

- [x] BIP scraper + IntelligentScraper z LLM
- [x] Upload plików (PDF/scan/DOCX)
- [x] Transkrypcja YouTube (Redis/BullMQ)
- [x] Auto-import do kalendarza z AI
- [x] ISAP adapter (isap-api-service.ts)
- [x] NSA/WSA adapter (nsa-api-service.ts) — orzeczenia sądów administracyjnych
- [x] RIO adapter (rio-api-service.ts) — decyzje Regionalnych Izb Obrachunkowych

### AI System

- [x] Multi-provider AI (AIClientFactory, AIConfigResolver)
- [x] OCR/Vision (Tesseract + VisionQueue)
- [x] DeepResearchService (Exa/Tavily/Serper/Brave)
- [x] Legal/Budget Analysis Engines
- [x] Voice Command System (Stefan 2.0)
- [x] BullMQ Analysis Queue (analysis-queue.ts)
- [x] ePUAP integracja (epuap-service.ts)
- [x] Raporty cykliczne (scheduled-reports-service.ts)
- [x] Linkowanie uchwał (document-graph-service.ts — amends/supersedes/implements)
- [x] TraceId middleware (trace-id.ts)

### Platforma

- [x] Docker Compose (API, Frontend, Worker, Redis, Speaches)
- [x] Supabase PostgreSQL + pgvector
- [x] 42+ migracje SQL z RLS
- [x] System uprawnień (RLS na tabelach)
