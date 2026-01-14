export interface YouTubeVideo {
    id: string;
    title: string;
    description: string;
    publishedAt: string;
    thumbnailUrl: string;
    duration?: string;
    url: string;
}
export interface YouTubeChannelConfig {
    channelUrl: string;
    channelId?: string;
    name: string;
    apiKey?: string;
    method?: "scraping" | "api";
}
export interface SessionListResult {
    success: boolean;
    sessions: YouTubeVideo[];
    channelName: string;
    error?: string;
}
export interface TranscriptionRequest {
    videoId: string;
    videoUrl: string;
    videoTitle: string;
}
export interface SessionAnalysisResult {
    sessionNumber: number | null;
    confidence: number;
    reasoning: string;
}
export interface UserMunicipalityInfo {
    municipality: string | null;
    councilName: string | null;
    voivodeship: string | null;
}
export declare class YouTubeSessionService {
    private llmClient;
    private userId;
    private modelName;
    private municipalityInfo;
    constructor();
    initializeWithUserConfig(userId: string): Promise<void>;
    /**
     * Pobiera informacje o gminie użytkownika z profilu
     */
    private getMunicipalityInfo;
    /**
     * Analizuje tytuł wideo YouTube i wyodrębnia numer sesji rady
     * Konwertuje numery rzymskie na arabskie
     */
    analyzeVideoTitle(videoTitle: string): Promise<SessionAnalysisResult>;
    /**
     * Fallback: Analiza tytułu za pomocą regex (bez LLM)
     */
    private analyzeVideoTitleWithRegex;
    /**
     * Generuje dynamiczne zapytanie YouTube na podstawie kontekstu
     */
    generateSearchQuery(context: string, documentContext?: {
        title?: string;
        description?: string;
        topics?: string[];
    }): Promise<string>;
    /**
     * Inteligentne wyszukiwanie kanału YouTube gminy przez LLM
     * Generuje zapytanie wyszukiwania na podstawie danych użytkownika
     */
    private findMunicipalityChannel;
    /**
     * Wyszukuje wideo na YouTube z dynamicznym zapytaniem
     * Obsługuje zarówno sesje rady jak i dowolne materiały
     */
    searchWithContext(userQuery: string, documentContext?: {
        title?: string;
        description?: string;
        topics?: string[];
    }): Promise<SessionListResult>;
    getCouncilSessions(channelConfig?: YouTubeChannelConfig, searchQuery?: string): Promise<SessionListResult>;
    private searchYouTubeVideos;
    private scrapeChannelVideos;
    /**
     * Pobiera wideo z kanału YouTube przez oficjalne Data API v3
     */
    fetchChannelVideosViaAPI(config: YouTubeChannelConfig): Promise<YouTubeVideo[]>;
    formatSessionList(sessions: YouTubeVideo[]): string;
    getVideoInfo(videoUrl: string): Promise<YouTubeVideo | null>;
    isSessionRequest(message: string): boolean;
    detectSessionSelection(message: string, availableSessions: YouTubeVideo[]): YouTubeVideo | null;
}
export declare const youtubeSessionService: YouTubeSessionService;
//# sourceMappingURL=youtube-session-service.d.ts.map