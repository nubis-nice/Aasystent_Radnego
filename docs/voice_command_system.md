# System Voice Command Processor

## Status: ✅ Wdrożony (2026-01-16) | Stefan 2.0

## Cel systemu

System obsługi głosowej "Voice Command Processor" umożliwia sterowanie aplikacją Asystent Radnego za pomocą komend głosowych. System integruje się z istniejącym AI Tool Orchestrator i umożliwia hands-free obsługę wszystkich funkcji aplikacji.

---

## Stefan 2.0 - Tryb czuwania i akcje głosowe

### Wake Word Detection

Stefan aktywuje się tylko po usłyszeniu **"Hej Stefan"** (lub wariantów: "Hey Stefan", "Cześć Stefan", "Ok Stefan").

```text
Przepływ:
1. Użytkownik klika 🎤 → Stefan wchodzi w TRYB CZUWANIA (standby)
2. Stefan ciągle nasłuchuje, ale nie przetwarza
3. Użytkownik mówi "Hej Stefan, dodaj spotkanie na jutro"
4. Stefan aktywuje się i przetwarza polecenie
5. Stefan odpowiada i wraca do trybu czuwania
```

### Tryby pracy

| Tryb           | Kolor przycisku     | Opis                    |
| -------------- | ------------------- | ----------------------- |
| **off**        | Fioletowy (outline) | Wyłączony               |
| **standby**    | Fioletowy (filled)  | Nasłuchuje na wake word |
| **active**     | Czerwony (pulsuje)  | Aktywne nagrywanie      |
| **processing** | Żółty               | Przetwarzanie           |

### Słowo wykonania

Dla akcji destrukcyjnych lub wymagających potwierdzenia, użytkownik musi powiedzieć **"wykonaj"**, **"tak"** lub **"potwierdź"**.

### Obsługiwane akcje głosowe

| Kategoria      | Typ akcji         | Przykłady poleceń                                |
| -------------- | ----------------- | ------------------------------------------------ |
| **Kalendarz**  | `calendar_add`    | "dodaj spotkanie z burmistrzem na jutro o 14:00" |
|                | `calendar_list`   | "pokaż kalendarz", "co mam zaplanowane"          |
|                | `calendar_edit`   | "zmień termin spotkania"                         |
|                | `calendar_delete` | "usuń spotkanie"                                 |
| **Zadania**    | `task_add`        | "dodaj zadanie: przygotować raport budżetowy"    |
|                | `task_list`       | "pokaż zadania", "co mam do zrobienia"           |
|                | `task_complete`   | "oznacz jako ukończone"                          |
| **Alerty**     | `alert_check`     | "sprawdź alerty", "czy są powiadomienia"         |
|                | `alert_dismiss`   | "odrzuć alert"                                   |
| **Dokumenty**  | `document_search` | "znajdź uchwałę o podatkach"                     |
|                | `document_open`   | "otwórz protokół z sesji 15"                     |
| **QuickTools** | `quick_tool`      | "utwórz interpelację", "napisz pismo"            |
| **Nawigacja**  | `navigate`        | "przejdź do pulpitu", "otwórz dokumenty"         |

### Nowe komponenty

#### Backend

- **`voice-action-service.ts`** - Serwis akcji głosowych
  - `processVoiceCommand(command)` - główna metoda
  - Wykrywanie intencji przez LLM
  - Obsługa pending actions (czeka na "wykonaj")

#### API Endpoints

- `POST /api/voice/action` - Wykonaj akcję głosową
- `POST /api/voice/detect-wake-word` - Wykryj wake word w transkrypcji

#### Frontend

- **`VoiceContext.tsx`** - rozszerzony o:

  - `voiceMode: "off" | "standby" | "active" | "processing"`
  - `enterStandbyMode()` / `exitStandbyMode()`
  - `pendingAction` - oczekująca akcja
  - `executeVoiceAction(command)` - wywołanie API

- **`StefanVoiceButton`** (sidebar.tsx) - obsługa trybu standby

