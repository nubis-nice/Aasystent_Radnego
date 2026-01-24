/**
 * Transcription Queue Service - Kolejkowanie zadań transkrypcji YouTube przez Redis/BullMQ
 *
 * Umożliwia:
 * - Kolejkowanie długich zadań transkrypcji
 * - Odporność na restarty (persystencja w Redis)
 * - Retry przy błędach
 * - Śledzenie postępu w czasie rzeczywistym
 * - Horizontal scaling workerów
 */

import { Queue, QueueEvents } from "bullmq";
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { backgroundTaskService } from "./background-task-service.js";

// ============================================================================
// TYPES
// ============================================================================

export interface TranscriptionJobData {
  id: string;
  userId: string;
  videoUrl: string;
  videoTitle: string;
  sessionId?: string;
  includeSentiment: boolean;
  identifySpeakers: boolean;
  createdAt: string;
}

export interface TranscriptionJobResult {
  success: boolean;
  documentId?: string;
  error?: string;
  processingTimeMs?: number;
  audioIssues?: string[];
}

export interface TranscriptionStepProgress {
  name: string;
  label: string;
  status: "pending" | "active" | "completed" | "failed";
  progress: number;
  startTime?: string;
  endTime?: string;
  duration?: number;
  details?: {
    fileSize?: string;
    downloadSpeed?: string;
    audioIssues?: string[];
    appliedFilters?: string[];
    model?: string;
    language?: string;
    processedDuration?: string;
    totalDuration?: string;
    speakersFound?: number;
    [key: string]: unknown;
  };
}

export interface DetailedTranscriptionProgress {
  globalProgress: number;
  globalMessage: string;
  currentStep: string;
  steps: TranscriptionStepProgress[];
  estimatedTimeRemaining?: number;
  startedAt: string;
  lastUpdate: string;
}

export interface TranscriptionJobStatus {
  id: string;
  status: "waiting" | "active" | "completed" | "failed" | "delayed";
  progress: number;
  progressMessage: string;
  result?: TranscriptionJobResult;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  detailedProgress?: DetailedTranscriptionProgress;
}

export const TRANSCRIPTION_STEPS = [
  {
    name: "download",
    label: "📥 Pobieranie audio z YouTube",
    globalProgressRange: [0, 10] as [number, number],
  },
  {
    name: "conversion",
    label: "🔄 Konwersja do formatu Whisper",
    globalProgressRange: [10, 18] as [number, number],
  },
  {
    name: "splitting",
    label: "✂️ Dzielenie na segmenty",
    globalProgressRange: [18, 22] as [number, number],
  },
  {
    name: "transcription",
    label: "🎤 Transkrypcja Whisper",
    globalProgressRange: [22, 60] as [number, number],
  },
  {
    name: "deduplication",
    label: "🧹 Usuwanie powtórzeń",
    globalProgressRange: [60, 68] as [number, number],
  },
  {
    name: "correction",
    label: "✏️ Korekta językowa (LLM)",
    globalProgressRange: [68, 78] as [number, number],
  },
  {
    name: "analysis",
    label: "🔍 Analiza treści",
    globalProgressRange: [78, 88] as [number, number],
  },
  {
    name: "saving",
    label: "💾 Zapisywanie do RAG",
    globalProgressRange: [88, 100] as [number, number],
  },
] as const;

// ============================================================================
// TRANSCRIPTION QUEUE SERVICE
// ============================================================================

class TranscriptionQueueService {
  private static instance: TranscriptionQueueService | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private queue: Queue<any, any> | null = null;
  private queueEvents: QueueEvents | null = null;
  private connection: Redis | null = null;
  private initialized: boolean = false;

  // Progress tracking cache
  private progressCache: Map<string, { progress: number; message: string }> =
    new Map();

  private constructor() {}

