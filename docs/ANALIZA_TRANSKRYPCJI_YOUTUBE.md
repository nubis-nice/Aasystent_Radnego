# Analiza systemu transkrypcji YouTube

**Data**: 2026-01-16  
**Status**: KRYTYCZNE PROBLEMY ZIDENTYFIKOWANE

---

## 🎯 Executive Summary

System transkrypcji YouTube działa z **krytycznymi problemami architektury**:

- In-memory queue bez persystencji → utrata zadań przy restarcie
- Brak dedykowanego workera → processing w API blocking
- Brak retry/recovery mechanizmu → zadania utykają
- Polling overhead → niepotrzebne obciążenie

**Priorytet naprawy**: WYSOKI

---

## 🏗️ Architektura obecna

### Pipeline

```
┌─────────────┐
│   Frontend  │ Poll co 3s
│   (React)   │
└──────┬──────┘
       │ POST /youtube/transcribe-async
       ↓
┌─────────────────────────────────────┐
│         API (Fastify)               │
│  ┌───────────────────────────────┐  │
│  │ TranscriptionJobService       │  │
│  │                               │  │
│  │ In-Memory Queue               │  │
│  │ Map<string, Job> ← PROBLEM!   │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
       │
       ↓ processJob() async
┌─────────────────────────────────────┐
│  1. Download (yt-dlp)               │ 10%
│  2. Preprocessing (AudioAnalyzer)   │ 20%
│  3. Transcription (Whisper STT)     │ 35-60%
│  4. Analysis (Speaker ID + LLM)     │ 60-85%
│  5. Save to RAG                     │ 85-100%
└─────────────────────────────────────┘
       ↓
┌─────────────────────────────────────┐
│  Supabase                           │
│  - transcription_jobs (status)      │
│  - processed_documents (result)     │
└─────────────────────────────────────┘
```

### Komponenty

| Komponent              | Plik                                                         | Funkcja                                |
| ---------------------- | ------------------------------------------------------------ | -------------------------------------- |
| **Frontend**           | `apps/frontend/src/app/documents/youtube/page.tsx`           | UI, polling, zarządzanie zadaniami     |
| **API Routes**         | `apps/api/src/routes/youtube.ts`                             | Endpointy `/transcribe-async`, `/jobs` |
| **Job Service**        | `apps/api/src/services/transcription-job-service.ts`         | Kolejkowanie i processing              |
| **Downloader**         | `apps/api/src/services/youtube-downloader.ts`                | yt-dlp integration, STT                |
| **Audio Preprocessor** | `apps/api/src/services/audio-preprocessor.ts`                | Normalizacja audio (ffmpeg)            |
| **Audio Analyzer**     | `apps/api/src/services/audio-analyzer.ts`                    | Analiza parametrów audio               |
| **DB Schema**          | `docs/supabase_migrations/023_create_transcription_jobs.sql` | Tabela statusów                        |

---

## ❌ Problemy zidentyfikowane

### 1. 🔴 KRYTYCZNY: In-Memory Queue

**Lokalizacja**: `apps/api/src/services/transcription-job-service.ts:76-77`

```typescript
// In-memory job queue (w produkcji użyj Redis/Bull)
const jobQueue: Map<string, TranscriptionJob> = new Map();
```

**Problem**:

- Zadania przechowywane **tylko w pamięci procesu**
- Restart API → **utrata wszystkich zadań w trakcie**
- Brak persystencji stanu procesowania
- Memory leak przy wielu długich zadań

**Impact**:

- Zadanie "XX Sesja Rady Miejskiej" utknęło na 20%
- Status w DB: `preprocessing`, ale processing zatrzymany
- Frontend nadal pokazuje stare zadanie

**Komentarz w kodzie**:

> "// In-memory job queue (w produkcji użyj Redis/Bull)"

Ale **NIE zaimplementowano** Redis/BullMQ!

---

### 2. 🔴 KRYTYCZNY: Brak dedykowanego Workera

**Lokalizacja**: `apps/api/src/services/transcription-job-service.ts:135`

```typescript
this.processJob(jobId).catch((error) => {
  console.error(`[TranscriptionJob] Job ${jobId} failed:`, error);
});
```

**Problem**:

- Processing odbywa się **w tym samym procesie co API**
- Długie zadania (1h+) **blokują resources API**
- Brak możliwości horizontal scaling

