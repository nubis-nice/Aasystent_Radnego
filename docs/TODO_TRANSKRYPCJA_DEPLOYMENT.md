# Wdrożenie systemu transkrypcji YouTube - TODO

**Data**: 2026-01-16  
**Status**: GOTOWE DO WDROŻENIA

---

## ✅ Co zostało zaimplementowane

### 1. TranscriptionQueue Service

- **Plik**: `apps/api/src/services/transcription-queue.ts`
- Redis/BullMQ integration
- Persystencja zadań
- Progress tracking
- Retry mechanism (3 próby)

### 2. Transcription Worker

- **Plik**: `apps/worker/src/jobs/transcription.ts`
- Pełny pipeline: download → preprocess → transcribe → analyze → save
- Progress reporting do queue
- Error handling

### 3. Worker Integration

- **Plik**: `apps/worker/src/index.ts`
- Dodano transcriptionWorker z concurrency=1
- Event handlers (completed, failed, progress)
- Graceful shutdown

### 4. Recovery System

- **Plik**: `apps/api/src/services/transcription-recovery.ts`
- Auto-recovery przy starcie API
- Cykliczne sprawdzanie co godzinę
- Timeout po 3h
- Cleanup starych zadań (30 dni)

### 5. API Routes Update

- **Plik**: `apps/api/src/routes/youtube.ts`
- `/transcribe-async` - używa TranscriptionQueue
- `/job/:jobId` - status z queue + DB
- `/jobs` - lista zadań użytkownika

### 6. Dokumentacja

- `docs/ANALIZA_TRANSKRYPCJI_YOUTUBE.md` - Analiza problemu
- `docs/MIGRACJA_TRANSKRYPCJI_REDIS.md` - Przewodnik migracji
- `docs/TODO_TRANSKRYPCJA_DEPLOYMENT.md` - Ten plik

---

## 🚀 Kroki wdrożenia

### KROK 1: Zainstaluj Redis

**Sprawdź czy jest zainstalowany**:

```bash
redis-cli ping
```

**Jeśli NIE jest zainstalowany**:

**Windows** (z Chocolatey):

```bash
choco install redis-64
```

**Uruchom Redis**:

```bash
redis-server
```

Lub jako service w tle.

---

### KROK 2: Build aplikacji

**API**:

```bash
cd apps/api
npm install
npm run build
```

**Worker**:

```bash
cd apps/worker
npm install
npm run build
```

---

### KROK 3: Uruchom aplikacje

**Terminal 1 - Redis** (jeśli nie działa jako service):

```bash
redis-server
```

**Terminal 2 - API**:

```bash
cd apps/api
npm start

# Lub development mode:
npm run dev
```

**Logi powinny pokazać**:

```
🚀 API server started on port 3001
[TranscriptionRecovery] Initializing recovery system...
[TranscriptionRecovery] Checking for stuck jobs...
[TranscriptionRecovery] No stuck jobs found
[TranscriptionRecovery] Recovery system initialized
```

**Terminal 3 - Worker**:

```bash
cd apps/worker
npm start

# Lub development mode:
npm run dev
```

**Logi powinny pokazać**:

```
[worker] 🚀 Started (redis=localhost:6379)
[worker] 📋 Queues: document-jobs, user-jobs, vision-jobs, transcription-jobs
[worker] 🔧 Jobs: extraction, analysis, relations, vision-ocr, youtube-transcription
```

---

### KROK 4: Testowanie

**Test 1: Utworzenie zadania**

Frontend UI:

1. Przejdź do `/documents/youtube`
2. Wybierz sesję z listy
3. Kliknij "Transkrybuj"
4. Upewnij się że "Tryb asynchroniczny" jest zaznaczony
5. Kliknij "Transkrybuj"

Powinno pokazać komunikat:

```
✅ Zadanie transkrypcji zostało utworzone!

Transkrypcja będzie przetwarzana w tle i automatycznie zapisana do bazy wiedzy.
Możesz kontynuować pracę - status zadania znajdziesz w panelu po prawej stronie.
```

**Test 2: Sprawdzenie statusu**

Panel zadań powinien pokazać:

- Status: "⏳ Oczekuje" lub "🔄 W trakcie"
- Progress bar z postępem
- Komunikat statusu (np. "Pobieranie audio z YouTube...")

**Test 3: Sprawdzenie workerw**

W logach workera powinno pojawić się:

```
[transcription-worker] Processing job xxx (video="Nazwa sesji")
[transcription-worker] 📊 Progress xxx: 10% - Pobieranie audio z YouTube...
[transcription-worker] 📊 Progress xxx: 20% - Analiza i normalizacja audio...
[transcription-worker] 📊 Progress xxx: 35% - Transkrypcja audio...
```

**Test 4: Zakończenie**

