# Instrukcja Uruchomienia Inteligentnego Czatu AI

## Wymagane Kroki

### 1. Zmienne Środowiskowe

Utwórz plik `apps/api/.env` z następującymi zmiennymi:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo-preview

# API
API_PORT=3001
LOG_LEVEL=info

# Frontend URL (dla CORS)
FRONTEND_URL=http://localhost:3000
```

**Gdzie znaleźć klucze:**

- Supabase: Project Settings → API → URL i service_role key
- OpenAI: https://platform.openai.com/api-keys

### 2. Uruchomienie Migracji Bazy Danych

**Opcja A: Przez Supabase Dashboard**

1. Przejdź do Supabase Dashboard → SQL Editor
2. Otwórz plik `apps/api/migrations/005_create_chat_schema.sql`
3. Skopiuj całą zawartość
4. Wklej do SQL Editor
5. Kliknij "Run"

**Opcja B: Przez CLI (jeśli masz Supabase CLI)**

```bash
supabase db push
```

**Migracja tworzy:**

- Tabele: `conversations`, `messages`, `municipal_data`, `calendar_events`
- Kolumny w `user_profiles` dla ustawień gminy
- Funkcję `search_municipal_data()` dla semantic search
- RLS policies dla bezpieczeństwa

### 3. Weryfikacja Migracji

Sprawdź czy tabele zostały utworzone:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('conversations', 'messages', 'municipal_data', 'calendar_events');
```

Sprawdź czy kolumny zostały dodane do user_profiles:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name IN ('municipality_name', 'municipality_type', 'bip_url');
```

### 4. Uruchomienie Aplikacji

```bash
# Terminal 1 - Frontend
cd apps/frontend
npm run dev

# Terminal 2 - API
cd apps/api
npm run dev
```

### 5. Test Czatu

1. Zaloguj się do aplikacji
2. Przejdź do `/chat`
3. Zadaj pytanie, np: "Jakie dokumenty mam w systemie?"
4. AI powinien odpowiedzieć z kontekstem Twoich dokumentów

## Rozwiązywanie Problemów

### Błąd: "supabaseUrl is required"

- Sprawdź czy plik `apps/api/.env` istnieje
- Sprawdź czy `SUPABASE_URL` jest ustawiony

### Błąd: "Invalid or expired token"

- Sprawdź czy użytkownik jest zalogowany
- Sprawdź czy token jest wysyłany w headerze Authorization

### Błąd: "Failed to send message"

- Sprawdź logi API (terminal 2)
- Sprawdź czy migracja została uruchomiona
- Sprawdź czy OpenAI API key jest prawidłowy

### Czat nie odpowiada

- Sprawdź console w przeglądarce (F12)
- Sprawdź czy API działa: http://localhost:3001/health
- Sprawdź czy CORS jest skonfigurowany

## Funkcjonalność

### Co działa:

✅ Wysyłanie wiadomości do AI
✅ System promptów (Asystent Radnego)
✅ RAG z dokumentami użytkownika
✅ Historia konwersacji
✅ Cytaty ze źródeł
✅ Loading states i error handling

### Co wymaga konfiguracji:

⏳ Dane gminy (wymaga scrapera)
⏳ Google Calendar (wymaga OAuth)
⏳ Powiadomienia

## Następne Kroki

1. **Dodaj dokumenty** - Przejdź do `/documents` i dodaj dokumenty
2. **Konfiguruj gminę** - Będzie dostępne w `/settings/municipal` (w przygotowaniu)
3. **Testuj czat** - Zadawaj pytania o dokumenty i sprawy samorządowe

## Wsparcie

Dokumentacja:

- Architektura: `docs/chat_ai_architecture.md`
- Status implementacji: `docs/chat_implementation_status.md`
