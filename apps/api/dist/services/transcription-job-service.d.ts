/**
 * TranscriptionJobService - Asynchroniczne przetwarzanie transkrypcji YouTube
 *
 * Funkcje:
 * - Kolejkowanie zadań transkrypcji
 * - Automatyczny zapis do RAG w kategorii "transkrypcje"
 * - Powiązanie z Sesjami Rady
 * - Identyfikacja mówców po imieniu i nazwisku
 * - Formatowanie dokumentu z ekspresją i sentymentem
 */
export interface TranscriptionJob {
    id: string;
    userId: string;
    videoUrl: string;
    videoTitle: string;
    sessionId?: string;
    status: "pending" | "downloading" | "preprocessing" | "transcribing" | "analyzing" | "saving" | "completed" | "failed";
    progress: number;
    progressMessage: string;
    includeSentiment: boolean;
    identifySpeakers: boolean;
    createdAt: Date;
    completedAt?: Date;
    error?: string;
    resultDocumentId?: string;
    audioIssues?: string[];
}
export interface CouncilMember {
    id: string;
    name: string;
    role: string;
    party?: string;
    voiceCharacteristics?: string;
}
export declare class TranscriptionJobService {
    private userId;
    private embeddingsClient;
    private llmClient;
    private embeddingModel;
    private llmModel;
    constructor(userId: string);
    initialize(): Promise<void>;
    /**
     * Tworzy nowe zadanie transkrypcji i uruchamia je asynchronicznie
     */
    createJob(videoUrl: string, videoTitle: string, options?: {
        sessionId?: string;
        includeSentiment?: boolean;
        identifySpeakers?: boolean;
    }): Promise<TranscriptionJob>;
    /**
     * Pobiera status zadania
     */
    getJob(jobId: string): TranscriptionJob | undefined;
    /**
     * Pobiera wszystkie zadania użytkownika
     */
    getUserJobs(): TranscriptionJob[];
    /**
     * Główna logika przetwarzania zadania
     */
    private processJob;
    private updateJob;
    /**
     * Pobiera listę radnych z bazy danych
     */
    private getCouncilMembers;
    /**
     * Identyfikuje mówców używając LLM
     */
    private identifySpeakers;
    /**
     * Formatuje transkrypcję w profesjonalny dokument
     */
    private formatEnhancedTranscript;
    private translateSentiment;
    /**
     * Zapisuje transkrypcję do RAG jako dokument
     */
    private saveToRAG;
    /**
     * Powiązuje transkrypcję z Sesją Rady
     */
    private linkToSession;
    /**
     * Aktualizuje status transkrypcji w scraped_content
     */
    private updateScrapedContentTranscriptionStatus;
    /**
     * Wyodrębnia słowa kluczowe z tekstu
     */
    private extractKeywords;
}
export declare function getTranscriptionJobService(userId: string): Promise<TranscriptionJobService>;
//# sourceMappingURL=transcription-job-service.d.ts.map