# System Obsługi Błędów z AI

## Przegląd

Zaawansowany system obsługi błędów wykorzystujący AI do analizy i wyjaśniania problemów użytkownikom w przyjazny sposób.

## Komponenty

### 1. AI Error Handler (`lib/errors/ai-error-handler.ts`)

**Funkcje:**

- Automatyczna analiza błędów
- Generowanie przyjaznych wyjaśnień
- Sugerowanie konkretnych akcji naprawczych
- Klasyfikacja według severity (low/medium/high/critical)

**Obsługiwane typy błędów:**

- ❌ Network errors (Failed to fetch)
- 🔐 Authorization errors (401 Unauthorized)
- 🔍 Not found errors (404)
- ⏱️ Rate limit errors (429)
- ⏳ Timeout errors
- 🤖 OpenAI API errors
- 💾 Database errors
- ❓ Generic/Unknown errors

**Przykład użycia:**

```typescript
try {
  await sendMessage(request);
} catch (error) {
  const explanation = AIErrorHandler.explain(error);

  toast.error(explanation.title, explanation.message);
  console.info("Suggested actions:", explanation.suggestedActions);
}
```

### 2. Toast Notifications (`lib/notifications/toast.tsx`)

**Funkcje:**

- Globalny system powiadomień
- 4 typy: success, error, warning, info
- Auto-dismiss z konfigurowalnym czasem
- Akcje w powiadomieniach
- Animacje slide-in

**Przykład użycia:**

```typescript
const toast = useToast();

// Success
toast.success("Wiadomość wysłana", "AI odpowie za chwilę");

// Error
toast.error("Błąd połączenia", "Sprawdź czy serwer działa");

// Warning
toast.warning("Limit zapytań", "Poczekaj 1 minutę");

// Info
toast.info("Nowa funkcja", "Sprawdź ustawienia");

// Z akcją
toast.addToast({
  type: "error",
  title: "Serwer nie działa",
  message: "Kliknij aby zobaczyć instrukcję",
  action: {
    label: "Pomoc",
    onClick: () => window.open("/docs/troubleshooting"),
  },
});
```

### 3. API Client z Retry Logic (`lib/api/chat.ts`)

**Funkcje:**

- Automatyczne retry (3 próby)
- Exponential backoff (1s, 2s, 4s)
- Timeout 30 sekund
- Inteligentne retry (nie retry na 4xx)
- Szczegółowe error messages

**Konfiguracja:**

```typescript
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const TIMEOUT = 30000; // 30 seconds
```

**Logika retry:**

- ✅ Retry na 5xx (server errors)
- ✅ Retry na timeout
- ❌ Nie retry na 4xx (client errors)
- ❌ Nie retry na network errors (immediate fail)

## Przepływ obsługi błędów

```
1. Użytkownik wysyła wiadomość
   ↓
2. API Client próbuje wysłać request
   ↓
3. Błąd? → Retry logic (max 3x)
   ↓
4. Nadal błąd? → AI Error Handler
   ↓
5. Generowanie wyjaśnienia
   ↓
6. Toast notification (UI)
   ↓
7. Szczegóły w konsoli (dev)
   ↓
8. Sugerowane akcje
```

## Przykłady błędów i wyjaśnień

### Network Error (Failed to fetch)

**Wyjaśnienie AI:**

```
Title: "Brak połączenia z serwerem"
Message: "Nie można połączyć się z API. Serwer może być wyłączony..."
Severity: high

Suggested Actions:
- Sprawdź czy serwer API działa (http://localhost:3001/health)
- Zrestartuj serwer API: cd apps/api && npm run dev
- Sprawdź czy port 3001 nie jest zajęty
- Sprawdź połączenie internetowe
```

### OpenAI API Error

**Wyjaśnienie AI:**

```
Title: "Błąd OpenAI API"
Message: "Problem z połączeniem do OpenAI. Sprawdź konfigurację..."
Severity: high

Suggested Actions:
- Przejdź do Ustawienia → Konfiguracja API
- Sprawdź czy klucz OpenAI jest prawidłowy
- Sprawdź limit zapytań na platform.openai.com/usage
- Spróbuj wygenerować nowy klucz API
```

### Authorization Error

**Wyjaśnienie AI:**

```
Title: "Błąd autoryzacji"
Message: "Twoja sesja wygasła lub nie masz uprawnień..."
Severity: medium

Suggested Actions:
- Wyloguj się i zaloguj ponownie
- Sprawdź czy token Supabase jest prawidłowy
- Skontaktuj się z administratorem
```

