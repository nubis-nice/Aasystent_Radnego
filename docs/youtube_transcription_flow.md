# Flow Transkrypcji YouTube z Automatycznym Przypisaniem do Sesji

## Przegląd

System automatycznie analizuje tytuły nagrań YouTube, przypisuje je do sesji rady miejskiej i inteligentnie zarządza transkrypcjami z analizą sentymentu.

## Architektura

### 1. Dynamiczne Wyszukiwanie Kanału YouTube

**Lokalizacja:** `apps/api/src/services/youtube-session-service.ts`

**Proces:**

1. Pobierz dane gminy z profilu użytkownika (`user_locale_settings`):
   - `municipality` - nazwa gminy/miasta
   - `council_name` - pełna nazwa rady
   - `voivodeship` - województwo
2. **LLM generuje zapytanie wyszukiwania** kanału YouTube:
   - Przykład: "gmina drawno oficjalny kanał"
   - Fallback: proste zapytanie bez LLM
3. Wyszukiwanie kanału przez YouTube Search API

**Zalety:**

- Brak hardcoded kanałów - działa dla każdej gminy
- Automatyczne dostosowanie do użytkownika
- Inteligentne wyszukiwanie przez LLM

### 2. Scraping YouTube → Analiza Tytułów

**Lokalizacja:** `apps/api/src/services/intelligent-scraper.ts`

**Proces:**

1. Automatyczny scraping kanału YouTube (cron: hourly/daily/weekly)
2. Dla każdego wideo:
   - Pobierz tytuł, URL, metadata
   - **Analiza tytułu przez LLM** (`YouTubeSessionService.analyzeVideoTitle()`)
   - Wyodrębnienie numeru sesji (konwersja rzymskich → arabskie)
   - Ocena pewności identyfikacji (0-100%)
3. Zapis do `scraped_content` z metadanymi:

```typescript
metadata: {
  videoId: string,
  sessionNumber: number | null,        // Wyodrębniony numer sesji
  sessionNumberConfidence: number,     // Pewność identyfikacji (0-100)
  sessionAnalysisReasoning: string,    // Uzasadnienie LLM
  youtubeTranscriptionAvailable: true, // Flaga dostępności
  transcriptionStatus: "pending",      // pending | completed | failed
}
```

### 2. Analiza Tytułów YouTube

**Lokalizacja:** `apps/api/src/services/youtube-session-service.ts`

**Metoda:** `analyzeVideoTitle(videoTitle: string)`

**Funkcjonalność:**

- **LLM Analysis:** GPT-4o-mini analizuje tytuł i wyodrębnia numer sesji
- **Konwersja rzymskich:** XIV → 14, XVII → 17, etc.
- **Regex Fallback:** Gdy LLM niedostępny, używa regex
- **Przykłady:**
  - "Sesja Rady Miejskiej nr 14" → `sessionNumber: 14, confidence: 95`
  - "XVII Sesja Rady Gminy Drawno" → `sessionNumber: 17, confidence: 90`
  - "Transmisja obrad - sesja 25" → `sessionNumber: 25, confidence: 85`

### 3. Transkrypcja Audio → RAG

**Lokalizacja:** `apps/api/src/services/transcription-job-service.ts`

**Pipeline:**

1. **Downloading** (10%) - pobieranie audio z YouTube
2. **Preprocessing** (20%) - adaptacyjna normalizacja audio
3. **Transcribing** (35-60%) - Whisper STT
4. **Analyzing** (60-85%) - identyfikacja mówców, analiza sentymentu
5. **Saving** (85-100%) - zapis do RAG

**Zapis do RAG:**

```typescript
processed_documents: {
  document_type: "transkrypcja",
  content: formattedTranscript,  // Pełny tekst z analizą
  metadata: {
    sessionId: string,
    dominantSentiment: string,
    averageTension: number,
    overallCredibility: number,
    speakerCount: number,
    speakers: string[],
  }
}
```

**Aktualizacja statusu:**
Po zakończeniu transkrypcji → aktualizacja `scraped_content`:

```typescript
metadata: {
  transcriptionStatus: "completed",
  transcriptionDocumentId: string  // ID w processed_documents
}
```

