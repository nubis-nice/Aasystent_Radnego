/**
 * Batch Embedding Service
 *
 * Wykorzystuje OpenAI Batch API dla embeddingów dokumentów
 * - 50% niższe koszty vs synchroniczne API
 * - Osobna pula rate limits
 * - Przetwarzanie do 24h (zazwyczaj szybciej)
 *
 * Użycie: przetwarzanie dokumentów, indeksowanie, re-embedding
 * NIE używać dla: chat w czasie rzeczywistym (użyj sync API)
 */
export interface BatchEmbeddingRequest {
    customId: string;
    text: string;
    metadata?: Record<string, unknown>;
}
export interface BatchEmbeddingResult {
    customId: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
    error?: string;
}
export interface BatchJobStatus {
    batchId: string;
    status: "validating" | "failed" | "in_progress" | "finalizing" | "completed" | "expired" | "cancelling" | "cancelled";
    totalRequests: number;
    completedRequests: number;
    failedRequests: number;
    createdAt: Date;
    completedAt?: Date;
    outputFileId?: string;
    errorFileId?: string;
}
export interface BatchEmbeddingOptions {
    model?: string;
    dimensions?: number;
    maxRequestsPerBatch?: number;
    pollIntervalMs?: number;
    maxWaitTimeMs?: number;
}
export declare class BatchEmbeddingService {
    private client;
    private options;
    constructor(apiKey: string, options?: BatchEmbeddingOptions);
    /**
     * Tworzy batch job dla embeddingów
     * Zwraca batchId do śledzenia statusu
     */
    createBatchJob(requests: BatchEmbeddingRequest[]): Promise<string>;
    /**
     * Sprawdza status batch job
     */
    getBatchStatus(batchId: string): Promise<BatchJobStatus>;
    /**
     * Pobiera wyniki batch job
     */
    getBatchResults(batchId: string): Promise<BatchEmbeddingResult[]>;
    /**
     * Anuluje batch job
     */
    cancelBatch(batchId: string): Promise<void>;
    /**
     * Listuje wszystkie batch jobs
     */
    listBatches(limit?: number): Promise<BatchJobStatus[]>;
    /**
     * Czeka na zakończenie batch job (polling)
     * Zwraca wyniki po zakończeniu
     */
    waitForCompletion(batchId: string, onProgress?: (status: BatchJobStatus) => void): Promise<BatchEmbeddingResult[]>;
    /**
     * Przetwarza dokumenty z automatycznym chunkowaniem
     * Dla dużych dokumentów dzieli na chunki i agreguje wyniki
     */
    processDocuments(documents: Array<{
        id: string;
        text: string;
        metadata?: Record<string, unknown>;
    }>, maxChunkChars?: number): Promise<Map<string, number[]>>;
    /**
     * Dzieli tekst na chunki
     */
    private chunkText;
    /**
     * Agreguje wiele embeddingów do jednego (średnia ważona + normalizacja)
     */
    private aggregateEmbeddings;
}
/**
 * Szacuje koszt batch embeddingu
 * Batch API: 50% taniej niż sync
 */
export declare function estimateBatchCost(totalTokens: number, model?: string): {
    syncCost: number;
    batchCost: number;
    savings: number;
};
/**
 * Szacuje liczbę tokenów w tekście
 */
export declare function estimateTokens(text: string): number;
export default BatchEmbeddingService;
//# sourceMappingURL=batch-embedding-service.d.ts.map