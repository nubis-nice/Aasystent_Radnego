/**
 * Scraping Queue Manager
 *
 * Zarządza kolejką zadań scrapingu z limitem równoczesnych procesów.
 * Implementuje priorytetyzację źródeł i równoległe przetwarzanie.
 */
import EventEmitter from "events";
export interface ScrapingJob {
    id: string;
    sourceId: string;
    userId: string;
    priority: number;
    config?: Record<string, unknown>;
    createdAt: Date;
    startedAt?: Date;
    finishedAt?: Date;
    status: "queued" | "running" | "completed" | "failed";
    error?: string;
    result?: unknown;
}
export interface ScrapingQueueConfig {
    maxConcurrent: number;
    maxPagesParallel: number;
    defaultPriority: number;
}
export interface QueueStats {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    totalProcessed: number;
    activeJobs: ScrapingJob[];
}
export declare class ScrapingQueueManager extends EventEmitter {
    private static instance;
    private config;
    private queue;
    private runningJobs;
    private completedJobs;
    private failedJobs;
    private isProcessing;
    private constructor();
    /**
     * Singleton - jedna instancja kolejki dla całej aplikacji
     */
    static getInstance(config?: Partial<ScrapingQueueConfig>): ScrapingQueueManager;
    /**
     * Dodaj zadanie do kolejki
     */
    enqueue(sourceId: string, userId: string, options?: {
        priority?: number;
        config?: Record<string, unknown>;
    }): Promise<string>;
    /**
     * Przetwarzaj kolejkę - uruchamiaj zadania do limitu
     */
    private processQueue;
    /**
     * Uruchom pojedyncze zadanie scrapingu
     */
    private startJob;
    /**
     * Pobierz status zadania
     */
    getJobStatus(jobId: string): ScrapingJob | null;
    /**
     * Pobierz statystyki kolejki
     */
    getStats(): QueueStats;
    /**
     * Anuluj zadanie (jeśli jest w kolejce)
     */
    cancelJob(jobId: string): boolean;
    /**
     * Wyczyść historię zakończonych zadań
     */
    clearHistory(): void;
    /**
     * Pobierz konfigurację równoległości dla scrapingu
     */
    getParallelConfig(): {
        maxPagesParallel: number;
    };
}
/**
 * Oblicz priorytet źródła na podstawie metadanych
 */
export declare function calculateSourcePriority(source: {
    type: string;
    metadata?: Record<string, unknown>;
    last_scraped_at?: string;
}): number;
//# sourceMappingURL=scraping-queue.d.ts.map