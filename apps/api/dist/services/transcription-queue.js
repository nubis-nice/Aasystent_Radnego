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
export const TRANSCRIPTION_STEPS = [
    {
        name: "download",
        label: "📥 Pobieranie audio",
        globalProgressRange: [0, 15],
    },
    {
        name: "preprocessing",
        label: "🎚️ Przetwarzanie audio",
        globalProgressRange: [15, 25],
    },
    {
        name: "transcription",
        label: "🎤 Transkrypcja",
        globalProgressRange: [25, 65],
    },
    {
        name: "analysis",
        label: "🔍 Analiza i identyfikacja",
        globalProgressRange: [65, 85],
    },
    {
        name: "saving",
        label: "💾 Zapisywanie do bazy",
        globalProgressRange: [85, 100],
    },
];
// ============================================================================
// TRANSCRIPTION QUEUE SERVICE
// ============================================================================
class TranscriptionQueueService {
    static instance = null;
    queue = null;
    queueEvents = null;
    connection = null;
    initialized = false;
    // Progress tracking cache
    progressCache = new Map();
    constructor() { }
    static getInstance() {
        if (!TranscriptionQueueService.instance) {
            TranscriptionQueueService.instance = new TranscriptionQueueService();
        }
        return TranscriptionQueueService.instance;
    }
    /**
     * Inicjalizacja połączenia z Redis i kolejki
     */
    async initialize() {
        if (this.initialized)
            return;
        const redisHost = process.env.REDIS_HOST ?? "localhost";
        const redisPort = Number(process.env.REDIS_PORT ?? 6379);
        try {
            this.connection = new Redis({
                host: redisHost,
                port: redisPort,
                maxRetriesPerRequest: null,
            });
            this.queue = new Queue("transcription-jobs", {
                connection: this.connection,
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
                    timeout: 7200000, // 2 godziny timeout per job
                },
            });
            this.queueEvents = new QueueEvents("transcription-jobs", {
                connection: this.connection,
            });
            // Nasłuchuj na ukończone zadania
            this.queueEvents.on("completed", ({ jobId, returnvalue }) => {
                console.log(`[TranscriptionQueue] Job ${jobId} completed`);
                this.progressCache.delete(jobId);
            });
            this.queueEvents.on("failed", ({ jobId, failedReason }) => {
                console.error(`[TranscriptionQueue] Job ${jobId} failed: ${failedReason}`);
                this.progressCache.delete(jobId);
            });
            this.queueEvents.on("progress", ({ jobId, data }) => {
                const progressData = data;
                console.log(`[TranscriptionQueue] Job ${jobId} progress: ${progressData.progress}% - ${progressData.message}`);
                this.progressCache.set(jobId, progressData);
            });
            this.initialized = true;
            console.log(`[TranscriptionQueue] Initialized (redis=${redisHost}:${redisPort})`);
        }
        catch (error) {
            console.error("[TranscriptionQueue] Failed to initialize:", error);
            throw error;
        }
    }
    /**
     * Dodaj zadanie transkrypcji do kolejki
     */
    async addJob(userId, videoUrl, videoTitle, options = {}) {
        await this.initialize();
        if (!this.queue) {
            throw new Error("Transcription queue not initialized");
        }
        const jobId = randomUUID();
        const jobData = {
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
        console.log(`[TranscriptionQueue] Added job ${jobId} (video="${videoTitle}")`);
        return jobId;
    }
    /**
     * Inicjalizuj detailed progress dla nowego zadania
     */
    initializeDetailedProgress() {
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
    async getJobStatus(jobId) {
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
        const jobProgress = typeof job.progress === "object"
            ? job.progress
            : progressData;
        return {
            id: jobId,
            status: state,
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
    async getUserJobs(userId) {
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
        const userJobs = await Promise.all(allJobs
            .filter((job) => job.data.userId === userId)
            .map(async (job) => {
            const state = await job.getState();
            const progressData = this.progressCache.get(job.id) ?? {
                progress: 0,
                message: "Oczekuje w kolejce...",
            };
            const jobProgress = typeof job.progress === "object"
                ? job.progress
                : progressData;
            return {
                id: job.id,
                status: state,
                progress: jobProgress.progress,
                progressMessage: jobProgress.message,
                result: job.returnvalue ?? undefined,
                error: job.failedReason,
                createdAt: new Date(job.timestamp),
                completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
            };
        }));
        // Sortuj po dacie utworzenia (najnowsze pierwsze)
        return userJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    /**
     * Czekaj na wynik zadania (z timeout)
     */
    async waitForResult(jobId, timeoutMs = 7200000 // 2 godziny
    ) {
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
                return (job.returnvalue ?? {
                    success: true,
                    documentId: undefined,
                });
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
    async getStats() {
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
    async cancelJob(jobId) {
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
    async retryJob(jobId) {
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
    async clear() {
        await this.initialize();
        if (!this.queue)
            return;
        await this.queue.obliterate({ force: true });
        this.progressCache.clear();
        console.log("[TranscriptionQueue] Queue cleared");
    }
    /**
     * Zamknij połączenia
     */
    async close() {
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
export async function addTranscriptionJob(userId, videoUrl, videoTitle, options) {
    return transcriptionQueue.addJob(userId, videoUrl, videoTitle, options);
}
export async function getTranscriptionJobStatus(jobId) {
    return transcriptionQueue.getJobStatus(jobId);
}
export async function getUserTranscriptionJobs(userId) {
    return transcriptionQueue.getUserJobs(userId);
}
export async function waitForTranscriptionResult(jobId, timeoutMs) {
    return transcriptionQueue.waitForResult(jobId, timeoutMs);
}
export async function getTranscriptionQueueStats() {
    return transcriptionQueue.getStats();
}
export async function cancelTranscriptionJob(jobId) {
    return transcriptionQueue.cancelJob(jobId);
}
export async function retryTranscriptionJob(jobId) {
    return transcriptionQueue.retryJob(jobId);
}
//# sourceMappingURL=transcription-queue.js.map