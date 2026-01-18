# Plan testów: YouTubeTranscriptionPage

**Data**: 2026-01-16  
**Komponent**: `apps/frontend/src/app/documents/youtube/page.tsx`  
**Cel**: Kompleksowe przetestowanie wszystkich funkcji systemu transkrypcji YouTube

---

## 📋 Zidentyfikowane funkcje

### 1. Zarządzanie sesjami YouTube

#### 1.1 Pobieranie listy sesji

- **Funkcja**: `loadSessions()`
- **API**: `getYouTubeSessions()`
- **Endpoint**: `GET /api/youtube/sessions`
- **Co robi**: Pobiera listę sesji YouTube z kanału
- **UI**: Lista sesji w głównym panelu

**Test**:

```
✅ T1.1.1: Kliknij "Odśwież listę" → Lista sesji się ładuje
✅ T1.1.2: Sprawdź czy sesje mają: title, thumbnailUrl, duration, publishedAt
✅ T1.1.3: Sprawdź czy sesje są sortowane chronologicznie
❌ T1.1.4: Test błędu - wyloguj się → powinien pokazać błąd autoryzacji
✅ T1.1.5: Test retry - kliknij "Spróbuj ponownie" po błędzie
```

#### 1.2 Wyszukiwanie sesji

- **Funkcja**: `searchQuery` state + filtering
- **Co robi**: Filtruje sesje po tytule
- **UI**: Input wyszukiwania nad listą sesji

**Test**:

```
✅ T1.2.1: Wpisz "XXIII" → Filtruje sesje zawierające "XXIII"
✅ T1.2.2: Wpisz "Drawno" → Filtruje po nazwie miejsca
✅ T1.2.3: Wyczyść wyszukiwanie → Wszystkie sesje widoczne
✅ T1.2.4: Wpisz nieistniejący tekst → "Brak wyników"
```

#### 1.3 Sortowanie sesji

- **Funkcja**: `sortOrder` state
- **Co robi**: Sortuje newest/oldest
- **UI**: Przycisk "Najnowsze/Najstarsze"

**Test**:

```
✅ T1.3.1: Kliknij przycisk sort → Zmienia z "newest" na "oldest"
✅ T1.3.2: Sprawdź kolejność → oldest = od najstarszych
✅ T1.3.3: Zmień z powrotem → newest = od najnowszych
```

#### 1.4 Paginacja

- **Funkcja**: `currentPage`, `ITEMS_PER_PAGE=5`
- **Co robi**: Dzieli listę na strony po 5 elementów
- **UI**: Nawigacja "< 1 / X >"

**Test**:

```
✅ T1.4.1: Sprawdź ile jest stron (total sesji / 5)
✅ T1.4.2: Kliknij ">" → Następna strona
✅ T1.4.3: Kliknij "<" → Poprzednia strona
✅ T1.4.4: Sprawdź disabled na stronach 1 i ostatniej
✅ T1.4.5: Wyszukaj → Paginacja przelicza dla filtrowanych wyników
```

#### 1.5 Rozwijanie/zwijanie sesji

- **Funkcja**: `expandedSessionId` state
- **Co robi**: Minimalizuje szczegóły sesji
- **UI**: Kliknięcie na nagłówek sesji

**Test**:

```
✅ T1.5.1: Kliknij nagłówek sesji → Rozwija szczegóły
✅ T1.5.2: Kliknij ponownie → Zwija szczegóły
✅ T1.5.3: Rozwiń inną sesję → Poprzednia się zwija
✅ T1.5.4: Sprawdź czy przyciski akcji są widoczne tylko po rozwinięciu
```

---

### 2. Transkrypcja (Tryb asynchroniczny - zalecany)

#### 2.1 Rozpoczęcie transkrypcji async

- **Funkcja**: `handleTranscribe()` z `useAsyncMode=true`
- **API**: `startAsyncTranscription()`
- **Endpoint**: `POST /api/youtube/transcribe-async`
- **Co robi**: Tworzy zadanie w BullMQ queue, zapisuje do RAG

**Test**:

