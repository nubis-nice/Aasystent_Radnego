import { Job } from "bullmq";
interface ExtractionJobData {
    documentId: string;
    filePath: string;
    mimeType: string;
}
export declare function processExtraction(job: Job<ExtractionJobData>): Promise<{
    documentId: string;
    extractedText: string;
    qualityScore: number;
    chunksCount: number;
    tokensUsed: unknown;
}>;
export {};
//# sourceMappingURL=extraction.d.ts.map