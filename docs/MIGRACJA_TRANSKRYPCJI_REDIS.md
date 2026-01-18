# Migracja systemu transkrypcji YouTube do Redis/BullMQ

**Data**: 2026-01-16  
**Status**: UKOŃCZONE ✅

---

## 🎯 Cel migracji

Zastąpienie **in-memory queue** systemem **Redis/BullMQ** dla:

- ✅ Persystencji zadań (odporność na restarty)
- ✅ Horizontal scaling workerów
- ✅ Retry mechanizm
- ✅ Recovery utkniętych zadań
- ✅ Timeout handling

---

## 📦 Zmiany w architekturze

### Przed migracją

```
Frontend → API → TranscriptionJobService
                 ↓
                 In-Memory Map<string, Job>  ← PROBLEM!
                 ↓
                 processJob() w tym samym procesie
```

**Problemy**:

- Restart API = utrata zadań
- Brak retry
- Processing blokuje API
- Brak recovery

### Po migracji

```
Frontend → API → TranscriptionQueue (Redis/BullMQ)
                 ↓
                 Redis (persystencja)
                 ↓
           Worker (dedykowany proces)
                 ↓
           processTranscription()
                 ↓
           RAG + Supabase
```

**Korzyści**:

- ✅ Persystencja w Redis
- ✅ Auto-retry (3 próby)
- ✅ Dedykowany worker
- ✅ Recovery system
- ✅ Horizontal scaling

---

## 🗂️ Nowe pliki

### 1. TranscriptionQueue Service

**Lokalizacja**: `apps/api/src/services/transcription-queue.ts`

**Funkcje**:

- Singleton pattern (jak VisionQueue)
- Redis/BullMQ integration
- Job queueing i status tracking
- Progress cache dla realtime updates

**API**:

```typescript
addTranscriptionJob(userId, videoUrl, videoTitle, options);
getTranscriptionJobStatus(jobId);
getUserTranscriptionJobs(userId);
waitForTranscriptionResult(jobId, timeout);
cancelTranscriptionJob(jobId);
retryTranscriptionJob(jobId);
```

**Konfiguracja**:

- Attempts: 3
- Backoff: exponential (5s → 10s → 20s)
- Timeout: 2h per job
- Retention: 7 dni (completed), 30 dni (failed)

### 2. Transcription Worker Job

**Lokalizacja**: `apps/worker/src/jobs/transcription.ts`

**Pipeline**:

1. Download audio (yt-dlp)
2. Preprocess audio (ffmpeg)
3. Transcription (Whisper STT)
4. Speaker identification (LLM)
5. Save to RAG (processed_documents)
6. Update status

**Progress reporting**:

- 10% - Download
- 20% - Preprocessing
- 35-60% - Transcription
- 60-85% - Analysis
- 85-100% - Save

### 3. Recovery Service

**Lokalizacja**: `apps/api/src/services/transcription-recovery.ts`

**Funkcje**:

- `recoverStuckJobs()` - Znajdź i oznacz utknięte zadania
- `markTimeoutJobs()` - Timeout po 3h
- `cleanupOldJobs()` - Usuń zadania starsze niż 30 dni
- `runRecoveryCycle()` - Pełny cykl (co godzinę)

**Auto-start**: Przy starcie API w `apps/api/src/index.ts`

### 4. Worker Integration

**Lokalizacja**: `apps/worker/src/index.ts`

**Dodano**:

- `transcriptionQueue` - Nowa kolejka
- `transcriptionWorker` - Worker z concurrency=1
- Event handlers (completed, failed, progress)
- Graceful shutdown

---

## 🔧 Zmienione pliki

### 1. YouTube API Routes

**Plik**: `apps/api/src/routes/youtube.ts`

**Zmiany**:

- Import z `transcription-queue` zamiast `transcription-job-service`
- `/transcribe-async` - Używa `addTranscriptionJob()` + zapis do DB
- `/job/:jobId` - Używa `getTranscriptionJobStatus()` + wzbogacenie z DB
- `/jobs` - Używa `getUserTranscriptionJobs()` + join z DB

