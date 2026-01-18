# Integracja z API GUS (Bank Danych Lokalnych)

## Przegląd

Asystent Radnego został zintegrowany z **Bank Danych Lokalnych GUS** - największą w Polsce bazą danych statystycznych o gospodarce, społeczeństwie i środowisku.

## 🎯 Możliwości

- **Dane demograficzne** gmin i powiatów
- **Finanse publiczne** (budżety, dochody, wydatki)
- **Rynek pracy** (bezrobocie, zatrudnienie)
- **Edukacja** (szkoły, przedszkola)
- **Infrastruktura** (drogi, wodociągi, kanalizacja)
- **Środowisko** (odpady, energia)
- **Porównania** między gminami

## 📋 Konfiguracja

### 1. Uruchom migrację Supabase

```sql
-- Wykonaj w Supabase SQL Editor:
-- docs/supabase_migrations/025_add_gus_bdl_data_source.sql
```

Migracja automatycznie dodaje GUS BDL do źródeł danych dla wszystkich użytkowników.

### 2. Zarejestruj się w API GUS

1. Odwiedź: https://api.stat.gov.pl/Home/BdlApi
2. Kliknij "Rejestracja"
3. Podaj email - otrzymasz klucz API automatycznie

### 3. Zapisz klucz API w aplikacji

Każdy użytkownik powinien zapisać swój osobisty klucz API:

```bash
POST /api/gus/api-key
Authorization: Bearer {token}
x-user-id: {userId}

{
  "apiKey": "twoj-klucz-api"
}
```

**Klucz jest zapisywany w bazie danych** w tabeli `data_sources` w kolumnie `metadata`:

```json
{
  "apiKey": "klucz-uzytkownika",
  "apiKeyUpdatedAt": "2026-01-16T12:00:00.000Z",
  ...
}
```

### 4. (Opcjonalnie) Domyślny klucz globalny

Dodaj klucz do `.env` jako fallback gdy użytkownik nie ma własnego:

```env
GUS_API_KEY=domyslny-klucz-api
```

## 📡 Endpointy API

### GET /api/gus/units

Lista jednostek terytorialnych (województwa, powiaty, gminy).

**Query params:**

- `parentId` - ID jednostki nadrzędnej
- `level` - Poziom (0=Polska, 2=Województwa, 5=Powiaty, 6=Gminy)
- `year` - Rok

**Przykład:**

```bash
GET /api/gus/units?level=6
```

**Response:**

```json
{
  "units": [
    {
      "id": "020201",
      "name": "Drawno",
      "level": 6,
      "parentId": "0202"
    }
  ]
}
```

### GET /api/gus/gmina/search

Wyszukaj gminę po nazwie.

**Query params:**

- `name` - Nazwa gminy (fragment)

**Przykład:**

```bash
GET /api/gus/gmina/search?name=Drawno
```

### GET /api/gus/gmina/:id/stats

Kluczowe statystyki gminy.

**Params:**

- `id` - ID gminy z GUS
- `year` (query) - Rok (opcjonalnie)

**Przykład:**

```bash
GET /api/gus/gmina/020201/stats?year=2023
```

**Response:**

```json
{
  "stats": {
    "unitId": "020201",
    "unitName": "Drawno",
    "level": 6,
    "variables": [
      {
        "id": "60559",
        "name": "Ludność",
        "value": 8234,
        "year": 2023,
        "unit": "osoba"
      },
      {
        "id": "72305",
        "name": "Dochody budżetu gminy",
        "value": 45230000,
        "year": 2023,
        "unit": "zł"
      }
    ]
  }
}
```

### GET /api/gus/variables

Lista dostępnych zmiennych (wskaźników).

**Query params:**

- `subjectId` - ID tematu
- `year` - Rok
- `level` - Poziom jednostek

**Przykład:**

```bash
GET /api/gus/variables?level=6
```

### GET /api/gus/subjects

Hierarchia tematów statystycznych.

**Query params:**

- `parentId` - ID tematu nadrzędnego

**Przykład:**

```bash
GET /api/gus/subjects
```

### POST /api/gus/compare

Porównaj wskaźniki wielu gmin.

**Body:**

```json
{
  "gminaIds": ["020201", "020202", "020203"],
  "variableIds": ["60559", "72305"],
  "year": 2023
}
```

