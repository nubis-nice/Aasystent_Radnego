export interface DownloadResult {
    success: boolean;
    audioPath?: string;
    title?: string;
    duration?: string;
    error?: string;
}
export interface TranscriptSegment {
    timestamp: string;
    speaker: string;
    text: string;
    sentiment: string;
    emotion: string;
    emotionEmoji: string;
    tension: number;
    credibility: number;
    credibilityEmoji: string;
}
export interface TranscriptionWithAnalysis {
    success: boolean;
    rawTranscript: string;
    formattedTranscript: string;
    segments: TranscriptSegment[];
    summary: {
        averageTension: number;
        dominantSentiment: string;
        overallCredibility: number;
        overallCredibilityEmoji: string;
        speakerCount: number;
        duration: string;
    };
    metadata: {
        videoId: string;
        videoTitle: string;
        videoUrl: string;
    };
    error?: string;
}
export declare class YouTubeDownloader {
    private openai;
    private tempDir;
    constructor();
    initializeWithUserConfig(userId: string): Promise<void>;
    downloadAudio(videoUrl: string): Promise<DownloadResult>;
    private runYtDlp;
    transcribeAndAnalyze(audioPath: string, videoId: string, videoTitle: string, videoUrl: string): Promise<TranscriptionWithAnalysis>;
    private correctTranscript;
    private analyzeTranscript;
    private formatTranscriptMarkdown;
    private extractVideoId;
}
//# sourceMappingURL=youtube-downloader.d.ts.map