# Plan rozbudowy UI - Szczegółowy postęp transkrypcji

**Data**: 2026-01-16  
**Status**: CZEKA NA AKCEPTACJĘ ⏳

---

## 🎯 Cel

Stworzenie rozbudowanego systemu informowania o procesie transkrypcji YouTube z:

- ✅ Osobnym postępem dla każdego sub-kroku
- ✅ Modalem ze szczegółami po kliknięciu na kartę zadania
- ✅ Wizualizacją pipeline'u transkrypcji
- ✅ Szczegółowymi informacjami o każdym etapie

---

## 📊 Obecny stan

### Backend - Progress Reporting

**Struktura w queue**:

```typescript
interface TranscriptionJobStatus {
  id: string;
  status: "waiting" | "active" | "completed" | "failed";
  progress: number; // 0-100 (globalny)
  progressMessage: string; // "Transkrypcja audio..."
  // ...
}
```

**Pipeline w worker** (`apps/worker/src/jobs/transcription.ts`):

1. **Download** (10%) - `updateProgress({ progress: 10, message: "Pobieranie audio..." })`
2. **Preprocessing** (20%) - `updateProgress({ progress: 20, message: "Analiza i normalizacja..." })`
3. **Transcription** (35-60%) - `updateProgress({ progress: 35, message: "Transkrypcja audio..." })`
4. **Analysis** (60-85%) - `updateProgress({ progress: 60, message: "Identyfikacja mówców..." })`
5. **Saving** (85-100%) - `updateProgress({ progress: 85, message: "Zapisywanie do RAG..." })`

**Problem**: Tylko globalny progress, brak szczegółów o sub-krokach.

### Frontend - UI

**Obecny widok** (compact card):

```jsx
<div className="p-4 rounded-xl border bg-blue-50">
  <h3>XX Sesja Rady Miejskiej</h3>
  <span>⏳ Oczekuje</span>

  {/* Pojedynczy progress bar */}
  <div className="h-2 bg-slate-200 rounded-full">
    <div style="width: 35%"></div>
  </div>

  <p>Transkrypcja audio...</p>
  <p>~24 min</p>
</div>
```

**Problem**: Brak możliwości zobaczenia szczegółów, tylko globalny postęp.

---

## 🎨 Proponowane rozwiązanie

### 1. Rozszerzona struktura danych - Backend

#### Nowy typ: DetailedProgress

```typescript
interface TranscriptionStepProgress {
  name: string; // "download" | "preprocessing" | ...
  label: string; // "Pobieranie audio"
  status: "pending" | "active" | "completed" | "failed";
  progress: number; // 0-100 (dla tego kroku)
  startTime?: string; // ISO timestamp
  endTime?: string; // ISO timestamp
  duration?: number; // sekundy
  details?: {
    // Opcjonalne szczegóły per krok
    fileSize?: string; // "45.2 MB"
    audioIssues?: string[]; // ["too_quiet", "noise"]
    model?: string; // "whisper-1"
    speakersFound?: number; // 4
    [key: string]: any;
  };
}

interface DetailedTranscriptionProgress {
  globalProgress: number; // 0-100 (ogólny postęp)
  globalMessage: string; // Główny komunikat
  currentStep: string; // "transcription"
  steps: TranscriptionStepProgress[];
  estimatedTimeRemaining?: number; // sekundy
  startedAt: string;
  lastUpdate: string;
}
```

#### Kroki pipeline'u:

```typescript
const TRANSCRIPTION_STEPS = [
  {
    name: "download",
    label: "📥 Pobieranie audio",
    globalProgressRange: [0, 15],
  },
  {
    name: "preprocessing",
    label: "🎚️ Przetwarzanie audio",
    globalProgressRange: [15, 25],
  },
  {
    name: "transcription",
    label: "🎤 Transkrypcja",
    globalProgressRange: [25, 65],
  },
  {
    name: "analysis",
    label: "🔍 Analiza i identyfikacja",
    globalProgressRange: [65, 85],
  },
  {
    name: "saving",
    label: "💾 Zapisywanie do bazy",
    globalProgressRange: [85, 100],
  },
];
```

