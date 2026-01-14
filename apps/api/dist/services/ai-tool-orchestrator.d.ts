/**
 * AI Tool Orchestrator - Inteligentna orchestracja narzędzi AI
 *
 * System rozpoznaje intencje użytkownika i automatycznie wybiera oraz
 * uruchamia odpowiednie narzędzia do realizacji zadania.
 *
 * Dostępne narzędzia:
 * 1. DeepResearchService - głębokie wyszukiwanie w internecie
 * 2. LegalSearchAPI - wyszukiwanie w dokumentach prawnych (RAG)
 * 3. LegalReasoningEngine - analiza prawna z wykrywaniem ryzyk
 * 4. DocumentQueryService - wykrywanie i wyszukiwanie dokumentów
 * 5. SessionDiscoveryService - wyszukiwanie materiałów z sesji rady
 * 6. DocumentProcessor - przetwarzanie dokumentów PDF/HTML
 * 7. IntelligentScraper - zaawansowany scraping stron
 */
export type ToolType = "deep_research" | "rag_search" | "legal_analysis" | "session_search" | "person_search" | "document_fetch" | "budget_analysis" | "youtube_search" | "simple_answer";
export interface DetectedIntent {
    primaryIntent: ToolType;
    secondaryIntents: ToolType[];
    confidence: number;
    entities: {
        personNames: string[];
        documentRefs: string[];
        sessionNumbers: number[];
        dates: string[];
        topics: string[];
    };
    requiresDeepSearch: boolean;
    estimatedTimeSeconds: number;
    userFriendlyDescription: string;
}
export interface ToolExecutionResult {
    tool: ToolType;
    success: boolean;
    data: unknown;
    executionTimeMs: number;
    error?: string;
}
export interface OrchestratorResult {
    intent: DetectedIntent;
    toolResults: ToolExecutionResult[];
    synthesizedResponse: string;
    sources: Array<{
        title: string;
        url?: string;
        type: string;
    }>;
    totalTimeMs: number;
    warnings: string[];
}
export declare class AIToolOrchestrator {
    private userId;
    private llmClient;
    private model;
    constructor(userId: string);
    private initialize;
    /**
     * Główna metoda - wykryj intencję i wykonaj odpowiednie narzędzia
     */
    process(userMessage: string, conversationContext?: string): Promise<OrchestratorResult>;
    /**
     * Wykryj intencję użytkownika za pomocą LLM
     */
    private detectIntent;
    /**
     * Wykonaj wybrane narzędzia
     */
    private executeTools;
    /**
     * Wykonaj pojedyncze narzędzie
     */
    private executeSingleTool;
    /**
     * Syntezuj odpowiedź na podstawie wyników narzędzi
     */
    private synthesizeResponse;
    /**
     * Sprawdza dostępność transkrypcji YouTube dla danej sesji
     * Jeśli transkrypcja jest dostępna, pobiera jej treść z RAG
     */
    private checkYouTubeTranscriptionAvailability;
}
export declare function shouldUseOrchestrator(message: string): boolean;
export declare const AVAILABLE_TOOLS: {
    deep_research: {
        name: string;
        description: string;
        avgTimeSeconds: number;
        requiresApiKey: boolean;
        providers: string[];
    };
    rag_search: {
        name: string;
        description: string;
        avgTimeSeconds: number;
        requiresApiKey: boolean;
    };
    legal_analysis: {
        name: string;
        description: string;
        avgTimeSeconds: number;
        requiresApiKey: boolean;
    };
    session_search: {
        name: string;
        description: string;
        avgTimeSeconds: number;
        requiresApiKey: boolean;
    };
    person_search: {
        name: string;
        description: string;
        avgTimeSeconds: number;
        requiresApiKey: boolean;
    };
    document_fetch: {
        name: string;
        description: string;
        avgTimeSeconds: number;
        requiresApiKey: boolean;
    };
    budget_analysis: {
        name: string;
        description: string;
        avgTimeSeconds: number;
        requiresApiKey: boolean;
    };
};
export declare const SUGGESTED_TOOLS: {
    name: string;
    description: string;
    priority: string;
    complexity: string;
}[];
//# sourceMappingURL=ai-tool-orchestrator.d.ts.map