# Moduł Zarządzania Użytkownikami - Projekt

## 1. Założenia i wymagania

### 1.1. Kluczowe wymagania

- ❌ **BRAK publicznej rejestracji** — użytkownicy dodawani tylko przez administratora
- ✅ **OAuth Google** — główna metoda logowania dla radnych
- ✅ **Logowanie email/hasło** — alternatywna metoda (hasła zarządzane przez admina)
- ✅ **Generowanie bezpiecznych haseł** — automatyczne przez system
- ✅ **Wymuszanie zmiany hasła** — przy pierwszym logowaniu
- ✅ **Reset hasła** — przez email (self-service)
- ✅ **Panel admina** — zarządzanie użytkownikami

### 1.2. Role użytkowników

- **Admin** — pełny dostęp, zarządzanie użytkownikami
- **Radny** — standardowy dostęp do dokumentów i czatu
- **Guest** (opcjonalnie) — ograniczony dostęp tylko do odczytu

## 2. Architektura systemu

### 2.1. Flow logowania

```
┌─────────────────────────────────────────────────────────┐
│                    Strona logowania                      │
│                                                          │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │  OAuth Google    │      │  Email + Hasło   │        │
│  │  (Preferowane)   │      │  (Alternatywne)  │        │
│  └────────┬─────────┘      └────────┬─────────┘        │
│           │                         │                   │
└───────────┼─────────────────────────┼───────────────────┘
            │                         │
            ▼                         ▼
    ┌───────────────┐         ┌──────────────┐
    │ Supabase Auth │         │ Supabase Auth│
    │ (Google OAuth)│         │ (Email/Pass) │
    └───────┬───────┘         └──────┬───────┘
            │                        │
            └────────────┬───────────┘
                         ▼
                ┌─────────────────┐
                │ Sprawdź profil  │
                │ w bazie danych  │
                └────────┬────────┘
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
    ┌───────────────┐         ┌──────────────────┐
    │ force_password│         │ Profil OK        │
    │ _change = true│         │ → Dashboard      │
    └───────┬───────┘         └──────────────────┘
            │
            ▼
    ┌───────────────┐
    │ Wymuszenie    │
    │ zmiany hasła  │
    └───────────────┘
```

### 2.2. Struktura bazy danych (Supabase)

#### Tabela: `profiles`

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'radny' CHECK (role IN ('admin', 'radny', 'guest')),
  force_password_change BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Użytkownicy mogą czytać swój profil
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admini mogą wszystko
CREATE POLICY "Admins can do everything"
  ON profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### Tabela: `password_reset_tokens`

```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index dla szybkiego wyszukiwania
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
```

#### Tabela: `audit_logs`

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'login', 'logout', 'password_change', 'user_created', etc.
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index dla audytu
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

## 3. Implementacja frontendu

### 3.1. Struktura folderów

```
apps/frontend/src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx              # Strona logowania (OAuth + Email)
│   │   ├── change-password/
│   │   │   └── page.tsx              # Wymuszenie zmiany hasła
│   │   └── reset-password/
│   │       ├── page.tsx              # Formularz żądania resetu
│   │       └── [token]/
│   │           └── page.tsx          # Ustawienie nowego hasła
│   ├── admin/
│   │   ├── layout.tsx                # Layout dla admina (guard)
│   │   └── users/
│   │       ├── page.tsx              # Lista użytkowników
│   │       ├── [id]/
│   │       │   └── page.tsx          # Edycja użytkownika
│   │       └── new/
│   │           └── page.tsx          # Dodawanie użytkownika
├── components/
│   ├── auth/
│   │   ├── login-form.tsx            # Formularz email/hasło
│   │   ├── google-login-button.tsx   # Przycisk OAuth Google
│   │   ├── change-password-form.tsx  # Formularz zmiany hasła
│   │   ├── reset-password-form.tsx   # Formularz resetu hasła
│   │   └── auth-guard.tsx            # HOC ochrony routes
│   └── admin/
│       ├── user-list.tsx             # Tabela użytkowników
│       ├── user-form.tsx             # Formularz użytkownika
│       └── password-generator.tsx    # Generator haseł
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Klient Supabase
│   │   ├── auth.ts                   # Funkcje auth
│   │   └── admin.ts                  # Funkcje admina
│   └── utils/
│       ├── password.ts               # Generowanie haseł
│       └── validation.ts             # Walidacja
└── middleware.ts                     # Middleware ochrony routes
```

### 3.2. Kluczowe funkcje

#### `lib/utils/password.ts` - Generowanie bezpiecznych haseł

