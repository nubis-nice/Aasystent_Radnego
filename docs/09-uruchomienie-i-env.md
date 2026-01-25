# 09 — Uruchomienie lokalne, ENV i usługi

## Wymagania

- Node.js `>= 20` (wg `package.json` w root)
- Docker (dla usług z `infra/docker-compose.yml`)

## Start infrastruktury

Plik: `infra/docker-compose.yml`

Usługi:

- Postgres (pgvector): `localhost:5433` (mapowanie `5433:5432`)
- Redis: `localhost:6379`
- Adminer: `localhost:8080`
- Whisper server (faster-whisper-server): `localhost:8000`

Uruchomienie:

- `npm run docker:up`

## Zmienne środowiskowe

### Frontend (`apps/frontend`)

Wg `apps/frontend/README.md`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Dodatkowo (wg kodu `apps/frontend/src/lib/api/*`):

- `NEXT_PUBLIC_API_URL` (opcjonalne; domyślnie puste `""`)

### API (`apps/api`)

Minimalny zestaw wynikający z kodu:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_PORT` (opcjonalne; domyślnie 3001)
- `REDIS_HOST` (opcjonalne; domyślnie localhost)
- `REDIS_PORT` (opcjonalne; domyślnie 6379)
- `LOG_LEVEL` (opcjonalne)

AI (fallback env, zależnie od konfiguracji w Supabase):

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (np. `gpt-4o-mini`)
- `OPENAI_VISION_MODEL` (np. `gpt-4o`)
- `OLLAMA_VISION_MODEL` (opcjonalne)

### Worker (`apps/worker`)

Minimalnie:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_HOST`
- `REDIS_PORT`

**Ważne:**

- `apps/worker/src/jobs/vision.ts` i `apps/worker/src/jobs/document-process.ts` wykonują `dotenv.config({ path: "../../../api/.env" })`.
- Oznacza to, że część jobów zakłada obecność pliku `.env` w `apps/api/`.

## Uruchomienie monorepo

Z root:

- `npm install`
- `npm run dev`

`npm run dev` uruchamia:

- `build:shared`
- równolegle: `dev:frontend`, `dev:api`, `dev:worker`

## Kolejność build a `apps/api/dist/*`

`apps/worker` w części jobów używa dynamicznych importów z `apps/api/dist/services/*`.

To oznacza, że w scenariuszach, w których uruchamiasz worker i enqueue’ujesz `document-process-jobs`, musisz mieć:

- zbudowane `apps/api` (żeby `dist/` było aktualne), np. `npm run build:api` lub `npm run build`.

## Notatki Windows

W `apps/api/src/services/document-processor.ts` konfiguracja Poppler na Windows jest ustawiona na:

- `C:\\ProgramData\\poppler\\poppler-24.08.0\\Library\\bin`

Jeżeli Poppler nie jest zainstalowany w tym miejscu, część funkcji OCR dla PDF może nie działać.
