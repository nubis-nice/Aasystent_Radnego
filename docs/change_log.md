# Change Log

## 2026-01-25 — Pipeline CI/CD

### Nowe funkcjonalności

Kompletny pipeline CI/CD z testami jednostkowymi, integracyjnymi i E2E.

#### Testy (17 łącznie)

- **Unit Tests (7)**: `deep-research-service.test.ts` (Vitest)
- **Integration Tests (6)**: `api-health.test.ts` (Fastify)
- **E2E Tests (4)**: `login.spec.ts` (Playwright)

#### GitHub Actions

- **`.github/workflows/ci.yml`**: lint, typecheck, build, test, e2e, security
- **`.github/workflows/deploy.yml`**: deploy do Vercel (staging/production)

#### Konfiguracja

- `apps/api/vitest.config.ts` — konfiguracja Vitest
- `e2e/playwright.config.ts` — konfiguracja Playwright
- `apps/frontend/vercel.json` — konfiguracja Vercel

#### Komendy

```bash
npm run typecheck   # TypeScript validation
npm run build       # Kompilacja wszystkich pakietów
npm run test        # Unit + Integration tests (37)
npm run test:e2e    # Playwright E2E tests (18)
```

#### Nowe pliki dokumentacji

- `docs/api/openapi.yaml` — OpenAPI 3.1 specyfikacja API
- `docs/todo.md` — lista zadań do wykonania

---

## 2026-01-25 — Asynchroniczna analiza dokumentów (naprawa timeout)

### Problem

Analiza dokumentów z OCR powodowała timeout (`socket hang up`) gdy przetwarzanie trwało zbyt długo.

### Rozwiązanie

Zmieniono endpoint `/documents/:id/analyze` na asynchroniczny:

1. **Backend natychmiast zwraca** `{ async: true, taskId, message }`
2. **Przetwarzanie kontynuuje się w tle** (funkcja `processAnalysisAsync`)
3. **Postęp zapisywany w** `background_tasks` (20% → 70% → 100%)
4. **Wyniki zapisywane w** `background_tasks.metadata.result`

### Zmiany

- **`apps/api/src/routes/documents.ts`**: Asynchroniczny endpoint + funkcja `processAnalysisAsync`
- **`apps/frontend/src/app/documents/page.tsx`**: Obsługa asynchronicznej odpowiedzi, przekierowanie do Dashboard

### Użycie

1. Kliknij "Analizuj" na dokumencie
2. Zostaniesz przekierowany do Dashboard
3. Obserwuj postęp w widgecie "Przetwarzanie danych"
4. Po zakończeniu kliknij zadanie aby otworzyć analizę

---

## 2026-01-25 — Śledzenie analizy dokumentów na Dashboard

### Nowe funkcjonalności

Analiza dokumentu (przycisk "Analizuj" w DocumentCard) jest teraz widoczna w widgecie "Przetwarzanie danych i alarmy" na Dashboard.

#### Backend

- **`apps/api/src/routes/documents.ts`** — endpoint `/documents/:id/analyze`:
  - Tworzy wpis w tabeli `background_tasks` na początku analizy
  - Aktualizuje postęp podczas budowania kontekstu RAG
  - Oznacza zadanie jako "completed" po zakończeniu
  - Obsługuje błędy i oznacza zadanie jako "failed"

#### Jak działa

1. Użytkownik klika "Analizuj" na dokumencie
2. Na Dashboard pojawia się wpis "Analiza dokumentu" ze statusem "W toku"
3. Po zakończeniu status zmienia się na "Zakończone"

---

## 2026-01-25 — AI Auto-wypełnianie formularzy narzędzi

### Nowe funkcjonalności

AI może automatycznie wypełniać formularze narzędzi danymi z kontekstu rozmowy.

#### Backend

- **`apps/api/src/services/voice-action-service.ts`**:
  - Ekstrakcja `toolTopic`, `toolContext`, `toolRecipient` z polecenia głosowego
  - Nowa akcja UI `open_tool_with_data` z danymi formularza

#### Frontend

- **`apps/frontend/src/hooks/useToolMode.ts`**:
  - Nowa funkcja `activateToolWithData()` do aktywacji narzędzia z danymi

- **`apps/frontend/src/app/chat/page.tsx`**:
  - Obsługa akcji `open_tool_with_data` z odpowiedzi API

#### Przykład użycia

```
Użytkownik: "Przygotuj interpelację w sprawie remontu ul. Głównej"
→ Otwiera się modal z wypełnionym polem "Temat: remont ul. Głównej"
```

---

## 2026-01-25 — System narzędzi ChatAI (Quick Tools)

### Nowe funkcjonalności

Dodano uniwersalny system narzędzi do generowania dokumentów w czacie AI.

#### Frontend

- **`apps/frontend/src/config/tools-config.ts`** — konfiguracja 8 typów narzędzi:
  - `speech` — Plan wystąpienia na sesji
  - `interpelation` — Kreator interpelacji radnego
  - `letter` — Generator pism urzędowych
  - `protocol` — Generator protokołów z posiedzeń
  - `budget` — Analiza budżetu gminy
  - `application` — Kreator wniosków formalnych
  - `resolution` — Generator projektów uchwał
  - `report` — Szablony raportów i sprawozdań

- **`apps/frontend/src/hooks/useToolMode.ts`** — hook do zarządzania stanem narzędzia

- **`apps/frontend/src/components/chat/tools/ToolPanel.tsx`** — uniwersalny modal narzędzia:
  - Dynamiczny formularz na podstawie konfiguracji
  - Formatowanie Markdown (ReactMarkdown + remarkGfm)
  - Pre-processing HTML tags (`<br>` → `\n`)
  - Eksport do PDF/DOCX
  - 80% szerokości z możliwością resize
  - Zamykanie przez Escape lub kliknięcie tła

- **`apps/frontend/src/app/chat/page.tsx`** — integracja:
  - Obsługa parametru `?tool=` z URL
  - Obsługa `uiActions.navigate` z odpowiedzi API

#### Backend

- **`apps/api/src/services/tool-prompt-service.ts`** — dedykowane prompty systemowe dla każdego typu narzędzia

### Sposób użycia

1. **URL**: `http://localhost:3000/chat?tool=speech`
2. **Czat**: "Przygotuj wystąpienie o budżecie" → AI aktywuje narzędzie
3. **Głos**: "Stefan, utwórz interpelację w sprawie dróg"

### Poprawki

- Naprawiono błąd nieskończonej pętli w useEffect (toolMode)
- Naprawiono błąd CORS (zakomentowano `NEXT_PUBLIC_API_URL` w `.env.local`)
- Naprawiono formatowanie HTML tags w wygenerowanej treści
