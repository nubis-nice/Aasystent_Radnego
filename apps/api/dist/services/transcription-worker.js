/**
 * Transcription Worker - BullMQ worker do przetwarzania zadań transkrypcji
 *
 * Przetwarza zadania z kolejki Redis i wykonuje transkrypcję YouTube
 */
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { createClient } from "@supabase/supabase-js";
import { YouTubeDownloader } from "./youtube-downloader.js";
import { getEmbeddingsClient, getAIConfig } from "../ai/index.js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
let worker = null;
let connection = null;
/**
 * Inicjalizacja workera transkrypcji
 */
export async function initializeTranscriptionWorker() {
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
        const redisConfig = {
            host: redisHost,
            port: redisPort,
            maxRetriesPerRequest: null,
        };
        worker = new Worker("transcription-jobs", async (job) => {
            return processTranscriptionJob(job);
        }, {
            connection: redisConfig,
            concurrency: 1, // Przetwarzaj jedno zadanie naraz (heavy workload)
            limiter: {
                max: 2,
                duration: 60000, // Max 2 zadania na minutę
            },
        });
        worker.on("completed", (job) => {
            console.log(`[TranscriptionWorker] Job ${job.id} completed successfully`);
        });
        worker.on("failed", (job, error) => {
            console.error(`[TranscriptionWorker] Job ${job?.id} failed:`, error.message);
        });
        worker.on("error", (error) => {
            console.error("[TranscriptionWorker] Worker error:", error);
        });
        console.log(`[TranscriptionWorker] Started (redis=${redisHost}:${redisPort})`);
    }
    catch (error) {
        console.error("[TranscriptionWorker] Failed to initialize:", error);
        throw error;
    }
}
/**
 * Główna logika przetwarzania zadania transkrypcji
 */
async function processTranscriptionJob(job) {
    const { id: jobId, userId, videoUrl, videoTitle } = job.data;
    const startTime = Date.now();
    console.log(`[TranscriptionWorker] Processing job ${jobId}: ${videoTitle}`);
    try {
        // Update status: downloading
        await updateJobStatus(jobId, "downloading", 10, "Pobieranie audio z YouTube...");
        await job.updateProgress({ progress: 10, message: "Pobieranie audio..." });
        // Initialize downloader with user config
        const downloader = new YouTubeDownloader();
        await downloader.initializeWithUserConfig(userId);
        // Download audio
        const downloadResult = await downloader.downloadAudio(videoUrl);
        if (!downloadResult.success || !downloadResult.audioPath) {
            throw new Error(downloadResult.error || "Błąd pobierania audio");
        }
        // Update status: preprocessing
        await updateJobStatus(jobId, "preprocessing", 20, "Analiza i normalizacja audio...");
        await job.updateProgress({
            progress: 20,
            message: "Przetwarzanie audio...",
        });
        // Update status: transcribing
        await updateJobStatus(jobId, "transcribing", 35, "Transkrypcja audio (może potrwać kilka minut)...");
        await job.updateProgress({ progress: 35, message: "Transkrypcja..." });
        // Extract video ID
        const videoIdMatch = videoUrl.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/);
        const videoId = videoIdMatch?.[1] || "unknown";
        // Transcribe
        const transcriptionResult = await downloader.transcribeAndAnalyze(downloadResult.audioPath, videoId, videoTitle, videoUrl, true // enablePreprocessing
        );
        if (!transcriptionResult.success) {
            throw new Error(transcriptionResult.error || "Transkrypcja nie powiodła się");
        }
        // Update status: analyzing
        await updateJobStatus(jobId, "analyzing", 70, "Analiza transkrypcji...");
        await job.updateProgress({ progress: 70, message: "Analiza..." });
        // Update status: saving
        await updateJobStatus(jobId, "saving", 85, "Zapisywanie do bazy danych...");
        await job.updateProgress({ progress: 85, message: "Zapisywanie..." });
        // Save transcription to RAG
        const documentId = await saveTranscriptionToRAG(userId, jobId, videoTitle, videoUrl, transcriptionResult.formattedTranscript, transcriptionResult.summary);
        // Update job as completed
        await updateJobStatus(jobId, "completed", 100, "Transkrypcja zakończona!", documentId);
        await job.updateProgress({ progress: 100, message: "Zakończono!" });
        const processingTimeMs = Date.now() - startTime;
        console.log(`[TranscriptionWorker] Job ${jobId} completed in ${Math.round(processingTimeMs / 1000)}s`);
        return {
            success: true,
            documentId,
            processingTimeMs,
            audioIssues: transcriptionResult.audioAnalysis?.issues?.map((i) => i.type),
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Nieznany błąd";
        console.error(`[TranscriptionWorker] Job ${jobId} failed:`, errorMessage);
        await updateJobStatus(jobId, "failed", 0, errorMessage, undefined, errorMessage);
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
async function updateJobStatus(jobId, status, progress, progressMessage, resultDocumentId, error) {
    const update = {
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
async function saveTranscriptionToRAG(userId, jobId, videoTitle, videoUrl, formattedTranscript, summary) {
    // Generate embeddings
    const embeddingsClient = await getEmbeddingsClient(userId);
    const embeddingsConfig = await getAIConfig(userId, "embeddings");
    const textForEmbedding = `${videoTitle}\n\n${formattedTranscript.substring(0, 4000)}`;
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
export async function closeTranscriptionWorker() {
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
//# sourceMappingURL=transcription-worker.js.map