### 4. Orkiestrator Narzędzi - Inteligentna Detekcja

**Lokalizacja:** `apps/api/src/services/ai-tool-orchestrator.ts`

**Metoda:** `checkYouTubeTranscriptionAvailability(sessionNumber: number)`

**Proces:**

1. Wyszukaj w `scraped_content` nagranie z `sessionNumber`
2. Sprawdź `transcriptionStatus`:
   - **pending** → Generuj interaktywne opcje dla użytkownika
   - **completed** → Pobierz treść z `processed_documents`
   - **not_found** → Brak nagrania

**Scenariusz A: Transkrypcja Pending**

```
📹 INFORMACJA O NAGRANIU YOUTUBE:
Znaleziono nagranie sesji nr 14 na YouTube. Transkrypcja nie została jeszcze wykonana.
Tytuł: XVII Sesja Rady Miejskiej
Link: https://youtube.com/watch?v=...

⚠️ WAŻNE: Transkrypcja tego nagrania nie została jeszcze wykonana.
Użytkownik może:
1. Zlecić automatyczną transkrypcję nagrania (zajmie kilka minut)
2. Obejrzeć nagranie bezpośrednio na YouTube
3. Kontynuować analizę bez transkrypcji
```

**Scenariusz B: Transkrypcja Completed**

```
✅ TRANSKRYPCJA SESJI Z YOUTUBE:
Transkrypcja sesji nr 14 jest dostępna
Tytuł: XVII Sesja Rady Miejskiej
Link: https://youtube.com/watch?v=...

TREŚĆ TRANSKRYPCJI:
[Pełna transkrypcja z analizą sentymentu, mówcami, emocjami...]
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SCRAPING YOUTUBE (Automatyczny - Cron)                   │
│    ├─ Pobierz listę filmów z kanału                         │
│    ├─ Dla każdego filmu:                                    │
│    │   ├─ Analizuj tytuł przez LLM                          │
│    │   ├─ Wyodrębnij numer sesji (XIV → 14)                │
│    │   └─ Zapisz do scraped_content z metadata             │
│    │       ├─ sessionNumber: 14                             │
│    │       ├─ sessionNumberConfidence: 90                   │
│    │       ├─ youtubeTranscriptionAvailable: true           │
│    │       └─ transcriptionStatus: "pending"                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. CHAT - Zapytanie o Sesję (np. "Sesja nr 14")            │
│    ├─ Orkiestrator wykrywa intencję: session_search        │
│    ├─ Sprawdza dostępność transkrypcji YouTube             │
│    │   └─ checkYouTubeTranscriptionAvailability(14)        │
│    └─ Generuje odpowiedź z opcjami                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    ┌───────┴───────┐
                    │               │
        ┌───────────▼─────┐   ┌────▼──────────┐
        │ Status: PENDING │   │ Status:       │
        │                 │   │ COMPLETED     │
        └───────┬─────────┘   └────┬──────────┘
                │                  │
                ▼                  ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│ 3A. INTERAKTYWNA OPCJA    │   │ 3B. DOŁĄCZ TRANSKRYPCJĘ     │
│     ├─ Opcja 1: Zlecić    │   │     ├─ Pobierz z RAG        │
│     │   transkrypcję      │   │     ├─ Dołącz do kontekstu  │
│     ├─ Opcja 2: Obejrzeć  │   │     │   (max 8000 znaków)   │
│     │   na YouTube        │   │     └─ Analiza z           │
│     └─ Opcja 3: Kontynuuj │   │         sentymentem         │
│         bez transkrypcji  │   └─────────────────────────────┘
└───────────────────────────┘
        │
        │ (Użytkownik wybiera Opcję 1)
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. TRANSKRYPCJA (Asynchroniczna)                            │
│    ├─ Download audio (yt-dlp)                               │
│    ├─ Preprocessing (normalizacja, redukcja szumów)         │
│    ├─ Whisper STT (pl)                                      │
│    ├─ Analiza LLM:                                          │
│    │   ├─ Identyfikacja mówców                              │
│    │   ├─ Analiza sentymentu (positive/neutral/negative)    │
│    │   ├─ Emocje (😊😢😠😨🤔)                                │
│    │   ├─ Napięcie emocjonalne (1-10)                       │
│    │   └─ Wiarygodność wypowiedzi (0-100%)                  │
│    ├─ Zapis do processed_documents (RAG)                    │
│    └─ Aktualizacja scraped_content:                         │
│        └─ transcriptionStatus: "completed"                  │
└─────────────────────────────────────────────────────────────┘
```

