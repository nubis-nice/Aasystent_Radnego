# Przewodnik Implementacji - System Ustawień

## Status: ✅ Gotowe do uruchomienia

Data: 2024-12-27

---

## 📋 Co zostało zaimplementowane

### 1. **Schemat bazy danych** ✅

- 5 tabel dla ustawień użytkownika
- Automatyczna inicjalizacja przy rejestracji
- Row Level Security (RLS)
- Triggery dla `updated_at`
- Widok zbiorczy `user_settings_complete`

**Plik**: `docs/database_schema_settings.md`

### 2. **Biblioteka TypeScript** ✅

- Interfejsy dla wszystkich typów ustawień
- Funkcje CRUD dla każdej tabeli
- Integracja z Supabase

**Plik**: `apps/frontend/src/lib/supabase/settings.ts`

### 3. **Komponenty React** ✅

Zaktualizowane z integracją bazy danych:

- `/settings/profile` - Profil użytkownika
- `/settings/notifications` - Powiadomienia
- `/settings/appearance` - Wygląd

**Funkcjonalności:**

- Pobieranie danych z bazy przy montowaniu
- Zapisywanie zmian do bazy
- Loading states
- Komunikaty sukcesu/błędu
- Walidacja i obsługa błędów

---

## 🚀 Kroki do uruchomienia

### Krok 1: Uruchomienie migracji SQL w Supabase

1. Zaloguj się do Supabase Dashboard
2. Przejdź do **SQL Editor**
3. Skopiuj i wklej pełny skrypt SQL z pliku:
   `docs/database_schema_settings.md` (sekcja "Migracja - Pełny skrypt SQL")
4. Kliknij **Run** aby wykonać migrację

**Skrypt tworzy:**

- 5 tabel ustawień
- Indeksy dla wydajności
- RLS policies dla bezpieczeństwa
- Triggery dla automatycznej aktualizacji `updated_at`
- Funkcję inicjalizacji ustawień dla nowych użytkowników
- Widok zbiorczy

### Krok 2: Weryfikacja migracji

Sprawdź czy tabele zostały utworzone:

```sql
-- Sprawdź tabele
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'user_%';

-- Powinny być widoczne:
-- user_profiles
-- user_notification_settings
-- user_appearance_settings
-- user_locale_settings
-- user_privacy_settings
```

### Krok 3: Test z istniejącym użytkownikiem

Jeśli masz już zarejestrowanych użytkowników, musisz ręcznie utworzyć dla nich ustawienia:

```sql
-- Dla każdego istniejącego użytkownika
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    -- Profil
    INSERT INTO user_profiles (id, full_name)
    VALUES (user_record.id, 'Użytkownik')
    ON CONFLICT (id) DO NOTHING;

    -- Powiadomienia
    INSERT INTO user_notification_settings (user_id)
    VALUES (user_record.id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Wygląd
    INSERT INTO user_appearance_settings (user_id)
    VALUES (user_record.id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Locale
    INSERT INTO user_locale_settings (user_id)
    VALUES (user_record.id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Prywatność
    INSERT INTO user_privacy_settings (user_id)
    VALUES (user_record.id)
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;
```

### Krok 4: Restart aplikacji frontend

```bash
cd apps/frontend
npm run dev
```

### Krok 5: Test funkcjonalności

1. **Zaloguj się** do aplikacji
2. Przejdź do **Ustawienia** → **Mój profil**
3. Kliknij **Edytuj profil**
4. Zmień dane (np. telefon, stanowisko)
5. Kliknij **Zapisz zmiany**
6. **Odśwież stronę** - dane powinny się zachować

Powtórz dla:

- **Powiadomienia** - przełączaj checkboxy
- **Wygląd** - zmień motyw i rozmiar czcionki

---

## 📊 Struktura tabel

### `user_profiles`

```
id (UUID, PK) → auth.users.id
full_name (VARCHAR)
phone (VARCHAR)
position (VARCHAR)
department (VARCHAR)
avatar_url (TEXT)
bio (TEXT)
created_at, updated_at
```

### `user_notification_settings`

```
id (UUID, PK)
user_id (UUID, FK) → auth.users.id
email_new_document (BOOLEAN)
email_analysis_complete (BOOLEAN)
email_weekly_report (BOOLEAN)
push_new_document (BOOLEAN)
push_analysis_complete (BOOLEAN)
push_chat_mention (BOOLEAN)
created_at, updated_at
```

### `user_appearance_settings`

```
id (UUID, PK)
user_id (UUID, FK) → auth.users.id
theme (VARCHAR) → 'light' | 'dark' | 'system'
font_size (VARCHAR) → 'small' | 'medium' | 'large'
compact_mode (BOOLEAN)
sidebar_collapsed (BOOLEAN)
created_at, updated_at
```

### `user_locale_settings`

```
id (UUID, PK)
user_id (UUID, FK) → auth.users.id
language (VARCHAR)
timezone (VARCHAR)
date_format (VARCHAR)
time_format (VARCHAR) → '12h' | '24h'
created_at, updated_at
```

### `user_privacy_settings`

