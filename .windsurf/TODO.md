# Cel operacyjny (MVP 2026-01-14)

Automatyzacja pozyskiwania i analizy dokumentów JST z pełnym śledzeniem źródeł.

## Źródła i ingest

- [x] BIP (scraper)
- [x] Upload plików (PDF/scan)
- [x] Inteligentny scraping z AI (metadata.llmAnalysis)
- [ ] ePUAP live sync + webhooki
- [ ] Adaptery ISAP / WSA-NSA / RIO w trybie produkcyjnym (obecnie placeholdery)

## AI i analizy

- [x] OCR / Vision (Tesseract + Qwen VLL)
- [x] Ekstrakcja + normalizacja (DocumentNormalizer, hierarchyLevel)
- [x] DeepResearchService (Exa/Tavily/Serper/Brave)
- [x] Inteligentny Scraping - tylko AI, bez regex (2026-01-14)
- [x] Auto-import do kalendarza z danych AI
- [ ] Automatyczne risk scoring + alerty (Legal/Budget)
- [ ] Raporty cykliczne (tydzień/miesiąc) + powiadomienia

## Platforma i operacje

- [x] Docker Compose (API, Frontend, Worker, Redis, Adminer)
- [x] Supabase PostgreSQL + pgvector (jedyna baza)
- [x] Spójność danych sesji (frontend = kalendarz = AI)
- [ ] Testy E2E czatu na realnych dokumentach (Drawno)
- [ ] System uprawnień użytkowników (role, RLS scenariusze)
- [ ] Monitoring traceId/log ingestion (dashboard ops)
