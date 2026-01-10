# Schemat Bazy Danych - Moduł Ustawień

## Analiza Wymagań

### Podstrony /settings i ich pola:

#### 1. `/settings/profile` - Profil użytkownika

**Pola:**

- `full_name` (string) - Imię i nazwisko
- `email` (string) - Email (readonly, z auth.users)
- `phone` (string) - Telefon
- `position` (string) - Stanowisko (np. "Radny Miejski")
- `department` (string) - Komisja/Departament
- `avatar_url` (string, optional) - URL do avatara

#### 2. `/settings/api` - Konfiguracja API

**Pola:** (już zaprojektowane w `api_management_design.md`)

- Tabela `api_configurations` z szyfrowaniem kluczy

#### 3. `/settings/notifications` - Powiadomienia

**Pola:**

- `email_new_document` (boolean) - Email przy nowym dokumencie
- `email_analysis_complete` (boolean) - Email po zakończeniu analizy
- `email_weekly_report` (boolean) - Email z raportem tygodniowym
- `push_new_document` (boolean) - Push przy nowym dokumencie
- `push_analysis_complete` (boolean) - Push po zakończeniu analizy
- `push_chat_mention` (boolean) - Push przy wzmiance w czacie

#### 4. `/settings/appearance` - Wygląd

**Pola:**

- `theme` (enum: 'light', 'dark', 'system') - Motyw kolorystyczny
- `font_size` (enum: 'small', 'medium', 'large') - Rozmiar czcionki
- `compact_mode` (boolean) - Tryb kompaktowy

#### 5. `/settings/locale` - Język i region

**Pola:**

- `language` (string) - Kod języka (np. 'pl', 'en')
- `timezone` (string) - Strefa czasowa
- `date_format` (string) - Format daty

#### 6. `/settings/privacy` - Prywatność

**Pola:**

- `profile_visibility` (enum: 'public', 'team', 'private')
- `activity_tracking` (boolean) - Śledzenie aktywności
- `analytics_consent` (boolean) - Zgoda na analitykę

---

## Schemat Bazy Danych (PostgreSQL/Supabase)

### Tabela: `user_profiles`

Rozszerza `auth.users` o dodatkowe informacje profilu.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Dane osobowe
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  position VARCHAR(100),
  department VARCHAR(100),
  avatar_url TEXT,

  -- Bio i dodatkowe
  bio TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy
CREATE INDEX idx_user_profiles_full_name ON user_profiles(full_name);