---

## Architektura

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND - Interfejs głosowy                               │
│  ┌──────────────┐    ┌──────────────┐   ┌──────────────┐  │
│  │  VoiceButton │───▶│ AudioRecorder│──▶│ STT Service  │  │
│  │  (przycisk)  │    │  (WebAPI)    │   │  (streaming) │  │
│  └──────────────┘    └──────────────┘   └──────────────┘  │
│         │                    │                   │          │
│         └────────────────────┴───────────────────┘          │
│                              │                               │
│                              ▼                               │
│                  ┌─────────────────────────┐                │
│                  │  VoiceCommandProcessor  │                │
│                  │  (komponent React)      │                │
│                  └─────────────────────────┘                │
└───────────────────────────│─────────────────────────────────┘
                            │
                            ▼ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│  BACKEND - Przetwarzanie                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  VoiceCommandService                                │    │
│  │  • Transkrypcja STT (OpenAI Whisper/faster-whisper)│    │
│  │  • Detekcja intencji (VoiceIntentDetector)         │    │
│  │  • Routing do akcji                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  AIToolOrchestrator (istniejący)                    │    │
│  │  + nowe narzędzia: voice_control, app_navigation    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Komponenty systemu

### Frontend (`apps/frontend/src`)

#### Komponenty (`components/voice/`)

- **VoiceButton** - Przycisk PTT (Push-to-Talk) z wizualizacją stanów
- **VoiceRecorder** - Pełny interfejs nagrywania z kontrolkami
- **AudioVisualizer** - Wizualizacja poziomu audio (waveform)
- **VoiceCommandProcessor** - Główny procesor komend z historią
- **VoiceSettings** - Panel ustawień obsługi głosowej
- **ContinuousListeningToggle** - Toggle dla trybu ciągłego nasłuchiwania

#### Hooks (`hooks/`)

- **useVoiceRecorder** - Obsługa MediaRecorder API i AudioContext
- **useVoiceCommands** - Przetwarzanie audio → transkrypcja → komenda
- **useContinuousListening** - Tryb ciągłego nasłuchiwania z VAD

#### API Client (`lib/api/voice.ts`)

- `transcribeAudio(audioBlob)` - Transkrypcja audio
- `processVoiceCommand(transcription)` - Rozpoznawanie intencji
- `getVoiceSettings()` - Pobranie ustawień
- `updateVoiceSettings(settings)` - Aktualizacja ustawień

### Backend (`apps/api/src`)

#### Services (`services/`)

- **voice-command-service.ts** - Główny serwis obsługi komend
- **voice-intent-detector.ts** - Detekcja intencji za pomocą LLM

#### Routes (`routes/voice.ts`)

- `POST /api/voice/transcribe` - Transkrypcja audio (multipart/form-data)
- `POST /api/voice/command` - Przetwarzanie komendy
- `GET /api/voice/settings` - Ustawienia użytkownika
- `PUT /api/voice/settings` - Aktualizacja ustawień
- `POST /api/voice/synthesize` - TTS (opcjonalnie)
- `GET /api/voice/history` - Historia komend

### Baza danych

#### Tabele (migracja `024_create_voice_commands_schema.sql`)

**voice_commands** - Historia komend głosowych

```sql
- id UUID PRIMARY KEY
- user_id UUID (FK → auth.users)
- transcription TEXT NOT NULL
- intent TEXT (navigation|search|chat|control|unknown)
- confidence FLOAT
- action JSONB
- executed BOOLEAN
- execution_result JSONB
- created_at TIMESTAMPTZ
```

**voice_macros** - Niestandardowe makra użytkownika

```sql
- id UUID PRIMARY KEY
- user_id UUID (FK → auth.users)
- trigger_phrase TEXT NOT NULL
- description TEXT
- actions JSONB NOT NULL
- is_active BOOLEAN
- priority INTEGER
- usage_count INTEGER
- created_at, updated_at TIMESTAMPTZ
```

