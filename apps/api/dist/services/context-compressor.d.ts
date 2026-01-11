/**
 * Context Compressor Service
 *
 * Optymalizuje kontekst dla AI poprzez:
 * 1. Estymację tokenów (bez zewnętrznych bibliotek)
 * 2. Kompresję długich dokumentów
 * 3. Summaryzację historii konwersacji
 * 4. Priorytetyzację kontekstu według relevance
 */
/**
 * Szacuje liczbę tokenów w tekście
 * Reguła: ~4 znaki = 1 token dla angielskiego, ~2.5 znaki dla polskiego
 * Polski tekst ma więcej znaków diakrytycznych i dłuższe słowa
 */
export declare function estimateTokens(text: string): number;
/**
 * Szacuje tokeny dla tablicy wiadomości OpenAI
 */
export declare function estimateMessagesTokens(messages: Array<{
    role: string;
    content: string;
}>): number;
export interface CompressionOptions {
    maxTokens: number;
    preserveStructure: boolean;
    extractKeyPoints: boolean;
}
/**
 * Kompresuje długi tekst do określonej liczby tokenów
 */
export declare function compressText(text: string, options?: Partial<CompressionOptions>): string;
export interface DocumentContext {
    id: string;
    title: string;
    content: string;
    relevanceScore: number;
    metadata?: Record<string, unknown>;
}
export interface CompressedRAGContext {
    documents: DocumentContext[];
    municipalData: DocumentContext[];
    totalTokens: number;
    compressionRatio: number;
}
/**
 * Kompresuje kontekst RAG do określonego budżetu tokenów
 */
export declare function compressRAGContext(documents: DocumentContext[], municipalData: DocumentContext[], maxTokens?: number): CompressedRAGContext;
export interface ConversationMessage {
    role: "user" | "assistant" | "system";
    content: string;
}
export interface CompressedHistory {
    messages: ConversationMessage[];
    summary?: string;
    totalTokens: number;
    originalCount: number;
    keptCount: number;
}
/**
 * Kompresuje historię konwersacji
 * Strategia:
 * 1. Zawsze zachowaj ostatnie N wiadomości w pełni
 * 2. Starsze wiadomości -> podsumowanie
 */
export declare function compressConversationHistory(messages: ConversationMessage[], maxTokens?: number, keepLastN?: number): CompressedHistory;
export interface ContextBudget {
    systemPrompt: number;
    ragContext: number;
    history: number;
    userMessage: number;
    completion: number;
}
export interface OptimizedContext {
    systemPrompt: string;
    ragContextMessage?: string;
    historyMessages: ConversationMessage[];
    userMessage: string;
    totalTokens: number;
    budget: ContextBudget;
    savings: {
        originalTokens: number;
        compressedTokens: number;
        savedTokens: number;
        savingsPercent: number;
    };
}
/**
 * Domyślne budżety dla różnych modeli
 */
export declare const MODEL_CONTEXT_LIMITS: Record<string, number>;
/**
 * Optymalizuje cały kontekst dla wywołania AI
 */
export declare function optimizeContext(systemPrompt: string, ragDocuments: DocumentContext[], ragMunicipalData: DocumentContext[], conversationHistory: ConversationMessage[], userMessage: string, modelName?: string, maxCompletionTokens?: number): OptimizedContext;
export declare const ContextCompressor: {
    estimateTokens: typeof estimateTokens;
    estimateMessagesTokens: typeof estimateMessagesTokens;
    compressText: typeof compressText;
    compressRAGContext: typeof compressRAGContext;
    compressConversationHistory: typeof compressConversationHistory;
    optimizeContext: typeof optimizeContext;
    MODEL_CONTEXT_LIMITS: Record<string, number>;
};
export default ContextCompressor;
//# sourceMappingURL=context-compressor.d.ts.map