-- RLS (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Użytkownik może czytać swój profil
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Użytkownik może aktualizować swój profil
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Automatyczne tworzenie profilu przy rejestracji
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### Tabela: `user_notification_settings`

Ustawienia powiadomień dla każdego użytkownika.

```sql
CREATE TABLE user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email notifications
  email_new_document BOOLEAN DEFAULT true,
  email_analysis_complete BOOLEAN DEFAULT true,
  email_weekly_report BOOLEAN DEFAULT false,

  -- Push notifications
  push_new_document BOOLEAN DEFAULT true,
  push_analysis_complete BOOLEAN DEFAULT false,
  push_chat_mention BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Indeksy
CREATE INDEX idx_notification_settings_user ON user_notification_settings(user_id);

-- RLS
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notification settings"
  ON user_notification_settings
  FOR ALL
  USING (auth.uid() = user_id);
```

### Tabela: `user_appearance_settings`

Ustawienia wyglądu interfejsu.

```sql
CREATE TABLE user_appearance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Theme
  theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),

  -- Typography
  font_size VARCHAR(20) DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),

  -- Layout
  compact_mode BOOLEAN DEFAULT false,
  sidebar_collapsed BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Indeksy
CREATE INDEX idx_appearance_settings_user ON user_appearance_settings(user_id);

-- RLS
ALTER TABLE user_appearance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own appearance settings"
  ON user_appearance_settings
  FOR ALL
  USING (auth.uid() = user_id);
```

### Tabela: `user_locale_settings`

Ustawienia języka i regionu.

```sql
CREATE TABLE user_locale_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Locale
  language VARCHAR(10) DEFAULT 'pl',
  timezone VARCHAR(50) DEFAULT 'Europe/Warsaw',
  date_format VARCHAR(20) DEFAULT 'DD.MM.YYYY',
  time_format VARCHAR(10) DEFAULT '24h' CHECK (time_format IN ('12h', '24h')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Indeksy
CREATE INDEX idx_locale_settings_user ON user_locale_settings(user_id);

-- RLS
ALTER TABLE user_locale_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own locale settings"
  ON user_locale_settings
  FOR ALL
  USING (auth.uid() = user_id);
```

### Tabela: `user_privacy_settings`

Ustawienia prywatności.

```sql
CREATE TABLE user_privacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Privacy
  profile_visibility VARCHAR(20) DEFAULT 'team' CHECK (profile_visibility IN ('public', 'team', 'private')),
  activity_tracking BOOLEAN DEFAULT true,
  analytics_consent BOOLEAN DEFAULT true,

  -- Data retention
  auto_delete_chats_after_days INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Indeksy
CREATE INDEX idx_privacy_settings_user ON user_privacy_settings(user_id);

-- RLS
ALTER TABLE user_privacy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own privacy settings"
  ON user_privacy_settings
  FOR ALL
  USING (auth.uid() = user_id);
```

---

## Triggery dla `updated_at`

```sql
-- Funkcja do automatycznej aktualizacji updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggery dla każdej tabeli
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON user_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appearance_settings_updated_at
  BEFORE UPDATE ON user_appearance_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locale_settings_updated_at
  BEFORE UPDATE ON user_locale_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_privacy_settings_updated_at
  BEFORE UPDATE ON user_privacy_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Funkcja inicjalizacji ustawień dla nowego użytkownika

```sql
-- Funkcja wywoływana po utworzeniu nowego użytkownika
CREATE OR REPLACE FUNCTION initialize_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- Utwórz profil
  INSERT INTO user_profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Użytkownik'));

  -- Utwórz ustawienia powiadomień (domyślne wartości)
  INSERT INTO user_notification_settings (user_id)
  VALUES (NEW.id);

  -- Utwórz ustawienia wyglądu (domyślne wartości)
  INSERT INTO user_appearance_settings (user_id)
  VALUES (NEW.id);

  -- Utwórz ustawienia locale (domyślne wartości)
  INSERT INTO user_locale_settings (user_id)
  VALUES (NEW.id);

  -- Utwórz ustawienia prywatności (domyślne wartości)
  INSERT INTO user_privacy_settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger na auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_settings();
```

---

## Widok zbiorczy dla wszystkich ustawień użytkownika

```sql
CREATE VIEW user_settings_complete AS
SELECT
  u.id as user_id,
  u.email,

  -- Profile
  p.full_name,
  p.phone,
  p.position,
  p.department,
  p.avatar_url,
  p.bio,

  -- Notifications
  n.email_new_document,
  n.email_analysis_complete,
  n.email_weekly_report,
  n.push_new_document,
  n.push_analysis_complete,
  n.push_chat_mention,

  -- Appearance
  a.theme,
  a.font_size,
  a.compact_mode,
  a.sidebar_collapsed,

  -- Locale
  l.language,
  l.timezone,
  l.date_format,
  l.time_format,

  -- Privacy
  pr.profile_visibility,
  pr.activity_tracking,
  pr.analytics_consent,
  pr.auto_delete_chats_after_days

FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
LEFT JOIN user_notification_settings n ON u.id = n.user_id
LEFT JOIN user_appearance_settings a ON u.id = a.user_id
LEFT JOIN user_locale_settings l ON u.id = l.user_id
LEFT JOIN user_privacy_settings pr ON u.id = pr.user_id;
```

---

## Migracja - Pełny skrypt SQL

Plik: `apps/api/migrations/002_create_user_settings_tables.sql`

```sql
-- ============================================
-- Migracja: Tabele ustawień użytkownika
-- Data: 2024-12-27
-- Opis: Tworzenie tabel dla profilu, powiadomień, wyglądu, locale i prywatności
-- ============================================

-- 1. Tabela user_profiles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  position VARCHAR(100),
  department VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_full_name ON user_profiles(full_name);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Tabela user_notification_settings
CREATE TABLE user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_new_document BOOLEAN DEFAULT true,
  email_analysis_complete BOOLEAN DEFAULT true,
  email_weekly_report BOOLEAN DEFAULT false,
  push_new_document BOOLEAN DEFAULT true,
  push_analysis_complete BOOLEAN DEFAULT false,
  push_chat_mention BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_notification_settings_user ON user_notification_settings(user_id);

ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notification settings" ON user_notification_settings FOR ALL USING (auth.uid() = user_id);

-- 3. Tabela user_appearance_settings
CREATE TABLE user_appearance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  font_size VARCHAR(20) DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
  compact_mode BOOLEAN DEFAULT false,
  sidebar_collapsed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_appearance_settings_user ON user_appearance_settings(user_id);

ALTER TABLE user_appearance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own appearance settings" ON user_appearance_settings FOR ALL USING (auth.uid() = user_id);

-- 4. Tabela user_locale_settings
CREATE TABLE user_locale_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language VARCHAR(10) DEFAULT 'pl',
  timezone VARCHAR(50) DEFAULT 'Europe/Warsaw',
  date_format VARCHAR(20) DEFAULT 'DD.MM.YYYY',
  time_format VARCHAR(10) DEFAULT '24h' CHECK (time_format IN ('12h', '24h')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_locale_settings_user ON user_locale_settings(user_id);

ALTER TABLE user_locale_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own locale settings" ON user_locale_settings FOR ALL USING (auth.uid() = user_id);

-- 5. Tabela user_privacy_settings
CREATE TABLE user_privacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_visibility VARCHAR(20) DEFAULT 'team' CHECK (profile_visibility IN ('public', 'team', 'private')),
  activity_tracking BOOLEAN DEFAULT true,
  analytics_consent BOOLEAN DEFAULT true,
  auto_delete_chats_after_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_privacy_settings_user ON user_privacy_settings(user_id);

ALTER TABLE user_privacy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own privacy settings" ON user_privacy_settings FOR ALL USING (auth.uid() = user_id);

-- 6. Funkcja aktualizacji updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Triggery dla updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON user_notification_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appearance_settings_updated_at BEFORE UPDATE ON user_appearance_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_locale_settings_updated_at BEFORE UPDATE ON user_locale_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_privacy_settings_updated_at BEFORE UPDATE ON user_privacy_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Funkcja inicjalizacji ustawień dla nowego użytkownika
CREATE OR REPLACE FUNCTION initialize_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Użytkownik'));
  INSERT INTO user_notification_settings (user_id) VALUES (NEW.id);
  INSERT INTO user_appearance_settings (user_id) VALUES (NEW.id);
  INSERT INTO user_locale_settings (user_id) VALUES (NEW.id);
  INSERT INTO user_privacy_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Trigger inicjalizacji
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION initialize_user_settings();

-- 10. Widok zbiorczy
CREATE VIEW user_settings_complete AS
SELECT
  u.id as user_id, u.email,
  p.full_name, p.phone, p.position, p.department, p.avatar_url, p.bio,
  n.email_new_document, n.email_analysis_complete, n.email_weekly_report,
  n.push_new_document, n.push_analysis_complete, n.push_chat_mention,
  a.theme, a.font_size, a.compact_mode, a.sidebar_collapsed,
  l.language, l.timezone, l.date_format, l.time_format,
  pr.profile_visibility, pr.activity_tracking, pr.analytics_consent, pr.auto_delete_chats_after_days
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
LEFT JOIN user_notification_settings n ON u.id = n.user_id
LEFT JOIN user_appearance_settings a ON u.id = a.user_id
LEFT JOIN user_locale_settings l ON u.id = l.user_id
LEFT JOIN user_privacy_settings pr ON u.id = pr.user_id;
```

---

**Status**: Schemat gotowy do implementacji  
**Data**: 2024-12-27
