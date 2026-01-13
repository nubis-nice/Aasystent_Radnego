# Architektura Źródeł Danych dla Asystenta Radnego

## 1. Przegląd

System umożliwia Asystentowi AI pobieranie i analizę danych z różnych źródeł internetowych:

- Strony gminy (www.drawno.pl)
- Biuletyn Informacji Publicznej (BIP)
- Portale prawne (Lexlege, Isap, Sejm)
- Serwisy dla radnych
- Aktualne dane samorządowe

## 2. Typy Źródeł Danych

### 2.1 Strona Gminy

**Cel:** Aktualności, ogłoszenia, wydarzenia lokalne

**Źródła:**

- Strona główna gminy
- Sekcja aktualności
- Projekty i inwestycje
- Dla mieszkańca

**Częstotliwość:** Codziennie

### 2.2 Biuletyn Informacji Publicznej (BIP)

**Cel:** Uchwały, protokoły, budżet, przetargi

**Źródła:**

- Uchwały Rady Gminy
- Protokoły z sesji
- Dokumenty budżetowe
- Ogłoszenia i przetargi
- Zarządzenia Wójta

**Częstotliwość:** Codziennie

### 2.3 Portale Prawne

**Cel:** Aktualne przepisy prawne, orzecznictwo

**Źródła:**

- **Lexlege** (lexlege.pl) - baza aktów prawnych
- **ISAP** (isap.sejm.gov.pl) - Internetowy System Aktów Prawnych
- **Sejm.gov.pl** - projekty ustaw, druki sejmowe
- **Monitor Polski** - akty wykonawcze

**Częstotliwość:** Tygodniowo

### 2.4 Serwisy dla Radnych

**Cel:** Szkolenia, porady, narzędzia dla radnych

**Źródła:**

- Portal Samorządowy (portalsamorzadowy.pl)
- Związek Gmin Wiejskich RP
- Fundacja Rozwoju Demokracji Lokalnej
- Szkolenia i webinary

**Częstotliwość:** Tygodniowo

### 2.5 Dane Statystyczne

**Cel:** Dane demograficzne, ekonomiczne, społeczne

**Źródła:**

- GUS (stat.gov.pl) - Bank Danych Lokalnych
- Ministerstwo Finansów - dane budżetowe JST
- Eurostat - dane porównawcze

**Częstotliwość:** Miesięcznie

## 3. Architektura Techniczna

### 3.1 Komponenty Systemu

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Ustawienia > Źródła Danych                        │ │
│  │  - Konfiguracja źródeł                             │ │
│  │  - Harmonogram scrapingu                           │ │
│  │  - Podgląd pobranych danych                        │ │
│  │  - Statystyki i logi                               │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓ API
┌─────────────────────────────────────────────────────────┐
│                   Backend (Fastify)                      │
│  ┌────────────────────────────────────────────────────┐ │
│  │  /api/data-sources                                 │ │
│  │  - CRUD dla źródeł danych                          │ │
│  │  - Trigger scraping                                │ │
│  │  - Status i logi                                   │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Worker (BullMQ)                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Scraping Jobs                                     │ │
│  │  - Playwright/Puppeteer dla dynamicznych stron     │ │
│  │  - Cheerio dla statycznych HTML                   │ │
│  │  - PDF parsing (pdf-parse)                         │ │
│  │  - Rate limiting i retry logic                     │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Processing Jobs                                   │ │
│  │  - Ekstrakcja tekstu                               │ │
│  │  - Generowanie embeddings                  │ │
│  │  - Klasyfikacja dokumentów                         │ │
│  │  - Wykrywanie zmian                                │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL + pgvector)            │
│  ┌────────────────────────────────────────────────────┐ │
│  │  data_sources - konfiguracja źródeł               │ │
│  │  scraped_content - surowe dane                     │ │
│  │  processed_documents - przetworzone dokumenty      │ │
│  │  embeddings - wektory semantyczne                  │ │
│  │  scraping_logs - logi i błędy                      │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Schemat Bazy Danych

```sql
-- Źródła danych
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'municipality', 'bip', 'legal', 'councilor', 'statistics'
  url TEXT NOT NULL,
  scraping_enabled BOOLEAN DEFAULT true,
  scraping_frequency TEXT DEFAULT 'daily', -- 'hourly', 'daily', 'weekly', 'monthly'
  last_scraped_at TIMESTAMPTZ,
  next_scrape_at TIMESTAMPTZ,
  scraping_config JSONB DEFAULT '{}', -- selektory CSS, xpath, itp.
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pobrane treści
CREATE TABLE scraped_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  content_type TEXT, -- 'html', 'pdf', 'json'
  raw_content TEXT,
  content_hash TEXT, -- do wykrywania zmian
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Przetworzone dokumenty
CREATE TABLE processed_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_content_id UUID REFERENCES scraped_content(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  document_type TEXT, -- 'resolution', 'protocol', 'news', 'legal_act'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  keywords TEXT[],
  publish_date TIMESTAMPTZ,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logi scrapingu
CREATE TABLE scraping_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'success', 'error', 'partial'
  items_scraped INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 4. Konfiguracja Źródeł

### 4.1 Przykład: Strona Gminy Drawno

```json
{
  "name": "Gmina Drawno - Aktualności",
  "type": "municipality",
  "url": "https://www.drawno.pl",
  "scraping_config": {
    "selectors": {
      "news_list": ".news-item",
      "title": "h2.title",
      "content": ".content",
      "date": ".publish-date"
    },
    "pagination": {
      "enabled": true,
      "selector": ".pagination a.next"
    }
  }
}
```

### 4.2 Przykład: BIP Gminy Drawno

```json
{
  "name": "BIP Drawno - Uchwały",
  "type": "bip",
  "url": "https://bip.drawno.pl/uchwaly",
  "scraping_config": {
    "selectors": {
      "document_list": ".document-row",
      "title": ".doc-title",
      "pdf_link": "a.pdf-download",
      "date": ".doc-date",
      "number": ".doc-number"
    },
    "download_pdfs": true
  }
}
```

### 4.3 Przykład: Portal Prawny

```json
{
  "name": "ISAP - Akty prawne samorządowe",
  "type": "legal",
  "url": "https://isap.sejm.gov.pl",
  "scraping_config": {
    "search_params": {
      "category": "samorzad",
      "date_from": "last_month"
    },
    "api_endpoint": "/api/search",
    "requires_auth": false
  }
}
```

## 5. Przepływ Danych

### 5.1 Scraping Flow

```
1. Scheduler (cron) → Sprawdza data_sources.next_scrape_at
2. Tworzy job w BullMQ → scraping-queue
3. Worker pobiera job:
   a. Otwiera stronę (Playwright/Cheerio)
   b. Ekstraktuje dane według selektorów
   c. Zapisuje do scraped_content
   d. Tworzy log w scraping_logs
