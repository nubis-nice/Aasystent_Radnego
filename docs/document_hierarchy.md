# Hierarchia Ważności Dokumentów Sesyjnych (Document Hierarchy)

Dokument definiuje oficjalną hierarchię ważności dokumentów w systemie Asystent Radnego.
Wagi (0-100) są wykorzystywane przez algorytmy:

1. **DocumentScorer** - do obliczania priorytetu wyświetlania.
2. **RAG Context Selection** - do dobierania najbardziej relewantnego kontekstu dla LLM.

## Poziom 1: Akty Prawne i Decyzje (Krytyczne)

**Zakres wag: 90-100**
_Najważniejsze dokumenty stanowiące o prawie miejscowym i budżecie. Muszą być zawsze uwzględniane w pierwszej kolejności._

| Typ dokumentu       | Kod typu (`documentType`) | Waga    | Opis                                                            |
| ------------------- | ------------------------- | ------- | --------------------------------------------------------------- |
| **Budżet / Zmiany** | `budget_act`              | **100** | Uchwała budżetowa, WPF, zmiany w budżecie. Absolutnie kluczowe. |
| **Uchwała**         | `resolution`              | **95**  | Finalny akt woli Rady Gminy. Prawo miejscowe.                   |
| **Porządek Obrad**  | `session_order`           | **90**  | Definiuje zakres prawny i tematyczny sesji.                     |

## Poziom 2: Zapis Przebiegu i Narzędzia Kontrolne (Wysoka ważność)

**Zakres wag: 70-89**
_Dokumentują przebieg debaty i indywidualną aktywność radnych. Kluczowe dla analizy "kto co powiedział"._

| Typ dokumentu       | Kod typu (`documentType`) | Waga   | Opis                                                |
| ------------------- | ------------------------- | ------ | --------------------------------------------------- |
| **Projekt Uchwały** | `resolution_project`      | **85** | Wersja robocza uchwały, kluczowa przed sesją.       |
| **Protokół**        | `protocol`                | **80** | Oficjalny, prawnie wiążący zapis przebiegu obrad.   |
| **Interpelacja**    | `interpellation`          | **75** | Narzędzie kontrolne radnego, pytania do Burmistrza. |
| **Transkrypcja**    | `transcription`           | **70** | Szczegółowy zapis wypowiedzi (Speech-to-Text).      |

## Poziom 3: Materiały Merytoryczne i Opinie (Średni priorytet)

**Zakres wag: 50-69**
_Kontekst niezbędny do podjęcia decyzji i zrozumienia tła sprawy._

| Typ dokumentu         | Kod typu (`documentType`) | Waga   | Opis                                             |
| --------------------- | ------------------------- | ------ | ------------------------------------------------ |
| **Nagranie Wideo**    | `video`                   | **65** | Materiał źródłowy audio/wideo.                   |
| **Opinia Komisji**    | `committee_opinion`       | **60** | Stanowisko merytoryczne komisji problemowej.     |
| **Uzasadnienie**      | `justification`           | **55** | Wyjaśnienie celu wprowadzenia uchwały.           |
| **Materiały Sesyjne** | `session_materials`       | **50** | Raporty, sprawozdania i inne materiały zbiorcze. |

## Poziom 4: Dokumentacja Administracyjna (Niska ważność)

**Zakres wag: 30-49**
_Dokumenty pomocnicze, organizacyjne i informacyjne._

| Typ dokumentu   | Kod typu (`documentType`) | Waga   | Opis                                                |
| --------------- | ------------------------- | ------ | --------------------------------------------------- |
| **Zarządzenie** | `order`                   | **40** | Decyzje organu wykonawczego (Burmistrza).           |
| **Ogłoszenie**  | `announcement`            | **30** | Informacje o charakterze publicznym, obwieszczenia. |

## Poziom 5: Załączniki i Dane Referencyjne (Tło)

**Zakres wag: 0-29**
_Szczegółowe dane techniczne, mapy, tabele._

| Typ dokumentu          | Kod typu (`documentType`) | Waga   | Opis                                      |
| ---------------------- | ------------------------- | ------ | ----------------------------------------- |
| **Załącznik**          | `attachment`              | **20** | Tabele, wykazy, mapy dołączone do uchwał. |
| **Analiza Zewnętrzna** | `reference_material`      | **15** | Ekspertyzy, opracowania zewnętrzne.       |
| **Inne**               | `other`                   | **10** | Niesklasyfikowane, newsy, komunikaty.     |
| **Info**               | `news`                    | **10** | Aktualności ze strony www.                |

---

## Implementacja

### Wagi w `DocumentScorer`

System scoringu używa powyższych wag jako bazowego `typeScore` (30% całkowitej oceny dokumentu).

### Metadata `hierarchyLevel`

Każdy znormalizowany dokument powinien posiadać pole `hierarchyLevel` w metadanych:

```typescript
interface NormalizedDocumentMetadata {
  // ...
  hierarchyLevel: 1 | 2 | 3 | 4 | 5;
}
```

Mapowanie poziomów:

- **Level 1**: >= 90 pkt
- **Level 2**: 70-89 pkt
- **Level 3**: 50-69 pkt
- **Level 4**: 30-49 pkt
- **Level 5**: < 30 pkt