```
✅ T2.1.1: Rozwiń sesję → Kliknij "Transkrybuj"
✅ T2.1.2: Sprawdź opcje:
   - ✅ Tryb asynchroniczny (checked)
   - ✅ Identyfikacja mówców (checked)
   - ✅ Analiza sentymentu (checked)
✅ T2.1.3: Kliknij "🚀 Rozpocznij transkrypcję"
✅ T2.1.4: Sprawdź alert: "Zadanie transkrypcji zostało utworzone!"
✅ T2.1.5: Panel zadań (prawy) otwiera się automatycznie
✅ T2.1.6: Nowe zadanie widoczne w panelu z statusem "Oczekuje" lub "W trakcie"
```

#### 2.2 Monitoring zadania async

- **Funkcja**: Polling co 2s dla aktywnych zadań
- **API**: `getTranscriptionJobs()`
- **Co robi**: Odświeża status zadań w tle

**Test**:

```
✅ T2.2.1: Obserwuj panel zadań → Status zmienia się co 2s
✅ T2.2.2: Sprawdź statusy:
   - "Oczekuje" → żółty badge
   - "W trakcie" → niebieski badge, progress bar
   - "Zakończono" → zielony badge, przycisk "Zobacz dokument"
   - "Błąd" → czerwony badge, komunikat błędu
✅ T2.2.3: Sprawdź progress message (np. "Pobieranie audio...", "Transkrypcja...")
✅ T2.2.4: Sprawdź estimated time remaining
```

#### 2.3 Detailed progress modal

- **Funkcja**: `TranscriptionDetailModal`
- **API**: `getTranscriptionJobDetailed()`
- **Endpoint**: `GET /api/youtube/job/:jobId/detailed`
- **Co robi**: Pokazuje szczegółowy progress każdego kroku

**Test**:

```
✅ T2.3.1: Kliknij na kartę zadania → Modal się otwiera
✅ T2.3.2: Sprawdź global progress bar (0-100%)
✅ T2.3.3: Sprawdź listę kroków:
   - Download (0-15%)
   - Preprocessing (15-25%)
   - Transcription (25-65%)
   - Analysis (65-85%)
   - Saving (85-100%)
✅ T2.3.4: Sprawdź status ikon:
   - ⏳ Pending (szary)
   - 🔄 Active (niebieski, animowany)
   - ✅ Completed (zielony)
   - ❌ Failed (czerwony)
✅ T2.3.5: Sprawdź czasy wykonania dla zakończonych kroków
✅ T2.3.6: Sprawdź szczegóły kroku (model, language, audioIssues)
✅ T2.3.7: Kliknij "✕" → Modal się zamyka
✅ T2.3.8: Modal auto-refresh co 2s dla aktywnych zadań
```

#### 2.4 Mini-steps indicator na karcie zadania

- **Funkcja**: Wyświetlanie mini kroków na karcie
- **Co robi**: Wizualizacja postępu bez otwierania modala

**Test**:

```
✅ T2.4.1: Sprawdź mini steps pod progress bar
✅ T2.4.2: Format: "✓ Download • ✓ Preprocessing • → 29% Transcription • Analysis • Saving"
✅ T2.4.3: Zakończone kroki: zielone "✓"
✅ T2.4.4: Aktywny krok: niebieski "→ X%"
✅ T2.4.5: Oczekujące: szare bez ikony
```

#### 2.5 Zakończone zadanie - dokument

- **Funkcja**: `handleShowJobDocument()`
- **API**: `getTranscriptionDocument()`
- **Endpoint**: `GET /api/youtube/transcription/:documentId`
- **Co robi**: Pokazuje zapisany dokument z RAG

**Test**:

```
✅ T2.5.1: Zadanie zakończone → Przycisk "Zobacz dokument"
✅ T2.5.2: Kliknij "Zobacz dokument" → Modal z treścią
✅ T2.5.3: Sprawdź czy zawiera:
   - Tytuł sesji
   - Treść transkrypcji
   - Metadata (URL, data)
✅ T2.5.4: Kliknij "Zamknij" → Modal się zamyka
✅ T2.5.5: Test błędu - usuń dokument z bazy → "Błąd pobierania dokumentu"
```

---

### 3. Transkrypcja (Tryb synchroniczny)

#### 3.1 Rozpoczęcie transkrypcji sync

- **Funkcja**: `handleTranscribe()` z `useAsyncMode=false`
- **API**: `transcribeYouTubeVideo()`
- **Endpoint**: `POST /api/youtube/transcribe`
- **Co robi**: Czeka na wynik, nie zapisuje do RAG automatycznie

**Test**:

