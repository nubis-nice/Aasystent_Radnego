/**
 * Document Process Queue - Redis/BullMQ queue for OCR/transcription jobs
 * Zapewnia persystencję zadań przy zerwaniu sesji przeglądarki
 */

import { Queue, QueueEvents } from "bullmq";
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { backgroundTaskService } from "./background-task-service.js";

// ============================================================================
// TYPES
// ============================================================================

export interface DocumentProcessJobData {
  userId: string;
  fileName: string;
  fileBuffer: string; // base64 encoded
  mimeType: string;
  fileSize: number;
  options?: {
    useVisionOnly?: boolean;
    tesseractConfidenceThreshold?: number;
    visionMaxDimension?: number;
  };
}

export interface DocumentProcessJobResult {
  success: boolean;
  text?: string;
  metadata?: {
    fileName: string;
    fileType: string;
    mimeType: string;
    fileSize: number;
    processingMethod: string;
    confidence?: number;
    language?: string;
    ocrEngine?: string;
    pageCount?: number;
  };
  error?: string;
}

export interface DocumentJobRecord {
  id: string;
  user_id: string;
  job_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  result: DocumentProcessJobResult | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// ============================================================================
// QUEUE SINGLETON
// ============================================================================

const redisHost = process.env.REDIS_HOST ?? "localhost";
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

class DocumentProcessQueue {
  private queue: Queue<
    DocumentProcessJobData,
    DocumentProcessJobResult
  > | null = null;
  private queueEvents: QueueEvents | null = null;
  private connection: Redis | null = null;
  private supabase = createClient(supabaseUrl, supabaseServiceKey);
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.connection = new Redis({
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue<DocumentProcessJobData, DocumentProcessJobResult>(
      "document-process-jobs",
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        connection: this.connection as any,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: false, // Keep completed jobs for user to see
          removeOnFail: false,
        },
      },
    );

    this.queueEvents = new QueueEvents("document-process-jobs", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connection: this.connection as any,
    });

    // Listen for job events
    this.queueEvents.on("completed", async ({ jobId, returnvalue }) => {
      console.log(`[DocumentProcessQueue] ✅ Job ${jobId} completed`);
      await this.updateJobStatus(
        jobId,
        "completed",
        returnvalue as unknown as DocumentProcessJobResult,
      );
      // Aktualizuj background_tasks
      backgroundTaskService
        .updateByJobId(jobId, {
          status: "completed",
          progress: 100,
        })
        .catch((err) =>
          console.error("[DocumentProcessQueue] Background task error:", err),
        );
    });

    this.queueEvents.on("failed", async ({ jobId, failedReason }) => {
      console.log(
        `[DocumentProcessQueue] ❌ Job ${jobId} failed: ${failedReason}`,
      );
      await this.updateJobStatus(jobId, "failed", undefined, failedReason);
      // Aktualizuj background_tasks
      backgroundTaskService
        .updateByJobId(jobId, {
          status: "failed",
          error_message: failedReason,
        })
        .catch((err) =>
          console.error("[DocumentProcessQueue] Background task error:", err),
        );
    });

    this.queueEvents.on("progress", async ({ jobId, data }) => {
      const progress =
        typeof data === "number"
          ? data
          : ((data as { progress?: number })?.progress ?? 0);
      await this.updateJobProgress(jobId, progress);
      // Aktualizuj background_tasks
      backgroundTaskService
        .updateByJobId(jobId, {
          status: "running",
          progress,
        })
        .catch((err) =>
          console.error("[DocumentProcessQueue] Background task error:", err),
        );
    });

