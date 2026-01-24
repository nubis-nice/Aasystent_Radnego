# TODO (produkt + technologia)

## Stan aktualny (2026-01-24)

### Co działa (deployment local dev)

- **Infrastruktura**: Docker Compose (Postgres pgvector, Redis, Speaches STT) działa na localhost.
- **Frontend**: Next.js 14 (app router) na `localhost:3000` — kompletny panel z nawigacją.
- **API**: Fastify na `localhost:3001` — 25 route files, 67 services.
- **Worker**: BullMQ + Redis — 6 job handlers (extraction, analysis, relations, vision, transcription).
- **Repo**: npm workspaces (apps/api, apps/frontend, apps/worker, packages/shared).
- **Migracje**: 42 pliki SQL w `apps/api/migrations/`.

---

## 🔴 Do zrobienia (priorytety)

### Krytyczne

- [ ] **Adaptery API produkcyjne**: ISAP, WSA/NSA, RIO (obecnie placeholdery)
- [ ] **Testy E2E czatu** na realnych dokumentach (Drawno)
- [ ] **System uprawnień**: role użytkowników, RLS scenariusze

### Ważne

- [ ] **Raporty cykliczne**: tygodniowe/miesięczne + alerty
- [ ] **Brief na sesję/komisję**
- [ ] **ePUAP live sync** + webhooki
- [ ] **Integracja Google Calendar**

### Normalne

- [ ] **Linkowanie uchwał**: "zmienia/uchyla/wykonuje"
- [ ] **Porównywanie wersji**: projekt vs uchwała
- [ ] **Monitoring traceId/log ingestion** (dashboard ops)

---

## ✅ Ukończone moduły

### Multi-Provider AI System (2026-01-18)

- [x] Struktura `apps/api/src/ai/` z pełną implementacją
- [x] `AIClientFactory` - fabryka klientów AI
- [x] `AIConfigResolver` - resolver konfiguracji z cache
- [x] `defaults.ts` - presety OpenAI/Ollama/Custom
- [x] `types.ts` - pełne typowanie
- [x] Klienty: LLM, Embeddings, Vision, STT, TTS
- [x] Frontend modal konfiguracji z zakładkami

### Transkrypcja YouTube (2026-01-18)

- [x] `TranscriptionQueue` - Redis/BullMQ persistence
- [x] `TranscriptionWorker` - dedykowany worker
- [x] `TranscriptionRecovery` - auto-recovery utkniętych zadań
- [x] Detailed Progress UI z 5 krokami pipeline
- [x] Timeout STT z fallbackiem

### Voice Command System - Stefan 2.0 (2026-01-16)

- [x] Wake word "Hej Stefan" + tryb czuwania
- [x] `VoiceActionService` - akcje głosowe
- [x] Integracja kalendarz, zadania, dokumenty, nawigacja
- [x] `VoiceContext` - globalny kontekst głosowy

### Inteligentny Scraping (2026-01-14)

- [x] `IntelligentScraper` z LLM analysis
- [x] Dane sesji tylko z `metadata.llmAnalysis`
- [x] `calendar-auto-import` bez regex fallbacków

### Deep Research & Legal (2026-01-14)

- [x] `DeepResearchService` z Exa, Brave, Tavily, Serper
- [x] `LegalSearchApi`, `LegalReasoningEngine`, `BudgetAnalysisEngine`
- [x] Fallback providerów + wykrywanie odmów LLM

### Frontend kompletny (2026-01-09)

- [x] Panel dokumentów, czat, research, analysis, settings, admin
- [x] Dark mode, responsywność, walidacja formularzy
- [x] Auth Supabase z middleware
