# Plan wdrożenia - Inteligentny System Dokumentów v2

## Cele

1. **Inteligentne pozycjonowanie** - najważniejsze dokumenty radnego na górze
2. **Kategoryzacja kolorystyczna** - różne odcienie tła według ważności
3. **Scoring dokumentów** - system punktacji
4. **Analiza przez AI** - przekazanie do reasoning engine
5. **Rozszerzony uploader** - różne formaty (PDF, JPG, PNG, DOC)
6. **Zaawansowane filtry** - lepsza czytelność i wyszukiwanie

---

## FAZA 1: Scoring dokumentów (Backend)

### 1.1 Algorytm ważności

```typescript
interface DocumentScore {
  relevanceScore: number; // 0-100 - dopasowanie do radnego
  urgencyScore: number; // 0-100 - pilność (terminy, sesje)
  typeScore: number; // 0-100 - typ dokumentu
  recencyScore: number; // 0-100 - aktualność
  totalScore: number; // suma ważona
  priority: "critical" | "high" | "medium" | "low";
}
```

### 1.2 Wagi scoringu

| Typ dokumentu | Waga bazowa |
| ------------- | ----------- |
| Sesja rady    | 100         |
| Uchwała       | 90          |
| Protokół      | 80          |
| Ogłoszenie    | 60          |
| Artykuł       | 40          |

### 1.3 Modyfikatory

- Słowa kluczowe radnego: +20
- Nadchodząca sesja (< 7 dni): +30
- Wspomnienie w uchwale: +25
- Dokument z ostatnich 24h: +15

---

## FAZA 2: Kategoryzacja kolorystyczna (Frontend)

### 2.1 Kolory według priorytetu

| Priorytet | Tło      | Border    | Badge          |
| --------- | -------- | --------- | -------------- |
| critical  | red-50   | red-200   | 🔴 Pilne       |
| high      | amber-50 | amber-200 | 🟠 Ważne       |
| medium    | blue-50  | blue-200  | 🔵 Standardowe |
| low       | gray-50  | gray-200  | ⚪ Archiwalne  |

---

## FAZA 3: Analiza przez Reasoning Engine

### 3.1 Endpoint API

```
POST /api/documents/:id/analyze
```

### 3.2 Flow

1. Pobierz pełny dokument
2. Wyślij do reasoning engine z promptem analizy
3. Zapisz wynik analizy
4. Przekieruj do chatu z kontekstem

---

## FAZA 4: Rozszerzony Uploader

### 4.1 Obsługiwane formaty

- PDF (z OCR dla skanów)
- DOCX
- DOC (konwersja)
- JPG/PNG/WEBP (OCR)
- TXT/MD

### 4.2 Komponent

- Drag & drop
- Preview pliku
- Progress upload
- Automatyczne OCR

---

## FAZA 5: Zaawansowane filtry

### 5.1 Nowe filtry

- Zakres dat (date picker)
- Priorytet (critical/high/medium/low)
- Źródło (scraping/upload/ai)
- Sortowanie (data/ważność/alfabetycznie)
- Pełnotekstowe wyszukiwanie

### 5.2 UI/UX

- Kontrastowe kolory
- Dropdown z ikonami
- Chip dla aktywnych filtrów
- Reset filtrów

---

## Kolejność implementacji

1. ✅ Backend: Algorytm scoringu w API
2. ✅ Backend: Endpoint analizy dokumentu
3. ✅ Frontend: Kolorystyka według priorytetu
4. ✅ Frontend: Przycisk "Analizuj" → chat
5. ✅ Frontend: Zaawansowane filtry
6. ✅ Frontend: Strona upload z obsługą wielu formatów
7. ✅ Testy integracyjne

---

## Pliki do modyfikacji

### Backend (apps/api)

- `src/routes/documents.ts` - nowe endpointy
- `src/services/document-scorer.ts` - NOWY - algorytm scoringu
- `src/services/document-processor.ts` - już istnieje, rozszerzenie

### Frontend (apps/frontend)

- `src/app/documents/page.tsx` - główna lista
- `src/app/documents/upload/page.tsx` - NOWY - strona upload
- `src/lib/api/documents-list.ts` - rozszerzenie interfejsu
- `src/components/documents/DocumentCard.tsx` - NOWY - karta z kolorystyką
- `src/components/documents/AdvancedFilters.tsx` - NOWY - zaawansowane filtry
