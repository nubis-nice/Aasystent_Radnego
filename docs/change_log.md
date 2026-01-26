# Change Log

## 2026-01-26 — Naprawa pipeline generowania treści narzędzi

### Problem

Backend nie używał specjalistycznych promptów z `ToolPromptService` dla żądań narzędzi. Frontend wysyłał prompt z `[NARZĘDZIE: ...]` ale backend używał standardowego systemu promptu.

### Rozwiązanie

1. Dodano `toolType` do `ChatRequestSchema` w pakiecie shared
2. Frontend przekazuje `toolType` w żądaniu `sendMessage` przy generowaniu treści
3. Backend wykrywa `toolType` i używa specjalistycznego promptu z `ToolPromptService`

### Zmienione pliki

- `packages/shared/src/types/chat.ts` - nowe pole `toolType` w schemacie
- `apps/api/src/routes/chat.ts` - import i użycie `ToolPromptService`
- `apps/frontend/src/lib/api/chat.ts` - pole `toolType` w interfejsie
- `apps/frontend/src/app/chat/page.tsx` - przekazywanie `toolType` w onGenerate

### Efekt

Narzędzia (speech, interpelation, letter, protocol, budget, application, resolution, report, script) teraz używają dedykowanych promptów i formatów wyjściowych.

---

## 2026-01-26 — Nowe narzędzie: Generator Scenopisów

### Nowa funkcja

Dodano narzędzie **"Generator scenopisów na rolkę"** do tworzenia scenariuszy na TikTok, YouTube Shorts i Instagram Reels.

### Zmiany techniczne

- `apps/api/src/services/voice-action-service.ts` - aliasy: scenopis, scenariusz, rolka, tiktok, reels
- `apps/api/src/services/tool-prompt-service.ts` - prompt z strukturą Hook → Treść → CTA → Hashtagi
- `apps/frontend/src/config/tools-config.ts` - formularz z polami: platforma, temat, długość, styl
- `apps/frontend/src/components/dashboard/QuickToolsWidget.tsx` - kafelek w szybkich narzędziach

### Naprawa duplikatów narzędzi

Lista dostępnych narzędzi teraz używa `Map` po ścieżce, eliminując duplikaty aliasów (Wystąpienie x4 → x1).

---

## 2026-01-26 — Poprawa wykrywania intencji AI

### Problem

System błędnie rozpoznawał pytania o "posiedzenie komisji" jako chęć wygenerowania protokołu (`quick_tool`) zamiast wyszukania dokumentów (`rag_search`/`document_search`).

### Rozwiązanie

Zaktualizowano prompty wykrywania intencji w:

- `apps/api/src/services/voice-action-service.ts`
- `apps/api/src/services/ai-tool-orchestrator.ts`

**Nowe reguły:**

- `quick_tool` → WYMAGA słów akcji: "utwórz", "napisz", "generuj", "przygotuj", "stwórz"
- Pytania o "posiedzenie", "komisja", "committee" BEZ słów akcji → `rag_search` lub `document_search`

**Przykłady:**

- "posiedzenie komisji budżetowej" → `document_search` (szuka dokumentów)
- "generuj protokół z sesji" → `quick_tool` (tworzy nowy dokument)

---

## 2026-01-26 — Wyświetlanie transkrypcji w DocumentCard i DocumentDetailPage

### Nowe funkcje

- Dokumenty sesji wyświetlają teraz informację o powiązanej transkrypcji z YouTube
- Karta "🎬 Transkrypcja sesji" w szczegółach dokumentu (czerwono-pomarańczowa)
- Wskaźnik "Transkrypcja" na liście dokumentów

### Zmiany techniczne

- `GET /documents/:id` - sprawdzanie powiązanej transkrypcji przez `document_relations` i `session_number`
- `GET /documents` - batch query dla transkrypcji i mapowanie do dokumentów
- Frontend: nowa karta w `DocumentDetailPage`, wskaźnik w `DocumentCard`

---

## 2026-01-26 — Zarządzanie kalendarzem przez AI (Stefan)

### Nowe funkcje

**Stefan AI może teraz zarządzać spotkaniami w kalendarzu:**

- **calendar_edit** — zmiana terminu, godziny, miejsca wydarzenia
- **calendar_delete** — usuwanie wydarzeń z kalendarza

