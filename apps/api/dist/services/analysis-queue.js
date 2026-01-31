/**
 * Analysis Queue - Redis/BullMQ queue for document analysis jobs
 * Zapewnia persystencję zadań analizy dokumentów
 */
import { Queue, QueueEvents } from "bullmq";
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { backgroundTaskService } from "./background-task-service.js";
// ============================================================================
// QUEUE SINGLETON
// ============================================================================
const redisHost = process.env.REDIS_HOST ?? "localhost";
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
class AnalysisQueue {
    queue = null;
    queueEvents = null;
    connection = null;
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    initialized = false;
    async initialize() {
        if (this.initialized)
            return;
        this.connection = new Redis({
            host: redisHost,
            port: redisPort,
            maxRetriesPerRequest: null,
        });
        this.queue = new Queue("analysis-jobs", {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            connection: this.connection,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 5000,
                },
                removeOnComplete: false,
                removeOnFail: false,
            },
        });
        this.queueEvents = new QueueEvents("analysis-jobs", {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            connection: this.connection,
        });
        // Listen for job events
        this.queueEvents.on("completed", async ({ jobId, returnvalue }) => {
            console.log(`[AnalysisQueue] ✅ Job ${jobId} completed`);
            const result = returnvalue;
            // Aktualizuj background_tasks z wynikiem
            await backgroundTaskService.updateByJobId(jobId, {
                status: "completed",
                progress: 100,
                metadata: {
                    result: {
                        documentId: result.documentId,
                        documentTitle: result.documentTitle,
                        score: result.score,
                        references: result.references,
                        analysisPrompt: result.analysisPrompt,
                        systemPrompt: result.systemPrompt,
                    },
                },
            });
        });
        this.queueEvents.on("failed", async ({ jobId, failedReason }) => {
            console.log(`[AnalysisQueue] ❌ Job ${jobId} failed: ${failedReason}`);
            await backgroundTaskService.updateByJobId(jobId, {
                status: "failed",
                error_message: failedReason,
            });
        });
        this.queueEvents.on("progress", async ({ jobId, data }) => {
            const progressData = data;
            const progress = progressData?.progress ?? 0;
            const description = progressData?.description;
            await backgroundTaskService.updateByJobId(jobId, {
                status: "running",
                progress,
                description,
            });
        });
        this.initialized = true;
        console.log(`[AnalysisQueue] Initialized (redis=${redisHost}:${redisPort})`);
    }
    /**
     * Dodaj zadanie analizy do kolejki
     */
    async addJob(data) {
        await this.initialize();
        if (!this.queue)
            throw new Error("Queue not initialized");
        const jobId = `analysis-${randomUUID()}`;
        const taskId = randomUUID();
        // Zapisz do background_tasks dla Supabase Realtime i Dashboard
        await backgroundTaskService.createTask({
            taskId,
            userId: data.userId,
            taskType: "analysis",
            title: `Analiza: ${data.documentTitle.substring(0, 50)}`,
            metadata: {
                jobId,
                documentId: data.documentId,
                documentTitle: data.documentTitle,
            },
        });
        // Dodaj do kolejki Redis
        await this.queue.add("analyze-document", data, {
            jobId,
            priority: 1,
        });
        console.log(`[AnalysisQueue] Added job ${jobId} for document ${data.documentId}`);
        return { jobId, taskId };
    }
    /**
     * Statystyki kolejki
     */
    async getStats() {
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
     * Pobierz kolejkę (dla workera)
     */
    getQueue() {
        return this.queue;
    }
}
// Singleton instance
export const analysisQueue = new AnalysisQueue();
// Export helper functions
export async function addAnalysisJob(data) {
    return analysisQueue.addJob(data);
}
export async function getAnalysisQueueStats() {
    return analysisQueue.getStats();
}
//# sourceMappingURL=analysis-queue.js.map