  static getInstance(): TranscriptionQueueService {
    if (!TranscriptionQueueService.instance) {
      TranscriptionQueueService.instance = new TranscriptionQueueService();
    }
    return TranscriptionQueueService.instance;
  }

  /**
   * Inicjalizacja połączenia z Redis i kolejki
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const redisHost = process.env.REDIS_HOST ?? "localhost";
    const redisPort = Number(process.env.REDIS_PORT ?? 6379);

    try {
      this.connection = new Redis({
        host: redisHost,
        port: redisPort,
        maxRetriesPerRequest: null,
      });

      this.queue = new Queue("transcription-jobs", {
        connection: this.connection as never,
        defaultJobOptions: {
          attempts: 3, // 3 próby przy błędach
          backoff: {
            type: "exponential",
            delay: 5000, // Start od 5s, potem 10s, 20s
          },
          removeOnComplete: {
            age: 7 * 86400, // Usuń ukończone po 7 dniach
            count: 500, // Zachowaj max 500 ostatnich
          },
          removeOnFail: {
            age: 30 * 86400, // Usuń nieudane po 30 dniach
          },
          // timeout przeniesiony do Worker options (jobTimeout)
        },
      });

      this.queueEvents = new QueueEvents("transcription-jobs", {
        connection: this.connection as never,
      });

      // Nasłuchuj na ukończone zadania
      this.queueEvents.on("completed", ({ jobId }) => {
        console.log(`[TranscriptionQueue] Job ${jobId} completed`);
        this.progressCache.delete(jobId);
        // Aktualizuj status w background_tasks
        backgroundTaskService
          .updateByJobId(jobId, {
            status: "completed",
            progress: 100,
          })
          .catch((err) =>
            console.error(
              "[TranscriptionQueue] Background task update error:",
              err,
            ),
          );
      });

      this.queueEvents.on("failed", ({ jobId, failedReason }) => {
        console.error(
          `[TranscriptionQueue] Job ${jobId} failed: ${failedReason}`,
        );
        this.progressCache.delete(jobId);
        // Aktualizuj status w background_tasks
        backgroundTaskService
          .updateByJobId(jobId, {
            status: "failed",
            error_message: failedReason,
          })
          .catch((err) =>
            console.error(
              "[TranscriptionQueue] Background task update error:",
              err,
            ),
          );
      });

      this.queueEvents.on("progress", ({ jobId, data }) => {
        const progressData = data as { progress: number; message: string };
        console.log(
          `[TranscriptionQueue] Job ${jobId} progress: ${progressData.progress}% - ${progressData.message}`,
        );
        this.progressCache.set(jobId, progressData);
        // Aktualizuj progress w background_tasks
        backgroundTaskService
          .updateByJobId(jobId, {
            status: "running",
            progress: progressData.progress,
            description: progressData.message,
          })
          .catch((err) =>
            console.error(
              "[TranscriptionQueue] Background task update error:",
              err,
            ),
          );
      });

      this.initialized = true;
      console.log(
        `[TranscriptionQueue] Initialized (redis=${redisHost}:${redisPort})`,
      );
    } catch (error) {
      console.error("[TranscriptionQueue] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Dodaj zadanie transkrypcji do kolejki
   */
  async addJob(
    userId: string,
    videoUrl: string,
    videoTitle: string,
    options: {
      sessionId?: string;
      includeSentiment?: boolean;
      identifySpeakers?: boolean;
      priority?: number;
    } = {},
  ): Promise<string> {
    await this.initialize();

    if (!this.queue) {
      throw new Error("Transcription queue not initialized");
    }

    const jobId = randomUUID();
    const jobData: TranscriptionJobData = {
      id: jobId,
      userId,
      videoUrl,
      videoTitle,
      sessionId: options.sessionId,
      includeSentiment: options.includeSentiment ?? true,
      identifySpeakers: options.identifySpeakers ?? true,
      createdAt: new Date().toISOString(),
    };

    await this.queue.add("youtube-transcription", jobData, {
      jobId,
      priority: options.priority ?? 5, // Domyślny priorytet 5 (1=highest)
    });

    // Zapisz do background_tasks dla Supabase Realtime
    await backgroundTaskService.createTask({
      userId,
      taskType: "transcription",
      title: `Transkrypcja: ${videoTitle}`,
      metadata: { jobId, videoUrl, sessionId: options.sessionId },
    });

    console.log(
      `[TranscriptionQueue] Added job ${jobId} (video="${videoTitle}")`,
    );

    return jobId;
  }

