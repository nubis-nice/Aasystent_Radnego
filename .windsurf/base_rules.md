# WINDSURF BASE RULES – Asystent Radnego

## Rola

Działasz jako **Senior Software Architect & Backend Engineer**.

Tworzysz i utrzymujesz **Agenta AI Windsurf** (analiza prawna, budżetowa, porównawcza JST).

System opiera się wyłącznie na **publicznych, bezpłatnych API i scraperach** (ISAP, CBOSA, RIO, BIP, Dzienniki Urzędowe).

**Brak MCP. Brak zgadywania prawa.**

---

## 0. PERSONALIZACJA AGENTA (GLOBALNE ZASADY)

### 0.1 Dane użytkownika z `user_locale_settings`

**ZAWSZE** pobieraj dane lokalne użytkownika przed rozpoczęciem pracy:

```typescript
// Tabela: user_locale_settings
interface UserLocaleSettings {
  user_id: string;
  language: string; // "pl" | "en"
  timezone: string; // "Europe/Warsaw"
  date_format: string; // "DD.MM.YYYY"
  municipality: string; // Gmina/Miasto (np. "Drawno")
  voivodeship: string; // Województwo (np. "zachodniopomorskie")
  council_name: string; // Pełna nazwa rady (np. "Rada Miejska w Drawnie")
  bip_url: string; // Adres BIP gminy
}
```

### 0.2 Zwracanie się do użytkownika

**Model AI ZAWSZE:**

- Pobiera imię użytkownika z `user_profiles.full_name`
- Zwraca się do użytkownika **po imieniu** (pierwsza część `full_name`)
- Przykład: "Cześć Marcin, przeanalizowałem dokument..."

```typescript
// Wyciągnij imię z pełnego imienia i nazwiska
const firstName = profile.full_name?.split(" ")[0] || "";
```

### 0.3 Kontekst lokalny

**System ZAWSZE ustawia się do pracy na rzecz samorządu użytkownika:**

- Priorytetyzuje źródła z gminy/powiatu użytkownika
- Używa `council_name` w kontekście odpowiedzi
- Automatycznie przeszukuje BIP użytkownika (`bip_url`)
- Zna województwo i specyfikę regionalną

### 0.4 Implementacja w chat.ts

```typescript
// Pobierz dane lokalne
const { data: localeSettings } = await supabase
  .from("user_locale_settings")
  .select("*")
  .eq("user_id", userId)
  .single();

// Buduj kontekst z priorytetem dla danych lokalnych
const systemPromptContext = {
  municipalityName:
    localeSettings?.municipality || localeSettings?.council_name,
  councilName: localeSettings?.council_name,
  voivodeship: localeSettings?.voivodeship,
  bipUrl: localeSettings?.bip_url,
  userName: profile?.full_name,
  userPosition: profile?.position,
};
```

---

## Zasady nadrzędne

1. **Najpierw architektura** → potem kod.
2. **Separacja odpowiedzialności**: `ingest → parse → analyze → diff → output`
3. **Kod produkcyjny**, audytowalny, testowalny.
4. **AI wspiera** klasyfikację i podobieństwo, **nie podejmuje decyzji prawnych**.

---

## 1. KONFIGURACJA DYNAMICZNA (ZAKAZ HARDCODOWANIA)

### 1.1 Konfiguracja API

**ZAWSZE** pobieraj konfigurację z `api_configurations` przez `AIConfigResolver`:

```typescript
// ✅ POPRAWNIE - dynamiczna konfiguracja
const configResolver = new AIConfigResolver(supabase, userId);
const config = await configResolver.resolve();

// ❌ BŁĘDNIE - hardcoded
const openai = new OpenAI({ apiKey: "sk-..." });
const model = "gpt-4o";
```

### 1.2 Providery AI

Nigdy nie hardcoduj nazw providerów ani modeli:

```typescript
// ✅ POPRAWNIE
const provider = config.providers.get(functionType);
const model = provider.modelName;

// ❌ BŁĘDNIE
const model = "gpt-4o-mini";
const provider = "openai";
```

### 1.3 Providery Semantic Search

Używaj dynamicznej listy z `DeepResearchService`:

```typescript
// ✅ POPRAWNIE - dynamiczne providery
const providers = await deepResearch.getAvailableProviders();
// Zwraca: ['exa', 'brave', 'tavily', 'serper'] na podstawie api_configurations

// ❌ BŁĘDNIE
const providers = ["exa"]; // hardcoded
```

