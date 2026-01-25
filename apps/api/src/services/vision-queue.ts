/**
 * Vision Queue Service - Kolejkowanie zadań OCR/Vision AI przez Redis/BullMQ
 *
 * Umożliwia:
 * - Kolejkowanie zadań Vision AI (Ollama, OpenAI)
 * - Rate limiting dla API
 * - Retry przy błędach
 * - Śledzenie postępu
 */

import { Queue, QueueEvents } from "bullmq";
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

// ============================================================================
// TYPES
// ============================================================================

export interface VisionJobData {
  id: string;
  userId: string;
  imageBase64: string;
  prompt: string;
  pageNumber?: number;
  fileName?: string;
  provider: string; // "ollama" | "openai" | "google"
  model: string;
  createdAt: string;
}

export interface VisionJobResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
  processingTimeMs?: number;
}

export interface VisionJobStatus {
  id: string;
  status: "waiting" | "active" | "completed" | "failed";
  progress?: number;
  result?: VisionJobResult;
  error?: string;
}

// ============================================================================
// VISION QUEUE SERVICE
// ============================================================================

class VisionQueueService {
  private static instance: VisionQueueService | null = null;
  private queue: Queue<VisionJobData, VisionJobResult> | null = null;
  private queueEvents: QueueEvents | null = null;
  private connection: Redis | null = null;
  private initialized: boolean = false;

  // Pending results cache (for sync retrieval)
  private resultsCache: Map<string, VisionJobResult> = new Map();

  private constructor() {}

  static getInstance(): VisionQueueService {
    if (!VisionQueueService.instance) {
      VisionQueueService.instance = new VisionQueueService();
    }
    return VisionQueueService.instance;
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

      // @ts-expect-error - bullmq Queue type mismatch
      this.queue = new Queue<VisionJobData, VisionJobResult>("vision-jobs", {
        // @ts-expect-error - ioredis version mismatch with bullmq
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3, // 3 próby przy błędach
          backoff: {
            type: "exponential",
            delay: 2000, // Start od 2s, potem 4s, 8s
          },
          removeOnComplete: {
            age: 3600, // Usuń ukończone po 1h
            count: 100, // Zachowaj max 100 ostatnich
          },
          removeOnFail: {
            age: 86400, // Usuń nieudane po 24h
          },
        },
      });

      this.queueEvents = new QueueEvents("vision-jobs", {
        // @ts-expect-error - ioredis version mismatch with bullmq
        connection: this.connection,
      });

      // Nasłuchuj na ukończone zadania
      this.queueEvents.on("completed", ({ jobId, returnvalue }) => {
        console.log(`[VisionQueue] Job ${jobId} completed`);
        if (returnvalue) {
          this.resultsCache.set(
            jobId,
            returnvalue as unknown as VisionJobResult,
          );
          // Usuń z cache po 5 minutach
          globalThis.setTimeout(
            () => this.resultsCache.delete(jobId),
            5 * 60 * 1000,
          );
        }
      });

      this.queueEvents.on("failed", ({ jobId, failedReason }) => {
        console.error(`[VisionQueue] Job ${jobId} failed: ${failedReason}`);
        this.resultsCache.set(jobId, {
          success: false,
          text: "",
          error: failedReason,
        });
      });