```
✅ T3.1.1: Odznacz "Tryb asynchroniczny"
✅ T3.1.2: Wybierz sesję → Kliknij "🚀 Rozpocznij transkrypcję"
✅ T3.1.3: Sprawdź progress message: "Pobieranie audio z YouTube..."
✅ T3.1.4: Poczekaj ~5-15 minut (zależnie od długości)
✅ T3.1.5: Po zakończeniu → Panel wyników transkrypcji się pokazuje
✅ T3.1.6: Sprawdź czy zawiera:
   - Tytuł wideo
   - Podsumowanie (średnie napięcie, sentyment, wiarygodność)
   - Liczba mówców
   - Czas trwania
   - Segmenty z timestampami
```

#### 3.2 Wynik transkrypcji - UI

- **Funkcja**: `transcriptionResult` state
- **Co robi**: Wyświetla wynik w prawym panelu

**Test**:

```
✅ T3.2.1: Sprawdź metryki:
   - Średnie napięcie (0-100)
   - Dominujący sentyment (pozytywny/neutralny/negatywny)
   - Średnia wiarygodność z emoji
   - Liczba mówców
✅ T3.2.2: Sprawdź segmenty:
   - Timestamp (HH:MM:SS)
   - Mówca (Speaker 1, 2, 3...)
   - Tekst
   - Sentyment + emoji
   - Napięcie (0-100)
   - Wiarygodność z emoji
✅ T3.2.3: Scroll długiej transkrypcji → Poprawne przewijanie
```

---

### 4. Akcje na transkrypcji

#### 4.1 Eksport do Markdown

- **Funkcja**: `handleExportMarkdown()`
- **Co robi**: Pobiera plik .md z transkrypcją
- **UI**: Przycisk "Pobierz Markdown"

**Test**:

```
✅ T4.1.1: Zakończ transkrypcję sync → Kliknij "Pobierz Markdown"
✅ T4.1.2: Sprawdź czy plik się pobiera
✅ T4.1.3: Otwórz plik → Format: `transkrypcja_TITLE_YYYY-MM-DD.md`
✅ T4.1.4: Sprawdź zawartość:
   - # Tytuł sesji
   - ## Podsumowanie (metryki)
   - ## Transkrypcja (segmenty)
✅ T4.1.5: Tytuł z polskimi znakami → Poprawnie znormalizowany w nazwie pliku
```

#### 4.2 Dodanie do RAG jako scenogram

- **Funkcja**: `handleAddToRAG()`
- **Endpoint**: `POST /api/rag/add-transcript`
- **Co robi**: Zapisuje transkrypcję do bazy wiedzy RAG

**Test**:

```
✅ T4.2.1: Zakończ transkrypcję sync → Kliknij "Dodaj do RAG jako scenogram"
✅ T4.2.2: Sprawdź alert: "Scenogram został dodany do bazy RAG!"
✅ T4.2.3: Sprawdź w Supabase `processed_documents`:
   - Nowy wpis z content = transkrypcja
   - metadata.videoUrl, videoTitle
   - embedding wygenerowany
✅ T4.2.4: Test w RAG search → Znajdź dokument po fragmencie transkrypcji
❌ T4.2.5: Test błędu - wyłącz API → "Błąd dodawania do RAG"
```

#### 4.3 Dodanie do kontekstu chata

- **Funkcja**: `handleAddToContext()`
- **Co robi**: Zapisuje sesję do localStorage jako kontekst
- **UI**: Przycisk "Do kontekstu" na sesji

**Test**:

```
✅ T4.3.1: Rozwiń sesję → Kliknij "Do kontekstu"
✅ T4.3.2: Sprawdź alert: "Dodano do kontekstu chata"
✅ T4.3.3: Otwórz localStorage → Klucz `chat_context`
✅ T4.3.4: Sprawdź zawartość:
   {
     type: "youtube_session",
     id: "xxx",
     title: "XXI Sesja...",
     url: "https://...",
     timestamp: ISO string
   }
✅ T4.3.5: Przejdź do chata → Sprawdź czy kontekst jest dostępny
```

#### 4.4 Dodanie do RAG z wykryciem powiązań

- **Funkcja**: `handlePrepareAddToRAG()` + `handleConfirmAddToRAG()`
- **Endpoint**: `POST /api/youtube/rag/add-youtube-session`
- **Co robi**: Wykrywa numer sesji i pozwala powiązać z dokumentem

**Test**:

```
✅ T4.4.1: Rozwiń sesję → Kliknij "Dodaj do RAG"
✅ T4.4.2: Modal się otwiera → Sprawdź wykrytą relację
✅ T4.4.3: Tytuł "XXI Sesja" → Detected: "Sesja 21"
✅ T4.4.4: Input "ID powiązanego dokumentu" → Opcjonalny
✅ T4.4.5: Kliknij "Potwierdź i dodaj do RAG"
✅ T4.4.6: Alert: "Sesja dodana do bazy RAG!"
✅ T4.4.7: Sprawdź w Supabase → Nowy dokument z metadata.detectedRelation
✅ T4.4.8: Kliknij "Anuluj" → Modal się zamyka bez dodawania
```

---

### 5. Panel zadań asynchronicznych

#### 5.1 Otwieranie/zamykanie panelu

- **Funkcja**: `showJobsPanel` state
- **UI**: Przycisk "📋 Zadania (X)" w headerze

**Test**:

```
✅ T5.1.1: Kliknij "📋 Zadania" → Panel się otwiera z prawej
✅ T5.1.2: Liczba w badge → Równa liczbie zadań
✅ T5.1.3: Kliknij "✕" w panelu → Panel się zamyka
✅ T5.1.4: Panel automatycznie otwiera się po utworzeniu nowego zadania
```

#### 5.2 Lista zadań

- **Funkcja**: `jobs` state
- **API**: `getTranscriptionJobs()`
- **Co robi**: Wyświetla wszystkie zadania użytkownika

**Test**:

```
✅ T5.2.1: Sprawdź listę zadań → Sortowane od najnowszych
✅ T5.2.2: Każde zadanie ma:
   - Tytuł wideo
   - Status badge
   - Progress bar (jeśli w trakcie)
   - Progress message
   - Estimated time
   - Mini-steps indicator
✅ T5.2.3: Zadania zakończone → Przycisk "Zobacz dokument"
✅ T5.2.4: Zadania błędne → Error message
```

#### 5.3 Kliknięcie na zadanie

- **Funkcja**: `setSelectedJobId()` → otwiera `TranscriptionDetailModal`
- **Co robi**: Pokazuje detailed progress

**Test**:

```
✅ T5.3.1: Kliknij na kartę zadania (nie na przycisk) → Modal się otwiera
✅ T5.3.2: Kliknij na przycisk "Zobacz szczegóły" → Modal się otwiera
✅ T5.3.3: Sprawdź czy pokazuje detailed progress (jak w T2.3)
```

---

### 6. Obsługa błędów

#### 6.1 Błędy pobierania sesji

**Test**:

```
❌ T6.1.1: Wyloguj się → "Brak aktywnej sesji. Zaloguj się ponownie."
❌ T6.1.2: Wyłącz API → "Błąd pobierania sesji YouTube"
✅ T6.1.3: Kliknij "Spróbuj ponownie" → Retry pobierania
```

#### 6.2 Błędy transkrypcji

**Test**:

```
❌ T6.2.1: Błędny URL wideo → "Błąd transkrypcji"
❌ T6.2.2: Brak yt-dlp na serwerze → "yt-dlp nie jest zainstalowany..."
❌ T6.2.3: Timeout STT API → "Błąd transkrypcji STT: STT API timeout po 600s"
❌ T6.2.4: Brak OpenAI key → "Błąd konfiguracji AI"
```

#### 6.3 Błędy zadań async

**Test**:

```
❌ T6.3.1: Worker nie działa → Zadanie czeka w nieskończoność
✅ T6.3.2: Sprawdź recovery system → Zadania > 1h powinny być oznaczone jako stuck
❌ T6.3.3: Błąd w trakcie przetwarzania → Status "Błąd" + error message
```

---

## 🔧 API Endpoints - weryfikacja

### Frontend API (`youtube-sessions.ts`)

```typescript
✅ getYouTubeSessions() → GET /api/youtube/sessions
✅ getTranscriptionJobs() → GET /api/youtube/jobs
✅ startAsyncTranscription() → POST /api/youtube/transcribe-async
✅ transcribeYouTubeVideo() → POST /api/youtube/transcribe
✅ getTranscriptionDocument() → GET /api/youtube/transcription/:docId
✅ getTranscriptionJobDetailed() → GET /api/youtube/job/:jobId/detailed
✅ getYouTubeVideoInfo() → POST /api/youtube/session-info
```