---

### 2. Backend - Implementacja

#### Plik: `apps/api/src/services/transcription-queue.ts`

**Dodać**:

```typescript
export interface TranscriptionJobStatusDetailed extends TranscriptionJobStatus {
  detailedProgress?: DetailedTranscriptionProgress;
}

// Nowa funkcja
export async function getDetailedJobStatus(
  jobId: string
): Promise<TranscriptionJobStatusDetailed | null> {
  // Pobierz z Redis + cache
}
```

#### Plik: `apps/worker/src/jobs/transcription.ts`

**Zmienić reporting**:

```typescript
// Zamiast:
await job.updateProgress({ progress: 10, message: "..." });

// Na:
await job.updateProgress({
  progress: 10,
  message: "...",
  detailedProgress: {
    globalProgress: 10,
    currentStep: "download",
    steps: [
      {
        name: "download",
        label: "📥 Pobieranie audio",
        status: "active",
        progress: 50, // 50% kroku download
        startTime: new Date().toISOString(),
        details: { fileSize: "45.2 MB" },
      },
      // ... pozostałe jako "pending"
    ],
  },
});
```

**Sub-kroki** w każdej fazie:

- **Download**: 0% → 50% (start) → 100% (complete)
- **Preprocessing**: Analiza (0-30%) → Filtrowanie (30-70%) → Normalizacja (70-100%)
- **Transcription**: Inicjalizacja (0-10%) → Przetwarzanie (10-90%) → Finalizacja (90-100%)
- **Analysis**: Speaker ID (0-50%) → Sentiment (50-100%)
- **Saving**: RAG embedding (0-70%) → Zapis DB (70-100%)

---

### 3. Frontend - Modal ze szczegółami

#### Nowy komponent: `TranscriptionDetailModal`

**Lokalizacja**: `apps/frontend/src/app/documents/youtube/components/TranscriptionDetailModal.tsx`

**Funkcje**:

1. ✅ Otwierany po kliknięciu na kartę zadania
2. ✅ Pokazuje pipeline z wszystkimi krokami
3. ✅ Każdy krok ma osobny progress bar
4. ✅ Aktywny krok jest highlighted
5. ✅ Szczegóły każdego kroku w accordion
6. ✅ Estymowany czas pozostały
7. ✅ Historia wykonanych kroków z czasem trwania

**Struktura UI**:

```
┌─────────────────────────────────────────────────────────┐
│  🎬 Transkrypcja: XX Sesja Rady Miejskiej              │
│  ═══════════════════════════════════════════════════  │
│  Postęp ogólny: 35%                                    │
│  Szacowany czas: ~24 minuty                            │
│  ───────────────────────────────────────────────────  │
│                                                         │
│  Pipeline transkrypcji:                                │
│                                                         │
│  ✅ 📥 Pobieranie audio                   [████████] 100% │
│     ├─ Rozmiar pliku: 45.2 MB                          │
│     ├─ Czas: 2m 15s                                    │
│     └─ Zakończono: 15:32:45                            │
│                                                         │
│  ✅ 🎚️ Przetwarzanie audio               [████████] 100% │
│     ├─ Wykryte problemy: Zbyt cichy, Szum              │
│     ├─ Zastosowane filtry: Loudnorm, Denoise            │
│     ├─ Czas: 1m 30s                                    │
│     └─ Zakończono: 15:34:15                            │
│                                                         │
│  🔄 🎤 Transkrypcja                       [█████░░░] 65%  │
│     ├─ Model: whisper-1                                │
│     ├─ Język: Polski                                   │
│     ├─ Postęp: 15m 23s / 23m 45s                       │
│     └─ W trakcie...                                    │
│                                                         │
│  ⏳ 🔍 Analiza i identyfikacja            [░░░░░░░░]  0%  │
│     └─ Oczekuje...                                     │
│                                                         │
│  ⏳ 💾 Zapisywanie do bazy                [░░░░░░░░]  0%  │
│     └─ Oczekuje...                                     │
│                                                         │
│  [Zamknij]                         [Anuluj transkrypcję] │
└─────────────────────────────────────────────────────────┘
```

