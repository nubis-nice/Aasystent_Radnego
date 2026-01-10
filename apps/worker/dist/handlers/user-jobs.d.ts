import type { Job } from "bullmq";
export interface UserJobData {
    userId: string;
    action: "analyze_document" | "export_chat" | "delete_document" | "summarize_document";
    data: {
        documentId?: string;
        chatId?: string;
        [key: string]: unknown;
    };
}
export declare function processUserJob(job: Job<UserJobData>): Promise<{
    success: boolean;
    documentId: string;
    analysis: {
        summary: string;
        keyPoints: string[];
        riskLevel: string;
        processingTime: string;
    };
} | {
    success: boolean;
    chatId: string;
    exportUrl: string;
    messageCount: number;
    exportDate: string;
} | {
    success: boolean;
    documentId: string;
    deletedAt: string;
} | {
    success: boolean;
    documentId: string;
    summary: string;
    wordCount: number;
    processingTime: string;
}>;
//# sourceMappingURL=user-jobs.d.ts.map