# Instrukcja uruchomienia systemu Agent AI "Winsdurf"

## Wymagania wstępne

- Node.js LTS (v18+)
- PostgreSQL 14+ z rozszerzeniem pgvector
- Redis
- Konto Supabase
- Klucz API OpenAI

## Krok 1: Uruchomienie migracji bazy danych

Uruchom migracje w kolejności:

```bash
# Przejdź do katalogu API
cd apps/api

# Uruchom migracje w Supabase
# Opcja A: Przez Supabase Dashboard
# 1. Otwórz Supabase Dashboard → SQL Editor
# 2. Wklej i uruchom kolejno:
#    - migrations/006_create_data_sources_schema.sql
#    - migrations/008_update_data_sources_for_api.sql
#    - migrations/009_create_semantic_search_functions.sql

# Opcja B: Przez Supabase CLI
supabase db push
```

## Krok 2: Konfiguracja zmiennych środowiskowych

### Backend API (`apps/api/.env`)

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (opcjonalnie - można skonfigurować przez UI)
OPENAI_API_KEY=sk-...

# API
API_PORT=3001
LOG_LEVEL=info

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### Frontend (`apps/frontend/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Krok 3: Instalacja zależności

```bash
# Z głównego katalogu projektu
npm install
```

## Krok 4: Uruchomienie aplikacji

### Opcja A: Wszystkie serwisy jednocześnie

```bash
# Z głównego katalogu
npm run dev
```

### Opcja B: Osobno każdy serwis

```bash
# Terminal 1 - Backend API
cd apps/api
npm run dev

# Terminal 2 - Frontend
cd apps/frontend
npm run dev

# Terminal 3 - Worker (opcjonalnie)
cd apps/worker
npm run dev
```

## Krok 5: Konfiguracja OpenAI przez UI

1. Otwórz `http://localhost:3000`
2. Zaloguj się przez Google OAuth
3. Przejdź do **Ustawienia → Konfiguracja API**
4. Dodaj konfigurację OpenAI:
   - Provider: OpenAI
   - API Key: `sk-...`
   - Model: `gpt-4` lub `gpt-3.5-turbo`
   - Embedding Model: `text-embedding-3-small`
   - Ustaw jako domyślny

## Krok 6: Dodanie źródeł danych

1. Przejdź do **Ustawienia → Źródła Danych**
2. Kliknij **Dodaj źródło**
3. Wybierz typ źródła:
   - **ISAP** - Internetowy System Aktów Prawnych
   - **WSA/NSA** - Orzecznictwo sądów administracyjnych
   - **RIO** - Regionalna Izba Obrachunkowa
   - **BIP** - Biuletyn Informacji Publicznej (twoja gmina)
4. Skonfiguruj:
   - Nazwa: np. "BIP Gminy Drawno"
   - URL: `https://bip.drawno.pl`
   - Metoda pobierania: `Scraping (Web)`
5. Kliknij **Scrapuj** aby pobrać dokumenty

## Krok 7: Testowanie silników analitycznych

### Legal Search API

```bash
curl -X POST http://localhost:3001/api/legal/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "budżet gminy",
    "searchMode": "hybrid",
    "maxResults": 5
  }'
```

### Legal Reasoning Engine

```bash
curl -X POST http://localhost:3001/api/legal/reasoning \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Czy uchwała budżetowa jest zgodna z ustawą o finansach publicznych?",
    "analysisType": "legality"
  }'
```

### Budget Analysis Engine

```bash
curl -X POST http://localhost:3001/api/legal/budget-analysis \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "document-uuid",
    "analysisType": "risk"
  }'
```

## Weryfikacja działania

### 1. Sprawdź health endpoint

```bash
curl http://localhost:3001/health
# Powinno zwrócić: {"status":"ok","timestamp":"...","version":"1.0.0"}
```

### 2. Sprawdź frontend

Otwórz `http://localhost:3000` - powinieneś zobaczyć stronę logowania.

### 3. Sprawdź bazę danych

```sql
-- Sprawdź czy migracje zostały uruchomione
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'data_sources'
  AND column_name IN ('fetch_method', 'api_config', 'category');

-- Sprawdź funkcje RPC
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN ('match_documents', 'hybrid_search');
```

## Rozwiązywanie problemów

### Problem: Brak embeddingów w semantic search

**Rozwiązanie:** Upewnij się, że:

1. OpenAI API key jest skonfigurowany
2. Dokumenty zostały przetworzone (mają `embedding IS NOT NULL`)
3. Model embeddings jest ustawiony w konfiguracji API

### Problem: Scraping nie działa

**Rozwiązanie:**

1. Sprawdź logi API: `cd apps/api && npm run dev`
2. Sprawdź czy URL źródła jest dostępny
3. Sprawdź konfigurację selektorów CSS dla danego typu źródła

### Problem: Błąd "OpenAI API configuration not found"

**Rozwiązanie:**

1. Zaloguj się do aplikacji
2. Przejdź do Ustawienia → Konfiguracja API
3. Dodaj konfigurację OpenAI i ustaw jako domyślną

## Architektura systemu

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent AI "Winsdurf"                      │
│              Asystent Analityczno-Kontrolny                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  WARSTWA 1: Źródła Danych                   │
├─────────────────────────────────────────────────────────────┤
│  • ISAP (scraping)        • WSA/NSA (scraping)             │
│  • RIO (scraping)         • BIP JST (scraping)             │
│  • Dzienniki Urzędowe     • API custom                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              WARSTWA 2: Adaptery Pobierania                 │
├─────────────────────────────────────────────────────────────┤
│  • ApiDataFetcher (OAuth2, API key, Basic, Bearer)         │
│  • ScraperDataFetcher (Cheerio, crawling, deduplikacja)    │
│  • UnifiedDataService (orkiestrator)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              WARSTWA 3: Silniki Analityczne                 │
├─────────────────────────────────────────────────────────────┤
│  • Legal Search API (fulltext, semantic, hybrid)           │
│  • Legal Reasoning Engine (analiza prawna, ryzyka)         │
│  • Budget Analysis Engine (analiza budżetowa)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    WARSTWA 4: API & UI                      │
├─────────────────────────────────────────────────────────────┤
│  • REST API (Fastify)                                       │
│  • Frontend (Next.js)                                       │
│  • Worker (BullMQ)                                          │
└─────────────────────────────────────────────────────────────┘
```

## Następne kroki

1. **Dodaj więcej źródeł danych** - skonfiguruj BIP swojej gminy, RIO, ISAP
2. **Przetestuj analizy** - uruchom scraping i przetestuj silniki analityczne
3. **Utwórz UI dla analiz** - zbuduj interfejs do wyszukiwania i analiz prawnych
4. **Skonfiguruj automatyczne scrapowanie** - ustaw harmonogramy dla źródeł

## Wsparcie

W razie problemów sprawdź:

- `docs/architecture.md` - architektura systemu
- `docs/change_log.md` - historia zmian
- Logi API: `apps/api/logs/`
- Logi Worker: `apps/worker/logs/`