**Animacje**:

- ✅ Pulsowanie aktywnego kroku
- ✅ Smooth progress bar transitions
- ✅ Checkmark animation po zakończeniu kroku
- ✅ Shimmer effect podczas aktywnego przetwarzania

---

### 4. Frontend - Card ze skróconym widokiem

**Aktualizacja**: `apps/frontend/src/app/documents/youtube/page.tsx`

**Zmiany**:

```jsx
{
  /* Obecna karta zadania */
}
<div
  className="p-4 rounded-xl border bg-blue-50 cursor-pointer hover:bg-blue-100"
  onClick={() => setSelectedJobId(job.id)} // NOWE: Otwórz modal
>
  <div className="flex items-center justify-between mb-2">
    <h3>XX Sesja Rady Miejskiej</h3>
    <div className="flex items-center gap-2">
      <span>⏳ W trakcie</span>
      {/* NOWE: Ikona info */}
      <button className="text-blue-600 hover:text-blue-800">
        <Info className="h-4 w-4" />
      </button>
    </div>
  </div>

  {/* Globalny progress bar */}
  <div className="h-2 bg-slate-200 rounded-full">
    <div style="width: 35%"></div>
  </div>

  {/* NOWE: Mini steps indicator */}
  <div className="flex items-center gap-1 mt-2 text-xs">
    <span className="text-green-600">✓ Download</span>
    <span className="text-green-600">✓ Preprocessing</span>
    <span className="text-blue-600 font-semibold">→ Transcription</span>
    <span className="text-slate-400">Analysis</span>
    <span className="text-slate-400">Saving</span>
  </div>

  <p className="text-xs mt-1">🎤 Transkrypcja audio... (65%)</p>
  <p className="text-xs text-slate-500">~24 min</p>
</div>;

{
  /* NOWE: Modal */
}
{
  selectedJobId && (
    <TranscriptionDetailModal
      jobId={selectedJobId}
      onClose={() => setSelectedJobId(null)}
    />
  );
}
```

---

### 5. API Endpoints

#### Nowy endpoint: `/api/youtube/job/:jobId/detailed`

**Zwraca**:

```json
{
  "success": true,
  "job": {
    "id": "xxx",
    "videoTitle": "XX Sesja Rady Miejskiej",
    "status": "active",
    "globalProgress": 35,
    "detailedProgress": {
      "currentStep": "transcription",
      "estimatedTimeRemaining": 1440,
      "steps": [
        {
          "name": "download",
          "label": "📥 Pobieranie audio",
          "status": "completed",
          "progress": 100,
          "startTime": "2026-01-16T15:30:00Z",
          "endTime": "2026-01-16T15:32:15Z",
          "duration": 135,
          "details": {
            "fileSize": "45.2 MB",
            "downloadSpeed": "335 KB/s"
          }
        },
        {
          "name": "preprocessing",
          "label": "🎚️ Przetwarzanie audio",
          "status": "completed",
          "progress": 100,
          "startTime": "2026-01-16T15:32:15Z",
          "endTime": "2026-01-16T15:33:45Z",
          "duration": 90,
          "details": {
            "audioIssues": ["too_quiet", "background_noise"],
            "appliedFilters": ["loudnorm", "highpass", "denoise"]
          }
        },
        {
          "name": "transcription",
          "label": "🎤 Transkrypcja",
          "status": "active",
          "progress": 65,
          "startTime": "2026-01-16T15:33:45Z",
          "details": {
            "model": "whisper-1",
            "language": "pl",
            "processedDuration": "15m 23s",
            "totalDuration": "23m 45s"
          }
        },
        {
          "name": "analysis",
          "label": "🔍 Analiza i identyfikacja",
          "status": "pending",
          "progress": 0
        },
        {
          "name": "saving",
          "label": "💾 Zapisywanie do bazy",
          "status": "pending",
          "progress": 0
        }
      ]
    }
  }
}
```

---

## 🛠️ Plan implementacji

### Faza 1: Backend - Extended Progress (2-3h)

**1.1. Rozszerzenie typów**