### Backend Routes (`apps/api/src/routes/youtube.ts`)

```typescript
✅ GET /api/youtube/sessions - Pobiera sesje z kanału
✅ POST /api/youtube/transcribe-async - Tworzy zadanie w BullMQ
✅ POST /api/youtube/transcribe - Synchroniczna transkrypcja (deprecated)
✅ GET /api/youtube/jobs - Lista zadań użytkownika
✅ GET /api/youtube/job/:jobId/detailed - Detailed progress joba
✅ GET /api/youtube/transcription/:docId - Dokument z RAG
✅ POST /api/youtube/session-info - Info o wideo
```

### BullMQ Queue (`transcription-queue`)

```typescript
✅ Worker: apps/worker/src/jobs/transcription.ts
✅ Queue: transcription-jobs
✅ Redis: localhost:6379
✅ Concurrency: 1
✅ Retry: 3 attempts
✅ Timeout: 30 minut per job
```

---

## 🎯 Scenariusze testowe end-to-end

### E2E-1: Kompletny flow async (happy path)

```
1. Zaloguj się do aplikacji
2. Przejdź do /documents/youtube
3. Poczekaj na załadowanie sesji (2-5s)
4. Znajdź sesję "XXI Sesja Rady Miejskiej"
5. Kliknij nagłówek → Rozwija szczegóły
6. Sprawdź opcje transkrypcji (wszystkie checked)
7. Kliknij "🚀 Rozpocznij transkrypcję"
8. Sprawdź alert → OK
9. Panel zadań otwiera się automatycznie
10. Nowe zadanie widoczne ze statusem "Oczekuje"
11. Po 10-30s → Status "W trakcie"
12. Kliknij na kartę zadania → Modal detailed progress
13. Obserwuj progress przez kroki:
    - Download (0-15%) → ~2 min
    - Preprocessing (15-25%) → ~1 min
    - Transcription (25-65%) → ~10-20 min
    - Analysis (65-85%) → ~3 min
    - Saving (85-100%) → ~1 min
14. Status zmienia się na "Zakończono"
15. Przycisk "Zobacz dokument" pojawia się
16. Kliknij "Zobacz dokument" → Modal z transkrypcją
17. Sprawdź zawartość → Poprawna transkrypcja
18. Zamknij modal
19. Przejdź do RAG search → Znajdź dokument
✅ PASS - Pełny flow działa
```

### E2E-2: Kompletny flow sync

```
1-5. Jak w E2E-1
6. Odznacz "Tryb asynchroniczny"
7. Kliknij "🚀 Rozpocznij transkrypcję"
8. Poczekaj 10-20 minut (blocking)
9. Wynik transkrypcji pokazuje się w prawym panelu
10. Sprawdź metryki i segmenty
11. Kliknij "Pobierz Markdown" → Plik się pobiera
12. Otwórz plik → Sprawdź zawartość
13. Kliknij "Dodaj do RAG jako scenogram"
14. Alert: "Scenogram został dodany do bazy RAG!"
15. Sprawdź w RAG → Dokument istnieje
✅ PASS - Sync flow działa
```

### E2E-3: Multiple jobs jednocześnie

```
1. Utwórz 3 zadania async dla różnych sesji
2. Wszystkie 3 pojawiają się w panelu
3. Worker przetwarza je sekwencyjnie (concurrency=1)
4. Pierwsze zadanie się wykonuje
5. Drugie czeka w statusie "Oczekuje"
6. Trzecie też czeka
7. Po zakończeniu pierwszego → Drugie zaczyna się przetwarzać
8. Wszystkie 3 kończą się sukcesem
✅ PASS - Queue działa poprawnie
```

### E2E-4: Error handling - timeout STT

```
1. Skonfiguruj STT na lokalny provider (Ollama)
2. Wyłącz lokalny STT server
3. Utwórz zadanie async
4. Zadanie zaczyna się przetwarzać
5. Dociera do "Inicjalizacja Whisper..."
6. Po 10 minutach → Timeout error
7. Status: "Błąd"
8. Error message: "Błąd transkrypcji STT: STT API timeout po 600s"
9. Worker automatycznie retry (BullMQ)
10. Po 3 retry → Status "failed" w Redis
11. UI pokazuje "Błąd" + komunikat
✅ PASS - Timeout handling działa
```

---