  /**
   * Inicjalizuj detailed progress dla nowego zadania
   */
  private initializeDetailedProgress(): DetailedTranscriptionProgress {
    return {
      globalProgress: 0,
      globalMessage: "Oczekuje w kolejce...",
      currentStep: "download",
      steps: TRANSCRIPTION_STEPS.map((step) => ({
        name: step.name,
        label: step.label,
        status: "pending",
        progress: 0,
      })),
      startedAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
    };
  }

  /**
   * Pobierz status zadania
   */
  async getJobStatus(jobId: string): Promise<TranscriptionJobStatus | null> {
    await this.initialize();

    if (!this.queue) {
      throw new Error("Transcription queue not initialized");
    }

    const job = await this.queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progressData = this.progressCache.get(jobId) ?? {
      progress: 0,
      message: "Oczekuje w kolejce...",
    };

    // Pobierz progress z job data jeśli dostępny
    const jobProgress =
      typeof job.progress === "object"
        ? (job.progress as { progress: number; message: string })
        : progressData;

    return {
      id: jobId,
      status: state as TranscriptionJobStatus["status"],
      progress: jobProgress.progress,
      progressMessage: jobProgress.message,
      result: job.returnvalue ?? undefined,
      error: job.failedReason,
      createdAt: new Date(job.timestamp),
      completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  }

  /**
   * Pobierz wszystkie zadania użytkownika
   */
  async getUserJobs(userId: string): Promise<TranscriptionJobStatus[]> {
    await this.initialize();

    if (!this.queue) {
      return [];
    }

    // Pobierz zadania z różnych stanów
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getJobs(["waiting"]),
      this.queue.getJobs(["active"]),
      this.queue.getJobs(["completed"], 0, 100), // Last 100 completed
      this.queue.getJobs(["failed"], 0, 50), // Last 50 failed
      this.queue.getJobs(["delayed"]),
    ]);

    const allJobs = [
      ...waiting,
      ...active,
      ...completed,
      ...failed,
      ...delayed,
    ];

    // Filtruj po userId i mapuj do status
    const userJobs = await Promise.all(
      allJobs
        .filter((job) => job.data.userId === userId)
        .map(async (job) => {
          const state = await job.getState();

          // Preferuj progressCache (aktualizowane przez Redis events w czasie rzeczywistym)
          // Fallback do job.progress tylko jeśli cache pusty
          const cachedProgress = this.progressCache.get(job.id!);
          let progress = 0;
          let progressMessage = "Oczekuje w kolejce...";

          if (cachedProgress) {
            progress = cachedProgress.progress;
            progressMessage = cachedProgress.message;
          } else if (
            typeof job.progress === "object" &&
            job.progress !== null
          ) {
            const jobProgress = job.progress as {
              progress: number;
              message: string;
            };
            progress = jobProgress.progress ?? 0;
            progressMessage = jobProgress.message ?? "Przetwarzanie...";
          }

          return {
            id: job.id!,
            status: state as TranscriptionJobStatus["status"],
            progress,
            progressMessage,
            result: job.returnvalue ?? undefined,
            error: job.failedReason,
            createdAt: new Date(job.timestamp),
            completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
          };
        }),
    );

