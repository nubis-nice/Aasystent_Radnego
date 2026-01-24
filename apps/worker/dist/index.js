import "dotenv/config";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { processUserJob } from "./handlers/user-jobs.js";
import { processExtraction } from "./jobs/extraction.js";
import { processAnalysis } from "./jobs/analysis.js";
import { processRelations } from "./jobs/relations.js";
import { processVision, } from "./jobs/vision.js";
import { processTranscription } from "./jobs/transcription.js";
const redisHost = process.env.REDIS_HOST ?? "localhost";
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const connection = new Redis({
    host: redisHost,
    port: redisPort,
    maxRetriesPerRequest: null,
});
// Kolejki - rzutowanie na any z powodu niezgodności wersji ioredis/bullmq
export const documentQueue = new Queue("document-jobs", {
    connection: connection,
});
export const userQueue = new Queue("user-jobs", {
    connection: connection,
});
export const visionQueue = new Queue("vision-jobs", { connection: connection });
export const transcriptionQueue = new Queue("transcription-jobs", { connection: connection });
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
    connection: connection,
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
}, { connection: connection });
// Worker dla zadań Vision AI (OCR)
const visionWorker = new Worker("vision-jobs", async (job) => {
    console.log(`[vision-worker] Processing job ${job.id} (page=${job.data.pageNumber})`);
    return await processVision(job);
}, {
    connection: connection,
    concurrency: 2, // Max 2 równoczesne zadania Vision (rate limits)
    limiter: {
        max: 20, // Max 20 zadań
        duration: 60000, // na minutę
    },
});
// Worker dla zadań transkrypcji YouTube
const transcriptionWorker = new Worker("transcription-jobs", async (job) => {
    console.log(`[transcription-worker] Processing job ${job.id} (video="${job.data.videoTitle}")`);
    return await processTranscription(job);
}, {
    connection: connection,
    concurrency: 1, // Max 1 równoczesne zadanie (długie procesowanie)
    limiter: {
        max: 5, // Max 5 zadań
        duration: 3600000, // na godzinę
    },
});
// Event handlers dla vision worker
visionWorker.on("completed", (job) => {
    console.log(`[vision-worker] ✅ Completed ${job.id}`);
});
visionWorker.on("failed", (job, err) => {
    console.error(`[vision-worker] ❌ Failed ${job?.id}: ${err.message}`);
});
visionWorker.on("progress", (job, progress) => {
    console.log(`[vision-worker] 📊 Progress ${job.id}: ${progress}%`);
});
// Event handlers dla transcription worker
transcriptionWorker.on("completed", (job) => {
    console.log(`[transcription-worker] ✅ Completed ${job.id} - "${job.data.videoTitle}"`);
});
transcriptionWorker.on("failed", (job, err) => {
    console.error(`[transcription-worker] ❌ Failed ${job?.id}: ${err.message}`);
});
transcriptionWorker.on("progress", (job, progress) => {
    const progressData = progress;
    console.log(`[transcription-worker] 📊 Progress ${job.id}: ${progressData.progress}% - ${progressData.message}`);
});
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
userWorker.on("completed", (job) => {
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
    await visionWorker.close();
    await transcriptionWorker.close();
    await connection.quit();
    process.exit(0);
});
console.log(`[worker] 🚀 Started (redis=${redisHost}:${redisPort})`);
console.log("[worker] 📋 Queues: document-jobs, user-jobs, vision-jobs, transcription-jobs");
console.log("[worker] 🔧 Jobs: extraction, analysis, relations, vision-ocr, youtube-transcription");
//# sourceMappingURL=index.js.map