### 2. API Server Startup

**Plik**: `apps/api/src/index.ts`

**Dodano**:

```typescript
import { initializeTranscriptionRecovery } from "./services/transcription-recovery.js";

app.listen(...).then(async () => {
  await initializeTranscriptionRecovery(); // Auto-recovery
});
```

---

## 🗄️ Baza danych

### Tabela: transcription_jobs

**Użycie po migracji**:

- **Queue** (Redis) - Source of truth dla statusu w czasie rzeczywistym
- **Database** (Supabase) - Persystencja i audit trail

**Synchronizacja**:

- Worker aktualizuje DB podczas przetwarzania
- API czyta z queue + wzbogaca z DB
- Recovery service synchronizuje queue ↔ DB

**Schemat**: Bez zmian (już istnieje z migracji 023)

---

## ⚙️ Wymagania środowiskowe

### Redis

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Instalacja** (jeśli brak):

```bash
# Windows (z Chocolatey)
choco install redis-64

# Linux/Mac
brew install redis  # macOS
sudo apt install redis  # Ubuntu
```

**Start**:

```bash
redis-server
```

### Worker Process

**Musi być uruchomiony** dla przetwarzania zadań:

```bash
cd apps/worker
npm run dev  # Development
npm start    # Production
```

---

## 🚀 Deployment

### 1. Upewnij się że Redis działa

```bash
redis-cli ping
# Powinno zwrócić: PONG
```

### 2. Deploy API (z recovery)

```bash
cd apps/api
npm run build
npm start
```

**Logi powinny pokazać**:

```
[TranscriptionRecovery] Initializing recovery system...
[TranscriptionRecovery] Checking for stuck jobs...
[TranscriptionRecovery] No stuck jobs found
[TranscriptionRecovery] Recovery system initialized
```

### 3. Deploy Worker

```bash
cd apps/worker
npm run build
npm start
```

**Logi powinny pokazać**:

```
[worker] 🚀 Started (redis=localhost:6379)
[worker] 📋 Queues: document-jobs, user-jobs, vision-jobs, transcription-jobs
[worker] 🔧 Jobs: extraction, analysis, relations, vision-ocr, youtube-transcription
```

### 4. Testowanie

**Utwórz zadanie transkrypcji**:

```bash
curl -X POST http://localhost:3001/api/youtube/transcribe-async \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=...",
    "videoTitle": "Test Sesja",
    "includeSentiment": true,
    "identifySpeakers": true
  }'
```

**Sprawdź status**:

```bash
curl http://localhost:3001/api/youtube/jobs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Monitoruj workera**:

```bash
# W logach workera powinno pojawić się:
[transcription-worker] Processing job xxx (video="Test Sesja")
[transcription-worker] 📊 Progress xxx: 10% - Pobieranie audio z YouTube...
```

---

## 🔍 Monitoring

### Redis Queue Stats

```bash
redis-cli
> KEYS transcription-jobs:*
> HGETALL transcription-jobs:xxx
```

### API Endpoint

```bash
GET /api/youtube/jobs
# Zwraca wszystkie zadania użytkownika z queue
```

### Worker Logs

```bash
tail -f apps/worker/logs/worker.log

# Lub w konsoli:
npm run dev  # z opcją --watch
```

---

## 🐛 Troubleshooting

### Problem: Zadania nie są przetwarzane

**Diagnoza**:

```bash
# 1. Sprawdź Redis
redis-cli ping

# 2. Sprawdź worker
ps aux | grep worker

# 3. Sprawdź logi workera
cat apps/worker/logs/error.log
```

**Rozwiązanie**:

- Uruchom Redis: `redis-server`
- Uruchom worker: `cd apps/worker && npm start`

### Problem: Zadania utknięte w "pending"

**Diagnoza**:

```bash
# Sprawdź queue w Redis
redis-cli
> LLEN transcription-jobs:waiting
> LLEN transcription-jobs:active
```

**Rozwiązanie**:

```bash
# Uruchom recovery cycle ręcznie
curl -X POST http://localhost:3001/api/youtube/recovery/cycle \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Problem: Worker pada przy przetwarzaniu

