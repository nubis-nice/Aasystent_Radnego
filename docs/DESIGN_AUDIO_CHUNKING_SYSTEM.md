# Design: Audio Chunking System z Silence Detection

**Data**: 2026-01-16  
**Feature Request**: Podzielenie długich audio na części z wykrywaniem ciszy dla lepszego progress tracking  
**Priorytet**: HIGH - Znacząco poprawia UX i stabilność

---

## 🎯 Cel

Podzielić długie nagrania audio (np. 1-2 godziny sesji rady) na mniejsze części (5-10 minut) używając wykrywania ciszy, aby:

1. **Lepszy wgląd w postęp**: "Part 3/12 (25%): Transcribing..."
2. **Płynniejszy progress**: Update co 5-10 min zamiast czekać 30+ min
3. **Stabilność**: Mniejsze pliki = mniejsze ryzyko timeout
4. **Możliwość retry**: Jeśli part fails → retry tylko ten part
5. **Inteligentne cięcie**: Dzielenie w miejscach ciszy (pauzy między mówiącymi)

---

## 📊 Obecny flow vs. Nowy flow

### Obecny (monolithic)

```
Download (2 min)
  ↓
Preprocessing (1 min) - cały plik 1-2h
  ↓
Transcription (20-40 min) - cały plik naraz, brak szczegółowego progress
  ↓
Analysis (3 min)
  ↓
Saving (1 min)

Total: 27-47 min, progress tylko "Transcription: 29%"
```

### Nowy (chunked)

```
Download (2 min)
  ↓
Preprocessing + Silence Detection + Splitting (2 min)
  ├─ Analiza audio
  ├─ Wykrycie punktów ciszy (każde 5-10 min)
  ├─ Cięcie na 8-12 części
  └─ Zapisanie parts: audio_part_001.wav ... audio_part_012.wav
  ↓
Transcription (20-40 min) - PER-PART LOOP
  ├─ Part 1/12: Transcribing... [===>      ] 35% (1.5 min)
  ├─ Part 2/12: Transcribing... [====>     ] 42% (1.4 min)
  ├─ Part 3/12: Transcribing... [=====>    ] 48% (1.6 min)
  ├─ ... (progress update co ~1-2 min)
  └─ Part 12/12: Transcribing... [==========] 100% (1.2 min)
  ↓
Analysis (3 min) - połączone transkrypty
  ↓
Saving (1 min)

Total: 28-48 min, ale progress widoczny co 1-2 min!
```

---

## 🏗️ Architektura

### 1. Silence Detection & Splitting

**Lokalizacja**: `apps/api/src/services/audio-preprocessor.ts`

**Nowa metoda**:

```typescript
async detectSilenceAndSplit(
  inputPath: string,
  options: {
    maxPartDuration: number;    // Sekundy, domyślnie 600 (10 min)
    silenceThreshold: number;   // dB, domyślnie -40
    silenceDuration: number;    // Sekundy, domyślnie 1.0
    minPartDuration: number;    // Sekundy, domyślnie 120 (2 min)
  }
): Promise<AudioSplitResult>
```

**Output**:

```typescript
interface AudioSplitResult {
  success: boolean;
  parts: AudioPart[];
  totalDuration: number;
  splitPoints: number[]; // Timestamps gdzie został podzielony
}

interface AudioPart {
  index: number; // 1, 2, 3...
  filePath: string; // /tmp/audio_part_001.wav
  duration: number; // Sekundy
  startTime: number; // Offset w oryginalnym pliku
  endTime: number;
  fileSize: number; // Bytes
}
```

**Algorytm**:

```typescript
1. Analyze całego audio ffmpeg silencedetect
   → Lista wszystkich punktów ciszy: [45.2s, 89.7s, 134.5s, ...]

2. Wybierz split points inteligentnie:
   - Co ~10 minut (maxPartDuration)
   - W najbliższym punkcie ciszy
   - Nie dziel jeśli part < 2 min (minPartDuration)

3. Cut audio na części używając ffmpeg:
   ffmpeg -i input.wav -ss START -to END -c copy part_001.wav

4. Zapisz metadata każdej części

5. Return AudioSplitResult
```

**FFmpeg commands**:

```bash
# 1. Wykryj ciszę
ffmpeg -i audio.wav -af silencedetect=noise=-40dB:d=1.0 -f null - 2>&1 | grep silence_end

# Output:
# [silencedetect] silence_end: 45.234 | silence_duration: 2.156
# [silencedetect] silence_end: 89.789 | silence_duration: 1.543
# ...

# 2. Podziel na części
ffmpeg -i audio.wav -ss 0 -to 45.234 -c copy audio_part_001.wav
ffmpeg -i audio.wav -ss 45.234 -to 89.789 -c copy audio_part_002.wav
...
```

---

### 2. Transcription Worker - Per-Part Processing

**Lokalizacja**: `apps/worker/src/jobs/transcription.ts`

**Modyfikacja funkcji `transcribeAndAnalyze()`**:

```typescript
// PRZED (monolithic):
const transcriptionResult = await downloader.transcribeAndAnalyze(
  downloadResult.audioPath,
  videoId,
  videoTitle,
  videoUrl,
  true
);

// PO (chunked):
const transcriptionResult = await downloader.transcribeAndAnalyzeChunked(
  downloadResult.audioPath,
  downloadResult.parts, // AudioPart[]
  videoId,
  videoTitle,
  videoUrl,
  {
    enablePreprocessing: true,
    onPartProgress: async (partIndex, totalParts, partProgress) => {
      // Update progress dla każdej części
      const overallPartProgress = ((partIndex - 1) / totalParts) * 100;
      const currentPartContribution = partProgress / totalParts;
      const totalProgress = overallPartProgress + currentPartContribution;

      await progressTracker.updateStep(
        "transcription",
        Math.round(totalProgress),
        `Part ${partIndex}/${totalParts}: Transcribing... (${partProgress}%)`,
        {
          currentPart: partIndex,
          totalParts: totalParts,
          partProgress: partProgress,
          estimatedTimePerPart: "1-2 min",
        }
      );
    },
  }
);
```

**Nowa metoda w `youtube-downloader.ts`**:

```typescript
async transcribeAndAnalyzeChunked(
  originalAudioPath: string,
  parts: AudioPart[],
  videoId: string,
  videoTitle: string,
  videoUrl: string,
  options: {
    enablePreprocessing: boolean;
    onPartProgress?: (partIndex: number, totalParts: number, progress: number) => Promise<void>;
  }
): Promise<TranscriptionWithAnalysis> {
  const totalParts = parts.length;
  const partTranscripts: Array<{
    partIndex: number;
    startTime: number;
    endTime: number;
    transcript: string;
  }> = [];

  console.log(`[YouTubeDownloader] Starting chunked transcription: ${totalParts} parts`);

  // Loop przez każdą część
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const partIndex = i + 1;

    console.log(`[YouTubeDownloader] Transcribing part ${partIndex}/${totalParts} (${part.duration}s)`);

    if (options.onPartProgress) {
      await options.onPartProgress(partIndex, totalParts, 0);
    }

    // Preprocessing tylko jeśli enabled
    const audioToTranscribe = options.enablePreprocessing
      ? await this.preprocessAudioPart(part.filePath)
      : part.filePath;

    if (options.onPartProgress) {
      await options.onPartProgress(partIndex, totalParts, 20);
    }

    // Transcribe part with timeout
    const partTranscript = await this.transcribeAudioPart(
      audioToTranscribe,
      part.index,
      totalParts
    );

    if (options.onPartProgress) {
      await options.onPartProgress(partIndex, totalParts, 100);
    }

    // Zapisz z timestampami
    partTranscripts.push({
      partIndex: part.index,
      startTime: part.startTime,
      endTime: part.endTime,
      transcript: partTranscript,
    });

    console.log(`[YouTubeDownloader] Part ${partIndex}/${totalParts} completed`);
  }

  // Połącz wszystkie transkrypty
  const fullTranscript = this.mergePartTranscripts(partTranscripts);

  // Dalej jak normalnie: analiza, formatting, etc.
  return this.analyzeAndFormatTranscript(fullTranscript, videoId, videoTitle, videoUrl);
}
```

---

### 3. Progress Tracking - Detailed Per-Part

**Aktualizacja `DetailedTranscriptionProgress`**:

