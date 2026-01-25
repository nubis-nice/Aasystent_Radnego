# 06 — Aplikacja Frontend (`apps/frontend`)

## Rola

`apps/frontend` to panel webowy oparty o Next.js (App Router). Odpowiada za:

- UI do pracy z dokumentami i czatem
- autoryzację użytkownika (Supabase Auth)
- komunikację z backendem API

## Routing i struktura stron

- Katalog: `apps/frontend/src/app/`

W repo widać m.in. segmenty:

- `(auth)/` — strony logowania
- `dashboard/`
- `documents/`
- `chat/`
- `analysis/`
- `research/`
- `settings/`
- `admin/`

## Połączenie z API

### Rewrite `/api/*`

- Plik: `apps/frontend/next.config.ts`
- Rewrite:
  - `/api/:path*` → `http://localhost:3001/api/:path*`

### `NEXT_PUBLIC_API_URL`

W klientach fetch (`apps/frontend/src/lib/api/*`) wykorzystywana jest zmienna:

- `NEXT_PUBLIC_API_URL` (domyślnie `""`)

Jeśli jest pusta, requesty idą względnie na `/api/...` i są „przekierowywane” przez Next.js (rewrites).

## Supabase Auth

### Konfiguracja klienta

- Plik: `apps/frontend/src/lib/supabase/client.ts`
- Zmienne:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Middleware autoryzacji (SSR)

- Plik: `apps/frontend/src/middleware.ts`
- Mechanizm:
  - używa `createServerClient(@supabase/ssr)`
  - `supabase.auth.getUser()` (waliduje token z serwerem)
  - przekierowuje niezalogowanego użytkownika do `/login` dla chronionych ścieżek:
    - `/dashboard`, `/documents`, `/chat`, `/settings`, `/admin`
  - wymusza zmianę hasła jeśli `user_profiles.force_password_change`
  - kontroluje dostęp do `/admin` przez `user_profiles.role === "admin"`

## Klient API — czat

- Plik: `apps/frontend/src/lib/api/chat.ts`

Cechy:

- token pobierany z Supabase session (`supabase.auth.getSession()`), fallback do `refreshSession()`
- requesty do API z nagłówkiem:
  - `Authorization: Bearer <token>`
- retry (max 3) i timeout 3 minuty dla odpowiedzi LLM

## Klient API — dokumenty

- Plik: `apps/frontend/src/lib/api/documents.ts`

Uwaga o spójności auth:

- `createDocument()` i `createSummary()` wysyłają nagłówek `x-user-id` pobrany z Supabase.
- Jednocześnie globalny `authMiddleware` w API wymaga `Authorization: Bearer ...`.

W praktyce oznacza to, że **samego `x-user-id` nie należy traktować jako bezpiecznej autoryzacji** — powinien być ustawiany przez backend po walidacji tokena (tak jak w middleware API).

## Minimalny zestaw ENV (frontend)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- opcjonalnie: `NEXT_PUBLIC_API_URL`

## System narzędzi ChatAI (Quick Tools)

System uniwersalnych narzędzi do generowania dokumentów w czacie.

### Pliki konfiguracyjne

- `apps/frontend/src/config/tools-config.ts` — konfiguracja 8 typów narzędzi
- `apps/frontend/src/hooks/useToolMode.ts` — hook zarządzający stanem narzędzia
- `apps/frontend/src/components/chat/tools/ToolPanel.tsx` — uniwersalny modal narzędzia

### Dostępne narzędzia

| Typ             | URL                        | Opis                      |
| --------------- | -------------------------- | ------------------------- |
| `speech`        | `/chat?tool=speech`        | Plan wystąpienia na sesji |
| `interpelation` | `/chat?tool=interpelation` | Kreator interpelacji      |
| `letter`        | `/chat?tool=letter`        | Generator pism urzędowych |
| `protocol`      | `/chat?tool=protocol`      | Generator protokołów      |
| `budget`        | `/chat?tool=budget`        | Analiza budżetu           |
| `application`   | `/chat?tool=application`   | Kreator wniosków          |
| `resolution`    | `/chat?tool=resolution`    | Projekty uchwał           |
| `report`        | `/chat?tool=report`        | Szablony raportów         |

### Aktywacja narzędzia

1. **Przez URL**: `/chat?tool=speech`
2. **Przez czat**: AI wykrywa intent `quick_tool` → zwraca `uiAction.navigate` → frontend aktywuje narzędzie
3. **Przez głos**: "Stefan, przygotuj wystąpienie o budżecie"

### Integracja z backendem

- Backend: `apps/api/src/services/tool-prompt-service.ts` — dedykowane prompty systemowe
- Backend: `apps/api/src/services/voice-action-service.ts` — mapowanie `quick_tool` → URL

### AI Auto-wypełnianie formularzy

AI może automatycznie wypełniać formularze narzędzi danymi z kontekstu rozmowy:

- Hook `useToolMode.ts` ma funkcję `activateToolWithData(toolType, formData)`
- Backend ekstrahuje `toolTopic`, `toolContext`, `toolRecipient` z polecenia
- Akcja UI: `open_tool_with_data` z pre-wypełnionymi polami

Przykład: "Przygotuj interpelację w sprawie remontu ul. Głównej" → otwiera modal z wypełnionym tematem.

## Asynchroniczna analiza dokumentów

Analiza dokumentów działa asynchronicznie aby uniknąć timeout:

- Plik: `apps/frontend/src/app/documents/page.tsx`
- Funkcja `handleAnalyze()` obsługuje odpowiedź `{ async: true, taskId }`
- Po kliknięciu "Analizuj" → przekierowanie do Dashboard
- Postęp widoczny w widgecie "Przetwarzanie danych"

## Notatka o wersji Next.js

- `apps/frontend/package.json` zawiera `next: 16.1.1`.
- `apps/frontend/README.md` wspomina Next.js 15 — to rozbieżność dokumentacyjna, nie kodowa.
