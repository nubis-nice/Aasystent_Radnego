/**
 * Transcription Worker - BullMQ worker do przetwarzania zadań transkrypcji
 *
 * Przetwarza zadania z kolejki Redis i wykonuje transkrypcję YouTube
 */

import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { createClient } from "@supabase/supabase-js";
import { YouTubeDownloader } from "./youtube-downloader.js";
import { getEmbeddingsClient, getAIConfig } from "../ai/index.js";
import type {
  TranscriptionJobData,
  TranscriptionJobResult,
} from "./transcription-queue.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

let worker: Worker<TranscriptionJobData, TranscriptionJobResult> | null = null;
let connection: Redis | null = null;

type RedisConnection = {
  host: string;
  port: number;
  maxRetriesPerRequest: null;
};

/**
 * Inicjalizacja workera transkrypcji
 */
export async function initializeTranscriptionWorker(): Promise<void> {
  if (worker) {
    console.log("[TranscriptionWorker] Already initialized");
    return;
  }

  const redisHost = process.env.REDIS_HOST ?? "localhost";
  const redisPort = Number(process.env.REDIS_PORT ?? 6379);

  try {
    connection = new Redis({
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: null,
    });

    const redisConfig: RedisConnection = {
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: null,
    };

    worker = new Worker<TranscriptionJobData, TranscriptionJobResult>(
      "transcription-jobs",
      async (job: Job<TranscriptionJobData>) => {
        return processTranscriptionJob(job);
      },
      {
        connection: redisConfig,
        concurrency: 1, // Przetwarzaj jedno zadanie naraz (heavy workload)
        limiter: {
          max: 2,
          duration: 60000, // Max 2 zadania na minutę
        },
      },
    );

    worker.on("completed", (job) => {
      console.log(`[TranscriptionWorker] Job ${job.id} completed successfully`);
    });

    worker.on("failed", (job, error) => {
      console.error(
        `[TranscriptionWorker] Job ${job?.id} failed:`,
        error.message,
      );
    });

    worker.on("error", (error) => {
      console.error("[TranscriptionWorker] Worker error:", error);
    });

    console.log(
      `[TranscriptionWorker] Started (redis=${redisHost}:${redisPort})`,
    );
  } catch (error) {
    console.error("[TranscriptionWorker] Failed to initialize:", error);
    throw error;
  }
}

/**
 * Główna logika przetwarzania zadania transkrypcji
 */