**user_settings.voice_preferences** - JSONB

```json
{
  "wakeWord": "Asystencie",
  "continuousMode": false,
  "autoTTS": true,
  "ttsVoice": "pl-PL-MarekNeural",
  "ttsSpeed": 1.0
}
```

## Typy komend głosowych

### 1. Navigation (Nawigacja)

**Przykłady:**

- "otwórz dokumenty"
- "pokaż dashboard"
- "przejdź do ustawień"
- "idź do czatu"

**Akcja:**

```typescript
{ type: "navigate", path: "/documents" }
```

### 2. Search (Wyszukiwanie)

**Przykłady:**

- "znajdź uchwałę nr 123"
- "wyszukaj budżet"
- "szukaj sesji"

**Akcja:**

```typescript
{ type: "search", query: "uchwała nr 123", tool?: "rag_search" }
```

### 3. Chat (Pytanie do AI)

**Przykłady:**

- "zapytaj o budżet"
- "wyjaśnij uchwałę"
- "co to znaczy"

**Akcja:**

```typescript
{ type: "chat", message: "wyjaśnij uchwałę..." }
```

### 4. Control (Kontrola aplikacji)

**Przykłady:**

- "zatrzymaj"
- "pauza"
- "głośniej"
- "ciszej"
- "powtórz"

**Akcja:**

```typescript
{ type: "control", command: "stop" | "pause" | "volume_up" | ... }
```

## Tryby pracy

### 1. Push-to-Talk (PTT)

- Kliknij przycisk → mów → kliknij ponownie
- Klawisz Space jako skrót (w trybie floating)
- Wizualizacja poziomu audio
- Timer nagrywania

### 2. Continuous Listening (VAD)

- Automatyczne wykrywanie aktywności głosowej
- Wake word: "Asystencie" (konfigurowalne)
- Timeout ciszy: 1.5s
- Max czas sesji: 10 minut
- Licznik komend w sesji

## Integracja z chat

Komponent VoiceButton został zintegrowany z interfejsem czatu:

```tsx
// apps/frontend/src/app/chat/page.tsx
<VoiceButton
  variant="inline"
  size="md"
  onTranscription={(text) => {
    setMessage(text);
  }}
  onCommand={(cmd) => {
    if (cmd.action?.type === "chat" && cmd.action?.message) {
      setMessage(cmd.action.message);
      handleSend();
    }
  }}
/>
```

## Ustawienia głosowe

Panel ustawień dostępny w `VoiceSettings` component:

- **Słowo wzywające** - Trigger phrase (default: "Asystencie")
- **Tryb ciągłego nasłuchiwania** - Auto-detect komend
- **Automatyczne TTS** - Odpowiedzi głosowe
- **Głos TTS** - Wybór głosu (Marek/Zofia/Agnieszka)
- **Prędkość mowy** - 0.5x - 2.0x

## Bezpieczeństwo

- **Autoryzacja** - Wszystkie endpointy wymagają Bearer token
- **RLS** - Row Level Security na tabelach voice\_\*
- **Rate limiting** - 60 komend/godzinę/użytkownik
- **Validation** - Max 10MB audio, max 5 minut nagrania
- **Audit trail** - Logowanie wszystkich komend do bazy

## Koszty (szacunkowe)

Dla 1 użytkownika / miesiąc:

- **OpenAI Whisper STT**: ~$3-5 (30min audio/dzień)
- **Edge TTS**: $0 (darmowy)
- **Storage (audio logs)**: ~$0.50
- **RAZEM**: ~$3.5-5.5/mies

## Metryki sukcesu

- ✅ Latencja STT < 500ms (streaming)
- ✅ Intent detection accuracy > 85%
- ✅ Integracja z istniejącym AI orchestrator
- ✅ Zapisywanie historii komend
- ✅ Konfigurowalność przez UI

## Dalszy rozwój (Roadmap)

### FAZA 5: Zaawansowane funkcje (Nice to have)

