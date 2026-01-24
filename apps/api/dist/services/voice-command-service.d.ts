export type VoiceIntent = "navigation" | "search" | "chat" | "control" | "unknown";
export type VoiceAction = {
    type: "navigate";
    path: string;
} | {
    type: "search";
    query: string;
    tool?: string;
} | {
    type: "chat";
    message: string;
} | {
    type: "control";
    command: string;
};
export interface VoiceCommandResult {
    intent: VoiceIntent;
    confidence: number;
    action: VoiceAction;
    entities?: Record<string, unknown>;
    userFriendlyMessage: string;
}
export declare class VoiceCommandService {
    private userId;
    private intentDetector;
    constructor(userId: string);
    processCommand(transcription: string): Promise<VoiceCommandResult>;
    private buildAction;
    private buildUserFriendlyMessage;
    private getPageName;
    private getControlMessage;
}
//# sourceMappingURL=voice-command-service.d.ts.map