# 08 — Kolejki i kontrakty (BullMQ/Redis)

Ten rozdział opisuje kolejki asynchroniczne i ich kontrakty danych, które łączą `apps/api` oraz `apps/worker`.

## Zasady i nazewnictwo

- **Queue name**: identyfikator kolejki w Redis (BullMQ)
- **Job name**: nazwa typu zadania w ramach kolejki (`queue.add(<jobName>, ...)`)
- **Job ID**: identyfikator instancji joba (`jobId` w BullMQ)

## Przegląd kolejek

| Queue name              | Producent (enqueue)                                      | Konsument (worker)                         | Job name                              | Persystencja statusu                          |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------ | ------------------------------------- | --------------------------------------------- |
| `transcription-jobs`    | API: `transcription-queue.ts` (m.in. route `youtube.ts`) | Worker: `apps/worker` **i/lub** `apps/api` | `youtube-transcription`               | `transcription_jobs` + `background_tasks`     |
| `document-process-jobs` | API: `document-process-queue.ts` (route `documents.ts`)  | Worker: `apps/worker`                      | `process-document`                    | `document_jobs` + `background_tasks`          |
| `vision-jobs`           | API: `vision-queue.ts` (m.in. `document-processor.ts`)   | Worker: `apps/worker`                      | `vision-ocr`                          | wynik w Redis (BullMQ) + cache w API (krótko) |
| `document-jobs`         | UNKNOWN (brak enqueue w `apps/api/src`)                  | Worker: `apps/worker`                      | `extraction`, `analysis`, `relations` | UNKNOWN                                       |
| `user-jobs`             | UNKNOWN (brak enqueue w `apps/api/src`)                  | Worker: `apps/worker`                      | zależne od `action`                   | UNKNOWN                                       |

## `transcription-jobs`

### Kontrakt joba (API)

- Plik: `apps/api/src/services/transcription-queue.ts`

```ts
export interface TranscriptionJobData {
  id: string;
  userId: string;
  videoUrl: string;
  videoTitle: string;
  sessionId?: string;
  includeSentiment: boolean;
  identifySpeakers: boolean;
  createdAt: string;
}
```

Job enqueue:

- `queue.add("youtube-transcription", jobData, { jobId, priority })`

### Status i monitoring

- `apps/api/src/routes/youtube.ts` zapisuje rekord do tabeli `transcription_jobs` (Supabase):
  - `id` = `jobId` z BullMQ
  - `status: "pending"`
  - `progress`, `progress_message`

- `apps/api/src/services/transcription-queue.ts`:
  - tworzy `background_tasks` (`taskType: transcription`, `metadata.jobId = jobId`)
  - nasłuchuje `QueueEvents` i aktualizuje `background_tasks` przez `updateByJobId(jobId, ...)`

### Konsument: Worker (`apps/worker`)

- Plik: `apps/worker/src/jobs/transcription.ts`

Cechy:

- używa `YouTubeDownloader` importowanego bezpośrednio z `apps/api/src/services/youtube-downloader.js`
- aktualizuje tabelę `transcription_jobs` (Supabase) w trakcie przetwarzania
- zapisuje transkrypcję do `processed_documents`
- aktualizuje `scraped_content.metadata.transcriptionStatus`

**Uwaga o spójności:**

- Worker zapisuje `processed_documents.document_type = "transkrypcja"`.
- Alternatywny worker w API (poniżej) zapisuje `processed_documents.document_type = "transcription"`.

### Konsument: API (`apps/api`) — alternatywny worker

- Plik: `apps/api/src/services/transcription-worker.ts`
- Inicjalizacja w `apps/api/src/index.ts` (`initializeTranscriptionWorker()`)

Zapis do `processed_documents`:

- `document_type: "transcription"`

### Detailed progress — stan implementacji

W repo istnieją typy:

- `DetailedTranscriptionProgress`
- `TranscriptionStepProgress`

