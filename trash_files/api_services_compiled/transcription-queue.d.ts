/**
 * Transcription Queue Service - Kolejkowanie zadań transkrypcji YouTube przez Redis/BullMQ
 *
 * Umożliwia:
 * - Kolejkowanie długich zadań transkrypcji
 * - Odporność na restarty (persystencja w Redis)
 * - Retry przy błędach
 * - Śledzenie postępu w czasie rzeczywistym
 * - Horizontal scaling workerów
 */
export interface TranscriptionJobData {
    id: string;
    userId: string;
    videoUrl: string;
    videoTitle: string;
    sessionId?: string;
    includeSentiment: boolean;
    identifySpeakers: boolean;
    createdAt: string;
}
export interface TranscriptionJobResult {
    success: boolean;
    documentId?: string;
    error?: string;
    processingTimeMs?: number;
    audioIssues?: string[];
}
export interface TranscriptionStepProgress {
    name: string;
    label: string;
    status: "pending" | "active" | "completed" | "failed";
    progress: number;
    startTime?: string;
    endTime?: string;
    duration?: number;
    details?: {
        fileSize?: string;
        downloadSpeed?: string;
        audioIssues?: string[];
        appliedFilters?: string[];
        model?: string;
        language?: string;
        processedDuration?: string;
        totalDuration?: string;
        speakersFound?: number;
        [key: string]: unknown;
    };
}
export interface DetailedTranscriptionProgress {
    globalProgress: number;
    globalMessage: string;
    currentStep: string;
    steps: TranscriptionStepProgress[];
    estimatedTimeRemaining?: number;
    startedAt: string;
    lastUpdate: string;
}
export interface TranscriptionJobStatus {
    id: string;
    status: "waiting" | "active" | "completed" | "failed" | "delayed";
    progress: number;
    progressMessage: string;
    result?: TranscriptionJobResult;
    error?: string;
    createdAt: Date;
    completedAt?: Date;
    detailedProgress?: DetailedTranscriptionProgress;
}
export declare const TRANSCRIPTION_STEPS: readonly [{
    readonly name: "download";
    readonly label: "📥 Pobieranie audio z YouTube";
    readonly globalProgressRange: [number, number];
}, {
    readonly name: "conversion";
    readonly label: "🔄 Konwersja do formatu Whisper";
    readonly globalProgressRange: [number, number];
}, {
    readonly name: "splitting";
    readonly label: "✂️ Dzielenie na segmenty";
    readonly globalProgressRange: [number, number];
}, {
    readonly name: "transcription";
    readonly label: "🎤 Transkrypcja Whisper";
    readonly globalProgressRange: [number, number];
}, {
    readonly name: "deduplication";
    readonly label: "🧹 Usuwanie powtórzeń";
    readonly globalProgressRange: [number, number];
}, {
    readonly name: "correction";
    readonly label: "✏️ Korekta językowa (LLM)";
    readonly globalProgressRange: [number, number];
}, {
    readonly name: "analysis";
    readonly label: "🔍 Analiza treści";
    readonly globalProgressRange: [number, number];
}, {
    readonly name: "saving";
    readonly label: "💾 Zapisywanie do RAG";
    readonly globalProgressRange: [number, number];
}];
declare class TranscriptionQueueService {
    private static instance;
    private queue;
    private queueEvents;
    private connection;
    private initialized;
    private progressCache;
    private constructor();
    static getInstance(): TranscriptionQueueService;
    /**
     * Inicjalizacja połączenia z Redis i kolejki
     */
    initialize(): Promise<void>;
    /**
     * Dodaj zadanie transkrypcji do kolejki
     */
    addJob(userId: string, videoUrl: string, videoTitle: string, options?: {
        sessionId?: string;
        includeSentiment?: boolean;
        identifySpeakers?: boolean;
        priority?: number;
    }): Promise<string>;
    /**
     * Inicjalizuj detailed progress dla nowego zadania
     */
    private initializeDetailedProgress;
    /**
     * Pobierz status zadania
     */
    getJobStatus(jobId: string): Promise<TranscriptionJobStatus | null>;
    /**
     * Pobierz wszystkie zadania użytkownika
     */
    getUserJobs(userId: string): Promise<TranscriptionJobStatus[]>;
    /**
     * Czekaj na wynik zadania (z timeout)
     */
    waitForResult(jobId: string, timeoutMs?: number): Promise<TranscriptionJobResult>;
    /**
     * Pobierz statystyki kolejki
     */
    getStats(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }>;
    /**
     * Anuluj zadanie
     */
    cancelJob(jobId: string): Promise<boolean>;
    /**
     * Retry nieudanego zadania
     */
    retryJob(jobId: string): Promise<boolean>;
    /**
     * Wyczyść kolejkę (tylko do testów/debugowania)
     */
    clear(): Promise<void>;
    /**
     * Zamknij połączenia
     */
    close(): Promise<void>;
}
export declare const transcriptionQueue: TranscriptionQueueService;
export declare function addTranscriptionJob(userId: string, videoUrl: string, videoTitle: string, options?: {
    sessionId?: string;
    includeSentiment?: boolean;
    identifySpeakers?: boolean;
}): Promise<string>;
export declare function getTranscriptionJobStatus(jobId: string): Promise<TranscriptionJobStatus | null>;
export declare function getUserTranscriptionJobs(userId: string): Promise<TranscriptionJobStatus[]>;
export declare function waitForTranscriptionResult(jobId: string, timeoutMs?: number): Promise<TranscriptionJobResult>;
export declare function getTranscriptionQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
}>;
export declare function cancelTranscriptionJob(jobId: string): Promise<boolean>;
export declare function retryTranscriptionJob(jobId: string): Promise<boolean>;
export {};
//# sourceMappingURL=transcription-queue.d.ts.map