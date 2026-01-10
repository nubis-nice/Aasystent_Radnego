# Tworzenie Dokumentów przez Czat AI

## Przegląd

Czat AI może teraz tworzyć i zapisywać dokumenty na bazie analizy danych źródłowych. Dokumenty są automatycznie indeksowane i dostępne w przyszłych wyszukiwaniach.

## Funkcje

### 1. Tworzenie Dokumentu (`/api/chat/create-document`)

**Opis:** Tworzy nowy dokument na bazie treści z czatu lub analizy.

**Endpoint:** `POST /api/chat/create-document`

**Request:**

```json
{
  "title": "Analiza budżetu gminy 2026",
  "content": "Szczegółowa treść dokumentu...",
  "documentType": "article",
  "summary": "Krótkie podsumowanie...",
  "keywords": ["budżet", "analiza", "2026"],
  "conversationId": "uuid-konwersacji"
}
```

**Response:**

```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "title": "Analiza budżetu gminy 2026",
    "document_type": "article",
    "content": "...",
    "summary": "...",
    "created_at": "2026-01-09T07:00:00Z"
  },
  "message": "Dokument został utworzony i zapisany w bazie."
}
```

**Funkcjonalność:**

- ✅ Automatyczne generowanie embeddings (OpenAI)
- ✅ Zapisanie do `processed_documents`
- ✅ Dostępność w semantic search
- ✅ Notyfikacja w konwersacji
- ✅ Link do źródłowej konwersacji

### 2. Tworzenie Podsumowania (`/api/chat/create-summary`)

**Opis:** Analizuje dokumenty i tworzy kompleksowe podsumowanie.

**Endpoint:** `POST /api/chat/create-summary`

**Request:**

```json
{
  "query": "Podsumuj wszystkie uchwały dotyczące budżetu",
  "documentTypes": ["resolution", "protocol"],
  "conversationId": "uuid-konwersacji"
}
```

**Response:**

```json
{
  "success": true,
  "summary": "Szczegółowe podsumowanie...",
  "document": {
    "id": "uuid",
    "title": "Podsumowanie: uchwały budżetowe",
    "content": "..."
  },
  "sourceDocuments": 5
}
```

**Funkcjonalność:**

- ✅ Semantic search w dokumentach (top 10)
- ✅ Analiza przez GPT-4
- ✅ Automatyczne podsumowanie
- ✅ Zapisanie jako nowy dokument
- ✅ Metadata ze źródłowymi dokumentami

## Typy Dokumentów

Dostępne typy dokumentów:

- `resolution` - Uchwała
- `protocol` - Protokół
- `news` - Aktualność
- `legal_act` - Akt prawny
- `announcement` - Ogłoszenie
- `article` - Artykuł (domyślny dla podsumowań)

## Przykłady Użycia

### Przykład 1: Zapisanie Analizy

**Scenariusz:** Użytkownik przeprowadził analizę w czacie i chce ją zapisać.

**Użytkownik:** "Zapisz tę analizę jako dokument"

**Czat:**

1. Pobiera treść z konwersacji
2. Wywołuje `/api/chat/create-document`
3. Zapisuje dokument z embeddings
4. Odpowiada: "✅ Dokument zapisany: Analiza budżetu gminy 2026"

### Przykład 2: Podsumowanie Uchwał

**Scenariusz:** Użytkownik chce podsumowanie wszystkich uchwał.

**Użytkownik:** "Stwórz podsumowanie uchwał z ostatniego kwartału"

**Czat:**

1. Wywołuje `/api/chat/create-summary`
2. Wyszukuje uchwały (semantic search)
3. GPT-4 analizuje i tworzy podsumowanie
4. Zapisuje jako nowy dokument
5. Odpowiada z podsumowaniem i linkiem do dokumentu

### Przykład 3: Raport z Wielu Źródeł

**Scenariusz:** Agregacja danych z różnych źródeł.

**Użytkownik:** "Zbierz wszystkie informacje o inwestycjach drogowych"

**Czat:**

1. Wyszukuje w BIP, protokołach, aktualnościach
2. Agreguje informacje
3. Tworzy raport
4. Zapisuje jako dokument typu 'article'
5. Dostępny w przyszłych wyszukiwaniach

## Metadata Dokumentów

Dokumenty utworzone przez AI zawierają metadata:

```json
{
  "created_by": "ai_assistant",
  "conversation_id": "uuid",
  "source_documents": ["uuid1", "uuid2"],
  "query": "oryginalne zapytanie",
  "created_at": "2026-01-09T07:00:00Z"
}
```

## Integracja z RAG

Utworzone dokumenty są automatycznie:

- ✅ Indeksowane (embeddings)
- ✅ Dostępne w semantic search
- ✅ Używane w przyszłych odpowiedziach
- ✅ Linkowane do źródłowej konwersacji

## Przepływ Danych

```
Użytkownik → Czat AI
    ↓
Analiza/Podsumowanie
    ↓
Generowanie embeddings (OpenAI)
    ↓
Zapisanie do processed_documents
    ↓
Notyfikacja w konwersacji
    ↓
Dokument dostępny w RAG
```

## Bezpieczeństwo

- ✅ Autoryzacja (x-user-id header)
- ✅ Walidacja danych wejściowych
- ✅ RLS w Supabase (tylko własne dokumenty)
- ✅ Rate limiting (przez API)

## Limity

- Max długość tytułu: 200 znaków
- Max długość treści: 50,000 znaków
- Max liczba keywords: 20
- Max dokumentów w podsumowaniu: 10

## Frontend API

### Tworzenie dokumentu:

```typescript
import { createDocument } from "@/lib/api/documents";

const result = await createDocument({
  title: "Mój dokument",
  content: "Treść dokumentu...",
  documentType: "article",
  conversationId: conversationId,
});
```

### Tworzenie podsumowania:

```typescript
import { createSummary } from "@/lib/api/documents";

const result = await createSummary({
  query: "Podsumuj uchwały budżetowe",
  documentTypes: ["resolution"],
  conversationId: conversationId,
});
```

## Przyszłe Funkcje

### Planowane:

- ⏳ Komendy specjalne (`/save`, `/summarize`)
- ⏳ Automatyczne tagowanie
- ⏳ Eksport do PDF/DOCX
- ⏳ Udostępnianie dokumentów
- ⏳ Wersjonowanie dokumentów
- ⏳ Komentarze i adnotacje

## Podsumowanie

Czat AI może teraz:

- ✅ **Czytać** z wszystkich źródeł danych
- ✅ **Analizować** dokumenty
- ✅ **Tworzyć** nowe dokumenty
- ✅ **Zapisywać** podsumowania i raporty
- ✅ **Indeksować** dla przyszłych wyszukiwań

**Dokumenty tworzone przez AI są pełnoprawnymi dokumentami w systemie RAG!**
