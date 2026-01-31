# Analiza systemu orchestratora narzędzi AI

## 1. Przegląd struktury

### Pliki wymagające refaktoryzacji (>500 linii):

| Plik | Linie | Rozmiar | Problem |
|------|-------|---------|---------|
| `document-processor.ts` | 1842 | 67KB | Za duży, wiele odpowiedzialności |
| `ai-tool-orchestrator.ts` | 1616 | 60KB | Hardcoded prompty, monolityczny |
| `voice-action-service.ts` | 1448 | 48KB | Hardcoded prompty, wiele handlerów |
| `intelligent-scraper.ts` | 1336 | 46KB | Za duży |
| `youtube-downloader.ts` | 1028 | 39KB | Za duży |

### Problemy zidentyfikowane:

1. **Hardcoded prompty** - prompty systemowe są zdefiniowane jako stałe stringi w kodzie
2. **Monolityczne pliki** - pojedyncze pliki obsługują zbyt wiele funkcjonalności
3. **Duplikacja logiki** - podobna logika wykrywania intencji w wielu miejscach
4. **Brak separacji** - prompty, logika biznesowa i obsługa błędów w jednym pliku

---

## 2. Architektura obecna

```
┌─────────────────────────────────────────────────────────────┐
│                      chat.ts (endpoint)                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              shouldUseOrchestrator() - 50+ regexów          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│            AIToolOrchestrator.process()                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  INTENT_DETECTION_PROMPT (220 linii hardcoded)          ││
│  │  - 30+ typów narzędzi                                   ││
│  │  - Reguły priorytetów                                   ││
│  │  - Przykłady mapowania                                  ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  detectIntent() → LLM call                              ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  executeTools() - 30+ case statements                   ││
│  │  - Każdy tool ma własną implementację inline           ││
│  │  - Brak abstrakcji                                      ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  synthesizeResponse() → LLM call                        ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Problemy z narzędziami zewnętrznymi

### Geoportal (geoportal_spatial):
- Serwis istnieje: `geoportal-service.ts` (14KB)
- Problem: Brak obsługi błędów API, timeout

### GUS Statistics (gus_statistics):
- Serwis istnieje: `gus-api-service.ts` (7.5KB)
- Problem: API może wymagać klucza, brak retry

### TERYT, KRS, CEIDG, GDOŚ:
- Serwisy istnieją i są zaimplementowane
- Problem: Brak cache'owania wyników

---

## 4. Proponowana architektura

```
apps/api/src/
├── orchestrator/
│   ├── index.ts                    # Eksport główny
│   ├── orchestrator.ts             # Klasa główna (slim)
│   ├── intent-detector.ts          # Wykrywanie intencji
│   ├── tool-executor.ts            # Wykonywanie narzędzi
│   ├── response-synthesizer.ts     # Synteza odpowiedzi
│   └── types.ts                    # Typy i interfejsy
│
├── prompts/
│   ├── index.ts                    # Loader promptów
│   ├── intent-detection.json       # Prompt wykrywania intencji
│   ├── voice-action.json           # Prompt akcji głosowych
│   ├── synthesis.json              # Prompt syntezy
│   └── tools/
│       ├── geoportal.json
│       ├── gus.json
│       ├── isap.json
│       └── ...
│
├── tools/
│   ├── index.ts                    # Registry narzędzi
│   ├── base-tool.ts                # Klasa bazowa
│   ├── public-data/
│   │   ├── geoportal-tool.ts
│   │   ├── gus-tool.ts
│   │   ├── isap-tool.ts
│   │   ├── teryt-tool.ts
│   │   ├── krs-tool.ts
│   │   ├── ceidg-tool.ts
│   │   └── gdos-tool.ts
│   ├── local-data/
│   │   ├── rag-search-tool.ts
│   │   ├── session-search-tool.ts
│   │   └── document-fetch-tool.ts
│   ├── actions/
│   │   ├── calendar-tool.ts
│   │   ├── task-tool.ts
│   │   └── navigation-tool.ts
│   └── generators/
│       └── quick-tool.ts
│
└── services/                       # Istniejące serwisy (slim)
```

---

## 5. Format promptów JSON

```json
{
  "id": "intent-detection",
  "version": "1.0.0",
  "description": "Prompt do wykrywania intencji użytkownika",
  "systemPrompt": "Jesteś ekspertem od analizy intencji...",
  "tools": [
    {
      "name": "geoportal_spatial",
      "triggers": ["działka", "parcela", "MPZP", "mapa"],
      "description": "Dane przestrzenne - działki, plany zagospodarowania",
      "priority": 4,
      "examples": [
        {"input": "znajdź działkę 123/4 w Drawnie", "output": "geoportal_spatial"}
      ]
    }
  ],
  "rules": [
    "Jeśli pytanie zawiera 'TERYT' → teryt_registry",
    "Jeśli pytanie zawiera 'KRS' → krs_registry"
  ],
  "outputSchema": {
    "type": "object",
    "properties": {
      "primaryIntent": {"type": "string"},
      "confidence": {"type": "number"}
    }
  }
}
```

---

## 6. Klasa bazowa narzędzia

```typescript
// tools/base-tool.ts
export abstract class BaseTool {
  abstract name: ToolType;
  abstract description: string;
  abstract triggers: RegExp[];
  
  abstract execute(
    userMessage: string,
    intent: DetectedIntent,
    userId: string
  ): Promise<ToolExecutionResult>;
  
  // Wspólna logika
  protected async withRetry<T>(
    fn: () => Promise<T>,
    retries = 3
  ): Promise<T> { ... }
  
  protected async withCache<T>(
    key: string,
    fn: () => Promise<T>,
    ttl = 3600
  ): Promise<T> { ... }
}
```

---

## 7. Plan migracji

### Faza 1: Ekstrakcja promptów (1-2h)
1. Utworzenie `apps/api/src/prompts/`
2. Ekstrakcja `INTENT_DETECTION_PROMPT` do JSON
3. Ekstrakcja `VOICE_ACTION_PROMPT` do JSON
4. Loader promptów z walidacją

### Faza 2: Refaktoryzacja orchestratora (2-3h)
1. Utworzenie `apps/api/src/orchestrator/`
2. Podział na: intent-detector, tool-executor, response-synthesizer
3. Zachowanie kompatybilności wstecznej

### Faza 3: Registry narzędzi (2-3h)
1. Utworzenie `apps/api/src/tools/`
2. Klasa bazowa `BaseTool`
3. Migracja narzędzi jeden po drugim
4. Dynamic loading z registry

### Faza 4: Testy i dokumentacja (1h)
1. Testy jednostkowe dla nowych modułów
2. Aktualizacja dokumentacji

---

## 8. Rekomendacje natychmiastowe

1. **Nie zmieniać działającego kodu** bez testów
2. **Rozpocząć od ekstrakcji promptów** - najmniejsze ryzyko
3. **Zachować stare pliki** jako fallback podczas migracji
4. **Dodać logowanie** do orchestratora dla debugowania

---

## 9. Metryki sukcesu

- [ ] Żaden plik >500 linii w `orchestrator/`
- [ ] Prompty w JSON z walidacją schema
- [ ] 100% kompatybilność wsteczna
- [ ] Testy pokrywające >80% kodu
- [ ] Dokumentacja każdego narzędzia
