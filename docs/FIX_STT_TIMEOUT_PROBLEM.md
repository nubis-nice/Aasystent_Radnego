# Fix: Problem z timeout STT API w transkrypcji YouTube

**Data**: 2026-01-16  
**Problem**: Job transkrypcji utknął na 29% ("Inicjalizacja Whisper...")  
**ROOT CAUSE**: Skonfigurowany STT provider jest niedostępny lub timeout

---

## 🔍 Analiza problemu

### Aktualny flow

1. Worker wywołuje `initializeWithUserConfig(userId)`
2. Pobiera konfigurację STT z `@d:\Aasystent_Radnego\apps\api\src\ai\ai-client-factory.ts:71-73`:

   ```typescript
   async getSTTClient(userId: string): Promise<OpenAI> {
     return this.getClient(userId, "stt");
   }
   ```

3. `youtube-downloader.ts` inicjalizuje:

   ```typescript
   this.sttClient = await getSTTClient(userId);
   const sttConfig = await getAIConfig(userId, "stt");
   this.sttModel = this.normalizeSTTModel(
     sttConfig.modelName,
     sttConfig.provider
   );
   ```

4. Następnie wywołuje transkrypcję `@d:\Aasystent_Radnego\apps\api\src\services\youtube-downloader.ts:389-395`:

   ```typescript
   const transcription = await this.sttClient.audio.transcriptions.create({
     file: audioStream,
     model: this.sttModel,
     language: "pl",
     response_format: "text",
   });
   ```

5. **TUTAJ UTKNĄŁ** - `this.sttClient.audio.transcriptions.create()` nie zwraca odpowiedzi

### Dlaczego utknął?

**Skonfigurowany STT provider (np. faster-whisper-server, lokalny Ollama) jest:**

- ❌ Niedostępny (serwer nie działa)
- ❌ Timeout (zbyt długi czas odpowiedzi, brak timeoutu w kodzie)
- ❌ Connection refused (błędny URL w konfiguracji)
- ❌ Authentication error (błędny API key)

### Aktualna konfiguracja użytkownika (z UI)

Z `@[dom-element:div:ApiSettingsPage]`:

- **Provider**: Lokalny model (Ollama/LM Studio)
- **Model**: gpt-oss:120b-cloud

Oznacza to że STT prawdopodobnie też używa **lokalnego providera** (Ollama lub custom).

---

## ⚠️ Problem w kodzie

### Brak timeoutu dla STT API call

`@d:\Aasystent_Radnego\apps\api\src\services\youtube-downloader.ts:389` - **NIE MA TIMEOUTU**:

```typescript
const transcription = await this.sttClient.audio.transcriptions.create({
  file: audioStream,
  model: this.sttModel,
  language: "pl",
  response_format: "text",
});
```

**Jeśli STT API nie odpowiada** → Worker czeka w nieskończoność → Job utknął na 29%

### Brak error handling

Nie ma try-catch konkretnie dla STT call, więc:

- Brak logu błędu
- Brak informacji dla użytkownika
- Job wisi w limbo

---

## ✅ Rozwiązanie

### Fix 1: Dodać timeout dla STT API call

```typescript
// youtube-downloader.ts, linia ~389
const transcriptionPromise = this.sttClient.audio.transcriptions.create({
  file: audioStream,
  model: this.sttModel,
  language: "pl",
  response_format: "text",
});

// Timeout 10 minut (dla długich audio)
const timeoutMs = 10 * 60 * 1000;
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(
    () => reject(new Error(`STT API timeout after ${timeoutMs / 1000}s`)),
    timeoutMs
  )
);

let transcription;
try {
  transcription = await Promise.race([transcriptionPromise, timeoutPromise]);
} catch (error) {
  console.error(`[YouTubeDownloader] STT API error:`, error);
  throw new Error(
    `Błąd transkrypcji: ${error instanceof Error ? error.message : "Timeout"}`
  );
}
```

### Fix 2: Dodać debug logi przed i po STT call

```typescript
console.log(`[YouTubeDownloader] Starting STT transcription...`);
console.log(
  `[YouTubeDownloader] STT config: provider=${sttConfig.provider}, baseUrl=${sttConfig.baseUrl}, model=${this.sttModel}`
);
console.log(
  `[YouTubeDownloader] Audio file: ${processedPath}, size: ${audioFileSize} bytes`
);

const startTime = Date.now();
const transcription = await; /* ... STT call ... */
const duration = (Date.now() - startTime) / 1000;

console.log(`[YouTubeDownloader] STT transcription completed in ${duration}s`);
console.log(
  `[YouTubeDownloader] Transcript length: ${transcription.length} chars`
);
```

### Fix 3: Fallback do domyślnego STT providera

```typescript
async transcribeAndAnalyze(...) {
  if (!this.sttClient) {
    throw new Error("STT client not initialized");
  }

  // Try z skonfigurowanym providerem
  try {
    return await this.transcribeWithClient(this.sttClient, ...);
  } catch (error) {
    console.error(`[YouTubeDownloader] STT failed with configured provider:`, error);

    // Fallback do OpenAI Whisper API
    console.log(`[YouTubeDownloader] Falling back to OpenAI Whisper API`);
    const fallbackClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    return await this.transcribeWithClient(fallbackClient, ...);
  }
}
```

