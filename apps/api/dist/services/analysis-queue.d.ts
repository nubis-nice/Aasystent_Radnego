/**
 * Analysis Queue - Redis/BullMQ queue for document analysis jobs
 * Zapewnia persystencję zadań analizy dokumentów
 */
import { Queue } from "bullmq";
export interface AnalysisJobData {
    userId: string;
    documentId: string;
    documentTitle: string;
}
export interface AnalysisJobResult {
    success: boolean;
    documentId: string;
    documentTitle: string;
    analysisPrompt?: string;
    systemPrompt?: string;
    score?: {
        relevanceScore: number;
        urgencyScore: number;
        typeScore: number;
        totalScore: number;
        priority: string;
    };
    references?: {
        found: number;
        missing: number;
    };
    error?: string;
}
declare class AnalysisQueue {
    private queue;
    private queueEvents;
    private connection;
    private supabase;
    private initialized;
    initialize(): Promise<void>;
    /**
     * Dodaj zadanie analizy do kolejki
     */
    addJob(data: AnalysisJobData): Promise<{
        jobId: string;
        taskId: string;
    }>;
    /**
     * Statystyki kolejki
     */
    getStats(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
    }>;
    /**
     * Pobierz kolejkę (dla workera)
     */
    getQueue(): Queue<AnalysisJobData, AnalysisJobResult> | null;
}
export declare const analysisQueue: AnalysisQueue;
export declare function addAnalysisJob(data: AnalysisJobData): Promise<{
    jobId: string;
    taskId: string;
}>;
export declare function getAnalysisQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
}>;
export {};
//# sourceMappingURL=analysis-queue.d.ts.map