```typescript
// apps/api/src/services/transcription-queue.ts
export interface TranscriptionStepProgress {
  name: string;
  label: string;
  status: "pending" | "active" | "completed" | "failed";
  progress: number;
  startTime?: Date;
  endTime?: Date;
  duration?: number;

  // NOWE dla chunked transcription:
  parts?: {
    currentPart: number;
    totalParts: number;
    partProgress: number; // 0-100 dla aktualnej części
    completedParts: number; // Ile już zakończonych
    partDetails?: Array<{
      index: number;
      status: "pending" | "active" | "completed" | "failed";
      duration?: number; // Jak długo trwała (ms)
      startTime?: Date;
      endTime?: Date;
    }>;
  };

  details?: Record<string, unknown>;
}
```

**UI Update w `TranscriptionDetailModal.tsx`**:

```tsx
{
  /* Dla kroku transcription z parts */
}
{
  step.name === "transcription" && step.parts && (
    <div className="mt-2 text-xs space-y-1">
      {/* Overall parts progress */}
      <div className="flex items-center justify-between">
        <span className="text-slate-600">
          Progress: Part {step.parts.currentPart}/{step.parts.totalParts}
        </span>
        <span className="font-medium text-blue-600">
          {step.parts.completedParts}/{step.parts.totalParts} completed
        </span>
      </div>

      {/* Current part progress */}
      <div className="w-full bg-slate-200 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${step.parts.partProgress}%` }}
        />
      </div>

      {/* Mini part indicators */}
      <div className="flex gap-0.5 flex-wrap">
        {step.parts.partDetails?.map((part) => (
          <div
            key={part.index}
            className={cn(
              "w-2 h-2 rounded-sm",
              part.status === "completed" && "bg-green-500",
              part.status === "active" && "bg-blue-500 animate-pulse",
              part.status === "pending" && "bg-slate-300",
              part.status === "failed" && "bg-red-500"
            )}
            title={`Part ${part.index}: ${part.status}`}
          />
        ))}
      </div>
    </div>
  );
}
```

---

### 4. Download Step - Output Parts

**Modyfikacja w `youtube-downloader.ts`**:

```typescript
// Rozszerz DownloadResult
export interface DownloadResult {
  success: boolean;
  audioPath?: string;
  title?: string;
  duration?: string;
  error?: string;

  // NOWE:
  parts?: AudioPart[];          // Jeśli chunking enabled
  splitMetadata?: {
    totalDuration: number;
    splitPoints: number[];
    chunkingEnabled: boolean;
  };
}

// W downloadAudio():
async downloadAudio(
  videoUrl: string,
  enableChunking: boolean = true,  // Domyślnie ON
  chunkOptions?: ChunkingOptions
): Promise<DownloadResult> {
  // ... download jak teraz ...

  if (enableChunking) {
    console.log('[YouTubeDownloader] Splitting audio into parts...');

    const splitResult = await this.preprocessor.detectSilenceAndSplit(
      audioPath,
      chunkOptions || {
        maxPartDuration: 600,      // 10 min
        silenceThreshold: -40,     // dB
        silenceDuration: 1.0,      // s
        minPartDuration: 120,      // 2 min
      }
    );

    if (splitResult.success) {
      return {
        success: true,
        audioPath: audioPath,
        title: title,
        duration: duration,
        parts: splitResult.parts,
        splitMetadata: {
          totalDuration: splitResult.totalDuration,
          splitPoints: splitResult.splitPoints,
          chunkingEnabled: true,
        },
      };
    }
  }

  // Fallback: no chunking
  return { success: true, audioPath, title, duration };
}
```

---

## 🔧 Implementacja krok po kroku

### Faza 1: Silence Detection & Splitting (audio-preprocessor.ts)

**Plik**: `apps/api/src/services/audio-preprocessor.ts`

**Dodaj**:

```typescript
export interface ChunkingOptions {
  maxPartDuration: number;
  silenceThreshold: number;
  silenceDuration: number;
  minPartDuration: number;
}

export interface AudioPart {
  index: number;
  filePath: string;
  duration: number;
  startTime: number;
  endTime: number;
  fileSize: number;
}

export interface AudioSplitResult {
  success: boolean;
  parts: AudioPart[];
  totalDuration: number;
  splitPoints: number[];
  error?: string;
}