### Obsługiwane polecenia głosowe

```
"Przesuń spotkanie z burmistrzem na piątek"
"Zmień termin sesji na 15:00"
"Usuń wydarzenie komisji budżetowej"
"Odwołaj spotkanie z dnia 28 stycznia"
```

### Zmiany techniczne

**`apps/api/src/services/voice-action-service.ts`:**

- Dodano `handleCalendarEdit()` - edycja wydarzeń (termin, godzina, miejsce)
- Dodano `handleCalendarDelete()` - usuwanie wydarzeń
- Rozszerzono switch w `executeAction()` o case'y `calendar_edit` i `calendar_delete`

**Logika wyszukiwania wydarzeń:**

- Wyszukiwanie po tytule (ILIKE) lub ID
- Zawężanie po dacie (dla delete)
- Gdy znaleziono >1 wydarzenie → prośba o uściślenie
- Po operacji → `uiAction: refresh` dla odświeżenia CalendarWidget

### Auto-refresh widgetów (wcześniej dziś)

| Widget         | Polling | Zdarzenia                               |
| -------------- | ------- | --------------------------------------- |
| CalendarWidget | 60s     | `calendar-refresh`, `dashboard-refresh` |
| TasksWidget    | 30s     | `tasks-refresh`, `dashboard-refresh`    |
| AlertsWidget   | 30s     | `alerts-refresh`, `dashboard-refresh`   |

---

## 2026-01-26 — Pełna migracja na Supabase Self-hosted

### Analiza struktury lokalnego Supabase

Przeprowadzono pełną analizę i dostosowanie aplikacji do lokalnego Supabase:

**Baza danych:**

- 39 tabel w schemacie `public`
- 8 ról (anon, authenticated, service_role, supabase_admin, etc.)
- 6 rozszerzeń (pgvector, pg_trgm, pgcrypto, pgjwt, uuid-ossp, plpgsql)
- 15+ funkcji RPC (search_processed_documents, match_documents, hybrid_search, etc.)

**Kontenery Docker:**

- aasystent-postgres (5433), aasystent-auth (9999), aasystent-kong (54321)
- aasystent-rest (3333), aasystent-realtime (4000), aasystent-storage (5000)
- aasystent-studio (54323), aasystent-redis (6379), aasystent-whisper (8000)

### Naprawione problemy

**1. Błąd 431 (Request Header Fields Too Large) na WebSocket:**

- Przyczyna: Kong miał za małe bufory dla nagłówków WebSocket
- Rozwiązanie: Zwiększono bufory w `infra/docker-compose.supabase.yml`:
  ```yaml
  KONG_NGINX_PROXY_LARGE_CLIENT_HEADER_BUFFERS: 4 64k
  KONG_NGINX_HTTP_LARGE_CLIENT_HEADER_BUFFERS: 4 64k
  ```

**2. Błąd 400 na upsert user_ai_settings:**

- Przyczyna: Brakująca kolumna `max_tokens` w tabeli
- Rozwiązanie: `ALTER TABLE user_ai_settings ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 2048;`

**3. Błąd `Error saving AI settings: {}`:**

- Przyczyna: Tabela `user_ai_settings` nie istniała
- Rozwiązanie: Migracja `027_create_user_ai_settings.sql`

### Konfiguracja środowiskowa

