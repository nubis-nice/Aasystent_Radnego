/**
 * AI Tool Orchestrator - Inteligentna orchestracja narzędzi AI
 */
export type ToolType = "deep_research" | "rag_search" | "legal_analysis" | "session_search" | "person_search" | "document_fetch" | "budget_analysis" | "youtube_search" | "gus_statistics" | "isap_legal" | "eu_funds" | "geoportal_spatial" | "teryt_registry" | "krs_registry" | "ceidg_registry" | "gdos_environmental" | "voice_control" | "app_navigation" | "calendar_add" | "calendar_list" | "calendar_edit" | "calendar_delete" | "task_add" | "task_list" | "task_complete" | "task_delete" | "alert_check" | "quick_tool" | "app_navigate" | "simple_answer";
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
    process(userMessage: string, conversationContext?: string): Promise<OrchestratorResult>;
    private detectIntent;
    private executeTools;
    private executeSingleTool;
    private synthesizeResponse;
}
export declare function shouldUseOrchestrator(message: string): boolean;
export declare const AVAILABLE_TOOLS: {
    deep_research: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    rag_search: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    legal_analysis: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    session_search: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    person_search: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    document_fetch: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    budget_analysis: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    gus_statistics: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    isap_legal: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    eu_funds: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    geoportal_spatial: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    teryt_registry: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    krs_registry: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    ceidg_registry: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    gdos_environmental: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    calendar_add: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    calendar_list: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    task_add: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    task_list: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    calendar_edit: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    calendar_delete: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    task_complete: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    task_delete: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    alert_check: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    quick_tool: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
    app_navigate: {
        name: string;
        description: string;
        avgTimeSeconds: number;
    };
};
//# sourceMappingURL=ai-tool-orchestrator.d.ts.map