async function processTranscriptionJob(
  job: Job<TranscriptionJobData>,
): Promise<TranscriptionJobResult> {
  const { id: jobId, userId, videoUrl, videoTitle } = job.data;
  const startTime = Date.now();

  console.log(`[TranscriptionWorker] Processing job ${jobId}: ${videoTitle}`);

  try {
    // ETAP 1: Pobieranie audio z YouTube
    await updateJobStatus(
      jobId,
      "download",
      5,
      "Pobieranie audio z YouTube...",
    );
    await job.updateProgress({ progress: 5, message: "Pobieranie audio..." });

    const downloader = new YouTubeDownloader();
    await downloader.initializeWithUserConfig(userId);

    const downloadResult = await downloader.downloadAudio(videoUrl);
    if (!downloadResult.success || !downloadResult.audioPath) {
      throw new Error(downloadResult.error || "Błąd pobierania audio");
    }

    // ETAP 2: Konwersja (już wykonana w downloadAudio)
    await updateJobStatus(
      jobId,
      "conversion",
      15,
      "Audio skonwertowane do formatu Whisper",
    );
    await job.updateProgress({ progress: 15, message: "Konwersja zakończona" });

    // ETAP 3: Dzielenie na segmenty (już wykonane w downloadAudio)
    const partsCount = downloadResult.parts?.length || 1;
    await updateJobStatus(
      jobId,
      "splitting",
      20,
      `Podzielono na ${partsCount} segment(ów)`,
    );
    await job.updateProgress({
      progress: 20,
      message: `${partsCount} segment(ów)`,
    });

    // ETAP 4: Transkrypcja Whisper
    await updateJobStatus(
      jobId,
      "transcription",
      25,
      "Transkrypcja Whisper...",
    );
    await job.updateProgress({ progress: 25, message: "Transkrypcja..." });

    const videoIdMatch = videoUrl.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/);
    const videoId = videoIdMatch?.[1] || "unknown";

    const transcriptionResult = await downloader.transcribeAndAnalyze(
      downloadResult.audioPath,
      videoId,
      videoTitle,
      videoUrl,
      downloadResult.parts,
    );

    if (!transcriptionResult.success) {
      throw new Error(
        transcriptionResult.error || "Transkrypcja nie powiodła się",
      );
    }

    // ETAP 5: Usuwanie powtórzeń (wykonane w transcribeAndAnalyze)
    await updateJobStatus(jobId, "deduplication", 62, "Usunięto powtórzenia");
    await job.updateProgress({ progress: 62, message: "Deduplikacja..." });

    // ETAP 6: Korekta językowa (wykonana w transcribeAndAnalyze)
    await updateJobStatus(
      jobId,
      "correction",
      72,
      "Korekta językowa zakończona",
    );
    await job.updateProgress({ progress: 72, message: "Korekta..." });

    // ETAP 7: Analiza treści (wykonana w transcribeAndAnalyze)
    await updateJobStatus(jobId, "analysis", 82, "Analiza treści zakończona");
    await job.updateProgress({ progress: 82, message: "Analiza..." });

    // ETAP 8: Zapisywanie do RAG
    await updateJobStatus(jobId, "saving", 90, "Zapisywanie do RAG...");
    await job.updateProgress({ progress: 90, message: "Zapisywanie..." });

    // Save transcription to RAG
    const documentId = await saveTranscriptionToRAG(
      userId,
      jobId,
      videoTitle,
      videoUrl,
      transcriptionResult.formattedTranscript,
      transcriptionResult.summary,
    );

    // Update job as completed
    await updateJobStatus(
      jobId,
      "completed",
      100,
      "Transkrypcja zakończona!",
      documentId,
    );
    await job.updateProgress({ progress: 100, message: "Zakończono!" });

    const processingTimeMs = Date.now() - startTime;
    console.log(
      `[TranscriptionWorker] Job ${jobId} completed in ${Math.round(
        processingTimeMs / 1000,
      )}s`,
    );

    return {
      success: true,
      documentId,
      processingTimeMs,
      audioIssues: transcriptionResult.audioAnalysis?.issues?.map(
        (i) => i.type,
      ),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Nieznany błąd";
    console.error(`[TranscriptionWorker] Job ${jobId} failed:`, errorMessage);

    await updateJobStatus(
      jobId,
      "failed",
      0,
      errorMessage,
      undefined,
      errorMessage,
    );

    return {
      success: false,
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Aktualizacja statusu zadania w bazie danych
 */
async function updateJobStatus(
  jobId: string,
  status: string,
  progress: number,
  progressMessage: string,
  resultDocumentId?: string,
  error?: string,
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    progress,
    progress_message: progressMessage,
  };

  if (resultDocumentId) {
    update.result_document_id = resultDocumentId;
  }

  if (error) {
    update.error = error;
  }

  if (status === "completed" || status === "failed") {
    update.completed_at = new Date().toISOString();
  }

  await supabase.from("transcription_jobs").update(update).eq("id", jobId);
}

/**
 * Zapisanie transkrypcji do RAG (processed_documents)
 */
async function saveTranscriptionToRAG(
  userId: string,
  jobId: string,
  videoTitle: string,
  videoUrl: string,
  formattedTranscript: string,
  summary: {
    averageTension: number;
    dominantSentiment: string;
    overallCredibility: number;
    speakerCount: number;
    duration: string;
  },
): Promise<string> {
  // Generate embeddings
  const embeddingsClient = await getEmbeddingsClient(userId);
  const embeddingsConfig = await getAIConfig(userId, "embeddings");

  const textForEmbedding = `${videoTitle}\n\n${formattedTranscript.substring(
    0,
    4000,
  )}`;
  const embResponse = await embeddingsClient.embeddings.create({
    model: embeddingsConfig.modelName,
    input: textForEmbedding,
  });

  const embedding = embResponse.data[0].embedding;

  // Save to processed_documents
  const { data: doc, error } = await supabase
    .from("processed_documents")
    .insert({
      user_id: userId,
      title: videoTitle,
      content: formattedTranscript,
      document_type: "transcription",
      source_url: videoUrl,
      embedding,
      metadata: {
        transcriptionJobId: jobId,
        summary,
        processedAt: new Date().toISOString(),
      },
    })
    .select("id")
    .single();

  if (error || !doc) {
    throw new Error(`Błąd zapisu do bazy: ${error?.message}`);
  }

  return doc.id;
}

/**
 * Zamknięcie workera
 */
export async function closeTranscriptionWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
  console.log("[TranscriptionWorker] Closed");
}
