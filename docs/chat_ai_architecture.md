# Architektura Inteligentnego Asystenta Radnego

## Status: ❌ NIE AKTYWNY (Placeholder)

Aktualnie moduł czatu zawiera tylko UI z symulowanymi odpowiedziami.

## Cel Strategiczny

Stworzenie inteligentnego asystenta AI dla radnych, który:

- Zna prawo i przepisy lokalne
- Analizuje dokumenty i uchwały
- Śledzi sprawy gminy/miasta
- Pomaga w przygotowaniu wystąpień
- Zarządza kalendarzem spotkań

## Architektura Docelowa

### 1. System Promptów AI

**Persona AI - Asystent Radnego:**

```
Jesteś doświadczonym asystentem radnego z następującymi kompetencjami:

1. PRAWNIK SAMORZĄDOWY
   - Znawca ustaw o samorządzie gminnym/powiatowym/wojewódzkim
   - Ekspert prawa administracyjnego i budżetowego
   - Specjalista od procedur uchwałodawczych

2. ANALITYK DOKUMENTÓW
   - Analizujesz projekty uchwał i ich skutki
   - Identyfikujesz ryzyka prawne i finansowe
   - Porównujesz z wcześniejszymi decyzjami

3. DZIAŁACZ LOKALNY
   - Znasz specyfikę terenu: {NAZWA_GMINY}
   - Śledzisz bieżące sprawy i problemy mieszkańców
   - Pomagasz w komunikacji z wyborcami

4. ORGANIZATOR
   - Zarządzasz kalendarzem spotkań rady
   - Przypominasz o terminach i deadlinach
   - Pomagasz w przygotowaniu wystąpień
```

### 2. Źródła Danych

#### A. Dokumenty Użytkownika (RAG)

- Projekty uchwał
- Protokoły z posiedzeń
- Notatki i analizy
- Korespondencja

**Technologia:**

- Embeddings: OpenAI text-embedding-3-small
- Vector DB: Supabase pgvector
- Chunking: 500 tokenów z overlap 50

#### B. Strona Gminy/Miasta (Web Scraping)

**Źródła:**

- Biuletyn Informacji Publicznej (BIP)
- Strona urzędu gminy/miasta
- Kalendarz posiedzeń rady
- Ogłoszenia i komunikaty

**Dane do pobrania:**

- Nadchodzące posiedzenia rady
- Porządek obrad
- Projekty uchwał do głosowania
- Uchwały przyjęte
- Ogłoszenia urzędu

**Technologia:**

- Scraper: Cheerio/Puppeteer
- Częstotliwość: Codziennie o 6:00
- Cache: Redis (24h)

#### C. Baza Wiedzy Prawnej

- Ustawy o samorządzie
- Rozporządzenia
- Orzecznictwo NSA
- Interpretacje prawne

### 3. Funkcje AI

#### A. Odpowiedzi na Pytania (Q&A)

```typescript
interface ChatRequest {
  message: string;
  conversationId?: string;
  includeDocuments?: boolean;
  includeMunicipalData?: boolean;
}

interface ChatResponse {
  answer: string;
  citations: Citation[];
  relatedDocuments: Document[];
  suggestedActions: Action[];
}
```

#### B. Analiza Dokumentów

- Streszczenie projektu uchwały
- Identyfikacja ryzyk prawnych
- Analiza skutków finansowych
- Porównanie z podobnymi uchwałami

#### C. Monitoring Spraw Gminy

- Śledzenie nowych projektów uchwał
- Powiadomienia o ważnych terminach
- Alerty o kontrowersyjnych sprawach

#### D. Przygotowanie Wystąpień

- Generowanie argumentów za/przeciw
- Cytaty z przepisów prawnych
- Dane statystyczne i finansowe

### 4. Integracje

#### A. Google Calendar API

**Funkcje:**

- Synchronizacja terminów posiedzeń rady
- Przypomnienia o spotkaniach
- Dodawanie notatek do wydarzeń

**Implementacja:**

```typescript
interface CalendarEvent {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
}
```

#### B. Strona Gminy/Miasta

**Konfiguracja w profilu użytkownika:**

