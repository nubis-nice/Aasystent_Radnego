# Diagnostyka aktywnego joba transkrypcji

**Data**: 2026-01-16  
**Job Status**: 29% - "Inicjalizacja Whisper..."  
**Problem**: Job może być zablokowany na etapie transcription

---

## 📊 Aktualny stan

### Widoczne w UI

- ✅ **Download** - zakończony (✓)
- ✅ **Preprocessing** - zakończony (✓)
- 🔄 **Transcription** - aktywny na 29% ("Inicjalizacja Whisper...")
- ⏳ **Analysis** - oczekuje
- ⏳ **Saving** - oczekuje

### Progress timeline

```
0-15%   Download      ✅ COMPLETED
15-25%  Preprocessing ✅ COMPLETED
25-65%  Transcription 🔄 ACTIVE (29%)  ← TUTAJ JESTEŚMY
65-85%  Analysis      ⏳ PENDING
85-100% Saving        ⏳ PENDING
```

---

## 🔍 Analiza pipeline w kodzie

### Sekwencja kroków w `transcription.ts`

**1. Download** (linie 76-106)

```typescript
await progressTracker.startStep("download", "Pobieranie audio...");
await progressTracker.updateStep("download", 50, "Łączenie z YouTube...");
const downloadResult = await downloader.downloadAudio(videoUrl);
await progressTracker.completeStep("download", { fileSize: "Unknown" });
```

✅ **Status**: Zakończony poprawnie (widać ✓ w UI)

**2. Preprocessing** (linie 108-116)

```typescript
await progressTracker.startStep("preprocessing", "Analiza audio...");
await progressTracker.updateStep(
  "preprocessing",
  50,
  "Przygotowanie do transkrypcji..."
);
```

✅ **Status**: Zakończony poprawnie (widać ✓ w UI)

**3. Transcription** (linie 118-173)

```typescript
await progressTracker.startStep("transcription", "Transkrypcja audio...");
await updateJobStatus(id, "transcribing", 35, "Transkrypcja audio...");

// ⚠️ TUTAJ JEST PROBLEM - progress 29% zatrzymał się tutaj:
await progressTracker.updateStep("transcription", 10, "Inicjalizacja Whisper...", {
  model: "whisper-1",
  language: "pl",
});

// Następnie powinno wywołać:
const transcriptionResult = await downloader.transcribeAndAnalyze(...);
```

---

## ⚠️ Zidentyfikowany problem

### Hipoteza 1: Worker utknął w `transcribeAndAnalyze()`

Job pokazuje 29% (25% start + 4% progress kroku), co odpowiada:

- Globalny progress: 25% (start transcription) + (10% \* (65-25)/100) = **29%** ✓

**Status**: Worker wywołał `updateStep("transcription", 10)` ale **nie zwrócił się z `transcribeAndAnalyze()`**

### Możliwe przyczyny:

1. **Whisper API timeout** - API nie odpowiada lub jest bardzo wolne
2. **Worker crash** - Worker przestał działać podczas transkrypcji
3. **Audio file problem** - Pobrany plik audio jest uszkodzony
4. **Network issues** - Brak połączenia z Whisper API
5. **Memory/Resource limits** - Worker zabił proces z powodu limitu pamięci

---

## 🔧 Komendy diagnostyczne

### 1. Sprawdź czy worker działa

**Windows PowerShell**:

```powershell
# Sprawdź proces workera
Get-Process | Where-Object {$_.ProcessName -like "*node*"}

# Lub sprawdź logi
cd d:\Aasystent_Radnego\apps\worker
npm run dev
```

**Oczekiwane logi** (jeśli działa poprawnie):

```
[TranscriptionWorker] Processing job xxx - "XX Sesja Rady Miejskiej"
[TranscriptionWorker] Audio downloaded: /tmp/audio-xxx.mp3
[TranscriptionWorker] 📊 Progress xxx: 10% - Inicjalizacja Whisper...
```

**Jeśli NIE MA logów** → Worker prawdopodobnie crashował

---

### 2. Sprawdź status w Redis queue

```bash
redis-cli

# Sprawdź active jobs
LLEN transcription-jobs:active

# Sprawdź konkretny job (zastąp XXX job ID)
HGETALL transcription-jobs:XXX

# Sprawdź czy są failed jobs
LLEN transcription-jobs:failed
```

**Co szukać**:

- `failedReason` - jeśli jest, pokazuje błąd
- `processedOn` - timestamp ostatniego update
- `finishedOn` - jeśli null, job nadal aktywny

---

### 3. Sprawdź Whisper API connectivity

**Test połączenia** (w workerze lub API):

```typescript
// Test Whisper API
const testResponse = await fetch("https://api.openai.com/v1/models", {
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  },
});
console.log("Whisper API status:", testResponse.status);
```

**Lub przez curl**:

```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_KEY"
```

---

### 4. Sprawdź logi błędów workera

**Lokalizacja logów**:

- Console: Terminal gdzie uruchomiony `npm run dev`
- File logs: `apps/worker/logs/` (jeśli skonfigurowane)

**Szukaj**:

```
Error
timeout
ECONNREFUSED
ETIMEDOUT
Out of memory
```

---

## 🚨 Najprawdopodobniejsze scenariusze

