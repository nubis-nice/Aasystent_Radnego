# TODO

## W toku

### Integracja API zewnętrznych

- [ ] Monitoring dostępności GUGIK geocoder (obecnie niedostępny)
- [ ] Rozszerzenie BDOT10k o nowe warstwy danych
- [ ] Integracja z TERYT GUS (pełna)

## Ukończone ostatnio

### 2026-01-27 — Orchestrator v2 + GUS API + Geoportal

- [x] **Orchestrator v2** - Universal Tool Orchestrator
  - Native function calling (OpenAI/Ollama)
  - Prompt-based fallback dla innych modeli
  - Tool Registry (`orchestrator/tool-registry.ts`)
  - Modułowe narzędzia (`tools/gus-statistics.ts`, `tools/session-search.ts`)
- [x] **GUS BDL API** - naprawione
  - `findGmina` → `/units/search`
  - `getDataByUnit` → `unit-parent-id` + filtrowanie lokalne
  - Filtrowanie po ID zmiennych (`60`, `65`, `68`)
  - Test: urodzenia w Drawnie 2024 ✅
- [x] **Geoportal.gov.pl** - naprawione
  - PRG WFS → dane gmin (działa)
  - ULDK → działki po współrzędnych/ID (działa)
  - GUGIK geocoder → **wyłączony** (niedostępny)
  - Logika: rozdzielenie adresów vs gmin

## Do zrobienia

### Testy

- [x] Testy `ai-client-factory` (12 testów)
- [x] Testy `document-processor` (28 testów)
- [x] Testy `document-scorer` (11 testów)
- [x] E2E: Documents (6 testów)
- [x] E2E: Chat/Dashboard/Settings (8 testów)
- [ ] Testy kolejek BullMQ

### Infrastruktura

- [x] Cache node_modules w GitHub Actions (już w setup-node)
- [ ] Monitoring (Sentry/Grafana)
- [x] Health check endpoint w API (`/diagnostics`)

### Dokumentacja

- [x] README.md - instrukcja deploymentu
- [x] API documentation (OpenAPI/Swagger) → `docs/api/openapi.yaml`

## Ukończone

### 2026-01-25

- [x] Pipeline CI/CD (GitHub Actions)
- [x] Unit tests: 77 testów (6 plików)
  - deep-research-service (7)
  - document-scorer (11)
  - tool-prompt-service (13)
  - api-health (6)
- [x] E2E tests: 18 testów (3 pliki)
  - login.spec.ts (4)
  - documents.spec.ts (6)
  - chat.spec.ts (8)
- [x] Deploy workflow (Vercel)
- [x] Sentry placeholder (`apps/api/src/lib/sentry.ts`)
- [x] Cleanup orphaned files → `/trash_files/`
