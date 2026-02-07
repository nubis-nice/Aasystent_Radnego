# 02 — Struktura repozytorium

## Monorepo i workspaces

Repozytorium działa jako monorepo oparte o **npm workspaces** (`package.json` w root):

- `apps/*`
- `packages/*`

## Drzewo katalogów (skrót)

```text
/ (repo root)
├─ apps/
│  ├─ api/        # backend Fastify
│  ├─ frontend/   # Next.js (App Router)
│  └─ worker/     # BullMQ workers
├─ packages/
│  └─ shared/     # @aasystent-radnego/shared
├─ infra/
│  └─ docker-compose.yml
├─ docs/          # istniejąca dokumentacja
└─ docs_new/      # nowa dokumentacja (ta paczka plików)
```

## Kluczowe pliki konfiguracyjne

- `package.json` (root)
  - definicja workspaces
  - skrypty uruchomieniowe `dev`, `build`, `lint`, `typecheck`
- `tsconfig.base.json`
  - bazowa konfiguracja TypeScript dla monorepo
- `eslint.config.mjs`
  - wspólna konfiguracja lintingu

## Skrypty uruchomieniowe (root)

Z `package.json` w root (wybrane):

- `npm run docker:up` — uruchamia usługi z `infra/docker-compose.yml`
- `npm run dev` — uruchamia `build:shared` oraz równolegle `dev:frontend`, `dev:api`, `dev:worker`
- `npm run build` — buduje `shared`, `frontend`, `api`, `worker`

## Aplikacje (`apps/*`)

### `apps/api`

- TypeScript, `type: module`
- entrypoint dev: `tsx watch src/index.ts`
- build: `tsc -p tsconfig.json || exit 0`

### `apps/worker`

- TypeScript, `type: module`
- entrypoint dev: `tsx watch src/index.ts`
- buduje do `dist/`

### `apps/frontend`

- Next.js 16
- App Router w `apps/frontend/src/app`
- aliasy TS:
  - `@/*` → `apps/frontend/src/*`
  - `@shared/*` → `packages/shared/src/*`

## Pakiety (`packages/*`)

### `packages/shared`

- Paczka `@aasystent-radnego/shared`
- Zawiera typy (Zod + TS) oraz narzędzia do integracji z OpenAI.
