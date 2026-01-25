# 05 — Aplikacja Worker (`apps/worker`)

## Rola

`apps/worker` uruchamia procesy BullMQ (`Worker`) podłączone do Redis. Przetwarza zadania asynchroniczne, które są enqueue’owane głównie przez aplikację API.

## Entrypoint

- Plik: `apps/worker/src/index.ts`
- Ładowanie env: `import "dotenv/config"` (zależne od standardowego mechanizmu dotenv)
- Redis:
  - `REDIS_HOST` (domyślnie `localhost`)
  - `REDIS_PORT` (domyślnie `6379`)

## Kolejki i workery

W `apps/worker/src/index.ts` inicjalizowane są kolejki (`Queue`) oraz workery (`Worker`).

### 1) `document-jobs`

- Queue: `new Queue("document-jobs")`
- Worker: `new Worker("document-jobs", ...)`
- Obsługiwane job name:
  - `extraction` → `apps/worker/src/jobs/extraction.ts`
  - `analysis` → `apps/worker/src/jobs/analysis.ts`
  - `relations` → `apps/worker/src/jobs/relations.ts`
- Concurrency: `2`
- Limiter: `max=10` / `60s`

**Status w repo:** w `apps/api/src` nie znaleziono miejsca, które enqueue’uje `document-jobs` — możliwe, że jest to funkcjonalność legacy / w trakcie przebudowy.

### 2) `document-process-jobs`

- Queue: `new Queue("document-process-jobs")`
- Worker: `new Worker("document-process-jobs", ...)`
- Obsługiwany job name:
  - `process-document` (enqueue w API)
- Processor:
  - `apps/worker/src/jobs/document-process.ts`

**Dane i efekty:**

- job pobiera `fileBuffer` jako base64, dekoduje do `Buffer`
- dla audio/wideo używa `AudioTranscriber` z `apps/api/dist/services/audio-transcriber.js`
- dla dokumentów/obrazów używa `DocumentProcessor` z `apps/api/dist/services/document-processor.js`
- wynik zapisuje do tabeli `document_jobs` w Supabase

**Ważne:** ta ścieżka wymaga istnienia artefaktów `apps/api/dist/*`.

### 3) `vision-jobs`

- Queue: `new Queue("vision-jobs")`
- Worker: `new Worker("vision-jobs", ...)`
- Obsługiwany job name:
  - `vision-ocr`
- Processor:
  - `apps/worker/src/jobs/vision.ts`
- Concurrency: `2`
- Limiter: `max=20` / `60s`

**Ważne:** `apps/worker/src/jobs/vision.ts` ładuje env przez:

- `dotenv.config({ path: path.resolve(__dirname, "../../../api/.env") })`

co oznacza, że worker w tym zakresie oczekuje pliku `.env` w `apps/api/`.

### 4) `transcription-jobs`

- Queue: `new Queue("transcription-jobs")`
- Worker: `new Worker("transcription-jobs", ...)`
- Obsługiwany job name:
  - `youtube-transcription`
- Processor:
  - `apps/worker/src/jobs/transcription.ts`
- Concurrency: `1`
- Limiter: `max=5` / `3600000ms` (1h)

**Ważne:** w repo istnieje także alternatywny worker transkrypcji w `apps/api` (`apps/api/src/services/transcription-worker.ts`) — dwie implementacje mogą przetwarzać tę samą kolejkę.

### 5) `user-jobs`

- Queue: `new Queue("user-jobs")`
- Worker: `new Worker("user-jobs", ...)`
- Processor:
  - `apps/worker/src/handlers/user-jobs.ts`

`user-jobs` obsługuje akcje typu:

- `analyze_document`
- `export_chat`
- `delete_document`
- `summarize_document`

**Status w repo:** w `apps/api/src` nie znaleziono enqueue’owania tej kolejki (możliwy moduł planowany / testowy).

## Cross-importy i coupling

W `apps/worker` występują cross-importy z aplikacji API.

### Importy z `apps/api/src/*`

- `apps/worker/src/jobs/transcription.ts` importuje:
  - typy z `apps/api/src/services/transcription-queue.js`
  - `YouTubeDownloader` z `apps/api/src/services/youtube-downloader.js`
  - `getEmbeddingsClient/getLLMClient/getAIConfig` z `apps/api/src/ai/index.js`

### Importy z `apps/api/dist/*`

- `apps/worker/src/jobs/document-process.ts` importuje dynamicznie:
  - `apps/api/dist/services/document-processor.js`
  - `apps/api/dist/services/audio-transcriber.js`

**Konsekwencje:**

- worker jest sprzężony z wewnętrzną strukturą API (zarówno `src`, jak i `dist`).
- w praktyce wymaga to dyscypliny build/deploy (kolejność budowania, kompatybilność ESM).

## Minimalny zestaw zmiennych środowiskowych (na podstawie kodu)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_HOST`
- `REDIS_PORT`

Dodatkowo, dla zadań AI:

- konfiguracje providerów są pobierane z Supabase (`ai_configurations`, `ai_providers`) lub z env (fallback, zależnie od scenariusza).
