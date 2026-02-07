/**
 * Universal Tool Orchestrator
 *
 * Obsługuje zarówno natywne function calling (OpenAI, Ollama)
 * jak i fallback prompt-based dla modeli bez wsparcia.
 */
import type { OrchestratorConfig, OrchestratorResult, Message } from "./types.js";
export declare class UniversalToolOrchestrator {
    private client;
    private config;
    private userId;
    private supportsNativeTools;
    constructor(userId: string, config: OrchestratorConfig);
    /**
     * Główna metoda przetwarzania wiadomości
     */
    process(userMessage: string, conversationHistory?: Message[]): Promise<OrchestratorResult>;
    /**
     * Przetwarzanie z natywnym function calling
     */
    private processWithNativeTools;
    /**
     * Przetwarzanie prompt-based (fallback)
     */
    private processWithPromptBased;
    /**
     * Syntezuj odpowiedź z wyników wielu narzędzi
     */
    private synthesizeResponse;
    /**
     * Syntezuj odpowiedź z pojedynczego wyniku
     */
    private synthesizeFromData;
    /**
     * Prosty chat bez narzędzi
     */
    private simpleChat;
    /**
     * Sprawdź czy model wspiera natywne function calling
     */
    private checkNativeToolSupport;
}
export { ToolRegistry } from "./tool-registry.js";
export * from "./types.js";
//# sourceMappingURL=index.d.ts.map