---

## 🔧 Implementacja fix

### Plik do edycji

`apps/api/src/services/youtube-downloader.ts` - funkcja `transcribeAndAnalyze()`, linia ~336-450

### Zmiana 1: Wrapper dla STT call z timeout

```typescript
private async callSTTWithTimeout(
  audioStream: any,
  timeoutMs: number = 10 * 60 * 1000
): Promise<string> {
  console.log(`[YouTubeDownloader] Calling STT API (timeout: ${timeoutMs/1000}s)...`);
  const startTime = Date.now();

  const transcriptionPromise = this.sttClient!.audio.transcriptions.create({
    file: audioStream,
    model: this.sttModel,
    language: "pl",
    response_format: "text",
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`STT API timeout after ${timeoutMs/1000}s`)), timeoutMs)
  );

  try {
    const transcription = await Promise.race([transcriptionPromise, timeoutPromise]);
    const duration = (Date.now() - startTime) / 1000;
    console.log(`[YouTubeDownloader] STT completed in ${duration.toFixed(1)}s`);
    return transcription as unknown as string;
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`[YouTubeDownloader] STT failed after ${duration.toFixed(1)}s:`, error);
    throw new Error(
      `Błąd transkrypcji STT: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
```

### Zmiana 2: Użyj wrapper w transcribeAndAnalyze

```typescript
// Zamiast bezpośredniego call:
const transcription = await this.sttClient.audio.transcriptions.create({...});

// Użyj:
const transcription = await this.callSTTWithTimeout(audioStream, 10 * 60 * 1000);
```

---

## 🧪 Testowanie fix

### Test 1: Sprawdź timeout

1. Wyłącz STT provider (np. zatrzymaj faster-whisper-server)
2. Uruchom transkrypcję
3. Po 10 minutach powinien pokazać error: "STT API timeout after 600s"

### Test 2: Sprawdź debug logi

1. Uruchom worker w terminalu: `cd apps/worker && npm run dev`
2. Obserwuj logi:
   ```
   [YouTubeDownloader] Calling STT API (timeout: 600s)...
   [YouTubeDownloader] STT failed after 600.0s: Error: STT API timeout
   ```

### Test 3: Sprawdź czy error propaguje do UI

1. Job powinien zmienić status na "failed"
2. Error message w UI: "Błąd transkrypcji STT: STT API timeout after 600s"

---

## 📊 Jak zdiagnozować problem u użytkownika

### Krok 1: Sprawdź konfigurację STT

W UI: Settings → API → AI Configuration Modal

Sprawdź:

- **STT Provider**: OpenAI? Ollama? Custom?
- **STT Model**: whisper-1? large-v3? inny?
- **Base URL**: Czy poprawny? Czy serwer działa?

### Krok 2: Test connectivity do STT providera

```bash
# Dla faster-whisper-server
curl http://localhost:8000/health

# Dla Ollama
curl http://localhost:11434/api/tags

# Dla custom API
curl <BASE_URL>/v1/models
```

### Krok 3: Sprawdź logi workera

Terminal gdzie uruchomiony worker powinien pokazać:

```
[YouTubeDownloader] STT: provider=local, model=large-v3, baseUrl=http://localhost:8000
[YouTubeDownloader] Calling STT API (timeout: 600s)...
[YouTubeDownloader] STT failed after X.Xs: Error: connect ECONNREFUSED 127.0.0.1:8000
```

---

## 🎯 Rekomendacja dla użytkownika

### Natychmiastowa akcja

1. **Sprawdź czy STT provider działa**:

   - Jeśli używasz faster-whisper-server → Czy serwer jest uruchomiony?
   - Jeśli używasz Ollama → Czy Ollama działa?
   - Jeśli custom API → Czy endpoint jest dostępny?

2. **Zmień na OpenAI Whisper** (tymczasowo):

   - Settings → API → AI Configuration
   - STT Provider → "OpenAI"
   - STT Model → "whisper-1"
   - API Key → Twój OpenAI key
   - Save

3. **Retry job**:
   - Worker automatycznie retry (BullMQ)
   - Lub utwórz nowe zadanie w UI

### Długoterminowe rozwiązanie

1. **Zainstaluj poprawkę** (Fix 1 + 2 powyżej)
2. **Skonfiguruj poprawnie lokalny STT** (jeśli chcesz używać)
3. **Dodaj monitoring** dla STT providera

---

## 📝 Podsumowanie

**Problem**: Job utknął na 29% bo skonfigurowany STT provider nie odpowiada (timeout/niedostępny)

**Root cause**: Brak timeoutu i error handling w `youtube-downloader.ts`

**Rozwiązanie**:

1. ✅ Dodać timeout 10 min dla STT API call
2. ✅ Dodać debug logi przed/po STT call
3. ✅ Dodać lepszy error handling
4. ⚠️ Użytkownik: Zmienić na OpenAI Whisper lub naprawić lokalny STT provider

**Priority**: HIGH - Job wisi w nieskończoność, blokuje kolejkę

---

**Następny krok**: Implementacja fix w `youtube-downloader.ts`
