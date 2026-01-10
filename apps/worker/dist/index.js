import "dotenv/config";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { processUserJob } from "./handlers/user-jobs.js";
import { processExtraction } from "./jobs/extraction.js";
import { processAnalysis } from "./jobs/analysis.js";
import { processRelations } from "./jobs/relations.js";
const redisHost = process.env.REDIS_HOST ?? "localhost";
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const connection = new Redis({
    host: redisHost,
    port: redisPort,
    maxRetriesPerRequest: null,
});
// Kolejki
export const documentQueue = new Queue("document-jobs", { connection });
export const userQueue = new Queue("user-jobs", { connection });
// Worker dla zadań dokumentów
const documentWorker = new Worker("document-jobs", async (job) => {
    console.log(`[document-worker] Processing job ${job.name} (${job.id})`);
    switch (job.name) {
        case "extraction":
            return await processExtraction(job);
        case "analysis":
            return await processAnalysis(job);
        case "relations":
            return await processRelations(job);
        default:
            throw new Error(`Unknown job type: ${job.name}`);
    }
}, {
    connection,
    concurrency: 2, // Maksymalnie 2 zadania równolegle (OpenAI rate limits)
    limiter: {
        max: 10, // Maksymalnie 10 zadań
        duration: 60000, // na minutę
    },
});
// Worker dla zadań użytkowników
const userWorker = new Worker("user-jobs", async (job) => {
    console.log(`[user-worker] Processing job ${job.name} (${job.id})`);
    return await processUserJob(job);
}, { connection });
// Event handlers dla document worker
documentWorker.on("completed", (job, result) => {
    console.log(`[document-worker] ✅ Completed ${job.name} (${job.id})`);
    console.log(`[document-worker] Result:`, result);
});
documentWorker.on("failed", (job, err) => {
    console.error(`[document-worker] ❌ Failed ${job?.name} (${job?.id})`);
    console.error(`[document-worker] Error:`, err.message);
});
documentWorker.on("progress", (job, progress) => {
    console.log(`[document-worker] 📊 Progress ${job.name} (${job.id}): ${progress}%`);
});
// Event handlers dla user worker
userWorker.on("completed", (job, result) => {
    console.log(`[user-worker] ✅ Completed ${job.name} (${job.id})`);
});
userWorker.on("failed", (job, err) => {
    console.error(`[user-worker] ❌ Failed ${job?.name} (${job?.id})`);
    console.error(`[user-worker] Error:`, err.message);
});
// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("[worker] SIGTERM received, closing workers...");
    await documentWorker.close();
    await userWorker.close();
    await connection.quit();
    process.exit(0);
});
console.log(`[worker] 🚀 Started (redis=${redisHost}:${redisPort})`);
console.log("[worker] 📋 Queues: document-jobs, user-jobs");
console.log("[worker] 🔧 Jobs: extraction, analysis, relations");
//# sourceMappingURL=index.js.map