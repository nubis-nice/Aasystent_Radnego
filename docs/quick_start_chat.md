# Quick Start - Uruchomienie Czatu AI

## Krok 1: Zmienne Środowiskowe (2 min)

Utwórz plik `apps/api/.env` i dodaj:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4-turbo-preview
API_PORT=3001
FRONTEND_URL=http://localhost:3000
```

**Gdzie znaleźć klucze:**

1. **Supabase:** Dashboard → Project Settings → API
   - URL: `https://xxxxx.supabase.co`
   - service_role key: `eyJhbGc...` (długi token)
2. **OpenAI:** https://platform.openai.com/api-keys
   - Utwórz nowy klucz API
   - Skopiuj `sk-...`

## Krok 2: Uruchomienie Migracji (3 min)

### Opcja A: Przez Supabase Dashboard (ZALECANE)

1. Otwórz: https://supabase.com/dashboard
2. Wybierz swój projekt
3. Przejdź do: **SQL Editor** (ikona bazy danych)
4. Kliknij: **New query**
5. Otwórz plik: `apps/api/migrations/005_create_chat_schema.sql`
6. Skopiuj **CAŁĄ** zawartość (Ctrl+A, Ctrl+C)
7. Wklej do SQL Editor (Ctrl+V)
8. Kliknij: **Run** (lub Ctrl+Enter)
9. Poczekaj ~10 sekund
10. Powinieneś zobaczyć: "Success. No rows returned"

### Opcja B: Przez Supabase CLI

```bash
# Jeśli masz Supabase CLI zainstalowane
supabase db push
```

### Weryfikacja Migracji

Uruchom w SQL Editor:

```sql
-- Sprawdź czy tabele istnieją
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('conversations', 'messages', 'municipal_data', 'calendar_events');

-- Powinno zwrócić 4 wiersze
```

## Krok 3: Uruchomienie Aplikacji (1 min)

### Terminal 1 - API

```bash
cd apps/api
npm run dev
```

Powinieneś zobaczyć:

```
[HH:MM:SS UTC] INFO: Server listening at http://127.0.0.1:3001
```

### Terminal 2 - Frontend

```bash
cd apps/frontend
npm run dev
```

Powinieneś zobaczyć:

```
✓ Ready in XXXXms
- Local: http://localhost:3000
```

## Krok 4: Test Czatu (2 min)

1. Otwórz: http://localhost:3000
2. Zaloguj się do aplikacji
3. Przejdź do: **Czat z AI** (menu boczne)
4. Zadaj pytanie: "Cześć, jak możesz mi pomóc?"
5. AI powinien odpowiedzieć w ciągu 3-5 sekund

### Przykładowe pytania do przetestowania:

```
1. "Jakie dokumenty mam w systemie?"
2. "Wyjaśnij mi procedurę uchwałodawczą"
3. "Jakie są główne obowiązki radnego?"
4. "Pomóż mi przygotować wystąpienie na temat budżetu"
```

## Rozwiązywanie Problemów

### ❌ Błąd: "supabaseUrl is required"

**Rozwiązanie:**

- Sprawdź czy plik `apps/api/.env` istnieje
- Sprawdź czy nie ma literówki w nazwie zmiennej
- Zrestartuj API (Ctrl+C, potem `npm run dev`)

### ❌ Błąd: "Invalid or expired token"

**Rozwiązanie:**

- Wyloguj się i zaloguj ponownie
- Sprawdź czy SUPABASE_SERVICE_ROLE_KEY jest poprawny
- Sprawdź czy używasz service_role key (nie anon key!)

### ❌ Błąd: "Failed to send message"

**Rozwiązanie:**

1. Otwórz Console w przeglądarce (F12)
2. Zobacz szczegóły błędu
3. Sprawdź logi API (terminal 1)
4. Sprawdź czy migracja została uruchomiona

### ❌ Czat nie odpowiada / długo się ładuje

**Rozwiązanie:**

- Sprawdź czy OpenAI API key jest prawidłowy
- Sprawdź limit OpenAI (https://platform.openai.com/usage)
- Sprawdź połączenie internetowe
- Pierwsze zapytanie może trwać dłużej (~5-10s)

### ❌ Błąd: "relation does not exist"

**Rozwiązanie:**

- Migracja nie została uruchomiona
- Uruchom ponownie migrację (Krok 2)
- Sprawdź czy jesteś w odpowiednim projekcie Supabase

## Co dalej?

### 1. Dodaj dokumenty

- Przejdź do: **Dokumenty** → **Dodaj dokument**
- Prześlij PDF lub TXT
- AI będzie mógł analizować te dokumenty

### 2. Konfiguruj profil

- Przejdź do: **Ustawienia** → **Profil użytkownika**
- Uzupełnij: Imię, Nazwisko, Stanowisko
- AI będzie personalizował odpowiedzi

### 3. Konfiguruj API OpenAI

- Przejdź do: **Ustawienia** → **Konfiguracja API**
- Dodaj swój klucz OpenAI
- Przetestuj połączenie

### 4. (Wkrótce) Konfiguruj gminę

- Strona `/settings/municipal` będzie dostępna wkrótce
- Będziesz mógł dodać URL do strony gminy
- AI będzie śledzić uchwały i spotkania rady

## Wsparcie

**Dokumentacja:**

- Architektura: `docs/chat_ai_architecture.md`
- Status: `docs/chat_implementation_status.md`
- Setup: `docs/setup_instructions.md`

**Problemy?**

- Sprawdź logi w terminalach
- Sprawdź Console w przeglądarce (F12)
- Sprawdź czy wszystkie zmienne środowiskowe są ustawione

## Metryki

**Oczekiwane czasy odpowiedzi:**

- Pierwsze zapytanie: 5-10s (cold start)
- Kolejne zapytania: 2-5s
- Z dokumentami (RAG): 3-7s

**Koszty OpenAI (szacunkowe):**

- 1 zapytanie: ~$0.01-0.05
- 100 zapytań/miesiąc: ~$1-5
- 1000 zapytań/miesiąc: ~$10-50

**Limity:**

- Max długość wiadomości: 4000 znaków
- Max długość odpowiedzi: 2000 tokenów
- Historia: 10 ostatnich wiadomości
- Dokumenty RAG: 5 najbardziej trafnych chunków

---

**Gotowe! Twój Inteligentny Asystent Radnego jest uruchomiony!** 🎉