**Response:**

```json
{
  "variables": [
    {
      "id": "60559",
      "n1": "Ludność",
      "measureUnitName": "osoba"
    }
  ],
  "data": {
    "020201": [{ "variableId": 60559, "val": 8234, "year": 2023 }],
    "020202": [{ "variableId": 60559, "val": 5421, "year": 2023 }]
  }
}
```

### DELETE /api/gus/cache

Wyczyść cache GUS API (24h TTL).

```bash
DELETE /api/gus/cache
```

## 🔧 Użycie w kodzie

### Backend (routes automatycznie używają klucza użytkownika)

Wszystkie endpointy GUS automatycznie pobierają klucz API użytkownika z bazy danych:

```typescript
// apps/api/src/routes/gus.ts

// Funkcja pomocnicza pobiera klucz z data_sources.metadata
async function getUserGUSApiKey(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("data_sources")
    .select("metadata")
    .eq("user_id", userId)
    .eq("type", "statistics")
    .eq("name", "GUS - Bank Danych Lokalnych")
    .single();

  const metadata = data?.metadata as { apiKey?: string };
  return metadata?.apiKey || process.env.GUS_API_KEY || null;
}

// W każdym endpoincie:
const apiKey = await getUserGUSApiKey(userId);
const gusService = new GUSApiService(apiKey || undefined);
const stats = await gusService.getGminaStats(gminaId, year);
```

### Własna instancja serwisu

```typescript
import { GUSApiService } from "@/services/gus-api-service";

// Utwórz instancję z kluczem użytkownika
const userApiKey = await getUserGUSApiKey(userId);
const gusService = new GUSApiService(userApiKey);

// Znajdź gminę
const gmina = await gusService.findGmina("Drawno");

// Pobierz statystyki
const stats = await gusService.getGminaStats(gmina.id, 2023);
```

### Frontend (przykład)

```typescript
// Pobierz dane gminy
const response = await fetch("/api/gus/gmina/020201/stats?year=2023", {
  headers: {
    Authorization: `Bearer ${token}`,
    "x-user-id": userId,
  },
});

const { stats } = await response.json();
```

## 📊 Poziomy terytorialne

| Poziom | Jednostka    |
| ------ | ------------ |
| 0      | Polska       |
| 1      | Makroregiony |
| 2      | Województwa  |
| 3      | Regiony      |
| 4      | Podregiony   |
| 5      | Powiaty      |
| 6      | Gminy        |
| 7      | Miejscowości |

## 🚀 Plany rozwoju

### Faza 1 (Obecna) ✅

- [x] Podstawowa integracja API
- [x] Pobieranie jednostek i zmiennych
- [x] Statystyki gmin
- [x] Porównania

### Faza 2 (Planowana)

- [ ] Widget na dashboard ze statystykami gminy
- [ ] Wykresy trendów czasowych
- [ ] Automatyczne raporty porównawcze
- [ ] Integracja z AI (kontekst GUS dla czatu)

### Faza 3 (Przyszłość)

- [ ] API SMUP (jakość usług publicznych)
- [ ] API TERYT (weryfikacja adresów)
- [ ] Eksport danych do Excel/PDF
- [ ] Alerty o zmianach wskaźników

## 🔗 Linki

- **API GUS Portal**: https://api.stat.gov.pl
- **Dokumentacja BDL**: https://api.stat.gov.pl/Home/BdlApi
- **Aplikacja BDL**: https://bdl.stat.gov.pl
- **Rejestracja klucza**: https://api.stat.gov.pl/Home/BdlApi (sekcja "Rejestracja")

## ⚠️ Uwagi

1. **Rate Limits**:

   - Bez klucza: Ograniczone
   - Z kluczem: 500 req/15min, 5000/12h, 50000/7d

2. **Cache**:

   - Dane cachowane przez 24h
   - Wyczyść cache po aktualizacji GUS

3. **Bezpłatne**:

   - Wszystkie API GUS są darmowe
   - Wymagana tylko rejestracja dla zwiększonych limitów

4. **Dostępność**:
   - Dane aktualizowane regularnie przez GUS
   - Niektóre wskaźniki z opóźnieniem (rok, kwartał)