---

## 2. DEEP RESEARCH - WYSZUKIWANIE DOKUMENTACJI

### 2.1 Zasada użycia

**ZAWSZE** używaj `DeepResearchService` do wyszukiwania zewnętrznych informacji:

```typescript
// ✅ POPRAWNIE
const deepResearch = new DeepResearchService(supabase, userId);
const results = await deepResearch.research({
  query: "ustawa o samorządzie gminnym art. 18",
  researchType: "legal",
  depth: "standard"
});

// ❌ BŁĘDNIE - bezpośrednie wywołanie API
const response = await fetch("https://api.exa.ai/search", {...});
```

### 2.2 Dynamiczne providery w DeepResearch

DeepResearch automatycznie używa providerów z `api_configurations`:

```
┌─────────────────────────────────────────────────────────┐
│ DeepResearchService                                     │
│   ├── ExaProvider      (jeśli klucz w DB)               │
│   ├── BraveProvider    (jeśli klucz w DB)               │
│   ├── TavilyProvider   (jeśli klucz w DB)               │
│   └── SerperProvider   (jeśli klucz w DB)               │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Typy wyszukiwań

```typescript
type ResearchType = "legal" | "budget" | "general" | "session";
type ResearchDepth = "quick" | "standard" | "deep";
```

---

## 3. CHAT AI - PRZEPŁYW PRZETWARZANIA ZAPYTAŃ

### 3.1 Algorytm obsługi zapytania

```
ZIDENTYFIKUJ → WYSZUKAJ → SPRAWDŹ AKTUALNOŚĆ → PRZEANALIZUJ → WYKONAJ
```

```typescript
async function handleChatMessage(message: string, userId: string) {
  // 1. ZIDENTYFIKUJ - wykryj intencję i wymagane dane
  const intent = await detectIntent(message);
  const sessionIntent = documentQueryService.detectSessionIntent(message);

  // 2. WYSZUKAJ - najpierw RAG, potem external
  let documents = await ragSearch(message, userId);

  // 3. SPRAWDŹ AKTUALNOŚĆ - jeśli brak lub nieaktualne, zdobądź
  if (needsFreshData(intent, documents)) {
    const externalResults = await deepResearch.research({
      query: message,
      researchType: intent.type,
    });
    documents = [...documents, ...externalResults];
  }

  // 4. PRZEANALIZUJ - użyj odpowiednich silników
  const analysis = await analyzeWithRelevantEngine(intent, documents);

  // 5. WYKONAJ - wygeneruj odpowiedź
  return generateResponse(analysis, documents);
}
```

### 3.2 Dostępne narzędzia do zdobywania informacji

| Narzędzie                 | Użycie                   | Moduł                                         |
| ------------------------- | ------------------------ | --------------------------------------------- |
| **RAG Search**            | Dokumenty użytkownika    | `DocumentQueryService`                        |
| **Session Discovery**     | Sesje rady, protokoły    | `SessionDiscoveryService`                     |
| **Deep Research**         | Zewnętrzne źródła prawne | `DeepResearchService`                         |
| **Legal Search**          | ISAP, CBOSA, Dzienniki   | `LegalSearchApi`                              |
| **Budget Analysis**       | Analiza budżetowa        | `BudgetAnalysisEngine`                        |
| **Legal Reasoning**       | Analiza prawna           | `LegalReasoningEngine`                        |
| **Intelligence Scraping** | Dane z BIP, YouTube      | `IntelligentScraper`, `ScraperV2`             |
| **Audio Transcription**   | Transkrypcja nagrań      | `AudioTranscriber`, `TranscriptionJobService` |
| **YouTube Download**      | Pobieranie audio         | `YouTubeDownloader`, `YouTubeSessionService`  |

### 3.3 Hierarchia wyszukiwania

```
1. RAG (lokalne dokumenty użytkownika)
   ↓ jeśli brak
2. Session Discovery (sesje rady)
   ↓ jeśli brak
3. Deep Research (Exa, Brave, Tavily, Serper)
   ↓ jeśli potrzeba prawna
4. Legal Search API (ISAP, CBOSA)
   ↓ jeśli potrzeba budżetowa
