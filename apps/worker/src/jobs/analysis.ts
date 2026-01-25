/**
 * Analysis Worker - Przetwarza zadania analizy dokumentów z kolejki BullMQ
 */

import { Job } from "bullmq";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy initialization - unikamy błędów przy braku env vars podczas importu
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
      );
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabase;
}

// Typ danych zadania analizy
export interface AnalysisJobData {
  userId: string;
  documentId: string;
  documentTitle: string;
}

export interface AnalysisJobResult {
  success: boolean;
  documentId: string;
  documentTitle: string;
  analysisPrompt?: string;
  systemPrompt?: string;
  score?: {
    relevanceScore: number;
    urgencyScore: number;
    typeScore: number;
    totalScore: number;
    priority: string;
  };
  references?: {
    found: number;
    missing: number;
  };
  error?: string;
}

/**
 * Główna funkcja przetwarzania zadania analizy dokumentu
 */
export async function processDocumentAnalysis(
  job: Job<AnalysisJobData, AnalysisJobResult>,
): Promise<AnalysisJobResult> {
  const { userId, documentId, documentTitle } = job.data;

  console.log(`[AnalysisWorker] Starting analysis for document ${documentId}`);
  job.log(`Starting analysis for document: ${documentTitle}`);

  try {
    // Inicjalizacja - dynamiczne importy aby uniknąć problemów z env vars
    await job.updateProgress({ progress: 10, description: "Inicjalizacja..." });

    const { DocumentAnalysisService } =
      await import("../../../api/src/services/document-analysis-service.js");
    const { DocumentScorer } =
      await import("../../../api/src/services/document-scorer.js");

    const analysisService = new DocumentAnalysisService();
    await analysisService.initialize(userId);

    // Budowanie kontekstu RAG
    await job.updateProgress({
      progress: 30,
      description: "Budowanie kontekstu RAG...",
    });
    job.log("Building RAG context...");

    const analysisContext = await analysisService.buildAnalysisContext(
      userId,
      documentId,
    );

    if (!analysisContext) {
      throw new Error("Nie znaleziono dokumentu lub błąd budowania kontekstu");
    }

    // Scoring dokumentu
    await job.updateProgress({
      progress: 60,
      description: "Obliczanie scoringu...",
    });
    job.log("Calculating document score...");

    const scorer = new DocumentScorer();
    const { data: docForScore } = await getSupabase()
      .from("processed_documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();

    const score = docForScore ? scorer.calculateScore(docForScore) : null;

    // Generowanie promptu analizy
    await job.updateProgress({
      progress: 80,
      description: "Generowanie analizy...",
    });
    job.log("Generating analysis prompt...");

    const analysisResult =
      analysisService.generateAnalysisPrompt(analysisContext);

    // Zakończenie
    await job.updateProgress({
      progress: 100,
      description: `Analiza zakończona: ${documentTitle}`,
    });
    job.log(`Analysis completed for document ${documentId}`);

    console.log(
      `[AnalysisWorker] ✅ Completed analysis for document ${documentId}`,
    );

    return {
      success: true,
      documentId,
      documentTitle: analysisContext.mainDocument.title,
      analysisPrompt: analysisResult.prompt,
      systemPrompt: analysisResult.systemPrompt,
      score: score
        ? {
            relevanceScore: score.relevanceScore,
            urgencyScore: score.urgencyScore,
            typeScore: score.typeScore,
            totalScore: score.totalScore,
            priority: score.priority,
          }
        : undefined,
      references: {
        found: analysisContext.references.filter(
          (r: { found: boolean }) => r.found,
        ).length,
        missing: analysisContext.missingReferences.length,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[AnalysisWorker] ❌ Failed analysis for document ${documentId}:`,
      errorMessage,
    );
    job.log(`Analysis failed: ${errorMessage}`);

    return {
      success: false,
      documentId,
      documentTitle,
      error: errorMessage,
    };
  }
}
