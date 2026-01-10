import { Job } from "bullmq";
import {
  createOpenAIClient,
  generateSummary,
  scanForRisks,
} from "@aasystent-radnego/shared";

interface AnalysisJobData {
  documentId: string;
  text: string;
  analysisTypes: Array<"summary" | "risk_scan">;
}

export async function processAnalysis(job: Job<AnalysisJobData>) {
  const { documentId, text, analysisTypes } = job.data;

  job.log(`Starting analysis for document ${documentId}`);
  await job.updateProgress(10);

  const openai = createOpenAIClient();
  const results: Record<string, unknown> = {};

  try {
    // 1. Streszczenie i punkty kluczowe
    if (analysisTypes.includes("summary")) {
      job.log("Generating summary...");
      const summary = await generateSummary(openai, text);

      results.summary = {
        analysis_type: "summary",
        result: {
          summary: summary.summary,
          keyPoints: summary.keyPoints,
        },
        tokens_used: summary.tokensUsed,
        model_used: "gpt-4-turbo-preview",
        prompt_version: "v1",
      };

      await job.updateProgress(50);
    }

    // 2. Skanowanie ryzyk
    if (analysisTypes.includes("risk_scan")) {
      job.log("Scanning for risks...");
      const risks = await scanForRisks(openai, text);

      results.risk_scan = {
        analysis_type: "risk_scan",
        result: {
          risks: risks.risks,
          totalRisks: risks.risks.length,
          highSeverityCount: risks.risks.filter(
            (r: any) => r.severity === "high"
          ).length,
        },
        tokens_used: risks.tokensUsed,
        model_used: "gpt-4-turbo-preview",
        prompt_version: "v1",
      };

      await job.updateProgress(100);
    }

    // 3. Zapisz analizy do bazy
    // TODO: Insert analyses into database
    job.log(`Saving ${Object.keys(results).length} analyses to database`);

    return {
      documentId,
      analyses: results,
    };
  } catch (error) {
    job.log(`Analysis failed: ${error}`);
    throw error;
  }
}