**apps/api/.env.local:**

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJ...Su1Q
SUPABASE_SERVICE_ROLE_KEY=eyJ...ba8
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres
REDIS_URL=redis://localhost:6379
```

**apps/frontend/.env.local:**

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...Su1Q
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Nowa dokumentacja

- `docs/architecture.md` - pełna dokumentacja architektury systemu

---

## 2026-01-26 — Supabase Self-hosted DZIAŁA

### Status usług

| Usługa                | Port  | Status     |
| --------------------- | ----- | ---------- |
| PostgreSQL + pgvector | 5433  | ✅ healthy |
| Auth (GoTrue)         | 9999  | ✅ healthy |
| Kong API Gateway      | 54321 | ✅ healthy |
| Storage               | 5000  | ✅ running |
| Studio Dashboard      | 54323 | ✅ running |
| Redis                 | 6379  | ✅ running |
| PostgREST             | 3333  | ✅ running |

### Migracje

- 37 tabel utworzonych w schemacie `public`
- Schemat `auth` zarządzany przez GoTrue
- Schemat `storage` zarządzany przez Storage API

### Kluczowe naprawy

1. **Auth schema ownership** — GoTrue wymaga bycia właścicielem schematu auth
2. **Storage permissions** — GRANT ALL ON DATABASE postgres TO supabase_storage_admin
3. **pgvector w public** — CREATE EXTENSION vector SCHEMA public

---

## 2026-01-25 — Migracja do Supabase Self-hosted

### Infrastruktura lokalna

Przygotowano pełną konfigurację Supabase Self-hosted:

**Nowe pliki:**

- `infra/docker-compose.supabase.yml` — pełny stack Supabase
- `infra/kong.yml` — konfiguracja API Gateway
- `infra/.env.local.example` — zmienne środowiskowe
- `infra/init/00-init-supabase.sql` — inicjalizacja ról/schematów
- `infra/scripts/run-migrations.sh` — skrypt Linux
- `infra/scripts/run-migrations.ps1` — skrypt Windows
- `infra/README.md` — dokumentacja

**Komponenty:**

- PostgreSQL 15 + pgvector (Supabase image)
- GoTrue (Auth)
- PostgREST (REST API)
- Realtime (WebSockets)
- Storage (pliki)
- Kong (API Gateway)
- Studio (Dashboard)

**Porty:**

- 54321 — Supabase API
- 54323 — Studio Dashboard
- 5433 — PostgreSQL
- 6379 — Redis

---

## 2026-01-25 — Kompletna implementacja TODO

### Zrealizowane zadania

Ukończono wszystkie 6 zadań z listy TODO:

1. **Adaptery NSA/WSA + RIO** — źródła danych prawnych
2. **Testy E2E czatu** — 39 testów Playwright
3. **ePUAP live sync** — integracja ze skrzynką podawczą
4. **Raporty cykliczne** — harmonogramy dzienne/tygodniowe/miesięczne
5. **Linkowanie uchwał** — relacje zmienia/uchyla/wykonuje
6. **Monitoring traceId** — śledzenie requestów

### Nowe pliki

```
apps/api/src/services/
├── nsa-api-service.ts        # Orzeczenia sądów administracyjnych
├── rio-api-service.ts        # Decyzje RIO
├── epuap-service.ts          # Integracja ePUAP
├── scheduled-reports-service.ts  # Raporty cykliczne

apps/api/src/routes/
├── nsa.ts, rio.ts, epuap.ts, reports.ts

apps/api/src/middleware/
├── trace-id.ts               # TraceId middleware

apps/api/migrations/
├── 043_create_epuap_schema.sql
├── 044_create_reports_schema.sql

apps/frontend/src/lib/api/
├── nsa.ts, rio.ts, epuap.ts, reports.ts

e2e/tests/
├── chat-with-documents.spec.ts  # 21 nowych testów
```

### Rozszerzone funkcje

- **document-graph-service.ts** — dodano wykrywanie relacji prawnych (amends/supersedes/implements)
- **index.ts** — zarejestrowano traceId middleware

---

## 2026-01-25 — Adaptery NSA/WSA i RIO

### Nowe źródła danych

Implementacja adapterów dla sądów administracyjnych i Regionalnych Izb Obrachunkowych:

#### NSA/WSA (Centralna Baza Orzeczeń Sądów Administracyjnych)

- `apps/api/src/services/nsa-api-service.ts` — scraping CBOSA
- `apps/api/src/routes/nsa.ts` — endpointy API
- `apps/frontend/src/lib/api/nsa.ts` — klient frontend
- Wyszukiwanie orzeczeń po: słowach kluczowych, sygnaturze, sądzie, dacie, symbolu sprawy
- Lista 16 sądów WSA + NSA

#### RIO (Regionalne Izby Obrachunkowe)

- `apps/api/src/services/rio-api-service.ts` — scraping BIP RIO
- `apps/api/src/routes/rio.ts` — endpointy API
- `apps/frontend/src/lib/api/rio.ts` — klient frontend
- 16 izb regionalnych z konfiguracją URL
- Typy decyzji: uchwały, rozstrzygnięcia nadzorcze, opinie, stanowiska

### Endpointy API

```
GET /api/nsa/courts
GET /api/nsa/case-symbols
GET /api/nsa/judgments/search
GET /api/nsa/judgments/:id
GET /api/nsa/judgments/local-government
GET /api/nsa/judgments/signature/:signature

