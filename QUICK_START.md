# 🚀 Quick Start - ~~bez~~RADNY

## ✅ Checklist uruchomienia

### Krok 1: Przygotowanie środowiska ✅ (GOTOWE)

- ✅ Migracje SQL już w Supabase
- ✅ Kod zrefaktorowany i gotowy

### Krok 2: Konfiguracja zmiennych środowiskowych

**Backend** - Utwórz `apps/api/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
API_PORT=3001
LOG_LEVEL=info
FRONTEND_URL=http://localhost:3000
```

**Frontend** - Utwórz `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Krok 3: Instalacja i build

```bash
# Zainstaluj zależności
npm install

# Zbuduj shared package (WAŻNE!)
npm run build:shared
```

### Krok 4: Uruchomienie aplikacji

```bash
# Uruchom wszystkie serwisy
npm run dev

# Aplikacja dostępna:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:3001
```

### Krok 5: Pierwsza konfiguracja w UI

1. **Otwórz** `http://localhost:3000`
2. **Zaloguj się** przez Google OAuth
3. **Ustawienia → Konfiguracja API**:
   - Dodaj konfigurację OpenAI
   - API Key: `sk-...`
   - Model: `gpt-4` lub `gpt-3.5-turbo`
   - Embedding Model: `text-embedding-3-small`
   - ✅ Ustaw jako domyślny

### Krok 6: Dodaj źródła danych

**Ustawienia → Źródła Danych** → Dodaj źródło:

**Przykład 1: BIP Gminy**

- Nazwa: `BIP Gminy Drawno`
- URL: `https://bip.drawno.pl`
- Typ: `BIP - Biuletyn Informacji Publicznej`
- Metoda: `Scraping (Web)`
- ✅ Zapisz

**Przykład 2: ISAP**

- Nazwa: `ISAP - Akty Prawne`
- URL: `https://isap.sejm.gov.pl`
- Typ: `ISAP - Akty prawne`
- Metoda: `Scraping (Web)`
- ✅ Zapisz

### Krok 7: Uruchom scraping

1. W liście źródeł kliknij **Scrapuj** przy wybranym źródle
2. Poczekaj na zakończenie (sprawdź logi w terminalu)
3. Sprawdź statystyki - powinny pojawić się pobrane dokumenty

### Krok 8: Testuj analizy

**Przejdź do `/analysis`** i przetestuj:

**Wyszukiwanie:**

- Query: `budżet gminy`
- Tryb: `Hybrydowe`
- Kliknij **Szukaj**

**Analiza prawna:**

- Pytanie: `Czy uchwała budżetowa jest zgodna z ustawą o finansach publicznych?`
- Typ: `Analiza legalności`
- Kliknij **Analizuj**

## 🔍 Weryfikacja działania

### 1. Sprawdź health endpoint

```bash
curl http://localhost:3001/health
# Powinno zwrócić: {"status":"ok","timestamp":"...","version":"1.0.0"}
```

### 2. Sprawdź czy shared package się zbudował

```bash
ls packages/shared/dist/
# Powinny być pliki: index.js, index.d.ts, types/
```

### 3. Sprawdź logi API

Terminal z `npm run dev` powinien pokazywać:

```
[API] Server listening at http://0.0.0.0:3001
[Frontend] Ready on http://localhost:3000
```

### 4. Sprawdź bazę danych

W Supabase Dashboard → SQL Editor:

```sql
-- Sprawdź nowe kolumny
SELECT column_name FROM information_schema.columns
WHERE table_name = 'data_sources'
AND column_name IN ('fetch_method', 'api_config', 'category');

-- Sprawdź funkcje RPC
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN ('match_documents', 'hybrid_search');
```

## ⚠️ Rozwiązywanie problemów

### Problem: "Cannot find module '@shared/types/data-sources-api'"

**Rozwiązanie:**

```bash
npm run build:shared
```

### Problem: "OpenAI API configuration not found"

**Rozwiązanie:**

1. Zaloguj się do aplikacji
2. Ustawienia → Konfiguracja API
3. Dodaj konfigurację OpenAI i ustaw jako domyślną

### Problem: Scraping nie działa

**Rozwiązanie:**

1. Sprawdź logi API w terminalu
2. Sprawdź czy URL źródła jest dostępny
3. Sprawdź konfigurację selektorów CSS

### Problem: Semantic search nie zwraca wyników

**Rozwiązanie:**

1. Upewnij się, że dokumenty mają embeddingi (`embedding IS NOT NULL`)
2. Sprawdź czy OpenAI API key jest poprawny
3. Sprawdź czy funkcja `match_documents` istnieje w bazie

## 📚 Następne kroki

1. ✅ **Dodaj więcej źródeł** - BIP, RIO, ISAP
2. ✅ **Uruchom scraping** dla wszystkich źródeł
3. ✅ **Przetestuj analizy** - wyszukiwanie i reasoning
4. ✅ **Skonfiguruj harmonogramy** - automatyczne scrapowanie
5. ✅ **Monitoruj logi** - sprawdzaj błędy i ostrzeżenia

## 🎯 Kluczowe endpointy

- `GET /health` - status API
- `GET /api/data-sources` - lista źródeł
- `POST /api/data-sources/:id/scrape` - uruchom scraping
- `POST /api/legal/search` - wyszukiwanie prawne
- `POST /api/legal/reasoning` - analiza prawna
- `POST /api/legal/budget-analysis` - analiza budżetowa

## 📖 Dokumentacja

- [`README.md`](README.md) - główny README
- [`docs/INSTRUKCJA_URUCHOMIENIA_WINSDURF.md`](docs/INSTRUKCJA_URUCHOMIENIA_WINSDURF.md) - szczegółowa instrukcja
- [`docs/REFACTORING_SUMMARY_2026_01_09.md`](docs/REFACTORING_SUMMARY_2026_01_09.md) - podsumowanie refactoringu
- [`docs/architecture.md`](docs/architecture.md) - architektura systemu

---

**~~bez~~RADNY gotowy! Powodzenia! 🚀**

---

**Licencja**: MIT | **Data aktualizacji**: 2026-01-25