async detectSilenceAndSplit(
  inputPath: string,
  options: ChunkingOptions
): Promise<AudioSplitResult> {
  try {
    // 1. Detect silence points
    const silencePoints = await this.detectSilencePoints(inputPath, options);

    // 2. Calculate optimal split points
    const splitPoints = this.calculateSplitPoints(
      silencePoints,
      options.maxPartDuration,
      options.minPartDuration
    );

    // 3. Split audio at split points
    const parts = await this.splitAudioIntoParts(inputPath, splitPoints);

    return {
      success: true,
      parts: parts,
      totalDuration: parts.reduce((sum, p) => sum + p.duration, 0),
      splitPoints: splitPoints,
    };
  } catch (error) {
    return {
      success: false,
      parts: [],
      totalDuration: 0,
      splitPoints: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

private async detectSilencePoints(
  inputPath: string,
  options: ChunkingOptions
): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const args = [
      "-i", inputPath,
      "-af", `silencedetect=noise=${options.silenceThreshold}dB:d=${options.silenceDuration}`,
      "-f", "null",
      "-"
    ];

    const ffmpeg = spawn(this.ffmpegPath, args);
    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg failed: ${code}`));
        return;
      }

      // Parse silence_end timestamps
      const silenceRegex = /silence_end: ([\d.]+)/g;
      const points: number[] = [];
      let match;

      while ((match = silenceRegex.exec(stderr)) !== null) {
        points.push(parseFloat(match[1]));
      }

      resolve(points);
    });

    ffmpeg.on("error", reject);
  });
}

private calculateSplitPoints(
  silencePoints: number[],
  maxDuration: number,
  minDuration: number
): number[] {
  const splits: number[] = [0]; // Zawsze zaczynamy od 0
  let currentPos = 0;

  while (silencePoints.length > 0) {
    const targetPos = currentPos + maxDuration;

    // Znajdź najbliższy punkt ciszy do targetPos
    const closest = silencePoints.reduce((prev, curr) => {
      return Math.abs(curr - targetPos) < Math.abs(prev - targetPos) ? curr : prev;
    });

    // Sprawdź czy part nie jest za krótki
    if (closest - currentPos >= minDuration) {
      splits.push(closest);
      currentPos = closest;

      // Usuń wykorzystane punkty
      silencePoints = silencePoints.filter(p => p > closest);
    } else {
      // Pomiń ten punkt ciszy (za blisko)
      silencePoints = silencePoints.filter(p => p !== closest);
    }
  }

  return splits;
}

private async splitAudioIntoParts(
  inputPath: string,
  splitPoints: number[]
): Promise<AudioPart[]> {
  const parts: AudioPart[] = [];
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputDir = path.dirname(inputPath);

  for (let i = 0; i < splitPoints.length; i++) {
    const startTime = splitPoints[i];
    const endTime = splitPoints[i + 1] || undefined; // undefined = do końca
    const partIndex = i + 1;
    const outputPath = path.join(outputDir, `${baseName}_part_${String(partIndex).padStart(3, '0')}.wav`);

    await this.extractAudioSegment(inputPath, outputPath, startTime, endTime);

    const stats = fs.statSync(outputPath);
    const duration = endTime ? endTime - startTime : await this.getAudioDuration(outputPath);

    parts.push({
      index: partIndex,
      filePath: outputPath,
      duration: duration,
      startTime: startTime,
      endTime: endTime || startTime + duration,
      fileSize: stats.size,
    });
  }

  return parts;
}

private extractAudioSegment(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime?: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-i", inputPath,
      "-ss", startTime.toString(),
    ];

    if (endTime) {
      args.push("-to", endTime.toString());
    }

    args.push("-c", "copy", outputPath);

    const ffmpeg = spawn(this.ffmpegPath, args);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg extraction failed: ${code}`));
      }
    });

    ffmpeg.on("error", reject);
  });
}
```

---

### Faza 2: Transcription Worker Integration

**Plik**: `apps/worker/src/jobs/transcription.ts`

**Modyfikacja**:

```typescript
// Linia ~142 - zamiast wywołania transcribeAndAnalyze():

