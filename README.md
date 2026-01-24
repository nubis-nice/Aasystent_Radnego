# ~~bez~~RADNY - Agent AI

Agent AI wspierający Radnego w kontroli legalności, zasadności i skutków uchwał samorządowych.

> **~~bez~~RADNY** - bo z nami radny nigdy nie jest *bez*radny.

## 🎯 Kluczowe funkcje

### Warstwa 1: Źródła Danych (API-first)

- **ISAP** - Internetowy System Aktów Prawnych (scraping)
- **WSA/NSA** - Orzecznictwo sądów administracyjnych (scraping)
- **RIO** - Regionalna Izba Obrachunkowa (scraping)
- **BIP** - Biuletyn Informacji Publicznej (scraping, template)
- **Dzienniki Urzędowe** - Monitor Polski i dzienniki wojewódzkie

### Warstwa 2: Adaptery Pobierania

- `ApiDataFetcher` - uniwersalny klient API (OAuth2, API key, Basic, Bearer)
- `ScraperDataFetcher` - web scraping z Cheerio (crawling, deduplikacja)
- `UnifiedDataService` - orkiestrator łączący API i scraping

### Warstwa 3: Silniki Analityczne

- **Legal Search API** - wyszukiwanie fulltext/semantic/hybrid
- **Legal Reasoning Engine** - analiza prawna z wykrywaniem ryzyk
- **Budget Analysis Engine** - analiza budżetowa i wykrywanie anomalii

## 🚀 Szybki start

### 1. Wymagania

- Node.js 18+
- PostgreSQL 14+ z pgvector
- Redis
- Konto Supabase
- Klucz API OpenAI

### 2. Instalacja

```bash
# Klonuj repozytorium
git clone <repo-url>
cd Aasystent_Radnego

# Zainstaluj zależności
npm install
```

### 3. Konfiguracja

Utwórz pliki `.env`:

**Backend** (`apps/api/.env`):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
API_PORT=3001
FRONTEND_URL=http://localhost:3000
```

**Frontend** (`apps/frontend/.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Migracje bazy danych

W Supabase Dashboard → SQL Editor uruchom kolejno:

1. `apps/api/migrations/006_create_data_sources_schema.sql`
2. `apps/api/migrations/008_update_data_sources_for_api.sql`
3. `apps/api/migrations/009_create_semantic_search_functions.sql`

### 5. Uruchomienie

```bash
# Wszystkie serwisy jednocześnie
npm run dev

# Lub osobno:
cd apps/api && npm run dev        # Backend API (port 3001)
cd apps/frontend && npm run dev   # Frontend (port 3000)
cd apps/worker && npm run dev     # Worker (opcjonalnie)
```

### 6. Pierwsze kroki

1. Otwórz `http://localhost:3000`
2. Zaloguj się przez Google OAuth
3. **Ustawienia → Konfiguracja API** - dodaj klucz OpenAI
4. **Ustawienia → Źródła Danych** - dodaj źródła (ISAP, BIP, RIO)
5. Kliknij **Scrapuj** aby pobrać dokumenty
6. **Analizy** - testuj wyszukiwanie i analizy prawne

## 📚 Dokumentacja

- [`docs/INSTRUKCJA_URUCHOMIENIA_WINSDURF.md`](docs/INSTRUKCJA_URUCHOMIENIA_WINSDURF.md) - szczegółowa instrukcja
- [`docs/architecture.md`](docs/architecture.md) - architektura systemu
- [`docs/change_log.md`](docs/change_log.md) - historia zmian

## 🏗️ Architektura

```
┌─────────────────────────────────────────┐
│           ~~bez~~RADNY                  │
│     Agent AI dla Rady Miejskiej         │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  WARSTWA 1: Źródła Danych               │
│  • ISAP  • WSA/NSA  • RIO  • BIP        │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  WARSTWA 2: Adaptery Pobierania         │
│  • ApiDataFetcher                       │
│  • ScraperDataFetcher                   │
│  • UnifiedDataService                   │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  WARSTWA 3: Silniki Analityczne         │
│  • Legal Search API                     │
│  • Legal Reasoning Engine               │
│  • Budget Analysis Engine               │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  WARSTWA 4: API & UI                    │
│  • REST API (Fastify)                   │
│  • Frontend (Next.js)                   │
│  • Worker (BullMQ)                      │
└─────────────────────────────────────────┘
```

## 🔌 API Endpoints

### Źródła danych

- `GET /api/data-sources` - lista źródeł
- `POST /api/data-sources` - dodaj źródło
- `POST /api/data-sources/:id/scrape` - uruchom scraping

### Analizy prawne

- `POST /api/legal/search` - wyszukiwanie prawne
- `POST /api/legal/reasoning` - analiza prawna z ryzykami
- `POST /api/legal/budget-analysis` - analiza budżetowa
- `GET /api/legal/analysis-types` - typy analiz

## 🧪 Testowanie

```bash
# Wyszukiwanie prawne
curl -X POST http://localhost:3001/api/legal/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "budżet gminy", "searchMode": "hybrid"}'

# Analiza prawna
curl -X POST http://localhost:3001/api/legal/reasoning \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "Czy uchwała jest zgodna z prawem?", "analysisType": "legality"}'
```

## 📦 Struktura projektu

```
Aasystent_Radnego/
├── apps/
│   ├── api/                    # Backend API (Fastify)
│   │   ├── src/
│   │   │   ├── routes/         # Endpointy API
│   │   │   ├── services/       # Silniki analityczne
│   │   │   │   ├── data-fetchers/
│   │   │   │   ├── legal-search-api.ts
│   │   │   │   ├── legal-reasoning-engine.ts
│   │   │   │   └── budget-analysis-engine.ts
│   │   │   └── middleware/
│   │   └── migrations/         # Migracje SQL
│   ├── frontend/               # Frontend (Next.js)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── analysis/   # UI analiz prawnych
│   │       │   └── settings/   # Ustawienia
│   │       └── lib/api/        # API clients
│   └── worker/                 # Worker (BullMQ)
├── packages/
│   └── shared/
│       └── src/types/          # Wspólne typy TypeScript
└── docs/                       # Dokumentacja
```

## 🛠️ Technologie

- **Backend**: Fastify, TypeScript, Node.js
- **Frontend**: Next.js 14, React, TailwindCSS
- **Database**: PostgreSQL + pgvector (Supabase)
- **AI**: OpenAI (GPT-4, embeddings)
- **Queue**: BullMQ + Redis
- **Scraping**: Cheerio, node-fetch

## 🔒 Bezpieczeństwo

- Autoryzacja przez Supabase OAuth (Google)
- API keys szyfrowane w bazie danych
- RLS (Row Level Security) w PostgreSQL
- Rate limiting na endpointach API
- Walidacja wszystkich inputów

## 📝 Licencja

Open Source - MIT License

## 🤝 Wsparcie

W razie problemów:

1. Sprawdź logi: `apps/api/logs/`
2. Zobacz dokumentację: `docs/`
3. Sprawdź migracje w Supabase Dashboard

---

**Status**: System gotowy do uruchomienia i testów ✅
