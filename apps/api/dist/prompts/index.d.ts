/**
 * Prompt Loader - Ładuje prompty z plików JSON
 *
 * Zamiast hardcoded promptów w kodzie, ładujemy je z plików JSON
 * co pozwala na łatwą modyfikację bez rekompilacji.
 */
/**
 * Interfejs dla promptu wykrywania intencji
 */
export interface IntentDetectionPrompt {
    id: string;
    version: string;
    description: string;
    rules: {
        reasoning: string[];
        priorities: Array<{
            pattern: string;
            tool: string;
        }>;
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
    examples?: Array<{
        input: string;
        output: string;
    }>;
    note?: string;
    subtypes?: string[];
}
/**
 * Ładuje prompt z pliku JSON
 */
export declare function loadPrompt<T>(promptName: string): T;
/**
 * Ładuje prompt wykrywania intencji
 */
export declare function loadIntentDetectionPrompt(): IntentDetectionPrompt;
/**
 * Generuje system prompt dla LLM na podstawie definicji z JSON
 */
export declare function buildIntentDetectionSystemPrompt(): string;
/**
 * Pobiera listę wszystkich dostępnych narzędzi
 */
export declare function getAvailableTools(): ToolDefinition[];
/**
 * Czyści cache promptów (np. po aktualizacji plików)
 */
export declare function clearPromptCache(): void;
//# sourceMappingURL=index.d.ts.map