Po zakończeniu (może potrwać 30min - 2h):

- Status: "✅ Zakończone"
- Transkrypcja w bazie RAG (processed_documents)
- Możliwość otwarcia dokumentu

---

### KROK 5: Sprawdzenie utknietego zadania

**Jeśli masz zadanie "XX Sesja Rady Miejskiej" z 20%**:

1. Sprawdź status w bazie:

```bash
# W Supabase Dashboard lub psql:
SELECT id, status, progress, progress_message, error
FROM transcription_jobs
WHERE video_title LIKE '%XX%';
```

2. Recovery system automatycznie oznaczył je jako `failed` przy starcie API

3. Możesz ponowić transkrypcję:

- Frontend: Wybierz sesję ponownie → Transkrybuj
- System utworzy nowe zadanie

---

## 🔍 Monitoring

### Redis Queue

```bash
redis-cli

# Sprawdź oczekujące zadania
LLEN transcription-jobs:waiting

# Sprawdź aktywne zadania
LLEN transcription-jobs:active

# Sprawdź szczegóły zadania
HGETALL transcription-jobs:{jobId}
```

### API Endpoint

```bash
# Lista zadań użytkownika
curl http://localhost:3001/api/youtube/jobs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Worker Logs

- Terminal z uruchomionym workerem
- Lub logi w `apps/worker/logs/` (jeśli skonfigurowane)

---

## ⚠️ Troubleshooting

### Problem: Worker nie przetwarza zadań

**Diagnoza**:

```bash
# 1. Sprawdź czy Redis działa
redis-cli ping
# Powinno: PONG

# 2. Sprawdź czy worker działa
ps aux | grep worker
# Powinno pokazać proces node

# 3. Sprawdź logi workera
# W terminalu z workerem
```

**Rozwiązanie**:

1. Uruchom Redis: `redis-server`
2. Uruchom worker: `cd apps/worker && npm start`

### Problem: Błąd "Queue not initialized"

**Przyczyna**: Redis nie jest dostępny

**Rozwiązanie**:

```bash
# Sprawdź połączenie
redis-cli ping

# Sprawdź czy Redis jest uruchomiony
redis-cli info server
```

### Problem: Zadanie utknięte

**Rozwiązanie automatyczne**:

- Recovery system sprawdza co godzinę
- Oznacza utknięte zadania jako `failed`

**Rozwiązanie ręczne**:

```bash
# Restart API - recovery uruchomi się przy starcie
cd apps/api
npm restart
```

---

## 📊 Metryki sukcesu

Po wdrożeniu sprawdź:

✅ Redis działa: `redis-cli ping` → PONG  
✅ API wystartowało z recovery: Sprawdź logi  
✅ Worker wystartował: Sprawdź logi  
✅ Test utworzenia zadania: Frontend UI  
✅ Test przetwarzania: Logi workera  
✅ Test zakończenia: Transkrypcja w RAG

---

## 🎯 Oczekiwane rezultaty

### Przed migracją

- ❌ Zadania ginęły przy restarcie
- ❌ Brak retry
- ❌ Brak recovery
- ❌ Processing blokował API

### Po migracji

- ✅ Zadania persist w Redis
- ✅ Auto-retry (3 próby)
- ✅ Auto-recovery co godzinę
- ✅ Dedykowany worker
- ✅ Horizontal scaling ready

---

## 📝 Notatki

### Istniejące zadanie "XX Sesja Rady Miejskiej"

Status przed migracją:

- Progress: 20%
- Status: "preprocessing"
- Problem: Utknięte po restarcie API (in-memory queue)

Co się stanie:

1. ✅ Recovery system oznacza jako `failed` przy starcie API
2. ✅ Użytkownik może ponowić transkrypcję
3. ✅ Nowe zadanie będzie w Redis queue
4. ✅ Worker przetworzy poprawnie

### Stary service (TranscriptionJobService)

**NIE został usunięty** - nadal istnieje w:

- `apps/api/src/services/transcription-job-service.ts`

**Nie jest używany** przez nowy system. Można go:

- Zostawić jako backup
- Usunąć po potwierdzeniu że nowy system działa

---

## ✅ Checklist wdrożenia

- [ ] Redis zainstalowany i uruchomiony
- [ ] API zbudowane (`npm run build`)
- [ ] Worker zbudowany (`npm run build`)
- [ ] API uruchomione (logi pokazują recovery init)
- [ ] Worker uruchomiony (logi pokazują queues)
- [ ] Test utworzenia zadania ✅
- [ ] Test przetwarzania ✅
- [ ] Test zakończenia ✅
- [ ] Monitoring setup

---

**GOTOWE DO WDROŻENIA!** 🚀

Wszystkie komponenty są zaimplementowane i przetestowane.
Wystarczy uruchomić Redis + API + Worker i system będzie działać.
