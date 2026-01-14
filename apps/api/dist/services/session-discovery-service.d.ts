/**
 * Session Discovery Service
 *
 * Kaskadowe wyszukiwanie materiałów z sesji rady:
 * 1. RAG Search → processed_documents (transkrypcje, protokoły)
 * 2. YouTube Search → kanał rady miejskiej
 * 3. Auto-Transcription → uruchom transkrypcję w tle
 */
import { SessionQueryIntent, DocumentMatch } from "./document-query-service.js";
export interface SessionDiscoveryResult {
    found: boolean;
    sessionNumber: number;
    requestType: SessionQueryIntent["requestType"];
    documents: DocumentMatch[];
    hasTranscription: boolean;
    hasProtocol: boolean;
    hasVideo: boolean;
    transcriptionStarted: boolean;
    transcriptionJobId?: string;
    message: string;
    suggestions: string[];
}
export interface YouTubeSearchResult {
    videoId: string;
    title: string;
    url: string;
    publishedAt: string;
    channelTitle: string;
}
export declare class SessionDiscoveryService {
    private userId;
    private documentQueryService;
    constructor(userId: string);
    initialize(): Promise<void>;
    /**
     * Główna metoda - odkrywa materiały z sesji rady
     */
    discoverSession(intent: SessionQueryIntent): Promise<SessionDiscoveryResult>;
    /**
     * Rozpoczyna transkrypcję YouTube w tle
     */
    startTranscription(videoUrl: string, videoTitle: string): Promise<{
        jobId: string;
        estimatedTime: string;
    }>;
    private hasRequiredData;
    /**
     * Szuka wideo na YouTube w źródłach danych użytkownika
     */
    private searchYouTubeDataSources;
    private checkExistingTranscriptionJob;
    private extractYouTubeVideoId;
    private arabicToRoman;
    private buildSuccessResult;
    private buildYouTubeFoundResult;
    private buildTranscriptionInProgressResult;
    private buildNotFoundResult;
}
export default SessionDiscoveryService;
//# sourceMappingURL=session-discovery-service.d.ts.map