**Istniejący folder workera**:

- `apps/worker/` istnieje ale NIE obsługuje transkrypcji
- Tylko OCR/Vision queue używa workera

**Potrzebne**:

- Dedykowany worker process
- Komunikacja przez Redis/BullMQ
- Możliwość uruchomienia wielu workerów

---

### 3. 🟡 ŚREDNI: Brak Recovery Mechanizmu

**Problem**:

- Zadania w statusie `pending`, `downloading`, `transcribing` po restarcie są **porzucone**
- Brak auto-retry
- Brak timeout handling
- Brak dead letter queue

**Konsekwencje**:

- Użytkownik musi ręcznie ponowić transkrypcję
- Utrata danych o częściowym progressie
- Brak logów błędów

---

### 4. 🟡 ŚREDNI: Polling Overhead

**Lokalizacja**: `apps/frontend/src/app/documents/youtube/page.tsx:97-104`

```typescript
const interval = setInterval(async () => {
  const result = await getTranscriptionJobs();
  setJobs(result.jobs);
}, 3000); // Co 3 sekundy!
```

**Problem**:

- Frontend polluje **wszystkie zadania użytkownika** co 3s
- Niepotrzebne obciążenie DB
- Brak WebSocket/SSE

**Better approach**:

- WebSocket dla realtime updates
- Long-polling tylko dla aktywnych zadań
- Server-Sent Events (SSE)

---

## ✅ Mocne strony systemu

### 1. ✅ Adaptacyjny Audio Preprocessing

**Lokalizacja**: `apps/api/src/services/audio-preprocessor.ts`

Bardzo dobry system analizy i preprocessingu:

- `AudioAnalyzer` - wykrywa problemy (clipping, noise, volume)
- Adaptacyjne filtry bazujące na analizie
- Normalizacja LUFS (standard EBU R128)
- Noise reduction, highpass/lowpass filters
- Kompresja dynamiki

```typescript
recommendations: {
  enableHighpass: true,      // 80Hz - usuwa rumble
  enableLowpass: true,       // 8kHz - usuwa hiss
  enableNoiseReduction: true,
  targetLoudness: -16,       // LUFS (standard mowy)
}
```

### 2. ✅ Speaker Identification

**Lokalizacja**: `apps/api/src/services/transcription-job-service.ts:413-522`

Inteligentna identyfikacja mówców:

- Pobiera listę radnych z `council_members` table
- LLM identyfikuje mówców po kontekście
- Rozpoznaje role (Przewodniczący, Burmistrz, Skarbnik)
- Fallback do "Radny/Radna N"

### 3. ✅ Sentiment Analysis

Pełna analiza każdego segmentu:

- Emocje (😊 😐 😠)
- Napięcie (0-10)
- Wiarygodność (0-100%)
- Dominujący sentyment sesji

### 4. ✅ RAG Integration

Automatyczny zapis do bazy wiedzy:

- Kategoria: "transkrypcje"
- Embedding dla semantic search
- Metadata: duration, speakers, sentiment
- Powiązanie z Sesjami Rady (document_relations)

---

## 📊 Status aktualnego zadania

Z DOM element widzę:

```
Zadanie: "XX Sesja Rady Miejskiej w Drawnie"
Status: ⏳ Oczekuje
Progress: 20%
Message: "Analiza i normalizacja audio..."
Estimated: ~1h 17min
```

**Diagnoza**:

1. Zadanie rozpoczęło się → download OK (10%)
2. Rozpoczęło preprocessing → AudioAnalyzer (20%)
3. **ZATRZYMANE** - prawdopodobnie restart API
4. Job w DB ma status `preprocessing` ale nie jest w memory queue
5. Frontend nadal polluje i pokazuje stare dane

**Akcja wymagana**:

- Sprawdzić logi API
- Zresetować zadanie do `failed`
- Uruchomić ponownie transkrypcję

---

## 🔧 Rekomendacje naprawy

### Priorytet 1: Implementacja Redis/BullMQ Queue

**Cel**: Persystencja zadań, odporność na restarty

**Implementacja**:

1. Zainstaluj `bullmq` i `ioredis`
2. Stwórz `TranscriptionQueue` w `services/transcription-queue.ts`
3. Przenieś processing do dedykowanego workera
4. Dodaj retry logic i error handling

**Przykład**:

```typescript
import { Queue, Worker } from "bullmq";

const transcriptionQueue = new Queue("transcription", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

const worker = new Worker(
  "transcription",
  async (job) => {
    // Processing logic
  },
  { connection: redis, concurrency: 2 }
);
```

### Priorytet 2: Dedykowany Worker Process

**Cel**: Separacja concerns, horizontal scaling

**Struktura**:

```
apps/worker/
  src/
    workers/
      transcription-worker.ts  ← NOWY
    index.ts
```

**Uruchomienie**:

- API: tworzy zadania w queue
- Worker: konsumuje zadania z queue
- Możliwość uruchomienia N workerów

### Priorytet 3: Recovery System

**Cel**: Auto-recovery po awarii

**Implementacja**:

1. Startup check - znajdź zadania `in_progress`
2. Jeśli job nie jest w queue → oznacz jako `failed`
3. Optional: auto-retry zadań failed < 3 attempts
4. Dead letter queue dla zadań permanentnie failed

**SQL check**:

```sql
UPDATE transcription_jobs
SET status = 'failed',
    error = 'Process interrupted (API restart)'
WHERE status IN ('downloading', 'preprocessing', 'transcribing')
  AND updated_at < NOW() - INTERVAL '10 minutes';
```

### Priorytet 4: WebSocket/SSE dla Updates

**Cel**: Realtime updates zamiast pollingu

**Implementacja**:

- Server-Sent Events endpoint `/youtube/jobs/stream`
- Worker emituje progress events
- Frontend subskrybuje stream

---

## 📈 Metryki systemu

| Metryka                 | Wartość     | Źródło                                              |
| ----------------------- | ----------- | --------------------------------------------------- |
| **Progress steps**      | 5           | download → preprocess → transcribe → analyze → save |
| **Estimated time**      | 1-2h        | Dla sesji ~1.5h długości                            |
| **Audio preprocessing** | Adaptacyjny | AudioAnalyzer recommendations                       |
| **STT model**           | large-v3    | Whisper (konfigurowalny)                            |
| **LLM model**           | gpt-4o      | Speaker identification                              |
| **Polling interval**    | 3s          | Frontend → API                                      |

---

## 🔍 Pliki do przeglądu

### Backend

- `apps/api/src/services/transcription-job-service.ts` - Główna logika (IN-MEMORY!)
- `apps/api/src/services/youtube-downloader.ts` - yt-dlp, STT
- `apps/api/src/services/audio-preprocessor.ts` - ffmpeg filtering
- `apps/api/src/services/audio-analyzer.ts` - Analiza parametrów
- `apps/api/src/routes/youtube.ts` - API endpoints

### Frontend

- `apps/frontend/src/app/documents/youtube/page.tsx` - UI i polling

### Database

- `docs/supabase_migrations/023_create_transcription_jobs.sql` - Schema

### Infrastructure

- `apps/worker/` - Istniejący ale nieużywany dla transkrypcji

---

## 🎬 Następne kroki

1. **Natychmiastowe**:

   - [ ] Sprawdź status zadania w DB: `SELECT * FROM transcription_jobs WHERE video_title LIKE '%XX Sesja%'`
   - [ ] Zresetuj utknięte zadanie do `failed`
   - [ ] Uruchom transkrypcję ponownie

2. **Krótkoterminowe (1-2 dni)**:

   - [ ] Implementuj Redis/BullMQ queue
   - [ ] Stwórz dedykowany transcription worker
   - [ ] Dodaj recovery system
   - [ ] Dodaj timeout handling

3. **Długoterminowe (1 tydzień)**:
   - [ ] Zastąp polling przez WebSocket/SSE
   - [ ] Dodaj monitoring i alerting
   - [ ] Implementuj horizontal scaling workerów
   - [ ] Performance optimization (chunk processing)

---

## 📚 Powiązana dokumentacja

- Memory: OCR Pipeline z VisionQueue (używa Redis/BullMQ) - WZÓR DO NAŚLADOWANIA
- Memory: DocumentAnalysisService RAG integration
- Code: `apps/api/src/services/vision-queue.ts` - Przykład prawidłowej implementacji queue

---

**Konkluzja**: System ma solidne fundamenty (preprocessing, STT, analysis) ale **krytyczne braki w architekturze task queue**. Wymaga refaktoryzacji z in-memory → Redis/BullMQ i dodania dedykowanego workera.
