/**
 * Document Process Queue - Redis/BullMQ queue for OCR/transcription jobs
 * Zapewnia persystencję zadań przy zerwaniu sesji przeglądarki
 */
export interface DocumentProcessJobData {
    userId: string;
    fileName: string;
    fileBuffer: string;
    mimeType: string;
    fileSize: number;
    options?: {
        useVisionOnly?: boolean;
        tesseractConfidenceThreshold?: number;
        visionMaxDimension?: number;
    };
}
export interface DocumentProcessJobResult {
    success: boolean;
    text?: string;
    metadata?: {
        fileName: string;
        fileType: string;
        mimeType: string;
        fileSize: number;
        processingMethod: string;
        confidence?: number;
        language?: string;
        ocrEngine?: string;
        pageCount?: number;
    };
    error?: string;
}
export interface DocumentJobRecord {
    id: string;
    user_id: string;
    job_id: string;
    file_name: string;
    mime_type: string;
    file_size: number;
    status: "pending" | "processing" | "completed" | "failed";
    progress: number;
    result: DocumentProcessJobResult | null;
    error: string | null;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
}
declare class DocumentProcessQueue {
    private queue;
    private queueEvents;
    private connection;
    private supabase;
    private initialized;
    initialize(): Promise<void>;
    /**
     * Dodaj zadanie do kolejki
     */
    addJob(data: DocumentProcessJobData): Promise<{
        jobId: string;
        recordId: string;
    }>;
    /**
     * Pobierz listę jobów użytkownika
     */
    getUserJobs(userId: string, limit?: number): Promise<DocumentJobRecord[]>;
    /**
     * Pobierz pojedynczy job
     */
    getJob(jobId: string, userId: string): Promise<DocumentJobRecord | null>;
    /**
     * Usuń job
     */
    deleteJob(jobId: string, userId: string): Promise<boolean>;
    /**
     * Ponów przetwarzanie
     */
    retryJob(jobId: string, userId: string): Promise<boolean>;
    /**
     * Aktualizuj status joba w Supabase
     */
    private updateJobStatus;
    /**
     * Aktualizuj progress joba
     */
    private updateJobProgress;
    /**
     * Statystyki kolejki
     */
    getStats(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
    }>;
}
export declare const documentProcessQueue: DocumentProcessQueue;
export declare function addDocumentProcessJob(data: DocumentProcessJobData): Promise<{
    jobId: string;
    recordId: string;
}>;
export declare function getUserDocumentJobs(userId: string, limit?: number): Promise<DocumentJobRecord[]>;
export declare function getDocumentJob(jobId: string, userId: string): Promise<DocumentJobRecord | null>;
export declare function deleteDocumentJob(jobId: string, userId: string): Promise<boolean>;
export declare function retryDocumentJob(jobId: string, userId: string): Promise<boolean>;
export declare function getDocumentQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
}>;
export {};
//# sourceMappingURL=document-process-queue.d.ts.map