    // Sortuj po dacie utworzenia (najnowsze pierwsze)
    return userJobs.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  /**
   * Czekaj na wynik zadania (z timeout)
   */
  async waitForResult(
    jobId: string,
    timeoutMs: number = 7200000, // 2 godziny
  ): Promise<TranscriptionJobResult> {
    await this.initialize();

    if (!this.queue) {
      throw new Error("Transcription queue not initialized");
    }

    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Czekaj na ukończenie
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const state = await job.getState();

      if (state === "completed") {
        return (
          job.returnvalue ?? {
            success: true,
            documentId: undefined,
          }
        );
      }

      if (state === "failed") {
        return {
          success: false,
          error: job.failedReason ?? "Unknown error",
        };
      }

      // Czekaj 2s przed kolejnym sprawdzeniem
      await setTimeout(2000);
    }

    return {
      success: false,
      error: `Timeout after ${timeoutMs}ms`,
    };
  }

  /**
   * Pobierz statystyki kolejki
   */
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    await this.initialize();

    if (!this.queue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Anuluj zadanie
   */
  async cancelJob(jobId: string): Promise<boolean> {
    await this.initialize();

    if (!this.queue) {
      return false;
    }

    const job = await this.queue.getJob(jobId);
    if (!job) {
      return false;
    }

    const state = await job.getState();
    if (state === "completed" || state === "failed") {
      return false; // Nie można anulować zakończonych zadań
    }

    await job.remove();
    this.progressCache.delete(jobId);
    console.log(`[TranscriptionQueue] Cancelled job ${jobId}`);
    return true;
  }

  /**
   * Retry nieudanego zadania
   */
  async retryJob(jobId: string): Promise<boolean> {
    await this.initialize();

    if (!this.queue) {
      return false;
    }

    const job = await this.queue.getJob(jobId);
    if (!job) {
      return false;
    }

    const state = await job.getState();
    if (state !== "failed") {
      return false; // Można retry tylko nieudane
    }

    await job.retry();
    console.log(`[TranscriptionQueue] Retrying job ${jobId}`);
    return true;
  }

  /**
   * Wyczyść kolejkę (tylko do testów/debugowania)
   */
  async clear(): Promise<void> {
    await this.initialize();

    if (!this.queue) return;

    await this.queue.obliterate({ force: true });
    this.progressCache.clear();
    console.log("[TranscriptionQueue] Queue cleared");
  }

  /**
   * Zamknij połączenia
   */
  async close(): Promise<void> {
    if (this.queueEvents) {
      await this.queueEvents.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
    if (this.connection) {
      await this.connection.quit();
    }
    this.initialized = false;
    console.log("[TranscriptionQueue] Closed");
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const transcriptionQueue = TranscriptionQueueService.getInstance();

export async function addTranscriptionJob(
  userId: string,
  videoUrl: string,
  videoTitle: string,
  options?: {
    sessionId?: string;
    includeSentiment?: boolean;
    identifySpeakers?: boolean;
  },
): Promise<string> {
  return transcriptionQueue.addJob(userId, videoUrl, videoTitle, options);
}

export async function getTranscriptionJobStatus(
  jobId: string,
): Promise<TranscriptionJobStatus | null> {
  return transcriptionQueue.getJobStatus(jobId);
}

export async function getUserTranscriptionJobs(
  userId: string,
): Promise<TranscriptionJobStatus[]> {
  return transcriptionQueue.getUserJobs(userId);
}

export async function waitForTranscriptionResult(
  jobId: string,
  timeoutMs?: number,
): Promise<TranscriptionJobResult> {
  return transcriptionQueue.waitForResult(jobId, timeoutMs);
}

export async function getTranscriptionQueueStats() {
  return transcriptionQueue.getStats();
}

export async function cancelTranscriptionJob(jobId: string): Promise<boolean> {
  return transcriptionQueue.cancelJob(jobId);
}

export async function retryTranscriptionJob(jobId: string): Promise<boolean> {
  return transcriptionQueue.retryJob(jobId);
}