4. Trigger → processing-queue
5. Processing Worker:
   a. Parsuje treść
   b. Generuje embedding (OpenAI)
   c. Klasyfikuje dokument
   d. Zapisuje do processed_documents
6. Aktualizuje data_sources.last_scraped_at
```

### 5.2 RAG Integration

```
User Query → AI Assistant
     ↓
1. Generuj embedding zapytania (OpenAI)
2. Semantic search w processed_documents (pgvector)
3. Pobierz top 5 najbardziej podobnych dokumentów
4. Dodaj do kontekstu AI
5. Generuj odpowiedź z cytatami
```

## 6. UI w Ustawieniach

### 6.1 Nowa Zakładka: "Źródła Danych"

**Sekcje:**

1. **Źródła Gminy**

   - Strona główna gminy
   - BIP
   - Możliwość dodania własnych URL

2. **Portale Prawne**

   - Lexlege
   - ISAP
   - Sejm.gov.pl
   - Monitor Polski

3. **Serwisy dla Radnych**

   - Portal Samorządowy
   - Związek Gmin
   - FRDL

4. **Dane Statystyczne**

   - GUS BDL
   - Ministerstwo Finansów

5. **Harmonogram**

   - Częstotliwość scrapingu
   - Godziny aktywności
   - Limity (max dokumentów/dzień)

6. **Podgląd Danych**
   - Lista pobranych dokumentów
   - Wyszukiwanie
   - Podgląd treści
   - Statystyki

### 6.2 Funkcje UI

- ✅ Włącz/wyłącz źródło
- ✅ Edytuj konfigurację
- ✅ Ręczny trigger scrapingu
- ✅ Podgląd logów
- ✅ Statystyki (ile dokumentów, ostatnia aktualizacja)
- ✅ Powiadomienia o nowych dokumentach

## 7. Bezpieczeństwo i Etyka

### 7.1 Rate Limiting

- Max 1 request/sekundę na domenę
- Respektowanie robots.txt
- User-Agent identyfikujący aplikację

### 7.2 Prywatność

- Dane tylko dla zalogowanego użytkownika
- RLS w Supabase
- Szyfrowanie wrażliwych danych

### 7.3 Zgodność z Prawem

- Scraping tylko publicznych danych
- Respektowanie praw autorskich
- Zgodność z RODO

## 8. Technologie

### Backend

- **Playwright** - scraping dynamicznych stron
- **Cheerio** - parsing HTML
- **pdf-parse** - ekstrakcja tekstu z PDF
- **BullMQ** - kolejki zadań
- **Redis** - cache i kolejki

### Frontend

- **React** - UI
- **TanStack Table** - tabele danych
- **Recharts** - wykresy statystyk

### AI/ML

- **OpenAI Embeddings** - wektory semantyczne
- **GPT-4** - klasyfikacja i podsumowania

## 9. Metryki i Monitoring

### KPI

- Liczba pobranych dokumentów/dzień
- Sukces scrapingu (%)
- Średni czas przetwarzania
- Liczba błędów
- Wykorzystanie embeddings w czacie

### Alerty

- Błędy scrapingu > 3 z rzędu
- Brak nowych danych > 7 dni
- Przekroczenie limitów API

## 10. Roadmap

### Faza 1 (MVP) - 2 tygodnie

- ✅ Schemat bazy danych
- ✅ UI w Ustawieniach
- ✅ Scraping strony gminy (HTML)
- ✅ Podstawowe przetwarzanie

### Faza 2 - 2 tygodnie

- ✅ Scraping BIP (PDF)
- ✅ Integracja z portalami prawnymi
- ✅ Embeddings i RAG
- ✅ Powiadomienia

### Faza 3 - 2 tygodnie

- ✅ Serwisy dla radnych
- ✅ Dane statystyczne GUS
- ✅ Zaawansowane filtry
- ✅ Eksport danych

### Faza 4 - Ciągłe ulepszanie

- ✅ ML do klasyfikacji
- ✅ Automatyczne wykrywanie zmian
- ✅ Integracja z kalendarzem
- ✅ Raporty i analizy