- [ ] Komendy kontekstowe ("otwórz ten dokument")
- [ ] Makra głosowe użytkownika
- [ ] Multimodalność (głos + gesty)
- [ ] Korekta komend tekstem

### FAZA 6: Optymalizacja

- [ ] Caching transkrypcji (Redis)
- [ ] Batching embeddingów
- [ ] Kompresja audio przed wysyłką
- [ ] Enhanced error handling
- [ ] Accessibility improvements

## Przykłady użycia

### Podstawowe użycie (PTT)

```typescript
import { VoiceButton } from "@/components/voice/VoiceButton";

<VoiceButton
  variant="floating"
  onTranscription={(text) => console.log("Transcribed:", text)}
  onCommand={(cmd) => console.log("Command:", cmd)}
/>;
```

### Tryb ciągły

```typescript
import { ContinuousListeningToggle } from "@/components/voice/ContinuousListeningToggle";

<ContinuousListeningToggle
  onCommand={(cmd) => handleVoiceCommand(cmd)}
  onTranscription={(text) => setInputText(text)}
/>;
```

### Nagrywanie z kontrolkami

```typescript
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";

<VoiceRecorder
  maxDuration={300}
  onRecordingComplete={(blob) => processAudio(blob)}
/>;
```

## Status implementacji

✅ **ZAIMPLEMENTOWANE:**

- FAZA 1: Podstawy STT & UI
- FAZA 2: Voice Command Service
- FAZA 3: Integracja z orkiestratorem
- FAZA 4: Continuous listening mode (podstawy)
- Migracje bazy danych
- Integracja z chat page
- API endpoints
- Komponenty UI

✅ **ZAIMPLEMENTOWANE (2026-01-16):**

- FAZA 4: Multi-turn conversation (VoiceConversationPanel)
- FAZA 4: Inteligentny TTS (TTSTextProcessor)
- FAZA 4: Blokada mikrofonu podczas mówienia asystenta

📋 **ZAPLANOWANE:**

- FAZA 5-6: Zaawansowane funkcje i optymalizacja

## System rozmów głosowych (Voice Conversation)

### Architektura

```
┌─────────────────────────────────────────────────────────────────┐
│  User: "Hej Stefan, znajdź uchwałę o budżecie"                 │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────┐                                          │
│  │ Wake Word Detection │◄─── "Stefan" (konfigurowalne)         │
│  └──────────────────┘                                          │
│         │ detected                                              │
│         ▼                                                       │
│  ┌──────────────────┐     ┌──────────────────┐                │
│  │ MIC BLOCKED      │────▶│ AI Processing    │                │
│  │ (during TTS)     │     │ (chat/search)    │                │
│  └──────────────────┘     └──────────────────┘                │
│         │                         │                            │
│         │                         ▼                            │
│         │◄────────────────┌──────────────────┐                │
│         │                 │ TTS Response     │                │
│  ┌──────────────────┐     │ (intelligent)    │                │
│  │ MIC UNBLOCKED    │     └──────────────────┘                │
│  └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Komponenty

#### Frontend

- **VoiceConversationPanel** - Panel rozmowy głosowej z historią
- **useVoiceConversation** - Hook do zarządzania rozmową

#### Backend

- **TTSTextProcessor** - Inteligentne przetwarzanie tekstu dla TTS
  - Pomija bloki kodu (` ``` `)
  - Konwertuje emoji na tekst
  - Formatuje liczby i daty
  - Rozwija skróty (np. "nr" → "numer")
  - Usuwa URL-e i markdown

### Użycie

```tsx
import { VoiceConversationPanel } from "@/components/voice";

function ChatPage() {
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsVoiceOpen(true)}>Rozmowa głosowa</button>

      <VoiceConversationPanel
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        assistantName="Stefan"
      />
    </>
  );
}
```

### Blokada mikrofonu

System automatycznie blokuje mikrofon podczas:

