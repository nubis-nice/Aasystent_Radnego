# 04 — Aplikacja API (`apps/api`)

## Rola

`apps/api` to backend HTTP dla systemu. Udostępnia endpointy pod prefiksem `/api`, obsługuje autoryzację użytkownika (Supabase), wykonuje operacje na danych (Supabase DB) oraz orkiestruje zadania asynchroniczne (BullMQ/Redis) i integracje AI.

## Entrypoint i konfiguracja serwera

- Plik: `apps/api/src/index.ts`
- Framework: Fastify
- Port: `API_PORT` (domyślnie `3001`)
- CORS:
  - dozwolone originy: `http://localhost:*`, `http://127.0.0.1:*`
  - `credentials: true`
  - `allowedHeaders`: `Content-Type`, `Authorization`, `x-user-id`
- Upload plików: `@fastify/multipart`, limit `10MB`
- WebSocket: `@fastify/websocket`
- Endpoint healthcheck:
  - `GET /health`

## Rejestracja routów

`apps/api/src/index.ts` rejestruje moduły routingu w dwóch trybach:

### Public (bez globalnego auth middleware)

- `authRoutes` z prefiksem `/api`
- `testApiRoutes` z prefiksem `/api`
- `apiModelsRoutes` z prefiksem `/api`
- `providerRoutes` z prefiksem `/api`
- `websocketRoutes` z prefiksem `/api`
- `sseRoutes` z prefiksem `/api`

### Protected (z `authMiddleware` na `onRequest`)

`authMiddleware` jest dodawany jako hook `onRequest` dla grupy routów i wymaga nagłówka:

- `Authorization: Bearer <token>`

Następnie rejestrowane są m.in.:

- `documentsRoutes`
- `chatRoutes`
- `dataSourcesRoutes`
- `legalAnalysisRoutes`
- `deepResearchRoutes`
- `dashboardRoutes`
- `youtubeRoutes`
- `diagnosticsRoutes`
- `documentGraphRoutes`
- `voiceRoutes`
- `gusRoutes`
- `isapRoutes`
- `euFundsRoutes`
- `geoportalRoutes`
- `terytRoutes`
- `krsRoutes`
- `ceidgRoutes`
- `gdosRoutes`
- `webSearchRoutes`
- `testRoutes`

**Uwaga:** część routów „public” może wciąż weryfikować tokeny wewnątrz handlerów. Powyższy podział dotyczy tylko globalnego middleware.

### Lista plików routingu (wg katalogu)

Katalog: `apps/api/src/routes/`

- `api-models.ts`
- `auth.ts`
- `ceidg.ts`
- `chat.ts`
- `dashboard.ts`
- `data-sources.ts`
- `deep-research.ts`
- `diagnostics.ts`
- `document-graph.ts`
- `documents.ts`
- `eu-funds.ts`
- `gdos.ts`
- `geoportal.ts`
- `gus.ts`
- `isap.ts`
- `krs.ts`
- `legal-analysis.ts`
- `providers.ts`
- `sse.ts`
- `teryt.ts`
- `test-api.ts`
- `test.ts`
- `voice.ts`
- `web-search.ts`
- `websocket.ts`
- `youtube.ts`

## Auth middleware

- Plik: `apps/api/src/middleware/auth.ts`
- Mechanizm:
  - odczyt nagłówka `Authorization`
  - walidacja tokenu w Supabase przez `supabase.auth.getUser(token)`
  - zapisanie `request.headers["x-user-id"] = user.id`

**Konsekwencja:** downstream handler powinien traktować `x-user-id` jako _informację wewnętrzną_, ustawianą przez middleware po udanej weryfikacji Bearer tokena.

## Integracje asynchroniczne (kolejki)

### `transcription-jobs`

- Serwis kolejki: `apps/api/src/services/transcription-queue.ts`
- Enqueue m.in. w route:
  - `apps/api/src/routes/youtube.ts` (`/youtube/transcribe-async`)
- Persystencja statusów:
  - tabela `transcription_jobs` (Supabase)
  - tabela `background_tasks` (Supabase)

### `document-process-jobs`

- Serwis kolejki: `apps/api/src/services/document-process-queue.ts`
- Enqueue w route:
  - `apps/api/src/routes/documents.ts` (`/documents/jobs`)
- Persystencja statusów:
  - tabela `document_jobs` (Supabase)
  - tabela `background_tasks` (Supabase)

### `vision-jobs`

- Serwis kolejki: `apps/api/src/services/vision-queue.ts`
- Enqueue m.in. w:
  - `apps/api/src/services/document-processor.ts` (fallback OCR przez Vision API)

## Kluczowe serwisy (wybrane)

Katalog: `apps/api/src/services/`

- **AI System**: `apps/api/src/ai/*`
  - presety providerów (`defaults.ts`)
  - resolver konfiguracji (`ai-config-resolver.ts`)
  - fabryka klientów (`ai-client-factory.ts`)

- **DocumentProcessor**: `document-processor.ts`
  - OCR/Tesseract + Poppler
  - Vision fallback przez `vision-queue`
  - opcjonalny etap 2: „OCR tekst → struktura JSON”

- **ScrapingQueueManager**: `scraping-queue.ts`
  - kolejka in-memory (brak BullMQ w implementacji)
  - integracja z `background_tasks` i WebSocket

- **Websocket hub**: `websocket-hub.ts`
  - rejestracja połączeń
  - publikacja statusów zadań

- **BackgroundTaskService**: `background-task-service.ts`
  - zapis statusów do tabeli `background_tasks`

## Artefakty build i ESM

- `apps/api` ma `type: module` i kompiluje do `apps/api/dist/*`.
- Część kodu workerów (`apps/worker`) wykonuje dynamiczne importy z `apps/api/dist/services/*`.

## Tabele/bucket’y Supabase widoczne w kodzie (niepełna lista)

Poniższa lista wynika z odwołań w kodzie (pełny schemat jest w `apps/api/migrations/*`):

- `user_profiles`
- `processed_documents`
- `conversations`
- `messages`
- `data_sources`
- `scraped_content`
- `background_tasks`
- `transcription_jobs`
- `document_jobs`
- `document_relations`