5. Budget Analysis Engine
```

---

## 4. AUTO-TRANSKRYPCJA YOUTUBE I AUDIO

### 4.1 Kiedy wykonywać transkrypcję

Gdy DeepResearch znajdzie źródła audio/video (YouTube, nagrania), AI ocenia relevancję:

```typescript
// Przepływ auto-transkrypcji
if (isAudioVideoSource(result.url) && isRelevantForCouncil(result)) {
  // 1. Pobierz audio
  const audio = await youtubeDownloader.downloadAudio(result.url);

  // 2. Wykonaj transkrypcję
  const transcription = await audioTranscriber.transcribe(audio, {
    language: "pl",
    model: config.transcriptionModel, // dynamiczny model z konfiguracji
  });

  // 3. Analiza sentymentu
  const sentiment = await analyzeSentiment(transcription.text);

  // 4. Dodaj do RAG
  await addToRAG({
    content: transcription.text,
    source_url: result.url,
    document_type: "transcription",
    metadata: {
      sentiment: sentiment,
      duration: audio.duration,
      speakers: transcription.speakers,
    },
  });
}
```

### 4.2 Kryteria relevancji dla transkrypcji

```typescript
function isRelevantForCouncil(result: SearchResult): boolean {
  const relevantPatterns = [
    /sesja.*rady/i,
    /posiedzenie.*komisji/i,
    /rada\s+(gminy|miejska|powiatu)/i,
    /obrady/i,
    /transmisja.*sesji/i,
    /nagranie.*sesji/i,
    /burmistrz|wójt|starosta/i,
    /informacja\s+publiczna/i,
  ];

  return relevantPatterns.some(
    (p) => p.test(result.title) || p.test(result.description)
  );
}
```

### 4.3 Analiza sentymentu transkrypcji

```typescript
interface SentimentAnalysis {
  overall: "positive" | "neutral" | "negative" | "mixed";
  score: number; // -1.0 do 1.0
  topics: Array<{
    topic: string;
    sentiment: string;
    confidence: number;
  }>;
  speakers?: Array<{
    speaker: string;
    sentiment: string;
    statements: number;
  }>;
}

// Dodawaj do RAG razem z sentymentem
await processedDocuments.insert({
  content: transcription.text,
  sentiment_analysis: sentimentAnalysis,
  document_type: "session_transcription",
  keywords: extractKeywords(transcription.text),
});
```

### 4.4 Moduły transkrypcji

```
┌─────────────────────────────────────────────────────────┐
│ YouTubeDownloader                                       │
│   └── Pobiera audio z YouTube                           │
├─────────────────────────────────────────────────────────┤
│ AudioPreprocessor                                       │
│   └── Normalizacja, dzielenie na chunki                 │
├─────────────────────────────────────────────────────────┤
│ AudioTranscriber                                        │
│   └── Whisper API (dynamiczny model z konfiguracji)     │
├─────────────────────────────────────────────────────────┤
│ AudioAnalyzer                                           │
│   └── Detekcja mówców, analiza jakości                  │
├─────────────────────────────────────────────────────────┤
│ TranscriptionJobService                                 │
│   └── Kolejkowanie i zarządzanie zadaniami              │
└─────────────────────────────────────────────────────────┘
```

---

## 5. INTELLIGENCE SCRAPING

### 5.1 Filtrowanie AI (checkDocumentRelevance)

Każdy scrapowany dokument przechodzi przez filtr relevancji:

```typescript
const isRelevant = await checkDocumentRelevance(
  openai,
  content.title,
  content.raw_content,
  content.url
);

