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

## Notatka o wersji Next.js

- `apps/frontend/package.json` zawiera `next: 16.1.1`.
- `apps/frontend/README.md` wspomina Next.js 15 — to rozbieżność dokumentacyjna, nie kodowa.
