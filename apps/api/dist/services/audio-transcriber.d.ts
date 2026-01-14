import { Buffer } from "node:buffer";
export interface TranscriptSegment {
    timestamp: string;
    speaker: string;
    text: string;
    sentiment: "positive" | "neutral" | "negative";
    emotion: string;
    emotionEmoji: string;
    tension: number;
    credibility: number;
    credibilityEmoji: string;
}
export interface TranscriptionResult {
    success: boolean;
    rawTranscript: string;
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
        fileName: string;
        fileType: string;
        mimeType: string;
        fileSize: number;
        language: string;
    };
    formattedTranscript: string;
    error?: string;
}
export declare class AudioTranscriber {
    private sttClient;
    private llmClient;
    private sttModel;
    private llmModel;
    constructor();
    /**
     * Inicjalizacja z konfiguracją użytkownika przez AIClientFactory
     */
    initializeWithUserConfig(userId: string): Promise<void>;
    isAudioOrVideo(mimeType: string): boolean;
    transcribe(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<TranscriptionResult>;
    private whisperTranscribe;
    private analyzeTranscript;
    private formatTranscript;
    private translateSentiment;
    private getFileType;
    getCredibilityEmoji(credibility: number): string;
}
//# sourceMappingURL=audio-transcriber.d.ts.map