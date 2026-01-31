# Architektura AAsystent Radnego

## Przegląd

Aplikacja składa się z trzech głównych komponentów:

1. **Frontend** - Next.js 16.x (apps/frontend)
2. **Backend API** - Fastify (apps/api)
3. **Supabase Self-hosted** - PostgreSQL + Auth + Storage + Realtime (infra/)

---

## Infrastruktura Supabase Self-hosted

### Kontenery Docker

| Kontener           | Obraz                          | Port  | Funkcja               |
| ------------------ | ------------------------------ | ----- | --------------------- |
| aasystent-postgres | supabase/postgres:15.1.1.61    | 5433  | PostgreSQL + pgvector |
| aasystent-auth     | supabase/gotrue:v2.143.0       | 9999  | Auth (GoTrue)         |
| aasystent-kong     | kong:2.8.1                     | 54321 | API Gateway           |
| aasystent-rest     | postgrest/postgrest:v12.0.1    | 3333  | REST API              |
| aasystent-realtime | supabase/realtime:v2.25.50     | 4000  | WebSocket             |
| aasystent-storage  | supabase/storage-api:v0.46.4   | 5000  | Storage API           |
| aasystent-studio   | supabase/studio                | 54323 | Dashboard             |
| aasystent-meta     | supabase/postgres-meta:v0.75.0 | 8080  | DB metadata           |
| aasystent-imgproxy | darthsim/imgproxy:v3.18        | 5001  | Image proxy           |
| aasystent-redis    | redis:7-alpine                 | 6379  | Cache/Queue           |
| aasystent-whisper  | speaches/speaches              | 8000  | STT/TTS               |

### Role bazodanowe

```
supabase_admin, supabase_storage_admin, supabase_auth_admin
supabase_realtime_admin, authenticator
anon, authenticated, service_role
```

### Rozszerzenia PostgreSQL

- `pgvector` v0.7.0 - wektory dla RAG
- `pg_trgm` - wyszukiwanie tekstowe
- `pgcrypto` - kryptografia
- `pgjwt` - JWT
- `uuid-ossp` - UUID

---

## Baza danych

### Tabele (39 tabel w schemacie public)

#### Dokumenty i RAG

- `documents` - główna tabela dokumentów
- `processed_documents` - przetworzone dokumenty z embeddingami
- `chunks` - fragmenty do RAG
- `document_relations` - relacje między dokumentami
- `document_clusters`, `document_cluster_members` - klastry

#### Użytkownicy

- `user_profiles` - profile użytkowników
- `user_ai_settings` - ustawienia asystenta AI
- `user_appearance_settings` - wygląd
- `user_locale_settings` - lokalizacja
- `user_notification_settings` - powiadomienia
- `user_privacy_settings` - prywatność
- `user_document_preferences` - preferencje dokumentów

#### Czat i AI

- `conversations` - konwersacje
- `messages` - wiadomości
- `research_reports` - raporty deep research

#### Źródła danych

- `data_sources` - źródła (RSS, API, scraping)
- `scraped_content` - zescrapowana treść
- `scraping_logs` - logi scrapingu

#### Zadania i powiadomienia

- `background_tasks` - zadania w tle
- `notifications` - powiadomienia
- `gis_notifications` - GIS
- `calendar_events`, `user_calendar_events` - kalendarz
- `user_tasks` - zadania użytkownika

#### Konfiguracja

- `api_configurations` - konfiguracje AI
- `provider_capabilities` - możliwości providerów

### Funkcje RPC (niestandardowe)

- `search_processed_documents` - wyszukiwanie semantyczne
- `match_documents`, `match_documents_filtered` - dopasowanie dokumentów
- `search_chunks` - wyszukiwanie chunków
- `hybrid_search` - wyszukiwanie hybrydowe
- `search_municipal_data` - dane gminne
- `detect_document_references` - wykrywanie referencji
- `initialize_user_settings` - inicjalizacja ustawień

---

## Konfiguracja środowiskowa