## Struktura Danych

### scraped_content (YouTube Videos)

```sql
{
  id: uuid,
  source_id: uuid,
  url: string,  -- https://youtube.com/watch?v=...
  title: string,
  content: string,
  content_type: "youtube_video",
  metadata: {
    videoId: string,
    sessionNumber: number | null,
    sessionNumberConfidence: number,
    sessionAnalysisReasoning: string,
    youtubeTranscriptionAvailable: boolean,
    transcriptionStatus: "pending" | "completed" | "failed",
    transcriptionDocumentId?: string
  }
}
```

### processed_documents (Transkrypcje)

```sql
{
  id: uuid,
  user_id: uuid,
  title: string,  -- "Transkrypcja: XVII Sesja Rady..."
  content: string,  -- Pełny tekst z formatowaniem Markdown
  document_type: "transkrypcja",
  source_url: string,  -- Link do YouTube
  embedding: vector,
  metadata: {
    category: "transkrypcje",
    sessionId?: string,
    videoUrl: string,
    duration: string,
    speakerCount: number,
    dominantSentiment: string,
    averageTension: number,
    overallCredibility: number,
    speakers: string[]
  }
}
```

## Konfiguracja

### Źródła Danych YouTube

**Lokalizacja:** Settings → Data Sources

- **Typ:** YouTube
- **URL:** https://www.youtube.com/@gminadrawno9146
- **Częstotliwość:** daily/weekly
- **Metoda:** scraping (bez API key)

### AI Configuration

**STT (Speech-to-Text):**

- Model: `whisper-1` (OpenAI) lub `Systran/faster-whisper-large-v3` (lokalny)
- Język: `pl`
- Timeout: 30 minut (dla długich sesji)

**LLM (Analiza):**

- Model: `gpt-4o-mini` lub `gpt-4o`
- Temperatura: 0.1 (deterministyczna analiza)

## Przykłady Użycia

### 1. Zapytanie o Sesję z Transkrypcją Pending

**Użytkownik:** "Co było na sesji nr 14?"

**Orkiestrator:**

- Wykrywa intencję: `session_search`
- Sprawdza YouTube: znaleziono nagranie, status `pending`
- Generuje odpowiedź:

```
Znalazłem informacje o sesji nr 14:

📹 Dostępne jest nagranie na YouTube:
"XVII Sesja Rady Miejskiej w Drawnie"
Link: https://youtube.com/watch?v=abc123

⚠️ Transkrypcja tego nagrania nie została jeszcze wykonana.

Co chcesz zrobić?
1. **Zlecić automatyczną transkrypcję** - zajmie 5-10 minut, otrzymasz pełną
   transkrypcję z analizą sentymentu i identyfikacją mówców
2. **Obejrzeć nagranie** bezpośrednio na YouTube
3. **Kontynuować** analizę na podstawie dostępnych dokumentów (protokoły, uchwały)
```

### 2. Zapytanie o Sesję z Gotową Transkrypcją

**Użytkownik:** "Co było na sesji nr 14?"

**Orkiestrator:**

- Wykrywa intencję: `session_search`
- Sprawdza YouTube: znaleziono transkrypcję, status `completed`
- Pobiera treść z RAG
- Analizuje z pełnym kontekstem transkrypcji

**Odpowiedź:**

