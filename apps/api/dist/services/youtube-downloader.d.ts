import { type AudioPart } from "./audio-preprocessor.js";
import type { AudioAnalysis } from "./audio-analyzer.js";
export interface DownloadResult {
    success: boolean;
    audioPath?: string;
    title?: string;
    duration?: string;
    error?: string;
    parts?: AudioPart[];
    splitMetadata?: {
        totalDuration: number;
        chunkingEnabled: boolean;
    };
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
    audioAnalysis?: AudioAnalysis;
    error?: string;
}
export declare class YouTubeDownloader {
    private sttClient;
    private llmClient;
    private tempDir;
    private userId;
    private sttModel;
    private llmModel;
    constructor();
    /**
     * Normalizuj nazwę modelu STT dla faster-whisper-server
     * Mapuje różne formaty nazw na prawidłowe nazwy modeli
     */
    private normalizeSTTModel;
    /**
     * Inicjalizacja z konfiguracją użytkownika przez AIClientFactory
     */
    initializeWithUserConfig(userId: string): Promise<void>;
    downloadAudio(videoUrl: string, enableChunking?: boolean): Promise<DownloadResult>;
    private extractVideoId;
    private runYtDlp;
    /**
     * Transkrybuj pojedynczy plik audio (dla krótkich nagrań)
     */
    private transcribeSingleFile;
    /**
     * Transkrybuj pojedynczy chunk audio z timeout
     */
    private transcribeChunk;
    transcribeAndAnalyze(audioPath: string, videoId: string, videoTitle: string, videoUrl: string, precomputedParts?: AudioPart[]): Promise<TranscriptionWithAnalysis>;
    /**
     * Usuwa powtarzające się frazy z transkrypcji (halucynacje Whisper)
     * V3: Algorytm iteracyjny dla fraz wielowyrazowych
     */
    private removeRepetitions;
    /**
     * Oblicza podobieństwo dwóch stringów (0-1)
     */
    private stringSimilarity;
    private correctTranscript;
    private analyzeTranscript;
    private formatTranscriptMarkdown;
}
//# sourceMappingURL=youtube-downloader.d.ts.map