- [ ] `apps/api/src/services/transcription-queue.ts`
  - Dodać `DetailedTranscriptionProgress` interface
  - Dodać `TranscriptionStepProgress` interface
  - Rozszerzyć `TranscriptionJobStatus`

**1.2. Worker - Detailed reporting**

- [ ] `apps/worker/src/jobs/transcription.ts`
  - Stworzyć helper `updateDetailedProgress()`
  - Aktualizować każdy krok z sub-progress
  - Dodać tracking czasu per krok
  - Estymacja czasu pozostałego

**1.3. API Endpoint**

- [ ] `apps/api/src/routes/youtube.ts`
  - Nowy endpoint: `GET /api/youtube/job/:jobId/detailed`
  - Zwraca rozszerzone info z queue + DB

---

### Faza 2: Frontend - Modal Component (3-4h)

**2.1. Komponent TranscriptionDetailModal**

- [ ] `apps/frontend/src/app/documents/youtube/components/TranscriptionDetailModal.tsx`
  - Pełnoekranowy modal z backdrop
  - Header z tytułem i przyciskiem zamknij
  - Globalny progress bar z estymacją
  - Lista kroków pipeline z individual progress
  - Accordion ze szczegółami każdego kroku
  - Loading state i error handling

**2.2. Stylowanie i animacje**

- [ ] Tailwind classes dla kroków (pending/active/completed/failed)
- [ ] Pulsowanie aktywnego kroku
- [ ] Checkmark animation dla completed
- [ ] Smooth transitions progress bars
- [ ] Shimmer effect podczas loading

**2.3. Real-time updates**

- [ ] Polling co 2s dla detailed progress
- [ ] Optimistic UI updates
- [ ] Stop polling gdy modal zamknięty

---

### Faza 3: Frontend - Card Integration (1h)

**3.1. Aktualizacja karty zadania**

- [ ] `apps/frontend/src/app/documents/youtube/page.tsx`
  - Dodać `onClick` handler → open modal
  - Dodać mini steps indicator pod progress bar
  - Pokazać aktualny krok (np. "🎤 Transcription 65%")
  - Info icon dla otwarcia szczegółów

**3.2. State management**

- [ ] `useState` dla `selectedJobId`
- [ ] Modal render conditionally
- [ ] Close handlers (backdrop, button, ESC)

---

### Faza 4: Testing & Polish (1-2h)

**4.1. Testy funkcjonalne**

- [ ] Test otwierania/zamykania modalu
- [ ] Test real-time updates w modalu
- [ ] Test różnych stanów (pending, active, completed, failed)
- [ ] Test różnych kroków pipeline
- [ ] Test edge cases (brak danych, błędy)

**4.2. UX polish**

- [ ] Responsywność na mobile
- [ ] Keyboard navigation (ESC, Tab)
- [ ] Loading skeletons
- [ ] Error states z retry
- [ ] Accessibility (ARIA labels)

**4.3. Dokumentacja**

- [ ] Update `MIGRACJA_TRANSKRYPCJI_REDIS.md`
- [ ] Screenshots w dokumentacji
- [ ] User guide dla nowego UI

---

## 📐 Design System

### Kolory kroków

```css
/* Pending - szary */
.step-pending {
  border: slate-200
  bg: slate-50
  text: slate-600
}

/* Active - niebieski + pulsowanie */
.step-active {
  border: blue-400
  bg: blue-50
  text: blue-800
  animation: pulse
}

/* Completed - zielony */
.step-completed {
  border: green-400
  bg: green-50
  text: green-800
}

/* Failed - czerwony */
.step-failed {
  border: red-400
  bg: red-50
  text: red-800
}
```

### Ikony kroków

- 📥 Download
- 🎚️ Preprocessing
- 🎤 Transcription
- 🔍 Analysis
- 💾 Saving

### Progress bars

- **Globalny**: Duży (h-3), niebieski gradient
- **Per krok**: Średni (h-2), kolor zależny od statusu
- **Sub-step**: Mały (h-1.5), szary

---

## 🎯 Rezultaty

### Przed

**Prosty widok**:

- ✅ Globalny progress bar
- ✅ Jeden komunikat statusu
- ❌ Brak szczegółów
- ❌ Nie wiadomo co się dzieje
- ❌ Nie wiadomo ile zostało czasu per krok

### Po

**Rozbudowany widok**:

- ✅ Globalny progress + mini steps w card
- ✅ Modal ze szczegółami po kliknięciu
- ✅ 5 kroków pipeline z individual progress
- ✅ Szczegóły każdego kroku (czas, parametry, problemy)
- ✅ Estymacja czasu per krok i globalnie
- ✅ Historia wykonanych kroków
- ✅ Real-time updates
- ✅ Animacje i feedback wizualny

### UX Improvements

1. **Transparentność** - Użytkownik widzi dokładnie co się dzieje
2. **Kontrola** - Możliwość anulowania w dowolnym momencie
3. **Diagnostyka** - Widoczne problemy z audio, użyte filtry
4. **Przewidywalność** - Estymacja czasu per krok
5. **Feedback** - Animacje pokazują aktywność systemu

---

## 📊 Estymacja czasu

| Faza      | Zadanie                     | Czas      |
| --------- | --------------------------- | --------- |
| 1         | Backend - Extended Progress | 2-3h      |
| 2         | Frontend - Modal Component  | 3-4h      |
| 3         | Frontend - Card Integration | 1h        |
| 4         | Testing & Polish            | 1-2h      |
| **TOTAL** |                             | **7-10h** |

---

## 🔄 Backward Compatibility

✅ **Pełna kompatybilność wsteczna**

- Stare zadania (bez detailed progress) działają dalej
- Prosty progress bar w card pozostaje
- Modal pokazuje fallback dla starych zadań
- Graceful degradation

---

## 📝 Wymagania techniczne

### Backend

- ✅ Redis już używany (queue)
- ✅ BullMQ job progress (już jest)
- ⚠️ Rozszerzenie struktury progress (nowe)

### Frontend

- ✅ React 19
- ✅ Tailwind CSS
- ✅ Lucide icons
- ⚠️ Modal component (nowy)
- ⚠️ Real-time polling (rozszerzenie)

### API

- ✅ Istniejące endpointy
- ⚠️ Nowy endpoint `/job/:jobId/detailed`

---

## ⚠️ Ryzyka i mitigation

### 1. Performance - Dużo pollingu

**Ryzyko**: Modal polling co 2s może obciążyć serwer

**Mitigation**:

- Polling tylko gdy modal otwarty
- Stop polling gdy job completed/failed
- Cache w Redis (już jest)

### 2. Complexity - Dużo stanów

**Ryzyko**: Wiele stanów kroków, skomplikowana synchronizacja

**Mitigation**:

- Single source of truth (queue progress)
- Optymistic UI updates
- Error boundaries w React

### 3. Mobile UX

**Ryzyko**: Modal może być za duży na mobile

**Mitigation**:

- Responsive design
- Bottom sheet na mobile
- Collapse accordion domyślnie

---

## 🚀 Następne kroki

### Po akceptacji planu:

1. ✅ **Implementacja Fazy 1** - Backend extended progress
2. ✅ **Implementacja Fazy 2** - Frontend modal
3. ✅ **Implementacja Fazy 3** - Card integration
4. ✅ **Implementacja Fazy 4** - Testing & polish

### Alternatywne podejście (MVP):

**Jeśli 7-10h to za dużo**, można zacząć od MVP:

**MVP (2-3h)**:

- ✅ Podstawowy modal z krokami (bez szczegółów)
- ✅ Prosty progress per krok (tylko % bez sub-steps)
- ✅ Bez animacji (tylko statyczne)
- ✅ Bez real-time (refresh on open)

---

## ✅ Akceptacja

**CZEKA NA TWOJĄ AKCEPTACJĘ**:

- [ ] ✅ Akceptuję pełny plan (7-10h)
- [ ] ✅ Akceptuję MVP (2-3h)
- [ ] ❌ Zmiany w planie (napisz jakie)
- [ ] ❌ Odrzucam

---

**Autor**: AI Assistant  
**Data**: 2026-01-16  
**Wersja**: 1.0