// Sprawdź czy mamy parts
if (downloadResult.parts && downloadResult.parts.length > 1) {
  console.log(
    `[TranscriptionWorker] Chunked transcription: ${downloadResult.parts.length} parts`
  );

  // Update step z info o parts
  await progressTracker.updateStep(
    "transcription",
    0,
    "Starting chunked transcription...",
    {
      totalParts: downloadResult.parts.length,
      chunkingEnabled: true,
    }
  );

  const transcriptionResult = await downloader.transcribeAndAnalyzeChunked(
    downloadResult.audioPath,
    downloadResult.parts,
    videoId,
    videoTitle,
    videoUrl,
    {
      enablePreprocessing: true,
      onPartProgress: async (partIndex, totalParts, partProgress) => {
        const overallProgress = Math.round(
          ((partIndex - 1) / totalParts) * 100 + partProgress / totalParts
        );

        await progressTracker.updateStep(
          "transcription",
          overallProgress,
          `Part ${partIndex}/${totalParts}: Transcribing...`,
          {
            currentPart: partIndex,
            totalParts: totalParts,
            partProgress: partProgress,
            completedParts: partIndex - 1,
          }
        );
      },
    }
  );

  // ... continue as normal
} else {
  // Fallback: single file transcription (jak teraz)
  console.log(`[TranscriptionWorker] Single file transcription`);

  const transcriptionResult = await downloader.transcribeAndAnalyze(
    downloadResult.audioPath,
    videoId,
    videoTitle,
    videoUrl,
    true
  );

  // ... continue as normal
}
```

---

### Faza 3: Frontend - Detailed Progress Modal Update

**Plik**: `apps/frontend/src/app/documents/youtube/components/TranscriptionDetailModal.tsx`

**Dodaj renderowanie parts**:

```tsx
{
  step.status === "active" && step.details?.currentPart && (
    <div className="mt-3 space-y-2 text-xs">
      <div className="flex items-center justify-between text-slate-600">
        <span>Chunked Transcription</span>
        <span className="font-medium text-blue-600">
          Part {step.details.currentPart}/{step.details.totalParts}
        </span>
      </div>

      {/* Per-part progress bar */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-slate-500">Current part progress</span>
          <span className="font-medium">{step.details.partProgress}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${step.details.partProgress}%` }}
          />
        </div>
      </div>

      {/* Mini part indicators */}
      <div className="flex items-center gap-1">
        <span className="text-slate-500 mr-2">Parts:</span>
        <div className="flex gap-1 flex-wrap flex-1">
          {Array.from({ length: step.details.totalParts }, (_, i) => {
            const partIndex = i + 1;
            const isCompleted = partIndex < step.details.currentPart;
            const isActive = partIndex === step.details.currentPart;
            const isPending = partIndex > step.details.currentPart;

            return (
              <div
                key={partIndex}
                className={cn(
                  "w-3 h-3 rounded-sm transition-all",
                  isCompleted && "bg-green-500",
                  isActive && "bg-blue-500 ring-2 ring-blue-300 animate-pulse",
                  isPending && "bg-slate-300"
                )}
                title={`Part ${partIndex}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

---

## 🧪 Testowanie

### Test 1: Krótkie audio (< 10 min)

```
Input: 8 minut sesji
Expected: NO CHUNKING (poniżej maxPartDuration)
Result: 1 part, normal transcription
```

### Test 2: Średnie audio (10-30 min)

```
Input: 25 minut sesji
Expected: 2-3 parts (zależnie od ciszy)
Result: Part 1/3, Part 2/3, Part 3/3
Progress updates co ~8 minut
```

### Test 3: Długie audio (1-2h)

```
Input: 90 minut sesji
Expected: 9-12 parts (~10 min każda)
Result: Part 1/10, Part 2/10, ..., Part 10/10
Progress updates co ~9 minut
UI pokazuje mini-indicators dla wszystkich parts
```

### Test 4: Brak ciszy (continuous speech)

```
Input: 30 minut bez przerw
Expected: Cięcie co 10 min niezależnie od ciszy
Result: 3 parts po 10 min (hard cut)
```

### Test 5: Error handling - Part fails

```
Scenario: Part 3/5 fails (STT timeout)
Expected: Retry tylko Part 3
Result: Parts 1,2,4,5 OK, Part 3 retry → sukces
```

---

## 📊 Korzyści

### 1. **Lepszy UX**

- Progress update co 1-2 min zamiast 30 min
- Wizualizacja "Part X/Y" pokazuje postęp
- Użytkownik wie że system działa

### 2. **Stabilność**

- Mniejsze pliki = mniejsze ryzyko timeout
- Retry per-part zamiast całości
- Memory usage równomierny

### 3. **Performance**

- Równoległy processing możliwy (future enhancement)
- Caching części dla retry
- Progressywne wyniki (partial transcript)

### 4. **Debugging**

- Łatwiej znaleźć problematyczną część
- Logi per-part bardziej czytelne
- Metrics per-part

---

## ⚠️ Potencjalne problemy

### 1. **Timestamp alignment**

**Problem**: Segmenty z różnych części muszą mieć poprawne offsety  
**Rozwiązanie**: Dodaj `part.startTime` do wszystkich timestampów w części

### 2. **Kontekst między częściami**

**Problem**: Mówca kontynuuje zdanie z poprzedniej części  
**Rozwiązanie**: Overlap 5-10s między częściami lub post-processing merge

### 3. **Więcej plików tymczasowych**

**Problem**: 10 części = 10 plików na dysku  
**Rozwiązanie**: Cleanup po każdej części, storage monitoring

### 4. **Dodatkowy czas na splitting**

**Problem**: +1-2 min na silence detection i cięcie  
**Rozwiązanie**: Warto za lepszy progress (trade-off: +2 min za 10x lepszy UX)

---

## 🚀 Deployment Plan

### Faza 1: Core Implementation (1-2 dni)

- [ ] Implementacja `detectSilenceAndSplit()` w audio-preprocessor
- [ ] Testy silence detection z różnymi audio
- [ ] Implementacja `splitAudioIntoParts()`

### Faza 2: Worker Integration (1 dzień)

- [ ] Modyfikacja transcription worker
- [ ] Implementacja `transcribeAndAnalyzeChunked()`
- [ ] Progress tracking per-part

### Faza 3: Frontend Update (0.5 dnia)

- [ ] Update TranscriptionDetailModal z parts UI
- [ ] Mini part indicators
- [ ] Testing UI z mock data

### Faza 4: Testing & Refinement (1 dzień)

- [ ] E2E test z różnymi długościami audio
- [ ] Performance testing
- [ ] Error handling testing
- [ ] UI/UX feedback

### Faza 5: Documentation & Deployment (0.5 dnia)

- [ ] Update dokumentacji
- [ ] Release notes
- [ ] Deploy to production

**Total**: ~4-5 dni roboczych

---

## 📝 Konfiguracja

### Domyślne wartości (konfigurowalne przez env vars):

```bash
# .env
AUDIO_CHUNKING_ENABLED=true
AUDIO_MAX_PART_DURATION=600      # 10 minut
AUDIO_SILENCE_THRESHOLD=-40      # dB
AUDIO_SILENCE_DURATION=1.0       # sekundy
AUDIO_MIN_PART_DURATION=120      # 2 minuty
```

### Feature flag:

```typescript
// Łatwe wyłączenie jeśli problemy
const ENABLE_CHUNKING = process.env.AUDIO_CHUNKING_ENABLED === "true";

if (ENABLE_CHUNKING && audioDuration > 600) {
  // Use chunked transcription
} else {
  // Fallback to monolithic
}
```

---

## 🎯 Success Metrics

Po wdrożeniu mierzymy:

1. **Progress Update Frequency**: Co ile pojawia się update?

   - Target: Co 1-3 min (był: 10-30 min)

2. **User Perception**: Czy użytkownicy czują że system działa?

   - Survey: "Czy widziałeś postęp transkrypcji?"

3. **Timeout Rate**: Czy maleje liczba timeoutów?

   - Target: < 5% (był: ~20%)

4. **Retry Success**: Ile retry kończy się sukcesem?

   - Target: > 90%

5. **Total Time**: Czy nie wydłuża się znacząco?
   - Target: +5-10% max (warte za UX)

---

**Status**: 📋 Design Ready - Gotowy do implementacji  
**Next Step**: Implementacja Faza 1 - silence detection & splitting
