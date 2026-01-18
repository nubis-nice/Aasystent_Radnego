# MVP Audio Chunking - Implementacja

**Data**: 2026-01-16  
**Wersja**: MVP (Time-based split, bez silence detection)  
**Status**: ✅ Zaimplementowane - Core funkcjonalność

---

## 🎯 Cel MVP

Podzielić długie audio (> 10 min) na części **co 10 minut** dla:

1. **Lepszego progress tracking** - widoczny postęp co 1-2 min zamiast 20-30 min
2. **Stabilności** - mniejsze pliki = mniejsze ryzyko timeout
3. **Retry per-part** - jeśli część fails → retry tylko tę część

**MVP**: Prosty time-based split (bez silence detection)  
**Future**: Inteligentny split z wykrywaniem ciszy (full version z design doc)

---

## ✅ Zaimplementowane komponenty

### 1. Audio Preprocessor - Splitting

**Plik**: `apps/api/src/services/audio-preprocessor.ts`

**Nowe interfejsy**:

```typescript
export interface AudioPart {
  index: number; // 1, 2, 3...
  filePath: string; // /tmp/audio_part_001.wav
  duration: number; // Sekundy
  startTime: number; // Offset w oryginalnym
  endTime: number;
  fileSize: number; // Bytes
}

export interface AudioSplitResult {
  success: boolean;
  parts: AudioPart[];
  totalDuration: number;
  error?: string;
}
```

**Nowe metody**:

- `getAudioDuration(inputPath)` - FFmpeg duration parsing
- `splitAudioByTime(inputPath, maxPartDuration)` - dzieli co X sekund
- `extractAudioSegment(...)` - wyciąga segment za pomocą FFmpeg

**Algorytm**:

```
1. Pobierz totalDuration za pomocą FFmpeg
2. Jeśli <= maxPartDuration (600s) → return empty parts (no split)
3. Loop: co 600s utwórz part używając: ffmpeg -ss START -to END -c copy
4. Return AudioSplitResult z listą parts
```

### 2. YouTube Downloader - Chunking Integration

**Plik**: `apps/api/src/services/youtube-downloader.ts`

**Rozszerzony DownloadResult**:

```typescript
export interface DownloadResult {
  success: boolean;
  audioPath?: string;
  title?: string;
  duration?: string;
  error?: string;
  parts?: AudioPart[]; // NOWE
  splitMetadata?: {
    // NOWE
    totalDuration: number;
    chunkingEnabled: boolean;
  };
}
```

**Modyfikacja downloadAudio()**:

```typescript
async downloadAudio(
  videoUrl: string,
  enableChunking: boolean = true  // Domyślnie włączone
): Promise<DownloadResult>
```

**Flow**:

1. Download audio (yt-dlp)
2. **Jeśli enableChunking**:
   - Wywołaj `preprocessor.splitAudioByTime(audioPath, 600)`
   - Jeśli success + parts.length > 0 → return z parts
   - Jeśli audio < 10 min → return bez parts (fallback)
3. Return DownloadResult

**Dodana metoda**:

- `extractVideoId(url)` - pomocnicza do parsowania YouTube URL

---

## 🔄 Flow w systemie

### Obecny (monolithic)

```
Download → Transcription (30 min, brak szczegółów) → Analysis → Saving
```

### Z MVP Chunking

```
Download (2 min)
  ↓
Split Audio (1 min)
  ├─ Analyze duration
  ├─ Split co 10 min
  └─ Create: audio_part_001.wav, audio_part_002.wav, ...audio_part_009.wav
  ↓
Transcription (30 min) - GOTOWE DO PER-PART
  ├─ Part 1/9: Transcribe...
  ├─ Part 2/9: Transcribe...
  ├─ ... (ready for detailed progress)
  └─ Part 9/9: Transcribe...
  ↓
Analysis + Saving
```

**Note**: Per-part transcription **nie jest jeszcze zaimplementowane** - to następny krok.  
Obecnie chunking działa, ale transcription nadal przetwarza cały plik naraz.

---

## 📦 Co zostało dodane

### Pliki zmienione:

1. ✅ `apps/api/src/services/audio-preprocessor.ts` (+147 linii)

   - AudioPart, AudioSplitResult interfaces
   - getAudioDuration()
   - splitAudioByTime()
   - extractAudioSegment()

2. ✅ `apps/api/src/services/youtube-downloader.ts` (+36 linii)
   - Rozszerzony DownloadResult z parts
   - Modyfikacja downloadAudio() z chunking
   - extractVideoId() helper

### Co NIE zostało jeszcze zaimplementowane:

- ❌ `transcribeAndAnalyzeChunked()` - per-part transcription loop
- ❌ Worker integration - chunked flow w `apps/worker/src/jobs/transcription.ts`
- ❌ Progress tracking - per-part progress w `TranscriptionProgressTracker`
- ❌ Frontend UI - parts visualization w `TranscriptionDetailModal`

**Status**: **Core splitting gotowe**, **transcription chunked - TODO**

---

## 🧪 Testowanie

### Test 1: Krótkie audio (< 10 min)

```
Input: 8 minut sesji
Expected: parts = [] (no splitting)
Result: Single file transcription (jak dotychczas)
```

### Test 2: Długie audio (30 min)

```
Input: 30 minut sesji
Expected: 3 parts (0-10min, 10-20min, 20-30min)
Result:
- audio_part_001.wav (10 min)
- audio_part_002.wav (10 min)
- audio_part_003.wav (10 min)
Parts zwrócone w DownloadResult
```

### Test 3: Bardzo długie audio (90 min)

```
Input: 90 minut sesji
Expected: 9 parts (~10 min każda)
Result: audio_part_001.wav ... audio_part_009.wav
```

### Jak testować:

```powershell
# Terminal 1 - API
cd apps/api
npm run dev

# Terminal 2 - Worker
cd apps/worker
npm run dev

# Terminal 3 - Frontend
cd apps/frontend
npm run dev

# Utwórz zadanie transkrypcji dla 30+ min sesji
# Sprawdź logi API:
[YouTubeDownloader] Audio chunking enabled, splitting...
[AudioPreprocessor] Total duration: 1847.3s
[AudioPreprocessor] Split into 3 parts
[YouTubeDownloader] Split into 3 parts
```

---

## 📊 Performance

### Overhead chunking:

- **+10-30 sekund** dla duration analysis + splitting
- **Warte za**: Lepszy progress tracking

### Storage:

- **3x więcej plików** tymczasowych
- Cleanup automatyczny po zakończeniu

---

## 🚀 Następne kroki (TODO)

### Faza 2: Per-Part Transcription (1-2 dni)

**1. YouTube Downloader - transcribeAndAnalyzeChunked()**

```typescript
async transcribeAndAnalyzeChunked(
  originalPath: string,
  parts: AudioPart[],
  videoId: string,
  videoTitle: string,
  videoUrl: string,
  options: {
    enablePreprocessing: boolean;
    onPartProgress?: (partIndex, totalParts, progress) => Promise<void>;
  }
): Promise<TranscriptionWithAnalysis> {
  const partTranscripts: Array<{
    partIndex: number;
    startTime: number;
    endTime: number;
    transcript: string;
  }> = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    console.log(`Transcribing part ${i+1}/${parts.length}`);

    if (options.onPartProgress) {
      await options.onPartProgress(i+1, parts.length, 0);
    }

    // Transcribe part (reuse existing STT logic)
    const partTranscript = await this.transcribeAudioPart(part.filePath);

    if (options.onPartProgress) {
      await options.onPartProgress(i+1, parts.length, 100);
    }

    partTranscripts.push({
      partIndex: part.index,
      startTime: part.startTime,
      endTime: part.endTime,
      transcript: partTranscript,
    });
  }

  // Merge transcripts
  const fullTranscript = partTranscripts.map(p => p.transcript).join("\n\n");

  // Continue as normal: analysis, formatting, etc.
  return this.analyzeAndFormatTranscript(fullTranscript, videoId, videoTitle, videoUrl);
}
```

**2. Worker Integration**

