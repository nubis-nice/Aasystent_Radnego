# Informacja o Aktualnych Danych w Czacie

## Status: BRAK DANYCH W BAZIE

### Problem

Czat AI jest skonfigurowany do korzystania z RAG (Retrieval-Augmented Generation), ale **nie ma jeszcze żadnych danych** w bazie, z których mógłby korzystać.

### Co oznacza "brak aktualnych danych"?

Czat AI może odpowiadać na pytania, ale:

- ❌ **NIE MA** dostępu do dokumentów użytkownika (baza `processed_documents` jest pusta)
- ❌ **NIE MA** dostępu do danych gminy (brak scraped content)
- ❌ **NIE MA** dostępu do uchwał, protokołów, aktualności
- ✅ **MA** dostęp do wiedzy ogólnej GPT-4 (do grudnia 2023)
- ✅ **MA** system promptów (Asystent Radnego)

### Dlaczego brak danych?

1. **Źródła danych nie są jeszcze aktywne**

   - Tabele `data_sources`, `scraped_content`, `processed_documents` są puste
   - Scraping worker nie jest jeszcze zaimplementowany
   - Brak automatycznego pobierania danych z stron

2. **Użytkownik nie dodał własnych dokumentów**
   - Brak funkcji upload dokumentów (do zaimplementowania)
   - Brak ręcznie dodanych dokumentów

## Jak naprawić?

### Opcja 1: Dodaj testowe dane (SZYBKIE)

Uruchom w Supabase SQL Editor:

```sql
-- Dodaj testowe źródło danych
INSERT INTO data_sources (user_id, name, type, url, scraping_enabled, scraping_frequency)
SELECT
  id,
  'Test - Gmina Drawno',
  'municipality',
  'https://www.drawno.pl',
  false, -- wyłączone scraping
  'manual'
FROM auth.users
LIMIT 1;

-- Dodaj testowy dokument
INSERT INTO processed_documents (
  user_id,
  document_type,
  title,
  content,
  summary,
  keywords,
  publish_date,
  source_url
)
SELECT
  id,
  'news',
  'Testowa aktualność z Gminy Drawno',
  'To jest testowa treść aktualności z gminy Drawno. Rada Gminy podjęła uchwałę w sprawie budżetu na rok 2026. Planowane inwestycje obejmują remont dróg gminnych oraz modernizację oświetlenia ulicznego.',
  'Rada Gminy podjęła uchwałę budżetową na 2026 rok.',
  ARRAY['budżet', 'uchwała', 'inwestycje', 'drogi'],
  NOW(),
  'https://www.drawno.pl/aktualnosci/test'
FROM auth.users
LIMIT 1;

-- Sprawdź czy dane zostały dodane
SELECT COUNT(*) as liczba_dokumentow FROM processed_documents;
```

### Opcja 2: Zaimplementuj scraping (WŁAŚCIWE ROZWIĄZANIE)

**Plan implementacji:**

1. **Backend Worker** (1-2 dni)

   - Zainstaluj Playwright, Cheerio, BullMQ
   - Zaimplementuj scraper dla strony gminy
   - Zaimplementuj processor dla dokumentów
   - Generuj embeddings (OpenAI)

2. **Scheduler** (1 dzień)

   - Cron job sprawdzający `data_sources.next_scrape_at`
   - Automatyczne uruchamianie scrapingu

3. **Frontend** (1 dzień)
   - Strona "Źródła Danych" już istnieje
   - Dodaj funkcjonalność "Odśwież teraz"
   - Podgląd pobranych dokumentów

### Opcja 3: Upload dokumentów (TYMCZASOWE)

**Dodaj funkcję upload:**

- Pozwól użytkownikowi uploadować PDF/DOCX
- Ekstraktuj tekst
- Generuj embeddings
- Zapisz do `processed_documents`

## Jak działa RAG w czacie?

### Aktualny przepływ (gdy są dane):

```
1. Użytkownik wysyła pytanie
   ↓
2. Generuj embedding pytania (OpenAI)
   ↓
3. Semantic search w processed_documents
   - Znajdź 5 najbardziej podobnych dokumentów
   - Threshold: 0.7 (70% podobieństwa)
   ↓
4. Dodaj dokumenty do kontekstu AI
   ↓
5. GPT-4 odpowiada z cytatami ze źródeł
```

### Aktualny przepływ (bez danych):

```
1. Użytkownik wysyła pytanie
   ↓
2. Generuj embedding pytania (OpenAI)
   ↓
3. Semantic search w processed_documents
   - Brak wyników (tabela pusta)
   ↓
4. GPT-4 odpowiada TYLKO z wiedzy ogólnej
   - Brak cytatów
   - Brak aktualnych danych
   - Brak lokalnego kontekstu
```

## Testy

### Test 1: Sprawdź czy są dane

```sql
-- Sprawdź źródła danych
SELECT COUNT(*) FROM data_sources;

-- Sprawdź przetworzone dokumenty
SELECT COUNT(*) FROM processed_documents;

-- Sprawdź surowe dane
SELECT COUNT(*) FROM scraped_content;
```

**Oczekiwany wynik (obecnie):**

- data_sources: 0 lub 3 (domyślne źródła)
- processed_documents: 0
- scraped_content: 0

### Test 2: Przetestuj czat bez danych

**Pytanie:** "Jakie uchwały podjęła rada gminy w ostatnim miesiącu?"

**Oczekiwana odpowiedź:**

```
Przepraszam, ale nie mam dostępu do aktualnych danych o uchwałach
Rady Gminy. Aby uzyskać te informacje, sprawdź:
1. BIP Gminy Drawno
2. Protokoły z sesji Rady Gminy
3. Skontaktuj się z biurem Rady Gminy
```

### Test 3: Przetestuj czat z danymi (po dodaniu testowych)

**Pytanie:** "Co wiesz o budżecie gminy?"

**Oczekiwana odpowiedź:**

```
Na podstawie dostępnych dokumentów:

Rada Gminy podjęła uchwałę w sprawie budżetu na rok 2026.
Planowane inwestycje obejmują:
- Remont dróg gminnych
- Modernizację oświetlenia ulicznego

Źródło: Testowa aktualność z Gminy Drawno
```

## Podsumowanie

### ✅ Co działa:

- Czat AI z GPT-4
- System promptów (Asystent Radnego)
- Historia konwersacji
- RAG infrastructure (gotowa do użycia)

### ❌ Co nie działa (brak danych):

- Semantic search (brak dokumentów)
- Cytaty ze źródeł (brak źródeł)
- Aktualne dane gminy (brak scrapingu)
- Kontekst lokalny (brak danych)

### 🔧 Następne kroki:

**Priorytet 1 (TERAZ):**

1. Dodaj testowe dane SQL (5 minut)
2. Przetestuj czat z danymi

**Priorytet 2 (NASTĘPNY TYDZIEŃ):**

1. Zaimplementuj scraping worker
2. Dodaj scheduler
3. Uruchom automatyczne pobieranie danych

**Priorytet 3 (PRZYSZŁOŚĆ):**

1. Upload dokumentów
2. Zaawansowane filtry
3. Eksport danych
