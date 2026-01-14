/**
 * DocumentProcessingJobService - Asynchroniczne przetwarzanie dokumentów OCR/transkrypcji
 *
 * Funkcje:
 * - Kolejkowanie zadań przetwarzania
 * - Automatyczny zapis do RAG
 * - Analiza sentymentu (opcjonalnie)
 * - Profesjonalne formatowanie dokumentu
 */
export interface ProcessingJob {
    id: string;
    userId: string;
    fileName: string;
    fileType: string;
    status: "pending" | "preprocessing" | "processing" | "analyzing" | "saving" | "completed" | "failed";
    progress: number;
    progressMessage: string;
    includeSentiment: boolean;
    saveToRag: boolean;
    formatAsProfessional: boolean;
    createdAt: Date;
    completedAt?: Date;
    error?: string;
    resultDocumentId?: string;
}
interface CreateJobOptions {
    fileName: string;
    fileBuffer: Buffer;
    mimeType: string;
    includeSentiment: boolean;
    saveToRag: boolean;
    formatAsProfessional: boolean;
}
export declare class DocumentProcessingJobService {
    private userId;
    constructor(userId: string);
    /**
     * Tworzy nowe zadanie przetwarzania i uruchamia je asynchronicznie
     */
    createJob(options: CreateJobOptions): Promise<ProcessingJob>;
    /**
     * Aktualizuje status zadania
     */
    private updateJob;
    /**
     * Pobiera status zadania
     */
    getJob(jobId: string): ProcessingJob | undefined;
    /**
     * Pobiera wszystkie zadania użytkownika
     */
    getUserJobs(): ProcessingJob[];
    /**
     * Główna logika przetwarzania zadania
     */
    private processJob;
    /**
     * Analiza sentymentu przez LLM
     */
    private analyzeSentiment;
    /**
     * Profesjonalne formatowanie dokumentu przez LLM
     */
    private formatDocument;
    /**
     * Sprawdza czy plik to audio/video
     */
    private isAudioFile;
    /**
     * Określa typ pliku
     */
    private getFileType;
}
export {};
//# sourceMappingURL=document-processing-job-service.d.ts.map