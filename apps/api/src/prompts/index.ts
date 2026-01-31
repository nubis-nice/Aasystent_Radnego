/**
 * Prompt Loader - Ładuje prompty z plików JSON
 * 
 * Zamiast hardcoded promptów w kodzie, ładujemy je z plików JSON
 * co pozwala na łatwą modyfikację bez rekompilacji.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache dla załadowanych promptów
const promptCache = new Map<string, unknown>();

/**
 * Interfejs dla promptu wykrywania intencji
 */
export interface IntentDetectionPrompt {
  id: string;
  version: string;
  description: string;
  rules: {
    reasoning: string[];
    priorities: Array<{ pattern: string; tool: string }>;
  };
  tools: {
    public_registries: ToolDefinition[];
    public_data: ToolDefinition[];
    local_documents: ToolDefinition[];
    search: ToolDefinition[];
    actions: ToolDefinition[];
    other: ToolDefinition[];
  };
  outputSchema: object;
}

export interface ToolDefinition {
  name: string;
  triggers: string[];
  description: string;
  examples?: Array<{ input: string; output: string }>;
  note?: string;
  subtypes?: string[];
}

/**
 * Ładuje prompt z pliku JSON
 */
export function loadPrompt<T>(promptName: string): T {
  // Sprawdź cache
  if (promptCache.has(promptName)) {
    return promptCache.get(promptName) as T;
  }

  const promptPath = join(__dirname, `${promptName}.json`);
  
  try {
    const content = readFileSync(promptPath, "utf-8");
    const prompt = JSON.parse(content) as T;
    
    // Zapisz w cache
    promptCache.set(promptName, prompt);
    
    return prompt;
  } catch (error) {
    console.error(`[PromptLoader] Failed to load prompt "${promptName}":`, error);
    throw new Error(`Cannot load prompt: ${promptName}`);
  }
}

/**
 * Ładuje prompt wykrywania intencji
 */
export function loadIntentDetectionPrompt(): IntentDetectionPrompt {
  return loadPrompt<IntentDetectionPrompt>("intent-detection");
}

/**
 * Generuje system prompt dla LLM na podstawie definicji z JSON
 */
export function buildIntentDetectionSystemPrompt(): string {
  const config = loadIntentDetectionPrompt();
  
  let prompt = `Jesteś ekspertem od analizy intencji użytkownika. Wybierz JEDNO narzędzie jako primaryIntent.

# ZASADY ROZUMOWANIA KONTEKSTOWEGO:
${config.rules.reasoning.map(r => `- ${r}`).join("\n")}

# NARZĘDZIA I KIEDY ICH UŻYWAĆ:

## REJESTRY PUBLICZNE:
${config.tools.public_registries.map(t => 
  `- **${t.name}** → ${t.triggers.join(", ")}\n  ${t.description}`
).join("\n")}

## DANE PUBLICZNE:
${config.tools.public_data.map(t => 
  `- **${t.name}** → ${t.triggers.join(", ")}\n  ${t.description}`
).join("\n")}

## LOKALNE DOKUMENTY:
${config.tools.local_documents.map(t => {
  let entry = `- **${t.name}** → ${t.triggers.join(", ")}\n  ${t.description}`;
  if (t.note) entry += `\n  ⚠️ ${t.note}`;
  return entry;
}).join("\n")}

## WYSZUKIWANIE:
${config.tools.search.map(t => 
  `- **${t.name}** → ${t.triggers.join(", ")}\n  ${t.description}`
).join("\n")}

## AKCJE:
${config.tools.actions.map(t => {
  let entry = `- **${t.name}** → ${t.triggers.join(", ")}\n  ${t.description}`;
  if (t.note) entry += `\n  ⚠️ ${t.note}`;
  return entry;
}).join("\n")}

## INNE:
${config.tools.other.map(t => 
  `- **${t.name}** → ${t.triggers.join(", ")}\n  ${t.description}`
).join("\n")}

# PRZYKŁADY MAPOWANIA:
${getAllExamples(config).map(e => 
  `Pytanie: "${e.input}" → ${e.output}`
).join("\n")}

# REGUŁY PRIORYTETÓW:
${config.rules.priorities.map((p, i) => 
  `${i + 1}. Jeśli pytanie zawiera "${p.pattern}" → ${p.tool}`
).join("\n")}

Odpowiedz TYLKO w formacie JSON:
{
  "primaryIntent": "tool_name",
  "secondaryIntents": [],
  "confidence": 0.95,
  "entities": {
    "personNames": [],
    "documentRefs": [],
    "sessionNumbers": [],
    "dates": [],
    "topics": ["główny temat zapytania"]
  },
  "requiresDeepSearch": false,
  "estimatedTimeSeconds": 10,
  "userFriendlyDescription": "Krótki opis co robię"
}`;

  return prompt;
}

/**
 * Wyciąga wszystkie przykłady z definicji narzędzi
 */
function getAllExamples(config: IntentDetectionPrompt): Array<{ input: string; output: string }> {
  const examples: Array<{ input: string; output: string }> = [];
  
  const allTools = [
    ...config.tools.public_registries,
    ...config.tools.public_data,
    ...config.tools.local_documents,
    ...config.tools.search,
    ...config.tools.actions,
    ...config.tools.other,
  ];
  
  for (const tool of allTools) {
    if (tool.examples) {
      examples.push(...tool.examples);
    }
  }
  
  return examples;
}

/**
 * Pobiera listę wszystkich dostępnych narzędzi
 */
export function getAvailableTools(): ToolDefinition[] {
  const config = loadIntentDetectionPrompt();
  
  return [
    ...config.tools.public_registries,
    ...config.tools.public_data,
    ...config.tools.local_documents,
    ...config.tools.search,
    ...config.tools.actions,
    ...config.tools.other,
  ];
}

/**
 * Czyści cache promptów (np. po aktualizacji plików)
 */
export function clearPromptCache(): void {
  promptCache.clear();
}
