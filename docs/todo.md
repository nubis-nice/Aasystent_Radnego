# TODO

## W toku

_Brak aktywnych zadań_

## Do zrobienia

### Testy

- [ ] Testy `ai-client-factory` (wymaga mockowania Supabase)
- [ ] Testy `document-processor`
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
- [x] Unit tests: 37 testów (4 pliki)
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