## Integracja z UI

### Chat Page

```typescript
const toast = useToast();

try {
  const response = await sendMessage({
    message: userMessage,
    conversationId,
  });

  // Success
  toast.success("Odpowiedź otrzymana");
} catch (err) {
  // AI analysis
  const explanation = AIErrorHandler.explain(err);

  // Show toast
  toast.error(explanation.title, explanation.message);

  // Log details
  console.error("Technical:", explanation.technicalDetails);
  console.info("Actions:", explanation.suggestedActions);
}
```

### Global Layout

```typescript
<ToastProvider>{children}</ToastProvider>
```

## Konfiguracja

### Toast Duration

```typescript
// Default durations
success: 5000ms (5s)
error: 7000ms (7s)
warning: 6000ms (6s)
info: 5000ms (5s)

// Custom
toast.addToast({
  type: "error",
  title: "Critical error",
  duration: 0, // Never auto-dismiss
});
```

### Retry Configuration

```typescript
// apps/frontend/src/lib/api/chat.ts
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Exponential backoff
delay = RETRY_DELAY * Math.pow(2, attempt);
// Attempt 0: 1s
// Attempt 1: 2s
// Attempt 2: 4s
```

## Best Practices

### 1. Zawsze używaj AI Error Handler

```typescript
// ✅ Good
catch (error) {
  const explanation = AIErrorHandler.explain(error);
  toast.error(explanation.title, explanation.message);
}

// ❌ Bad
catch (error) {
  toast.error("Error", error.message);
}
```

### 2. Loguj szczegóły techniczne

```typescript
// ✅ Good
console.error("Technical details:", explanation.technicalDetails);
console.info("Suggested actions:", explanation.suggestedActions);

// ❌ Bad
console.error(error); // Tylko surowy błąd
```

### 3. Używaj odpowiednich severity

```typescript
// Critical - wymaga natychmiastowej uwagi
severity: "critical"; // Database down, API unavailable

// High - ważny problem
severity: "high"; // Network error, OpenAI error

// Medium - problem do rozwiązania
severity: "medium"; // Auth error, rate limit

// Low - informacyjny
severity: "low"; // Not found, validation error
```

### 4. Dodawaj akcje do toastów

```typescript
toast.addToast({
  type: "error",
  title: "Brak konfiguracji OpenAI",
  message: "Dodaj klucz API aby korzystać z czatu",
  action: {
    label: "Przejdź do ustawień",
    onClick: () => router.push("/settings/api"),
  },
});
```

## Rozszerzanie systemu

### Dodawanie nowych typów błędów

```typescript
// lib/errors/ai-error-handler.ts

private static explainCustomError(): ErrorExplanation {
  return {
    title: "Tytuł błędu",
    message: "Przyjazne wyjaśnienie",
    technicalDetails: "Szczegóły techniczne",
    suggestedActions: [
      "Akcja 1",
      "Akcja 2",
    ],
    severity: "medium",
  };
}

// W metodzie explain()
if (message.includes("custom_error")) {
  return this.explainCustomError();
}
```

### Dodawanie nowych typów toastów

```typescript
// lib/notifications/toast.tsx

export type ToastType = "success" | "error" | "warning" | "info" | "custom";

const colors = {
  // ...existing
  custom: "bg-purple-100 border-purple-200 text-purple-700",
};
```

## Metryki

**Oczekiwane:**

- Retry success rate: > 70%
- Error explanation accuracy: > 90%
- User satisfaction: > 4/5
- Time to resolution: < 2 min

## Testowanie

```typescript
// Test AI Error Handler
const error = new TypeError("Failed to fetch");
const explanation = AIErrorHandler.explain(error);

expect(explanation.title).toBe("Brak połączenia z serwerem");
expect(explanation.severity).toBe("high");
expect(explanation.suggestedActions.length).toBeGreaterThan(0);
```

## Troubleshooting

**Toast nie pojawia się:**

- Sprawdź czy ToastProvider jest w layout
- Sprawdź czy useToast() jest wywołany w komponencie

**Retry nie działa:**

- Sprawdź konfigurację MAX_RETRIES
- Sprawdź czy błąd jest typu 5xx (retry tylko na server errors)

**AI nie rozpoznaje błędu:**

- Dodaj nowy typ błędu do AIErrorHandler
- Sprawdź czy error message zawiera odpowiednie słowa kluczowe
