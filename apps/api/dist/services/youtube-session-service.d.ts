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
export declare class YouTubeSessionService {
    private openai;
    constructor();
    initializeWithUserConfig(userId: string): Promise<void>;
    getCouncilSessions(channelConfig?: YouTubeChannelConfig, searchQuery?: string): Promise<SessionListResult>;
    private searchYouTubeVideos;
    private scrapeChannelVideos;
    formatSessionList(sessions: YouTubeVideo[]): string;
    getVideoInfo(videoUrl: string): Promise<YouTubeVideo | null>;
    isSessionRequest(message: string): boolean;
    detectSessionSelection(message: string, availableSessions: YouTubeVideo[]): YouTubeVideo | null;
}
export declare const youtubeSessionService: YouTubeSessionService;
//# sourceMappingURL=youtube-session-service.d.ts.map