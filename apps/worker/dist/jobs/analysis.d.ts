import { Job } from "bullmq";
interface AnalysisJobData {
    documentId: string;
    text: string;
    analysisTypes: Array<"summary" | "risk_scan">;
}
export declare function processAnalysis(job: Job<AnalysisJobData>): Promise<{
    documentId: string;
    analyses: Record<string, unknown>;
}>;
export {};
//# sourceMappingURL=analysis.d.ts.map