if (!isRelevant) {
  console.log(`[Scraper] Pomijam nieistotny dokument: ${content.title}`);
  continue;
}
```

### 5.2 Wzorce do odrzucenia

```typescript
const irrelevantPatterns = [
  /howyoutubeworks/i,
  /privacy.*policy/i,
  /terms.*service/i,
  /business.*model/i,
  /creator.*economy/i,
];
```

### 5.3 Słowa kluczowe do akceptacji

```typescript
const relevantKeywords = [
  "sesja",
  "rada",
  "gmina",
  "uchwała",
  "protokół",
  "burmistrz",
  "wójt",
  "radny",
  "budżet",
  "bip",
  "urząd",
];
```

---

## 6. ZAKRES FUNKCJONALNY

### 6.1 Legal Analysis

- Delegacje ustawowe
- Kompetencje organu
- Sprzeczności z prawem
- Moduły: `LegalReasoningEngine`, `LegalSearchApi`

### 6.2 Budget Analysis

- Klasyfikacja budżetowa
- Przesunięcia środków
- Ryzyka WPF/RIO
- Moduł: `BudgetAnalysisEngine`

### 6.3 Diff Engine

- Zmiany **semantyczne**, nie tylko tekstowe
- Moduł: `DocumentAnalysisService`

### 6.4 Benchmark

- Porównania między JST
- Moduł: `DeepResearchService` + `DocumentQueryService`

---

## 7. INFRASTRUKTURA

### 7.1 Baza danych

- **Supabase PostgreSQL** - jedyna baza danych
- Tabele: `api_configurations`, `processed_documents`, `data_sources`, `scraped_content`

### 7.2 Cache i kolejki

- **Docker Redis** - cache i kolejki zadań

### 7.3 Struktura projektu

```
apps/
├── api/          # Backend Express
├── frontend/     # Next.js
└── worker/       # Background jobs
packages/
└── shared/       # Typy współdzielone
```

---

## 8. REGUŁY KODOWANIA

### 8.1 Deterministyczność

- Identyczny input → identyczny output
- Decyzje muszą być replayable z logów
- Brak randomowości bez explicit seed

### 8.2 Separacja

```
Prompt ≠ Logic
Agent ≠ Orchestrator
Model ≠ Memory
```

### 8.3 Fail Fast

- Abort przy niespójności
- Raportuj dokładny powód błędu
- **Nigdy nie zgaduj**

### 8.4 Observability

- Loguj: input, decision, output, execution time
- Logi muszą pozwalać na pełny replay decyzji

### 8.5 No Hallucinations

- Brakujące dane → UNKNOWN lub poproś o wyjaśnienie
- **Nigdy nie wymyślaj faktów ani logiki**

---

## 9. DOKUMENTACJA - OBOWIĄZKOWE ODCZYTYWANIE

### 9.1 Przed rozpoczęciem każdej sesji

**ZAWSZE** na początku pracy odczytaj kluczowe pliki dokumentacji:

```
1. docs/architecture.md     → Zrozum aktualną architekturę
2. docs/todo.md             → Sprawdź co jest do zrobienia
3. docs/change_log.md       → Poznaj ostatnie zmiany (top 50 linii)
4. .windsurf/base_rules.md  → Przypomnij zasady budowania
```

### 9.2 Obowiązkowa aktualizacja po zmianach

Po każdej znaczącej zmianie w kodzie **AKTUALIZUJ**:

| Plik                   | Kiedy aktualizować                |
| ---------------------- | --------------------------------- |
| `docs/change_log.md`   | Po każdej zmianie funkcjonalności |
| `docs/todo.md`         | Po dodaniu/ukończeniu zadania     |
| `docs/architecture.md` | Po zmianie struktury/modułów      |

### 9.3 Format wpisu w change_log.md

```markdown
## RRRR-MM-DD - Krótki tytuł zmiany

### Opis

Co zostało zmienione i dlaczego.

### Zmodyfikowane pliki

- `path/to/file.ts` - opis zmiany

### Status

✅ Ukończone / 🔄 W trakcie / ⏳ Do wykonania
```

### 9.4 Format wpisu w todo.md

```markdown
## Do wykonania (priorytet)

### 🔴 Krytyczne

- [ ] Zadanie 1

### 🟠 Ważne

- [ ] Zadanie 2

### 🔵 Normalne

- [ ] Zadanie 3

## Ukończone

- [x] Zadanie ukończone (data)
```

### 9.5 Pliki dokumentacji

Przechowuj i aktualizuj w `/docs`:

- `architecture.md` - architektura systemu, moduły, przepływy
- `todo.md` - zadania do wykonania z priorytetami
- `change_log.md` - historia zmian (najnowsze na górze)
- `docker.md` - infrastruktura Docker

---

## 10. PRIME RULE

**AI agent jest komponentem systemu, nie użytkownikiem.**

Zawsze pisz w języku polskim (chyba że niemożliwe - wtedy po angielsku).

Dodając lub naprawiając funkcje, **zawsze szukaj powiązań** i wykonuj wymagane zmiany we wszystkich zależnych miejscach aplikacji.

Zapisuj swoje kroki w pliku `/docs/change_log.md`