```typescript
// apps/worker/src/jobs/transcription.ts

// Check if we have parts
if (downloadResult.parts && downloadResult.parts.length > 1) {
  console.log(`Chunked transcription: ${downloadResult.parts.length} parts`);

  const transcriptionResult = await downloader.transcribeAndAnalyzeChunked(
    downloadResult.audioPath,
    downloadResult.parts,
    videoId,
    videoTitle,
    videoUrl,
    {
      enablePreprocessing: true,
      onPartProgress: async (partIndex, totalParts, partProgress) => {
        await progressTracker.updateStep(
          "transcription",
          Math.round(((partIndex - 1) / totalParts) * 100 + (partProgress / totalParts)),
          `Part ${partIndex}/${totalParts}: Transcribing...`,
          {
            currentPart: partIndex,
            totalParts: totalParts,
            partProgress: partProgress,
          }
        );
      },
    }
  );
} else {
  // Fallback: single file
  const transcriptionResult = await downloader.transcribeAndAnalyze(...);
}
```

**3. Progress Tracking Types**

```typescript
// apps/api/src/services/transcription-queue.ts
export interface TranscriptionStepProgress {
  // ... existing fields
  parts?: {
    currentPart: number;
    totalParts: number;
    partProgress: number; // 0-100 dla aktualnej części
  };
}
```

**4. Frontend UI (optional dla MVP)**

```tsx
// TranscriptionDetailModal.tsx
{
  step.details?.currentPart && (
    <div className="text-xs text-slate-600">
      Part {step.details.currentPart}/{step.details.totalParts}
    </div>
  );
}
```

---

## 🎯 Success Metrics

### MVP Success (Core Splitting):

- ✅ Audio > 10 min dzieli się na części
- ✅ Parts zapisywane w temp dir
- ✅ Parts zwracane w DownloadResult
- ✅ Brak crashów podczas splittingu

### Full Success (Po Fazie 2):

- ⏳ Per-part transcription działa
- ⏳ Progress update co 1-2 min widoczny w UI
- ⏳ Retry per-part działa
- ⏳ Całość stabilna dla 90+ min audio

---

## 📝 Konfiguracja

### Env vars (opcjonalne):

```bash
# .env
AUDIO_CHUNKING_ENABLED=true
AUDIO_MAX_PART_DURATION=600  # 10 minut (domyślnie)
```

### Code config:

```typescript
// youtube-downloader.ts
const enableChunking = process.env.AUDIO_CHUNKING_ENABLED !== "false";
const maxPartDuration = parseInt(process.env.AUDIO_MAX_PART_DURATION || "600");

await downloader.downloadAudio(videoUrl, enableChunking);
```

---

## 🐛 Known Issues & Limitations

### 1. Hard cut (nie w punktach ciszy)

**Problem**: Split co dokładnie 10 min, może przeciąć w środku zdania  
**Rozwiązanie**: Full version z silence detection (design doc)  
**Workaround MVP**: 10 min parts wystarczająco długie że rzadko problem

### 2. Transcript merge bez overlap

**Problem**: Brak 5-10s overlap między częściami  
**Rozwiązanie**: Dodać overlap w `splitAudioByTime()`  
**Status**: TODO - nice to have

### 3. Więcej temp files

**Problem**: 9 części = 9 plików na dysku (~90MB każdy)  
**Rozwiązanie**: Cleanup po każdej części w worker  
**Status**: TODO - low priority

### 4. Per-part transcription nie zaimplementowane

**Problem**: Core splitting działa, ale worker nadal przetwarza cały plik  
**Rozwiązanie**: Faza 2 - implementacja `transcribeAndAnalyzeChunked()`  
**Status**: **TODO - HIGH PRIORITY**

---

## 📚 Related Docs

- Design doc (full version): `docs/DESIGN_AUDIO_CHUNKING_SYSTEM.md`
- Test plan: `docs/TEST_YOUTUBE_TRANSCRIPTION_PAGE.md`

---

**Status**: ✅ **MVP Core Splitting - DONE**  
**Next**: 🔄 Faza 2 - Per-Part Transcription Loop

**Estimated Time**: 1-2 dni dla Fazy 2
