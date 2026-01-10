# Inteligentny Scraper z Analizą LLM

## Opis

Nowy serwis `intelligent-scraper.ts` rozszerza możliwości scrapingu o:

1. **Pełne mapowanie strony (sitemap)** - crawler przechodzi całą strukturę witryny
2. **Analiza kontekstowa LLM** - każda strona jest analizowana przez GPT-4o-mini
3. **Inkrementalny scraping** - przy kolejnych uruchomieniach pobierane są tylko nowe/zmienione materiały
4. **Priorytetyzacja treści** - automatyczne wykrywanie najważniejszych materiałów dla radnego

## Użycie

### Endpoint API

```
POST /api/data-sources/:id/intelligent-scrape
```

**Body (opcjonalne):**

```json
{
  "councilLocation": "Drawno",
  "focusAreas": [
    "sesje rady",
    "kalendarz posiedzeń",
    "materiały dla radnych",
    "uchwały",
    "protokoły"
  ],
  "maxPages": 100,
  "maxDepth": 5,
  "enableLLMAnalysis": true,
  "incrementalMode": true
}
```

**Odpowiedź:**

```json
{
  "message": "Intelligent scrape completed",
  "source_id": "uuid",
  "status": "success",
  "site_map_size": 45,
  "pages_analyzed": 30,
  "documents_found": 25,
  "documents_processed": 20,
  "new_documents": 15,
  "skipped_documents": 5,
  "llm_analyses": 20,
  "errors": [],
  "processing_time_ms": 45000
}
```

## Fazy Działania

### Faza 1: Generowanie Mapy Strony

- Crawler zaczyna od bazowego URL
- Przechodzi wszystkie linki na stronie (max `maxDepth` poziomów)
- Klasyfikuje każdą stronę: `calendar`, `session`, `materials`, `document`, `page`
- Oblicza priorytet każdej strony (0-100)

### Faza 2: Analiza LLM

Dla każdej strony z priorytetem >= 50, LLM analizuje treść i zwraca:

```json
{
  "relevanceScore": 85,
  "contentType": "sesja",
  "summary": "Protokół z XII sesji Rady Miejskiej w Drawnie",
  "keyTopics": ["budżet", "inwestycje", "oświata"],
  "isRelevantForCouncilor": true,
  "extractedDates": ["2024-01-15"],
  "extractedEntities": ["Komisja Budżetowa"],
  "recommendedAction": "priority"
}
```

### Faza 3: Inkrementalny Scraping

- Każda strona ma wyliczany hash treści (MD5)
- Przy ponownym scrapingu porównywane są hashe
- Jeśli hash się nie zmienił - strona jest pomijana
- Oszczędza czas i zasoby API

### Faza 4: Zapis do RAG

- Przetworzone dokumenty są zapisywane do `scraped_content`
- Następnie generowane są embeddingi
- Dokumenty są dostępne w wyszukiwaniu semantycznym

## Konfiguracja Priorytetów

Automatyczne wykrywanie ważnych treści bazuje na słowach kluczowych:

**Wysokie priorytet (80-100):**

- kalendarz, sesja, posiedzenie
- materiały dla radnych
- projekty uchwał

**Średni priorytet (60-80):**

- uchwały, protokoły
- zarządzenia, ogłoszenia

**Niski priorytet (40-60):**

- aktualności, informacje ogólne

## Przykład dla Drawno

Dla strony `https://drawno-rada2.alfatv2.pl/kalendarz-posiedzen`:

1. Scraper tworzy mapę całej witryny
2. Wykrywa sekcję "kalendarz-posiedzen" jako priorytetową
3. LLM analizuje treść i wyodrębnia:
   - Daty sesji
   - Porządki obrad
   - Linki do materiałów
4. Tylko nowe/zmienione materiały są pobierane
5. Wszystko trafia do RAG z embeddingami

## Pliki

- `apps/api/src/services/intelligent-scraper.ts` - główny serwis
- `apps/api/src/routes/data-sources.ts` - endpoint API

## Wymagania

- Klucz API OpenAI (do analizy LLM)
- Supabase (do zapisu danych)
