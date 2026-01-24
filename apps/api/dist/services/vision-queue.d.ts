/**
 * Vision Queue Service - Kolejkowanie zadań OCR/Vision AI przez Redis/BullMQ
 *
 * Umożliwia:
 * - Kolejkowanie zadań Vision AI (Ollama, OpenAI)
 * - Rate limiting dla API
 * - Retry przy błędach
 * - Śledzenie postępu
 */
export interface VisionJobData {
    id: string;
    userId: string;
    imageBase64: string;
    prompt: string;
    pageNumber?: number;
    fileName?: string;
    provider: string;
    model: string;
    createdAt: string;
}
export interface VisionJobResult {
    success: boolean;
    text: string;
    confidence?: number;
    error?: string;
    processingTimeMs?: number;
}
export interface VisionJobStatus {
    id: string;
    status: "waiting" | "active" | "completed" | "failed";
    progress?: number;
    result?: VisionJobResult;
    error?: string;
}
declare class VisionQueueService {
    private static instance;
    private queue;
    private queueEvents;
    private connection;
    private initialized;
    private resultsCache;
    private constructor();
    static getInstance(): VisionQueueService;
    /**
     * Inicjalizacja połączenia z Redis i kolejki
     */
    initialize(): Promise<void>;
    /**
     * Dodaj zadanie Vision do kolejki
     */
    addJob(userId: string, imageBase64: string, prompt: string, options: {
        provider: string;
        model: string;
        pageNumber?: number;
        fileName?: string;
        priority?: number;
    }): Promise<string>;
    /**
     * Dodaj wiele zadań Vision jako batch
     */
    addBatch(userId: string, pages: Array<{
        imageBase64: string;
        pageNumber: number;
    }>, prompt: string, options: {
        provider: string;
        model: string;
        fileName?: string;
    }): Promise<string[]>;
    /**
     * Pobierz status zadania
     */
    getJobStatus(jobId: string): Promise<VisionJobStatus>;
    /**
     * Czekaj na wynik zadania (z timeout)
     */
    waitForResult(jobId: string, timeoutMs?: number): Promise<VisionJobResult>;
    /**
     * Pobierz statystyki kolejki
     */
    getStats(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
    }>;
    /**
     * Wyczyść kolejkę (tylko do testów/debugowania)
     */
    clear(): Promise<void>;
    /**
     * Zamknij połączenia
     */
    close(): Promise<void>;
}
export declare const visionQueue: VisionQueueService;
export declare function addVisionJob(userId: string, imageBase64: string, prompt: string, options: {
    provider: string;
    model: string;
    pageNumber?: number;
    fileName?: string;
}): Promise<string>;
export declare function addVisionBatch(userId: string, pages: Array<{
    imageBase64: string;
    pageNumber: number;
}>, prompt: string, options: {
    provider: string;
    model: string;
    fileName?: string;
}): Promise<string[]>;
export declare function getVisionJobStatus(jobId: string): Promise<VisionJobStatus>;
export declare function waitForVisionResult(jobId: string, timeoutMs?: number): Promise<VisionJobResult>;
export declare function getVisionQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
}>;
export {};
//# sourceMappingURL=vision-queue.d.ts.map