```typescript
export function generateSecurePassword(length: number = 16): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  const allChars = uppercase + lowercase + numbers + symbols;

  let password = "";
  // Zapewnij co najmniej jeden znak z każdej kategorii
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Wypełnij resztę losowymi znakami
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Przetasuj znaki
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push("Hasło musi mieć co najmniej 12 znaków");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Hasło musi zawierać wielką literę");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Hasło musi zawierać małą literę");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Hasło musi zawierać cyfrę");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push("Hasło musi zawierać znak specjalny");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

#### `lib/supabase/auth.ts` - Rozszerzone funkcje auth

```typescript
import { supabase } from "./client";

// Logowanie email/hasło
export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (data.user) {
    // Sprawdź czy wymaga zmiany hasła
    const { data: profile } = await supabase
      .from("profiles")
      .select("force_password_change")
      .eq("id", data.user.id)
      .single();

    if (profile?.force_password_change) {
      return { user: data.user, requiresPasswordChange: true, error: null };
    }

    // Zaktualizuj last_login
    await supabase
      .from("profiles")
      .update({ last_login: new Date().toISOString() })
      .eq("id", data.user.id);
  }

  return { user: data.user, requiresPasswordChange: false, error };
}

// OAuth Google
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  return { data, error };
}

// Zmiana hasła
export async function changePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (!error && data.user) {
    // Usuń flagę wymuszenia zmiany hasła
    await supabase
      .from("profiles")
      .update({ force_password_change: false })
      .eq("id", data.user.id);
  }

  return { data, error };
}

// Żądanie resetu hasła
export async function requestPasswordReset(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  return { data, error };
}

// Wylogowanie
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// Pobranie aktualnego użytkownika
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return { ...user, profile };
  }

  return null;
}
```

#### `lib/supabase/admin.ts` - Funkcje administracyjne

```typescript
import { supabase } from "./client";
import { generateSecurePassword } from "../utils/password";

// Dodaj użytkownika (tylko admin)
export async function createUser(data: {
  email: string;
  fullName: string;
  role: "admin" | "radny" | "guest";
  sendEmail?: boolean;
}) {
  // Generuj bezpieczne hasło
  const password = generateSecurePassword(16);

  // Utwórz użytkownika w Supabase Auth (wymaga service_role key)
  // To musi być wykonane przez backend API endpoint
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: data.email,
      password,
      fullName: data.fullName,
      role: data.role,
      sendEmail: data.sendEmail,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return await response.json();
}

// Lista użytkowników
export async function listUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return { data, error };
}

// Aktualizuj użytkownika
export async function updateUser(
  userId: string,
  updates: {
    fullName?: string;
    role?: string;
    isActive?: boolean;
  }
) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  return { data, error };
}

// Wymuś zmianę hasła
export async function forcePasswordChange(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ force_password_change: true })
    .eq("id", userId)
    .select()
    .single();

  return { data, error };
}

// Zresetuj hasło użytkownika (generuj nowe)
export async function resetUserPassword(userId: string) {
  const password = generateSecurePassword(16);

  // To musi być wykonane przez backend API endpoint
  const response = await fetch("/api/admin/users/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return await response.json();
}

// Usuń użytkownika
export async function deleteUser(userId: string) {
  // To musi być wykonane przez backend API endpoint
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return { success: true };
}
```

## 4. Backend API (Next.js API Routes)

### 4.1. Endpoint: `/api/admin/users` (POST)

```typescript
// apps/frontend/src/app/api/admin/users/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service role client (ma pełne uprawnienia)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Secret key!
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  // Sprawdź czy użytkownik jest adminem
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Utwórz użytkownika
  const body = await request.json();
  const { email, password, fullName, role, sendEmail } = body;

  // Utwórz użytkownika w Supabase Auth
  const { data: newUser, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-potwierdź email
      user_metadata: {
        full_name: fullName,
      },
    });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Utwórz profil
  const { error: profileError } = await supabase.from("profiles").insert({
    id: newUser.user.id,
    email,
    full_name: fullName,
    role,
    force_password_change: true, // Wymuś zmianę hasła przy pierwszym logowaniu
  });

  if (profileError) {
    // Rollback - usuń użytkownika z Auth
    await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  // Opcjonalnie wyślij email z hasłem (w produkcji użyj szablonu email)
  if (sendEmail) {
    // TODO: Implementacja wysyłki emaila z hasłem
    // Można użyć Resend, SendGrid, lub Supabase Email Templates
  }

  return NextResponse.json({
    user: newUser.user,
    temporaryPassword: password,
  });
}
```

### 4.2. Endpoint: `/api/admin/users/reset-password` (POST)

```typescript
// apps/frontend/src/app/api/admin/users/reset-password/route.ts
export async function POST(request: Request) {
  // Podobna logika jak wyżej
  // 1. Sprawdź czy admin
  // 2. Wygeneruj nowe hasło
  // 3. Zaktualizuj hasło użytkownika przez supabaseAdmin.auth.admin.updateUserById
  // 4. Ustaw force_password_change = true
  // 5. Wyślij email z nowym hasłem
}
```

## 5. Konfiguracja OAuth Google w Supabase

### 5.1. Kroki konfiguracji (przez MCP lub Dashboard)

1. **Utwórz projekt w Google Cloud Console**

   - Przejdź do https://console.cloud.google.com
   - Utwórz nowy projekt lub wybierz istniejący
   - Włącz Google+ API

2. **Skonfiguruj OAuth consent screen**

   - User Type: Internal (jeśli organizacja) lub External
   - App name: "Asystent Radnego"
   - User support email: twój email
   - Authorized domains: twoja domena

3. **Utwórz OAuth 2.0 Client ID**

   - Application type: Web application
   - Authorized redirect URIs:
     - `https://rgcegixkrigqxtiuuial.supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback` (dev)

