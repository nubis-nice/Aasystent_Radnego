# Universal Tool Orchestrator v2

## Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                 UniversalToolOrchestrator                   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │ Native Function  │ OR │  Prompt-Based    │              │
│  │    Calling       │    │  Tool Selection  │              │
│  │ (OpenAI/Ollama)  │    │   (Fallback)     │              │
│  └────────┬─────────┘    └────────┬─────────┘              │
│           │                       │                         │
│           └───────────┬───────────┘                         │
│                       ▼                                     │
│              ┌────────────────┐                             │
│              │  ToolRegistry  │                             │
│              └────────┬───────┘                             │
│                       ▼                                     │
│    ┌──────────────────────────────────────────┐            │
│    │              Tool Executor                │            │
│    │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │            │
│    │  │ GUS │ │ RAG │ │ Cal │ │ ... │        │            │
│    │  └─────┘ └─────┘ └─────┘ └─────┘        │            │
│    └──────────────────────────────────────────┘            │
│                       ▼                                     │
│              ┌────────────────┐                             │
│              │   Synthesizer  │                             │
│              └────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

## Pliki

```
apps/api/src/
├── orchestrator/
│   ├── index.ts           # UniversalToolOrchestrator
│   ├── types.ts           # Typy i interfejsy
│   └── tool-registry.ts   # Rejestr narzędzi
│
└── tools/
    ├── index.ts           # Rejestracja wszystkich narzędzi
    ├── gus-statistics.ts  # Narzędzie GUS BDL
    └── session-search.ts  # Wyszukiwanie sesji
```

## Użycie

```typescript
import { UniversalToolOrchestrator } from "./orchestrator/index.js";
import { registerAllTools } from "./tools/index.js";

// Zarejestruj narzędzia (raz przy starcie)
registerAllTools();

// Utwórz orchestrator
const orchestrator = new UniversalToolOrchestrator(userId, {
  provider: "ollama",
  model: "qwen3-next:80b-cloud",
  baseUrl: "http://localhost:11434/v1",
});

// Przetwórz wiadomość
const result = await orchestrator.process("ile urodzeń w gminie Drawno");

console.log(result.response);     // Odpowiedź dla użytkownika
console.log(result.toolsUsed);    // ["gus_statistics"]
console.log(result.reasoning);    // Wyjaśnienie decyzji
```

## Dodawanie nowego narzędzia

```typescript
// tools/my-tool.ts
import type { ToolDefinition, ToolContext, ToolResult } from "../orchestrator/types.js";

export const myTool: ToolDefinition = {
  name: "my_tool",
  description: "Opis co robi narzędzie - model użyje tego do decyzji",
  category: "public_data",
  parameters: {
    type: "object",
    properties: {
      param1: {
        type: "string",
        description: "Opis parametru"
      }
    },
    required: ["param1"]
  },
  
  execute: async (args, context): Promise<ToolResult> => {
    // Implementacja
    return {
      success: true,
      data: { ... },
      metadata: { source: "Nazwa źródła" }
    };
  }
};
```

Następnie zarejestruj w `tools/index.ts`:

```typescript
import { myTool } from "./my-tool.js";
ToolRegistry.register(myTool);
```

## Kategorie narzędzi

| Kategoria | Opis | Przykłady |
|-----------|------|-----------|
| `public_data` | Publiczne API | GUS, ISAP, TERYT, KRS |
| `local_documents` | Lokalna baza | RAG, sesje, dokumenty |
| `spatial` | Dane przestrzenne | Geoportal, mapy |
| `actions` | Akcje użytkownika | Kalendarz, zadania |
| `navigation` | Nawigacja UI | Quick tools |
| `research` | Wyszukiwanie | Deep research, web |

## Native vs Prompt-Based

System automatycznie wykrywa czy model wspiera natywne function calling:

**Native Function Calling** (szybsze, dokładniejsze):
- OpenAI GPT-4o, GPT-4o-mini
- Ollama: qwen2.5+, llama3.1+, mistral

**Prompt-Based** (uniwersalne):
- Każdy model LLM
- JSON w odpowiedzi parsowany automatycznie

## Migracja ze starego orchestratora

Stary `AIToolOrchestrator` używał:
- 50+ regexów w `shouldUseOrchestrator()`
- Hardcoded prompt w `detectIntent()`
- Monolityczny plik 1600+ linii

Nowy system:
- Brak regexów - model sam decyduje
- Modułowe narzędzia w osobnych plikach
- ~200 linii głównego orchestratora
