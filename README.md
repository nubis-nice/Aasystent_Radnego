# Dokumentacja monorepo (wygenerowana) — ~~bez~~RADNY

Ta dokumentacja została wygenerowana na podstawie analizy kodu w repozytorium. Jej celem jest opisanie:

- struktury monorepo (`apps/*`, `packages/*`, `infra/*`)
- zależności uruchomieniowych między aplikacjami
- zależności importów (w tym cross-importów między aplikacjami)
- kontraktów kolejek (BullMQ/Redis) używanych do zadań asynchronicznych

## Najnowsze zmiany (2026-01-25)

### Narzędzia ChatAI (Quick Tools)

Uniwersalny system 8 narzędzi do generowania dokumentów w czacie:

- Wystąpienie, Interpelacja, Pismo, Protokół, Budżet, Wniosek, Uchwała, Raport
- Aktywacja przez URL (`/chat?tool=speech`), czat lub głos
- AI może auto-wypełniać formularze danymi z kontekstu rozmowy

### Asynchroniczna analiza dokumentów

- Endpoint `/documents/:id/analyze` działa asynchronicznie
- Postęp widoczny na Dashboard w widgecie "Przetwarzanie danych"
- Rozwiązuje problem timeout przy OCR długich dokumentów

Szczegóły w [docs/change_log.md](docs/change_log.md)

## Zakres

- `apps/api` — backend (Fastify)
- `apps/frontend` — frontend (Next.js)
- `apps/worker` — worker (BullMQ)
- `packages/shared` — współdzielone typy i narzędzia (Zod, OpenAI utilities)
- `infra/docker-compose.yml` — podstawowa infrastruktura local dev

Jeżeli w repozytorium występują elementy, których nie dało się jednoznacznie potwierdzić w kodzie podczas analizy, są oznaczone jako `UNKNOWN`.

## Spis treści

- [01 — Architektura (high-level)](docs/01-architektura.md)
- [02 — Struktura repozytorium](docs/02-struktura-repo.md)
- [03 — Mapa zależności i importów](docs/03-mapa-zaleznosci-i-importow.md)
- [04 — Aplikacja API](docs/04-app-api.md)
- [05 — Aplikacja Worker](docs/05-app-worker.md)
- [06 — Aplikacja Frontend](docs/06-app-frontend.md)
- [07 — Pakiet `@aasystent-radnego/shared`](docs/07-pakiet-shared.md)
- [08 — Kolejki BullMQ i kontrakty jobów](docs/08-kolejki-i-kontrakty.md)
- [09 — Uruchomienie lokalne, ENV i usługi](docs/09-uruchomienie-i-env.md)
- [API Reference (OpenAPI)](docs/api/openapi.yaml)

## CI/CD Pipeline

### Uruchomienie testów

```bash
# TypeScript validation
npm run typecheck

# Unit + Integration tests (37 testów)
npm run test

# E2E tests z Playwright (18 testów)
npm run test:e2e

# Pełny pipeline
npm run typecheck && npm run build && npm run test
```

### GitHub Actions

Pipeline CI uruchamia się automatycznie na push/PR do `main`:

1. **Lint** — ESLint
2. **TypeCheck** — TypeScript
3. **Build** — Kompilacja wszystkich pakietów
4. **Test** — Unit + Integration (Vitest)
5. **E2E** — Playwright
6. **Security** — npm audit

### Deployment (Vercel)

```bash
# Wymagane secrets w GitHub:
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Deployment uruchamia się:

- **Staging** — push do `main`
- **Production** — tag `v*` (np. `v1.0.0`)