### Backend (apps/api/.env.local)

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJ...Su1Q
SUPABASE_SERVICE_ROLE_KEY=eyJ...ba8
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres
REDIS_URL=redis://localhost:6379
API_PORT=3001
WHISPER_API_URL=http://localhost:8000
```

### Frontend (apps/frontend/.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...Su1Q
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Architektura kodu

### Backend API (apps/api/src/)

```
├── index.ts              # Entry point Fastify
├── lib/
│   └── supabase.ts       # Klient Supabase (service_role)
├── middleware/
│   ├── auth.ts           # Weryfikacja JWT
│   └── trace-id.ts       # Śledzenie requestów
├── routes/
│   ├── auth.ts           # Logowanie/rejestracja
│   ├── documents.ts      # CRUD dokumentów
│   ├── chat.ts           # Chat AI
│   ├── dashboard.ts      # Statystyki
│   └── ...               # 25+ routerów
├── services/
│   ├── document-processor.ts    # Przetwarzanie dokumentów
│   ├── document-analysis-service.ts # Analiza AI
│   ├── intelligent-rag-search.ts    # Wyszukiwanie RAG
│   ├── deep-research-service.ts     # Deep research
│   └── ...               # 30+ serwisów
└── ai/
    ├── ai-client-factory.ts   # Fabryka klientów AI
    └── ai-config-resolver.ts  # Resolver konfiguracji
```

### Frontend (apps/frontend/src/)

```
├── app/                  # Next.js App Router
│   ├── dashboard/        # Dashboard
│   ├── documents/        # Lista i szczegóły dokumentów
│   ├── chat/             # Chat AI
│   ├── settings/         # Ustawienia
│   └── ...
├── components/           # Komponenty React
├── lib/
│   ├── supabase/
│   │   ├── client.ts     # Klient przeglądarki
│   │   └── auth.ts       # Helpers auth
│   └── api/              # Klienty API
└── hooks/                # Custom hooks
```

---

## Przepływ danych

### Autentykacja

```
Frontend → Supabase Auth (Kong:54321/auth/v1)
        → GoTrue → JWT
        → Backend weryfikuje JWT przez Supabase
```

### Zapytania do bazy

```
Frontend → Kong (54321) → PostgREST (3333) → PostgreSQL
                       ↓
Backend  → Supabase Client (service_role) → PostgreSQL
```

### Realtime (WebSocket)

```
Frontend → Kong (54321/realtime/v1) → Realtime (4000) → PostgreSQL
```

---

## Migracje

Lokalizacja: `apps/api/migrations/`

Uruchamianie:

```powershell
Get-Content "apps/api/migrations/XXX.sql" | docker exec -i aasystent-postgres psql -U postgres -d postgres
```

---

## Znane problemy i rozwiązania

### Błąd 431 (Request Header Fields Too Large)

**Problem:** WebSocket Realtime przez Kong zwraca 431 gdy nagłówki są za duże (cookies).

**Rozwiązanie:** Zwiększono bufory w Kong:

```yaml
KONG_NGINX_PROXY_LARGE_CLIENT_HEADER_BUFFERS: 4 64k
KONG_NGINX_HTTP_LARGE_CLIENT_HEADER_BUFFERS: 4 64k
```

### Błąd upsert user_ai_settings

**Problem:** Brakująca kolumna `max_tokens`.

**Rozwiązanie:** `ALTER TABLE user_ai_settings ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 2048;`

---

## Integracje zewnętrzne

### GUS BDL API

**Base URL:** `https://bdl.stat.gov.pl/api/v1`

| Endpoint                    | Opis                          |
| --------------------------- | ----------------------------- |
| `/units/search`             | Wyszukiwanie jednostek (gmin) |
| `/data/by-variable/{varId}` | Dane statystyczne per zmienna |

**Kluczowe ID zmiennych:**

- `60` — Urodzenia żywe
- `65` — Zgony ogółem
- `68` — Przyrost naturalny
- `450540` — Urodzenia na 1000 ludności

### Geoportal.gov.pl

| Usługa         | URL                                                          | Status                     |
| -------------- | ------------------------------------------------------------ | -------------------------- |
| PRG WFS        | `mapy.geoportal.gov.pl/.../PRG/WFS/AdministrativeBoundaries` | ✅ działa                  |
| ULDK           | `uldk.gugik.gov.pl`                                          | ✅ działa                  |
| BDOT10k        | `mapy.geoportal.gov.pl/.../BDOT10k/WFS/...`                  | ✅ działa                  |
| GUGIK geocoder | `services.gugik.gov.pl/uug/`                                 | ⚠️ niestabilny (wyłączony) |

**ULDK parametry:**

- `GetParcelByXY` — działka po współrzędnych (dodaj `,4326` dla WGS84)
- `GetParcelById` — działka po ID TERYT (np. `141201_1.0001.6509`)

---

## Aktualizacja: 2026-01-27