**Diagnoza**:

- Sprawdź logi workera: `apps/worker/logs/error.log`
- Sprawdź pamięć: `top` lub `htop`
- Sprawdź ffmpeg: `ffmpeg -version`

**Rozwiązanie**:

- Zwiększ pamięć workera
- Sprawdź czy ffmpeg jest zainstalowany
- Zmniejsz concurrency w `apps/worker/src/index.ts`

### Problem: Błąd "Queue not initialized"

**Przyczyna**: Redis nie jest dostępny

**Rozwiązanie**:

```bash
# Sprawdź połączenie
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping

# Sprawdź firewall
telnet $REDIS_HOST $REDIS_PORT
```

---

## 📊 Metryki

### Przed migracją

- ❌ In-memory queue
- ❌ Brak retry
- ❌ Single point of failure
- ❌ Brak recovery

### Po migracji

- ✅ Redis persistence
- ✅ 3 retry attempts
- ✅ Horizontal scaling ready
- ✅ Auto-recovery co godzinę
- ✅ Timeout: 2h per job
- ✅ Cleanup: 30 dni retention

---

## 🔄 Rollback (gdyby coś poszło nie tak)

### Krok 1: Zatrzymaj worker

```bash
pkill -f "node.*worker"
```

### Krok 2: Przywróć stary service

```bash
git checkout HEAD~1 apps/api/src/services/transcription-job-service.ts
git checkout HEAD~1 apps/api/src/routes/youtube.ts
```

### Krok 3: Restart API

```bash
cd apps/api
npm run build
npm start
```

**Uwaga**: Utracisz zadania w queue Redis (ale DB jest nietknięty)

---

## ✅ Checklist wdrożenia

- [x] Redis zainstalowany i działa
- [x] Worker build i deploy
- [x] API build i deploy (z recovery)
- [x] Test utworzenia zadania
- [x] Test statusu zadania
- [x] Test recovery mechanism
- [x] Monitoring setup
- [x] Dokumentacja zaktualizowana

---

## 📚 Powiązane pliki

### Kod

- `apps/api/src/services/transcription-queue.ts` - Queue service
- `apps/api/src/services/transcription-recovery.ts` - Recovery service
- `apps/worker/src/jobs/transcription.ts` - Worker job
- `apps/worker/src/index.ts` - Worker integration
- `apps/api/src/routes/youtube.ts` - API routes
- `apps/api/src/index.ts` - API startup

### Dokumentacja

- `docs/ANALIZA_TRANSKRYPCJI_YOUTUBE.md` - Analiza problemu
- `docs/MIGRACJA_TRANSKRYPCJI_REDIS.md` - Ten dokument
- `docs/supabase_migrations/023_create_transcription_jobs.sql` - Schema

### Wzorce

- `apps/api/src/services/vision-queue.ts` - Wzór implementacji
- `apps/worker/src/jobs/vision.ts` - Wzór job processingu

---

## 🎓 Wnioski

### Co zadziałało dobrze

1. **Wzorzec VisionQueue** - Idealny szablon do naśladowania
2. **Separacja concerns** - Queue w API, processing w worker
3. **Recovery system** - Automatyczne wykrywanie i naprawa
4. **Dual persistence** - Redis (realtime) + Supabase (audit)

### Lessons learned

1. **Worker musi działać** - Bez workera zadania czekają w queue
2. **Redis jest critical** - Backup i monitoring Redis
3. **Timeout jest ważny** - 2h per job zapobiega wiszącym zadaniom
4. **Recovery co godzinę** - Wystarczająco często dla recovery

### Rekomendacje na przyszłość

1. **Monitoring** - Dodać Grafana/Prometheus dla queue stats
2. **Alerts** - Email/Slack gdy queue przekroczy threshold
3. **Auto-scaling** - Więcej workerów przy wielu zadaniach
4. **Prioritization** - Premium users = wyższy priorytet

---

**Migracja ukończona!** 🎉

System transkrypcji YouTube jest teraz production-ready z pełną persystencją i recovery.