```
id (UUID, PK)
user_id (UUID, FK) → auth.users.id
profile_visibility (VARCHAR) → 'public' | 'team' | 'private'
activity_tracking (BOOLEAN)
analytics_consent (BOOLEAN)
auto_delete_chats_after_days (INTEGER)
created_at, updated_at
```

---

## 🔍 Testowanie i debugowanie

### Sprawdź dane użytkownika w bazie

```sql
-- Wszystkie ustawienia dla użytkownika
SELECT * FROM user_settings_complete
WHERE user_id = 'YOUR_USER_ID';

-- Tylko profil
SELECT * FROM user_profiles
WHERE id = 'YOUR_USER_ID';

-- Tylko powiadomienia
SELECT * FROM user_notification_settings
WHERE user_id = 'YOUR_USER_ID';
```

### Logi w konsoli przeglądarki

Komponenty logują błędy do konsoli:

- `Error loading profile:` - błąd pobierania danych
- `Error saving profile:` - błąd zapisywania danych

### Typowe problemy

**Problem**: "Nie jesteś zalogowany"

- **Rozwiązanie**: Sprawdź czy sesja Supabase jest aktywna

**Problem**: "Błąd podczas ładowania profilu"

- **Rozwiązanie**: Sprawdź czy tabele istnieją i RLS policies są poprawne

**Problem**: "Nie udało się zapisać zmian"

- **Rozwiązanie**: Sprawdź logi w Supabase Dashboard → Logs

---

## 🎯 Funkcje do dodania (opcjonalnie)

### 1. Upload avatara

```typescript
// W user_profiles
avatar_url: string;

// Funkcja upload
async function uploadAvatar(userId: string, file: File) {
  const { data, error } = await supabase.storage
    .from("avatars")
    .upload(`${userId}/${file.name}`, file);

  if (data) {
    const url = supabase.storage.from("avatars").getPublicUrl(data.path)
      .data.publicUrl;

    await updateUserProfile(userId, { avatar_url: url });
  }
}
```

### 2. Dark mode implementation

```typescript
// W appearance/page.tsx
useEffect(() => {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}, [theme]);
```

### 3. Walidacja formularzy (React Hook Form + Zod)

```typescript
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const profileSchema = z.object({
  fullName: z.string().min(2, "Imię musi mieć min. 2 znaki"),
  phone: z
    .string()
    .regex(/^\+48\s\d{3}\s\d{3}\s\d{3}$/, "Nieprawidłowy format"),
  position: z.string().optional(),
  department: z.string().optional(),
});
```

### 4. Toast notifications (react-hot-toast)

```bash
npm install react-hot-toast
```

```typescript
import toast from "react-hot-toast";

// Zamiast setMessage
toast.success("Profil został zaktualizowany");
toast.error("Nie udało się zapisać zmian");
```

---

## 📚 API Reference

### Funkcje w `lib/supabase/settings.ts`

#### Profile

```typescript
getUserProfile(userId: string): Promise<UserProfile | null>
updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null>
```

#### Notifications

```typescript
getNotificationSettings(userId: string): Promise<NotificationSettings | null>
updateNotificationSettings(userId: string, updates: Partial<NotificationSettings>): Promise<NotificationSettings | null>
```

#### Appearance

```typescript
getAppearanceSettings(userId: string): Promise<AppearanceSettings | null>
updateAppearanceSettings(userId: string, updates: Partial<AppearanceSettings>): Promise<AppearanceSettings | null>
```

#### Locale

```typescript
getLocaleSettings(userId: string): Promise<LocaleSettings | null>
updateLocaleSettings(userId: string, updates: Partial<LocaleSettings>): Promise<LocaleSettings | null>
```

#### Privacy

```typescript
getPrivacySettings(userId: string): Promise<PrivacySettings | null>
updatePrivacySettings(userId: string, updates: Partial<PrivacySettings>): Promise<PrivacySettings | null>
```

#### All Settings

```typescript
getAllUserSettings(userId: string): Promise<CompleteUserSettings | null>
```

---

## ✅ Checklist wdrożenia

- [ ] Uruchomiono migrację SQL w Supabase
- [ ] Zweryfikowano utworzenie tabel
- [ ] Utworzono ustawienia dla istniejących użytkowników
- [ ] Przetestowano edycję profilu
- [ ] Przetestowano zmianę powiadomień
- [ ] Przetestowano zmianę wyglądu
- [ ] Sprawdzono persystencję danych po odświeżeniu
- [ ] Sprawdzono komunikaty błędów
- [ ] Sprawdzono loading states

---

## 🎉 Podsumowanie

System ustawień jest **w pełni funkcjonalny** i gotowy do użycia po uruchomieniu migracji SQL.

**Zaimplementowane:**

- ✅ Baza danych (5 tabel + triggery + RLS)
- ✅ Biblioteka TypeScript (funkcje CRUD)
- ✅ Komponenty React (3 strony z pełną integracją)
- ✅ Loading states i error handling
- ✅ Komunikaty sukcesu/błędu
- ✅ Walidacja i persystencja danych

**Do zrobienia (opcjonalnie):**

- Upload avatara
- Dark mode implementation
- Walidacja formularzy (Zod)
- Toast notifications
- Strony locale i privacy

---

**Data utworzenia**: 2024-12-27  
**Status**: Gotowe do produkcji (po uruchomieniu migracji)