      this.initialized = true;
      console.log(
        `[VisionQueue] Initialized (redis=${redisHost}:${redisPort})`,
      );
    } catch (error) {
      console.error("[VisionQueue] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Dodaj zadanie Vision do kolejki
   */
  async addJob(
    userId: string,
    imageBase64: string,
    prompt: string,
    options: {
      provider: string;
      model: string;
      pageNumber?: number;
      fileName?: string;
      priority?: number;
    },
  ): Promise<string> {
    await this.initialize();

    if (!this.queue) {
      throw new Error("Vision queue not initialized");
    }

    const jobId = randomUUID();
    const jobData: VisionJobData = {
      id: jobId,
      userId,
      imageBase64,
      prompt,
      pageNumber: options.pageNumber,
      fileName: options.fileName,
      provider: options.provider,
      model: options.model,
      createdAt: new Date().toISOString(),
    };

    await this.queue.add("vision-ocr", jobData, {
      jobId,
      priority: options.priority ?? 5, // Domyślny priorytet 5 (1=highest)
    });

    console.log(
      `[VisionQueue] Added job ${jobId} (provider=${options.provider}, model=${options.model})`,
    );

    return jobId;
  }

  /**
   * Dodaj wiele zadań Vision jako batch
   */
  async addBatch(
    userId: string,
    pages: Array<{
      imageBase64: string;
      pageNumber: number;
    }>,
    prompt: string,
    options: {
      provider: string;
      model: string;
      fileName?: string;
    },
  ): Promise<string[]> {
    await this.initialize();

    if (!this.queue) {
      throw new Error("Vision queue not initialized");
    }

    const jobIds: string[] = [];

    const jobs = pages.map((page, index) => {
      const jobId = randomUUID();
      jobIds.push(jobId);

      return {
        name: "vision-ocr",
        data: {
          id: jobId,
          userId,
          imageBase64: page.imageBase64,
          prompt,
          pageNumber: page.pageNumber,
          fileName: options.fileName,
          provider: options.provider,
          model: options.model,
          createdAt: new Date().toISOString(),
        } as VisionJobData,
        opts: {
          jobId,
          priority: 5 + index, // Kolejność stron
        },
      };
    });

    await this.queue.addBulk(jobs);

    console.log(
      `[VisionQueue] Added batch of ${jobs.length} jobs (provider=${options.provider})`,
    );

    return jobIds;
  }

  /**
   * Pobierz status zadania
   */
  async getJobStatus(jobId: string): Promise<VisionJobStatus> {
    await this.initialize();

    if (!this.queue) {
      throw new Error("Vision queue not initialized");
    }

    const job = await this.queue.getJob(jobId);
    if (!job) {
      // Sprawdź cache
      const cached = this.resultsCache.get(jobId);
      if (cached) {
        return {
          id: jobId,
          status: cached.success ? "completed" : "failed",
          result: cached,
          error: cached.error,
        };
      }
      return { id: jobId, status: "waiting" };
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
      id: jobId,
      status: state as VisionJobStatus["status"],
      progress: typeof progress === "number" ? progress : undefined,
      result: job.returnvalue ?? undefined,
      error: job.failedReason,
    };
  }

  /**
   * Czekaj na wynik zadania (z timeout)
   */
  async waitForResult(
    jobId: string,
    timeoutMs: number = 60000,
  ): Promise<VisionJobResult> {
    await this.initialize();

    if (!this.queue) {
      throw new Error("Vision queue not initialized");
    }

    const job = await this.queue.getJob(jobId);
    if (!job) {
      // Sprawdź cache
      const cached = this.resultsCache.get(jobId);
      if (cached) return cached;
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
            text: "",
          }
        );
      }

      if (state === "failed") {
        return {
          success: false,
          text: "",
          error: job.failedReason ?? "Unknown error",
        };
      }

      // Czekaj 500ms przed kolejnym sprawdzeniem
      await setTimeout(500);
    }

    return {
      success: false,
      text: "",
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
  }> {
    await this.initialize();

    if (!this.queue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0 };
    }

    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  /**
   * Wyczyść kolejkę (tylko do testów/debugowania)
   */
  async clear(): Promise<void> {
    await this.initialize();

    if (!this.queue) return;

    await this.queue.obliterate({ force: true });
    this.resultsCache.clear();
    console.log("[VisionQueue] Queue cleared");
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
    console.log("[VisionQueue] Closed");
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const visionQueue = VisionQueueService.getInstance();

export async function addVisionJob(
  userId: string,
  imageBase64: string,
  prompt: string,
  options: {
    provider: string;
    model: string;
    pageNumber?: number;
    fileName?: string;
  },
): Promise<string> {
  return visionQueue.addJob(userId, imageBase64, prompt, options);
}

export async function addVisionBatch(
  userId: string,
  pages: Array<{ imageBase64: string; pageNumber: number }>,
  prompt: string,
  options: { provider: string; model: string; fileName?: string },
): Promise<string[]> {
  return visionQueue.addBatch(userId, pages, prompt, options);
}

export async function getVisionJobStatus(
  jobId: string,
): Promise<VisionJobStatus> {
  return visionQueue.getJobStatus(jobId);
}

export async function waitForVisionResult(
  jobId: string,
  timeoutMs?: number,
): Promise<VisionJobResult> {
  return visionQueue.waitForResult(jobId, timeoutMs);
}

export async function getVisionQueueStats() {
  return visionQueue.getStats();
}