```
Na sesji nr 14 (XVII Sesja Rady Miejskiej w Drawnie) omawiano następujące tematy:

1. **Budżet gminy na 2024 rok** (Burmistrz, 15:30)
   - Sentyment: pozytywny 😊
   - Napięcie: 3/10
   - Planowane wydatki: 12,5 mln zł

2. **Remont drogi gminnej** (Radny Kowalski, 28:45)
   - Sentyment: neutralny 😐
   - Napięcie: 5/10
   - Wątpliwości co do wykonawcy

[...pełna analiza na podstawie transkrypcji...]

📊 Podsumowanie sesji:
- Czas trwania: 2:15:30
- Liczba mówców: 12
- Dominujący sentyment: Neutralny
- Średnie napięcie: 4.2/10
- Ogólna wiarygodność: 85% 🟢

Źródła:
- Transkrypcja: XVII Sesja Rady Miejskiej (YouTube)
- Protokół z sesji nr 14
```

## Monitoring i Debugging

### Logi

```bash
# Scraping YouTube
[IntelligentScraper] Found 15 YouTube sessions
[IntelligentScraper] Video "XVII Sesja Rady" → Session 17 (confidence: 90%)

# Analiza tytułów
[YouTubeSessionService] Analyzed title: "Sesja nr 14" → session 14 (confidence: 95%)

# Transkrypcja
[TranscriptionJob] Job abc123 started
[TranscriptionJob] Downloading audio...
[TranscriptionJob] Transcribing (may take several minutes)...
[TranscriptionJob] Updated transcription status to 'completed' for https://youtube.com/...

# Orkiestrator
[AIOrchestrator] Detected intent: session_search
[AIOrchestrator] Checking YouTube transcription for session 14
[AIOrchestrator] Transcription status: completed, attaching content
```

## Bezpieczeństwo i Wydajność

### Limity

- **Rozmiar audio:** max 25MB (Whisper limit)
- **Długość transkrypcji w kontekście:** max 8000 znaków
- **Timeout STT:** 30 minut

### Optymalizacje

- **Preprocessing audio:** adaptacyjna normalizacja, redukcja szumów
- **Caching:** transkrypcje zapisane w RAG, nie trzeba ponownie transkrybować
- **Asynchroniczne przetwarzanie:** transkrypcja w tle, nie blokuje użytkownika

## Uniwersalne Wyszukiwanie YouTube

System obsługuje wyszukiwanie **dowolnych materiałów wideo**, nie tylko sesji rady:

### Przykłady Zapytań

**Użytkownik:** "Znajdź nagranie z konferencji prasowej burmistrza o budżecie"

**Orkiestrator:**

- Wykrywa intencję: `youtube_search`
- Generuje zapytanie: "konferencja prasowa burmistrz budżet [nazwa gminy]"
- Wyszukuje na YouTube
- Prezentuje wyniki z opcją transkrypcji

**Użytkownik:** "Czy jest film o nowej inwestycji drogowej?"

**Orkiestrator:**

- Wykrywa intencję: `youtube_search`
- Generuje zapytanie: "inwestycja drogowa [nazwa gminy]"
- Wyszukuje materiały wideo
- Użytkownik może zlecić transkrypcję wybranego filmu

### Zlecenie Transkrypcji z Chatu

**API Endpoint:** `POST /api/youtube/transcribe-async`

```typescript
{
  videoUrl: string,           // URL YouTube
  videoTitle?: string,         // Opcjonalny tytuł
  sessionId?: string,          // Opcjonalne ID sesji
  includeSentiment?: boolean,  // Analiza sentymentu (default: true)
  identifySpeakers?: boolean   // Identyfikacja mówców (default: true)
}
```

**Odpowiedź:**

```typescript
{
  success: true,
  jobId: string,              // ID zadania do monitorowania
  status: "pending",
  message: "Zadanie transkrypcji zostało utworzone"
}
```

**Sprawdzenie statusu:** `GET /api/youtube/job/:jobId`

## Rozszerzenia Przyszłe

1. **Automatyczna transkrypcja po scrapingu** - opcja w konfiguracji źródła
2. **Powiadomienia** - email gdy transkrypcja gotowa
3. **Wyszukiwanie w transkrypcjach** - semantic search po wypowiedziach
4. **Analiza trendów** - jak zmieniał się sentyment na przestrzeni sesji
5. **Export** - PDF/DOCX z pełną transkrypcją i analizą
6. **Integracja z kalendarzem** - automatyczne transkrypcje zaplanowanych sesji