## 📊 Checklist testowy (do wypełnienia)

### Podstawowe funkcje

- [ ] T1.1: Pobieranie sesji YouTube
- [ ] T1.2: Wyszukiwanie sesji
- [ ] T1.3: Sortowanie sesji
- [ ] T1.4: Paginacja
- [ ] T1.5: Rozwijanie/zwijanie sesji

### Transkrypcja async

- [ ] T2.1: Rozpoczęcie async transcription
- [ ] T2.2: Monitoring zadania (polling)
- [ ] T2.3: Detailed progress modal
- [ ] T2.4: Mini-steps indicator
- [ ] T2.5: Zobacz dokument zakończonego zadania

### Transkrypcja sync

- [ ] T3.1: Rozpoczęcie sync transcription
- [ ] T3.2: Wynik transkrypcji UI

### Akcje

- [ ] T4.1: Eksport Markdown
- [ ] T4.2: Dodanie do RAG jako scenogram
- [ ] T4.3: Dodanie do kontekstu chata
- [ ] T4.4: Dodanie do RAG z wykryciem powiązań

### Panel zadań

- [ ] T5.1: Otwieranie/zamykanie panelu
- [ ] T5.2: Lista zadań
- [ ] T5.3: Kliknięcie na zadanie

### Obsługa błędów

- [ ] T6.1: Błędy pobierania sesji
- [ ] T6.2: Błędy transkrypcji
- [ ] T6.3: Błędy zadań async

### E2E

- [ ] E2E-1: Kompletny flow async
- [ ] E2E-2: Kompletny flow sync
- [ ] E2E-3: Multiple jobs
- [ ] E2E-4: Error handling

---

## 🐛 Znane problemy i fixes

### Problem 1: Job utknął na 29% "Inicjalizacja Whisper"

**Status**: ✅ FIXED  
**Fix**: Dodano timeout 10 min dla STT API call w `youtube-downloader.ts:390-425`  
**Dokumentacja**: `docs/FIX_STT_TIMEOUT_PROBLEM.md`

### Problem 2: "Failed to fetch job details" w modal

**Status**: ✅ FIXED  
**Fix**: Zmieniono z direct fetch na `getTranscriptionJobDetailed()` helper  
**Commit**: TranscriptionDetailModal.tsx:77

### Problem 3: Redis connection refused

**Status**: ✅ OK  
**Rozwiązanie**: Port 6379 zajęty = Redis działa

---

## 🚀 Przygotowanie do testów

### 1. Uruchom wszystkie serwisy

```powershell
# Terminal 1 - Redis (Docker)
docker run --rm -it -p 6379:6379 redis:7-alpine

# Terminal 2 - API
cd apps/api
npm run dev

# Terminal 3 - Worker
cd apps/worker
npm run dev

# Terminal 4 - Frontend
cd apps/frontend
npm run dev
```

### 2. Sprawdź konfigurację

- [ ] Redis działa: `redis-cli ping` → PONG
- [ ] API działa: `curl http://localhost:3001/health`
- [ ] Worker działa: Logi pokazują "🚀 Started"
- [ ] Frontend działa: `http://localhost:3000`

### 3. Zaloguj się

- Email/Password lub OAuth
- Sprawdź czy token w localStorage

### 4. Skonfiguruj STT provider

**Settings → API → AI Configuration**:

- STT Provider: **OpenAI** (zalecane)
- STT Model: **whisper-1**
- API Key: Twój klucz
- Save

### 5. Gotowe do testów!

Przejdź do `/documents/youtube` i rozpocznij testy wg checklist.

---

## 📝 Raportowanie błędów

Przy znalezieniu błędu wypełnij:

**Bug Report Template**:

```
# Bug: [Krótki opis]

## Kroki do reprodukcji
1. ...
2. ...
3. ...

## Oczekiwane zachowanie
...

## Rzeczywiste zachowanie
...

## Środowisko
- Browser: Chrome 120
- OS: Windows 11
- API: localhost:3001
- Worker: localhost (via API)

## Logi / Screenshots
...

## Priorytet
- [ ] Critical (blokuje funkcjonalność)
- [ ] High (ważna funkcja nie działa)
- [ ] Medium (drobny problem)
- [ ] Low (kosmetyczny)
```

---

**Status dokumentu**: 📋 Gotowy do testów  
**Ostatnia aktualizacja**: 2026-01-16 04:51
