export type VoiceIntent = "navigation" | "search" | "chat" | "control" | "unknown";
export interface DetectedIntent {
    intent: VoiceIntent;
    confidence: number;
    entities: {
        action?: string;
        target?: string;
        query?: string;
        path?: string;
        command?: string;
        [key: string]: unknown;
    };
    reasoning?: string;
}
export declare class VoiceIntentDetector {
    private llmClient;
    private llmModelName;
    private userId;
    private assistantName;
    constructor(userId: string);
    private initialize;
    private loadAssistantName;
    getAssistantName(): string;
    private stripWakeWord;
    isWakeWordDetected(transcription: string): boolean;
    detectIntent(transcription: string): Promise<DetectedIntent>;
    private detectQuickPatterns;
    mapIntentToPath(intent: DetectedIntent): string | null;
}
//# sourceMappingURL=voice-intent-detector.d.ts.map