- Odtwarzania odpowiedzi TTS
- Przetwarzania komendy

Zapobiega to:

- Sprzężeniu zwrotnemu (feedback loop)
- Przypadkowemu nagrywaniu odpowiedzi asystenta

### Wake Word

Konfigurowalne imię asystenta (domyślnie "Stefan"):

```
"Hej Stefan, ..."
"Hey Stefan, ..."
"Cześć Stefan, ..."
"Ok Stefan, ..."
```

Imię jest automatycznie usuwane z transkrypcji przed wysłaniem do AI.

## Modernizacja (2026-01-16)

### Nowe funkcje

#### 1. Auto-start mikrofonu

Po otwarciu panelu rozmowy głosowej (przycisk "🎤 Stefan") mikrofon automatycznie się aktywuje i czeka na wake word.

#### 2. VAD (Voice Activity Detection)

Nowy hook `useVAD` wykrywa aktywność głosową i ciszę:

- **silenceThreshold**: 10 (próg ciszy 0-100)
- **silenceDuration**: 1500ms (czas ciszy przed wysłaniem)
- **minSpeechDuration**: 300ms (min czas mowy)

Po wykryciu ciszy (1.5s bez mowy) audio jest automatycznie wysyłane do transkrypcji i LLM.

#### 3. Imię asystenta z ustawień AI

Imię asystenta (wake word) jest pobierane z ustawień użytkownika (`/settings/ai-chat`):

- Tabela: `user_ai_settings.assistant_name`
- Hook: `useAISettings`
- Domyślnie: "Asystent"

#### 4. Naprawy krytyczne

- **Hardcoded model**: `voice-intent-detector.ts` teraz używa modelu z konfiguracji użytkownika
- **Temp files cleanup**: `voice.ts` używa `finally` block do usuwania plików tymczasowych
- **Podwójne getUserMedia**: Usunięto duplikację w `useVoiceConversation.ts`

### Nowe pliki

- `apps/frontend/src/hooks/useVAD.ts` - Voice Activity Detection hook
- `apps/frontend/src/hooks/useAISettings.ts` - Pobieranie ustawień AI użytkownika

### Przepływ rozmowy głosowej (nowy)

```
1. Użytkownik klika "🎤 Stefan"
2. Panel się otwiera → mikrofon auto-start
3. VAD nasłuchuje na mowę
4. Użytkownik mówi "Hej Stefan, znajdź uchwałę..."
5. VAD wykrywa ciszę (1.5s)
6. Audio → STT → LLM → TTS → Odpowiedź
7. Mikrofon blokowany podczas TTS
8. Po TTS mikrofon odblokowany → powrót do kroku 3
```

## Znane ograniczenia

1. **VAD** - Progi mogą wymagać dostrojenia dla różnych środowisk
2. **Wake word detection** - Proste dopasowanie stringów, brak dedykowanego modelu
3. **Browser support** - Wymaga nowoczesnej przeglądarki z MediaRecorder API
4. **Audio format** - WebM lub MP4 (zależnie od przeglądarki)

## Testy

Aby przetestować system:

1. **Uruchom migrację bazy danych:**

   ```bash
   # W Supabase Dashboard → SQL Editor
   # Wykonaj: docs/supabase_migrations/024_create_voice_commands_schema.sql
   ```

2. **Uruchom aplikację:**

   ```bash
   npm run dev
   ```

3. **Otwórz czat:**

   - Przejdź do `/chat`
   - Kliknij przycisk mikrofonu obok pola tekstowego
   - Powiedz komendę, np. "otwórz dokumenty"
   - System przetworzy komendę i wykona akcję

4. **Sprawdź historię:**
   ```sql
   SELECT * FROM voice_commands WHERE user_id = 'YOUR_USER_ID' ORDER BY created_at DESC LIMIT 10;
   ```

---

**Data utworzenia:** 2026-01-16  
**Autor:** AI Assistant (Cascade)  
**Status:** Production Ready (podstawowa funkcjonalność)