GET /api/rio/chambers
GET /api/rio/decision-types
GET /api/rio/decisions/search
GET /api/rio/decisions/:id
GET /api/rio/decisions/municipality
GET /api/rio/decisions/budget
```

---

## 2026-01-25 — Testy jednostkowe ai-client-factory i document-processor

### Nowe testy

Dodano brakujące testy jednostkowe zgodnie z TODO:

#### ai-client-factory (12 testów)

- `apps/api/src/ai/__tests__/ai-client-factory.test.ts`
- Testy konfiguracji, cache, różnych typów klientów (LLM, Embeddings, Vision, STT, TTS)
- Mock AIConfigResolver dla izolacji od Supabase

#### document-processor (28 testów)

- `apps/api/src/services/__tests__/document-processor.test.ts`
- Testy interfejsów, typów MIME, opcji OCR, metod przetwarzania

### Statystyki testów

```
Unit Tests:    77 testów (6 plików)
E2E Tests:     18 testów (3 pliki)
Total:         95 testów
```

---

## 2026-01-25 — BullMQ Analysis Queue

### Nowe funkcjonalności

Implementacja kolejki BullMQ dla asynchronicznej analizy dokumentów:

- `apps/api/src/services/analysis-queue.ts` — kolejka z event handlers
- `apps/worker/src/jobs/analysis.ts` — worker z dynamicznymi importami
- Endpoint `/documents/:id/analyze` używa kolejki zamiast bezpośredniego wywołania
- Postęp widoczny w Dashboard (widget "Przetwarzanie danych")

---

## 2026-01-25 — Pipeline CI/CD

### Nowe funkcjonalności

Kompletny pipeline CI/CD z testami jednostkowymi, integracyjnymi i E2E.

#### Testy (17 łącznie)

- **Unit Tests (7)**: `deep-research-service.test.ts` (Vitest)
- **Integration Tests (6)**: `api-health.test.ts` (Fastify)
- **E2E Tests (4)**: `login.spec.ts` (Playwright)

#### GitHub Actions

- **`.github/workflows/ci.yml`**: lint, typecheck, build, test, e2e, security
- **`.github/workflows/deploy.yml`**: deploy do Vercel (staging/production)

#### Konfiguracja

- `apps/api/vitest.config.ts` — konfiguracja Vitest
- `e2e/playwright.config.ts` — konfiguracja Playwright
- `apps/frontend/vercel.json` — konfiguracja Vercel

#### Komendy

```bash
npm run typecheck   # TypeScript validation
npm run build       # Kompilacja wszystkich pakietów
npm run test        # Unit + Integration tests (37)
npm run test:e2e    # Playwright E2E tests (18)
```

#### Nowe pliki dokumentacji

- `docs/api/openapi.yaml` — OpenAPI 3.1 specyfikacja API
- `docs/todo.md` — lista zadań do wykonania

---

## 2026-01-25 — Asynchroniczna analiza dokumentów (naprawa timeout)

### Problem

Analiza dokumentów z OCR powodowała timeout (`socket hang up`) gdy przetwarzanie trwało zbyt długo.

### Rozwiązanie

Zmieniono endpoint `/documents/:id/analyze` na asynchroniczny:

1. **Backend natychmiast zwraca** `{ async: true, taskId, message }`
2. **Przetwarzanie kontynuuje się w tle** (funkcja `processAnalysisAsync`)
3. **Postęp zapisywany w** `background_tasks` (20% → 70% → 100%)
4. **Wyniki zapisywane w** `background_tasks.metadata.result`

### Zmiany

- **`apps/api/src/routes/documents.ts`**: Asynchroniczny endpoint + funkcja `processAnalysisAsync`
- **`apps/frontend/src/app/documents/page.tsx`**: Obsługa asynchronicznej odpowiedzi, przekierowanie do Dashboard

### Użycie

1. Kliknij "Analizuj" na dokumencie
2. Zostaniesz przekierowany do Dashboard
3. Obserwuj postęp w widgecie "Przetwarzanie danych"
4. Po zakończeniu kliknij zadanie aby otworzyć analizę

---

## 2026-01-25 — Śledzenie analizy dokumentów na Dashboard

### Nowe funkcjonalności

Analiza dokumentu (przycisk "Analizuj" w DocumentCard) jest teraz widoczna w widgecie "Przetwarzanie danych i alarmy" na Dashboard.

#### Backend

- **`apps/api/src/routes/documents.ts`** — endpoint `/documents/:id/analyze`:
  - Tworzy wpis w tabeli `background_tasks` na początku analizy
  - Aktualizuje postęp podczas budowania kontekstu RAG
  - Oznacza zadanie jako "completed" po zakończeniu
  - Obsługuje błędy i oznacza zadanie jako "failed"

#### Jak działa

1. Użytkownik klika "Analizuj" na dokumencie
2. Na Dashboard pojawia się wpis "Analiza dokumentu" ze statusem "W toku"
3. Po zakończeniu status zmienia się na "Zakończone"

---

## 2026-01-25 — AI Auto-wypełnianie formularzy narzędzi

### Nowe funkcjonalności

AI może automatycznie wypełniać formularze narzędzi danymi z kontekstu rozmowy.

#### Backend

- **`apps/api/src/services/voice-action-service.ts`**:
  - Ekstrakcja `toolTopic`, `toolContext`, `toolRecipient` z polecenia głosowego
  - Nowa akcja UI `open_tool_with_data` z danymi formularza

#### Frontend

- **`apps/frontend/src/hooks/useToolMode.ts`**:
  - Nowa funkcja `activateToolWithData()` do aktywacji narzędzia z danymi

- **`apps/frontend/src/app/chat/page.tsx`**:
  - Obsługa akcji `open_tool_with_data` z odpowiedzi API

#### Przykład użycia

```
Użytkownik: "Przygotuj interpelację w sprawie remontu ul. Głównej"
→ Otwiera się modal z wypełnionym polem "Temat: remont ul. Głównej"
```

---

## 2026-01-25 — System narzędzi ChatAI (Quick Tools)

### Nowe funkcjonalności

Dodano uniwersalny system narzędzi do generowania dokumentów w czacie AI.

#### Frontend

- **`apps/frontend/src/config/tools-config.ts`** — konfiguracja 8 typów narzędzi:
  - `speech` — Plan wystąpienia na sesji
  - `interpelation` — Kreator interpelacji radnego
  - `letter` — Generator pism urzędowych
  - `protocol` — Generator protokołów z posiedzeń
  - `budget` — Analiza budżetu gminy
  - `application` — Kreator wniosków formalnych
  - `resolution` — Generator projektów uchwał
  - `report` — Szablony raportów i sprawozdań

- **`apps/frontend/src/hooks/useToolMode.ts`** — hook do zarządzania stanem narzędzia

- **`apps/frontend/src/components/chat/tools/ToolPanel.tsx`** — uniwersalny modal narzędzia:
  - Dynamiczny formularz na podstawie konfiguracji
  - Formatowanie Markdown (ReactMarkdown + remarkGfm)
  - Pre-processing HTML tags (`<br>` → `\n`)
  - Eksport do PDF/DOCX
  - 80% szerokości z możliwością resize
  - Zamykanie przez Escape lub kliknięcie tła

- **`apps/frontend/src/app/chat/page.tsx`** — integracja:
  - Obsługa parametru `?tool=` z URL
  - Obsługa `uiActions.navigate` z odpowiedzi API

#### Backend

- **`apps/api/src/services/tool-prompt-service.ts`** — dedykowane prompty systemowe dla każdego typu narzędzia

### Sposób użycia

1. **URL**: `http://localhost:3000/chat?tool=speech`
2. **Czat**: "Przygotuj wystąpienie o budżecie" → AI aktywuje narzędzie
3. **Głos**: "Stefan, utwórz interpelację w sprawie dróg"

### Poprawki

- Naprawiono błąd nieskończonej pętli w useEffect (toolMode)
- Naprawiono błąd CORS (zakomentowano `NEXT_PUBLIC_API_URL` w `.env.local`)
- Naprawiono formatowanie HTML tags w wygenerowanej treści