### Scenariusz A: Worker crashował podczas transcribeAndAnalyze()

**Objawy**:

- Progress zatrzymany na 29%
- Brak logów workera po "Inicjalizacja Whisper..."
- Worker nie działa (sprawdź `Get-Process`)

**Rozwiązanie**:

1. Restart workera: `cd apps/worker && npm run dev`
2. Job automatycznie się retry (BullMQ ma 3 próby)
3. Sprawdź logi czy powtarza błąd

### Scenariusz B: Whisper API timeout

**Objawy**:

- Worker działa ale job nie postępuje
- Możliwe logi: "Request timeout" lub brak odpowiedzi

**Rozwiązanie**:

1. Sprawdź połączenie z OpenAI API
2. Sprawdź czy `OPENAI_API_KEY` jest ustawiony
3. Zwiększ timeout w `transcribeAndAnalyze()` (domyślnie może być za krótki)

### Scenariusz C: Audio file problem

**Objawy**:

- Download ✓ ale transcription fails
- Możliwe logi: "Invalid audio format", "File corrupted"

**Rozwiązanie**:

1. Sprawdź czy plik audio istnieje: `/tmp/audio-*.mp3`
2. Sprawdź rozmiar pliku (czy > 0 bytes)
3. Test play audio file lokalnie

### Scenariusz D: Worker zabity przez system (OOM)

**Objawy**:

- Worker przestał działać nagle
- Brak "graceful shutdown" w logach
- Windows Event Log pokazuje "process killed"

**Rozwiązanie**:

1. Zmniejsz concurrency workera (domyślnie 1, OK)
2. Zwiększ pamięć dla Node: `NODE_OPTIONS=--max-old-space-size=4096`
3. Sprawdź Task Manager czy są spike'i pamięci

---

## ✅ Akcje do wykonania TERAZ

### Krok 1: Sprawdź czy worker działa

```powershell
cd d:\Aasystent_Radnego\apps\worker
# Jeśli nie działa
npm run dev
```

### Krok 2: Sprawdź logi workera

- Szukaj ostatniego logu dla job ID
- Zobacz czy jest error message

### Krok 3: Jeśli worker działa ale job utknął

```bash
# Sprawdź Redis
redis-cli
LLEN transcription-jobs:active
LLEN transcription-jobs:failed

# Sprawdź szczegóły joba
HGETALL transcription-jobs:<JOB_ID>
```

### Krok 4: Jeśli job failed - retry

- Job ma 3 retry attempts (BullMQ config)
- Automatycznie retry po fail
- Jeśli wszystkie 3 failed → sprawdź root cause

---

## 🐛 Debug mode

**Włącz verbose logging w workerze**:

```typescript
// apps/worker/src/jobs/transcription.ts
console.log("[DEBUG] Starting transcribeAndAnalyze...");
console.log("[DEBUG] Audio path:", downloadResult.audioPath);
console.log("[DEBUG] Video ID:", videoId);

const transcriptionResult = await downloader.transcribeAndAnalyze(...);

console.log("[DEBUG] Transcription result:", transcriptionResult.success);
```

**Restart workera** i obserwuj console.

---

## 📊 Oczekiwane zachowanie (prawidłowy flow)

```
[00:00] Download started (0%)
[02:15] Download completed (15%)
[02:15] Preprocessing started (15%)
[03:45] Preprocessing completed (25%)
[03:45] Transcription started (25%)
[03:50] Transcription progress: 10% - "Inicjalizacja Whisper..." (29%)
[04:00] Transcription progress: 30% - "Przetwarzanie audio..." (37%)
[15:00] Transcription progress: 80% - "Finalizacja..." (57%)
[18:00] Transcription completed (65%)
[18:00] Analysis started (65%)
[21:00] Analysis completed (85%)
[21:00] Saving started (85%)
[23:00] Saving completed (100%)
[23:00] Job completed!
```

**Aktualnie**: Zatrzymane na [03:50] - "Inicjalizacja Whisper..." (29%)

---

## 🔄 Recovery options

### Opcja 1: Poczekaj (jeśli worker działa)

- Whisper może być wolny dla długich audio (20+ min)
- Sprawdź za 5-10 minut czy progress się zmienił

### Opcja 2: Restart workera

```powershell
# Stop worker (Ctrl+C)
# Start worker
cd apps\worker
npm run dev
```

- BullMQ automatycznie retry failed jobs

### Opcja 3: Retry job ręcznie (przez UI)

- Jeśli job failed → frontend pokazuje przycisk "Retry"
- Lub utwórz nowe zadanie dla tej samej sesji

### Opcja 4: Force fail i cleanup

```bash
redis-cli
DEL transcription-jobs:<JOB_ID>
```

- Wymuś usunięcie z queue
- Utwórz nowe zadanie

---

## 📝 Następne kroki

1. **Sprawdź worker** - Czy działa? Logi?
2. **Sprawdź Redis** - Status joba? Failed?
3. **Sprawdź Whisper API** - Connectivity? Timeout?
4. **Retry jeśli failed** - Worker automatycznie retry
5. **Raport** - Zapisz błędy dla analizy

---

**Priorytet**: Sprawdź logi workera - tam będzie root cause! 🔍