    this.initialized = true;
    console.log(
      `[DocumentProcessQueue] Initialized (redis=${redisHost}:${redisPort})`,
    );
  }

  /**
   * Dodaj zadanie do kolejki
   */
  async addJob(
    data: DocumentProcessJobData,
  ): Promise<{ jobId: string; recordId: string }> {
    await this.initialize();
    if (!this.queue) throw new Error("Queue not initialized");

    const jobId = `doc-${randomUUID()}`;

    // Zapisz rekord w Supabase PRZED dodaniem do kolejki
    const { data: record, error: dbError } = await this.supabase
      .from("document_jobs")
      .insert({
        user_id: data.userId,
        job_id: jobId,
        file_name: data.fileName,
        mime_type: data.mimeType,
        file_size: data.fileSize,
        status: "pending",
        progress: 0,
      })
      .select("id")
      .single();

    if (dbError) {
      console.error(`[DocumentProcessQueue] DB insert error:`, dbError);
      throw new Error(`Failed to create job record: ${dbError.message}`);
    }

    // Dodaj do kolejki Redis
    await this.queue.add("process-document", data, {
      jobId,
      priority: 1,
    });

    // Zapisz do background_tasks dla Supabase Realtime
    backgroundTaskService
      .createTask({
        userId: data.userId,
        taskType: "ocr",
        title: `OCR: ${data.fileName}`,
        metadata: { jobId, recordId: record.id, fileName: data.fileName },
      })
      .catch((err) =>
        console.error("[DocumentProcessQueue] Background task error:", err),
      );

    console.log(
      `[DocumentProcessQueue] Added job ${jobId} for ${data.fileName}`,
    );

    return { jobId, recordId: record.id };
  }

  /**
   * Pobierz listę jobów użytkownika
   */
  async getUserJobs(
    userId: string,
    limit: number = 20,
  ): Promise<DocumentJobRecord[]> {
    const { data, error } = await this.supabase
      .from("document_jobs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`[DocumentProcessQueue] getUserJobs error:`, error);
      return [];
    }

    return data as DocumentJobRecord[];
  }

  /**
   * Pobierz pojedynczy job
   */
  async getJob(
    jobId: string,
    userId: string,
  ): Promise<DocumentJobRecord | null> {
    const { data, error } = await this.supabase
      .from("document_jobs")
      .select("*")
      .eq("job_id", jobId)
      .eq("user_id", userId)
      .single();

    if (error) {
      return null;
    }

    return data as DocumentJobRecord;
  }

  /**
   * Usuń job
   */
  async deleteJob(jobId: string, userId: string): Promise<boolean> {
    await this.initialize();

    // Usuń z Supabase
    const { error } = await this.supabase
      .from("document_jobs")
      .delete()
      .eq("job_id", jobId)
      .eq("user_id", userId);

    if (error) {
      console.error(`[DocumentProcessQueue] deleteJob error:`, error);
      return false;
    }

    // Spróbuj usunąć z Redis (może już nie istnieć)
    if (this.queue) {
      try {
        const job = await this.queue.getJob(jobId);
        if (job) {
          await job.remove();
        }
      } catch {
        // Job może już nie istnieć w Redis
      }
    }

    return true;
  }

  /**
   * Ponów przetwarzanie
   */
  async retryJob(jobId: string, userId: string): Promise<boolean> {
    await this.initialize();
    if (!this.queue) return false;

    const record = await this.getJob(jobId, userId);
    if (!record || record.status !== "failed") {
      return false;
    }

    // Pobierz oryginalne dane z Redis
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return false;
    }

    // Reset statusu
    await this.supabase
      .from("document_jobs")
      .update({
        status: "pending",
        progress: 0,
        error: null,
        started_at: null,
        completed_at: null,
      })
      .eq("job_id", jobId);

    // Retry job
    await job.retry();

    return true;
  }

  /**
   * Aktualizuj status joba w Supabase
   */
  private async updateJobStatus(
    jobId: string,
    status: "processing" | "completed" | "failed",
    result?: DocumentProcessJobResult,
    error?: string,
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
    };

    if (status === "processing") {
      updateData.started_at = new Date().toISOString();
    }

    if (status === "completed" || status === "failed") {
      updateData.completed_at = new Date().toISOString();
      updateData.progress = 100;
    }

    if (result) {
      updateData.result = result;
    }

    if (error) {
      updateData.error = error;
    }

    await this.supabase
      .from("document_jobs")
      .update(updateData)
      .eq("job_id", jobId);
  }

  /**
   * Aktualizuj progress joba
   */
  private async updateJobProgress(
    jobId: string,
    progress: number,
  ): Promise<void> {
    await this.supabase
      .from("document_jobs")
      .update({ progress, status: "processing" })
      .eq("job_id", jobId);
  }

  /**
   * Statystyki kolejki
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
}

// Singleton instance
export const documentProcessQueue = new DocumentProcessQueue();

// Export helper functions
export async function addDocumentProcessJob(
  data: DocumentProcessJobData,
): Promise<{ jobId: string; recordId: string }> {
  return documentProcessQueue.addJob(data);
}

export async function getUserDocumentJobs(
  userId: string,
  limit?: number,
): Promise<DocumentJobRecord[]> {
  return documentProcessQueue.getUserJobs(userId, limit);
}

export async function getDocumentJob(
  jobId: string,
  userId: string,
): Promise<DocumentJobRecord | null> {
  return documentProcessQueue.getJob(jobId, userId);
}

export async function deleteDocumentJob(
  jobId: string,
  userId: string,
): Promise<boolean> {
  return documentProcessQueue.deleteJob(jobId, userId);
}

export async function retryDocumentJob(
  jobId: string,
  userId: string,
): Promise<boolean> {
  return documentProcessQueue.retryJob(jobId, userId);
}

export async function getDocumentQueueStats() {
  return documentProcessQueue.getStats();
}