```typescript
interface MunicipalSettings {
  municipalityName: string; // "Gmina Drawno"
  municipalityType: "gmina" | "miasto" | "powiat";
  bipUrl: string; // URL do BIP
  councilPageUrl: string; // Strona rady
  scrapingEnabled: boolean;
  scrapingFrequency: "daily" | "weekly";
}
```

### 5. Baza Danych

#### Nowe Tabele:

**conversations** - Historia rozmów

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**messages** - Wiadomości w konwersacji

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  role TEXT CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**municipal_data** - Dane ze strony gminy

```sql
CREATE TABLE municipal_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  data_type TEXT, -- 'meeting', 'resolution', 'announcement'
  title TEXT,
  content TEXT,
  source_url TEXT,
  meeting_date TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);
```

**calendar_events** - Wydarzenia z kalendarza

```sql
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  google_event_id TEXT,
  title TEXT,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6. API Endpoints

#### Chat

```
POST /api/chat/message
POST /api/chat/conversation/new
GET  /api/chat/conversations
GET  /api/chat/conversation/:id
DELETE /api/chat/conversation/:id
```

#### Municipal Data

```
GET  /api/municipal/meetings
GET  /api/municipal/resolutions
GET  /api/municipal/announcements
POST /api/municipal/scrape (trigger manual scrape)
```

#### Calendar

```
GET  /api/calendar/events
POST /api/calendar/sync
POST /api/calendar/event
PUT  /api/calendar/event/:id
DELETE /api/calendar/event/:id
```

### 7. Worker Jobs

**Nowe zadania dla workera:**

- `scrape-municipal-data` - Scraping strony gminy
- `sync-calendar` - Synchronizacja z Google Calendar
- `generate-summary` - Generowanie podsumowań
- `check-deadlines` - Sprawdzanie terminów

### 8. Frontend

#### Nowe komponenty:

- `ChatInterface` - Główny interfejs czatu
- `CitationCard` - Karta z cytatem
- `MunicipalDataPanel` - Panel z danymi gminy
- `CalendarWidget` - Widget kalendarza
- `DocumentAnalysisView` - Widok analizy dokumentu

#### Nowe strony ustawień:

- `/settings/municipal` - Konfiguracja gminy
- `/settings/calendar` - Integracja z kalendarzem
- `/settings/ai` - Ustawienia AI (temperatura, model)

## Plan Implementacji

### Faza 1: Podstawy (Priorytet: WYSOKI)

1. ✅ Endpoint testowania OpenAI
2. ⏳ Backend chat endpoint z OpenAI
3. ⏳ Integracja z dokumentami użytkownika (RAG)
4. ⏳ System promptów dla AI
5. ⏳ Historia konwersacji

### Faza 2: Dane Gminy (Priorytet: WYSOKI)

1. ⏳ Ustawienia gminy w profilu
2. ⏳ Scraper strony gminy/BIP
3. ⏳ Worker job dla scrapingu
4. ⏳ Cache w Redis
5. ⏳ Panel danych gminy w UI

### Faza 3: Kalendarz (Priorytet: ŚREDNI)

1. ⏳ Google Calendar OAuth
2. ⏳ Synchronizacja wydarzeń
3. ⏳ Widget kalendarza
4. ⏳ Powiadomienia o terminach

### Faza 4: Zaawansowane (Priorytet: NISKI)

1. ⏳ Analiza sentymentu
2. ⏳ Generowanie raportów
3. ⏳ Eksport do PDF
4. ⏳ Integracja z email

## Metryki Sukcesu

- Czas odpowiedzi AI < 3s
- Dokładność cytatów > 95%
- Aktualność danych gminy < 24h
- Uptime > 99%
- Satysfakcja użytkowników > 4.5/5

## Bezpieczeństwo

- Wszystkie dane użytkownika szyfrowane
- API keys w zmiennych środowiskowych
- Rate limiting na endpointach
- Walidacja wszystkich inputów
- Audit log dla operacji wrażliwych

## Koszty

**Szacunkowe koszty miesięczne (1 użytkownik):**

- OpenAI API: ~$20-50
- Supabase: $0 (Free tier)
- Google Calendar API: $0 (Free)
- Hosting: ~$10-20

**Optymalizacja:**

- Cache odpowiedzi AI (Redis)
- Batch processing embeddings
- Kompresja promptów
- Używanie GPT-3.5 dla prostych zapytań
