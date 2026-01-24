# Cel operacyjny (MVP 2026-01-24)

Automatyzacja pozyskiwania i analizy dokumentów JST z pełnym śledzeniem źródeł.

## 🔴 Do zrobienia

### Krytyczne

- [ ] Adaptery ISAP / WSA-NSA / RIO w trybie produkcyjnym
- [ ] Testy E2E czatu na realnych dokumentach (Drawno)
- [ ] System uprawnień użytkowników (role, RLS)

### Ważne

- [ ] ePUAP live sync + webhooki
- [ ] Automatyczne risk scoring + alerty (Legal/Budget)
- [ ] Raporty cykliczne (tydzień/miesiąc) + powiadomienia
- [ ] Integracja Google Calendar

### Normalne

- [ ] Monitoring traceId/log ingestion (dashboard ops)
- [ ] Linkowanie uchwał "zmienia/uchyla/wykonuje"

## ✅ Ukończone

### Źródła i ingest

- [x] BIP scraper + IntelligentScraper z LLM
- [x] Upload plików (PDF/scan/DOCX)
- [x] Transkrypcja YouTube (Redis/BullMQ)
- [x] Auto-import do kalendarza z AI

### AI System

- [x] Multi-provider AI (AIClientFactory, AIConfigResolver)
- [x] OCR/Vision (Tesseract + VisionQueue)
- [x] DeepResearchService (Exa/Tavily/Serper/Brave)
- [x] Legal/Budget Analysis Engines
- [x] Voice Command System (Stefan 2.0)

### Platforma

- [x] Docker Compose (API, Frontend, Worker, Redis, Speaches)
- [x] Supabase PostgreSQL + pgvector
- [x] 42 migracje SQL