4. **Skopiuj Client ID i Client Secret**

5. **Skonfiguruj w Supabase**

   ```bash
   # Przez MCP
   mcp3_configure_auth --provider google --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET
   ```

   Lub przez Dashboard:

   - Authentication → Providers → Google
   - Włącz Google provider
   - Wklej Client ID i Client Secret

### 5.2. Testowanie OAuth

```typescript
// Test OAuth flow
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: "http://localhost:3000/auth/callback",
  },
});
```

## 6. Middleware ochrony routes

### `middleware.ts`

```typescript
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Chronione routes
  const protectedPaths = ["/dashboard", "/documents", "/chat", "/settings"];
  const adminPaths = ["/admin"];
  const authPaths = ["/login", "/change-password", "/reset-password"];

  const path = req.nextUrl.pathname;

  // Jeśli nie zalogowany i próbuje dostać się do chronionych routes
  if (!session && protectedPaths.some((p) => path.startsWith(p))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Jeśli zalogowany i próbuje dostać się do /login
  if (session && path === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Sprawdź czy wymaga zmiany hasła
  if (session && !authPaths.some((p) => path.startsWith(p))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("force_password_change")
      .eq("id", session.user.id)
      .single();

    if (profile?.force_password_change && path !== "/change-password") {
      return NextResponse.redirect(new URL("/change-password", req.url));
    }
  }

  // Sprawdź czy admin próbuje dostać się do panelu admina
  if (session && adminPaths.some((p) => path.startsWith(p))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

## 7. Podsumowanie implementacji

### 7.1. Checklist implementacji

- [ ] **Backend (Supabase)**

  - [ ] Utworzenie tabel: `profiles`, `password_reset_tokens`, `audit_logs`
  - [ ] Konfiguracja RLS policies
  - [ ] Konfiguracja OAuth Google
  - [ ] Utworzenie funkcji Edge Functions (opcjonalnie)

- [ ] **Backend API (Next.js)**

  - [ ] `/api/admin/users` (POST) - tworzenie użytkowników
  - [ ] `/api/admin/users/[id]` (PUT, DELETE) - edycja/usuwanie
  - [ ] `/api/admin/users/reset-password` (POST) - reset hasła

- [ ] **Frontend - Auth**

  - [ ] Strona logowania z OAuth Google + Email/Hasło
  - [ ] Strona wymuszenia zmiany hasła
  - [ ] Strona żądania resetu hasła
  - [ ] Strona ustawienia nowego hasła (z tokenem)
  - [ ] Middleware ochrony routes

- [ ] **Frontend - Admin Panel**

  - [ ] Lista użytkowników (tabela)
  - [ ] Formularz dodawania użytkownika
  - [ ] Formularz edycji użytkownika
  - [ ] Generator bezpiecznych haseł
  - [ ] Akcje: reset hasła, wymuś zmianę, dezaktywuj

- [ ] **Utilities**
  - [ ] Generator bezpiecznych haseł
  - [ ] Walidacja siły hasła
  - [ ] Email templates (opcjonalnie)

### 7.2. Bezpieczeństwo

- ✅ **Hasła** — hashowane przez Supabase (bcrypt)
- ✅ **JWT** — automatycznie zarządzane przez Supabase
- ✅ **RLS** — Row Level Security włączone
- ✅ **Service Role Key** — tylko w backend API, nigdy w frontend
- ✅ **HTTPS** — wymagane w produkcji
- ✅ **Rate limiting** — wbudowane w Supabase Auth
- ✅ **Audit logs** — śledzenie wszystkich akcji

### 7.3. Kolejne kroki

1. Utworzenie migracji Supabase (tabele + RLS)
2. Konfiguracja OAuth Google
3. Implementacja backend API endpoints
4. Implementacja stron auth (login, change-password, reset)
5. Implementacja panelu admina
6. Testy end-to-end
7. Deploy i konfiguracja produkcyjna

---

**Status:** Projekt gotowy do implementacji. Wszystkie komponenty zaprojektowane zgodnie z wymaganiami bezpieczeństwa i best practices.
