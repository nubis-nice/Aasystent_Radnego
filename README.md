# Dokumentacja monorepo (wygenerowana) — ~~bez~~RADNY

Ta dokumentacja została wygenerowana na podstawie analizy kodu w repozytorium. Jej celem jest opisanie:

- struktury monorepo (`apps/*`, `packages/*`, `infra/*`)
- zależności uruchomieniowych między aplikacjami
- zależności importów (w tym cross-importów między aplikacjami)
- kontraktów kolejek (BullMQ/Redis) używanych do zadań asynchronicznych

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