Jednak:

- w `apps/api/src/services/transcription-queue.ts` metoda `getJobStatus()` nie mapuje `detailedProgress` (w aktualnym kodzie).
- route `youtube.ts` zwraca `detailedProgress: job.detailedProgress` — w praktyce może być `undefined`.

Dodatkowo występuje rozbieżność kroków progress:

- API definiuje `TRANSCRIPTION_STEPS` (m.in. `conversion`, `splitting`, `deduplication`, `correction`)
- Worker używa własnych kroków w `apps/worker/src/jobs/transcription-progress.ts` (m.in. `preprocessing`, `analysis`)

## `document-process-jobs`

### Kontrakt joba

- Plik: `apps/api/src/services/document-process-queue.ts`

```ts
export interface DocumentProcessJobData {
  userId: string;
  fileName: string;
  fileBuffer: string; // base64
  mimeType: string;
  fileSize: number;
  options?: {
    useVisionOnly?: boolean;
    tesseractConfidenceThreshold?: number;
    visionMaxDimension?: number;
  };
}
```

Job enqueue:

```ts
queue.add("process-document", data, {
  jobId: "doc-" + randomUUID(),
  priority: 1,
});
```

### Persystencja

- API zapisuje rekord do `document_jobs` przed enqueue.
- Status joba jest aktualizowany:
  - przez `QueueEvents` w API (`document-process-queue.ts`)
  - oraz przez procesor w workerze (`apps/worker/src/jobs/document-process.ts`).

### Konsument (worker)

- Plik: `apps/worker/src/jobs/document-process.ts`

Wykonanie:

- jeśli `mimeType` zaczyna się od `audio/` lub `video/` → transkrypcja (`AudioTranscriber` z `apps/api/dist`)
- w przeciwnym razie OCR (`DocumentProcessor` z `apps/api/dist`)

Wynik:

- zapisany do `document_jobs.result`.

## `vision-jobs`

### Kontrakt joba — `vision-jobs`

- Plik: `apps/api/src/services/vision-queue.ts`

```typescript
export interface VisionJobData {
  id: string;
  userId: string;
  imageBase64: string;
  prompt: string;
  pageNumber?: number;
  fileName?: string;
  provider: string;
  model: string;
  createdAt: string;
}
```

Job enqueue:

- `queue.add("vision-ocr", jobData, { jobId, priority })`

### Konsument (worker) — `vision-jobs`

- Plik: `apps/worker/src/jobs/vision.ts`

Cechy:

- buduje request „openai-compatible” (`OpenAI` client z `baseURL`)
- pobiera konfigurację użytkownika z Supabase
- raportuje progress liczbą (`job.updateProgress(30)` itd.)

### Synchronizacja wyniku

API oferuje:

- `waitForVisionResult(jobId, timeoutMs?)`

W `DocumentProcessor` (`apps/api/src/services/document-processor.ts`) wywołanie używa timeoutu `300000ms` (5 minut) per strona.

## `ScrapingQueueManager` (kolejka in-memory)

- Plik: `apps/api/src/services/scraping-queue.ts`

To nie jest BullMQ. Implementacja używa:

- `queue: ScrapingJob[]`
- `runningJobs: Map<string, ScrapingJob>`

i limitu równoległości `maxConcurrent`.

Integracja real-time:

- WebSocketHub (`wsHub.registerTask/updateTask`)
- `backgroundTaskService.createTask/updateByJobId`

**Uwaga:** ID joba w `enqueue()` jest generowane z użyciem `Math.random()`.

## `document-jobs` i `user-jobs` — status

Kolejki istnieją w `apps/worker/src/index.ts`, ale na podstawie przeszukania `apps/api/src`:

- nie znaleziono enqueue `document-jobs`
- nie znaleziono enqueue `user-jobs`

Traktuj je jako moduły:

- legacy / eksperymentalne
- lub wymagające dopięcia producenta po stronie API.
