import "dotenv/config";
import { type Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { processUserJob, type UserJobData } from "./handlers/user-jobs.js";
import { processExtraction } from "./jobs/extraction.js";
import { processAnalysis } from "./jobs/analysis.js";
import { processRelations } from "./jobs/relations.js";
import {
  processVision,
  type VisionJobData,
  type VisionJobResult,
} from "./jobs/vision.js";

const redisHost = process.env.REDIS_HOST ?? "localhost";
const redisPort = Number(process.env.REDIS_PORT ?? 6379);

const connection = new Redis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
});

// Kolejki - rzutowanie na any z powodu niezgodności wersji ioredis/bullmq
export const documentQueue = new Queue("document-jobs", {
  connection: connection as any,
});
export const userQueue = new Queue("user-jobs", {
  connection: connection as any,
});
export const visionQueue = new Queue<VisionJobData, VisionJobResult>(
  "vision-jobs",
  { connection: connection as any }
);

// Worker dla zadań dokumentów
const documentWorker = new Worker(
  "document-jobs",
  async (job: Job) => {
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
  },
  {
    connection: connection as any,
    concurrency: 2, // Maksymalnie 2 zadania równolegle (OpenAI rate limits)
    limiter: {
      max: 10, // Maksymalnie 10 zadań
      duration: 60000, // na minutę
    },
  }
);

// Worker dla zadań użytkowników
const userWorker = new Worker(
  "user-jobs",
  async (job: Job<UserJobData>) => {
    console.log(`[user-worker] Processing job ${job.name} (${job.id})`);
    return await processUserJob(job);
  },
  { connection: connection as any }
);

// Worker dla zadań Vision AI (OCR)
const visionWorker = new Worker<VisionJobData, VisionJobResult>(
  "vision-jobs",
  async (job: Job<VisionJobData>) => {
    console.log(
      `[vision-worker] Processing job ${job.id} (page=${job.data.pageNumber})`
    );
    return await processVision(job);
  },
  {
    connection: connection as any,
    concurrency: 2, // Max 2 równoczesne zadania Vision (rate limits)
    limiter: {
      max: 20, // Max 20 zadań
      duration: 60000, // na minutę
    },
  }
);

// Event handlers dla vision worker
visionWorker.on("completed", (job: Job) => {
  console.log(`[vision-worker] ✅ Completed ${job.id}`);
});

visionWorker.on("failed", (job: Job | undefined, err: Error) => {
  console.error(`[vision-worker] ❌ Failed ${job?.id}: ${err.message}`);
});

visionWorker.on("progress", (job: Job, progress) => {
  console.log(`[vision-worker] 📊 Progress ${job.id}: ${progress}%`);
});

// Event handlers dla document worker
documentWorker.on("completed", (job: Job, result: unknown) => {
  console.log(`[document-worker] ✅ Completed ${job.name} (${job.id})`);
  console.log(`[document-worker] Result:`, result);
});

documentWorker.on("failed", (job: Job | undefined, err: Error) => {
  console.error(`[document-worker] ❌ Failed ${job?.name} (${job?.id})`);
  console.error(`[document-worker] Error:`, err.message);
});

documentWorker.on(
  "progress",
  (job: Job, progress: number | string | object | boolean) => {
    console.log(
      `[document-worker] 📊 Progress ${job.name} (${job.id}): ${progress}%`
    );
  }
);

// Event handlers dla user worker
userWorker.on("completed", (job: Job) => {
  console.log(`[user-worker] ✅ Completed ${job.name} (${job.id})`);
});

userWorker.on("failed", (job: Job | undefined, err: Error) => {
  console.error(`[user-worker] ❌ Failed ${job?.name} (${job?.id})`);
  console.error(`[user-worker] Error:`, err.message);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[worker] SIGTERM received, closing workers...");
  await documentWorker.close();
  await userWorker.close();
  await visionWorker.close();
  await connection.quit();
  process.exit(0);
});

console.log(`[worker] 🚀 Started (redis=${redisHost}:${redisPort})`);
console.log("[worker] 📋 Queues: document-jobs, user-jobs, vision-jobs");
console.log("[worker] 🔧 Jobs: extraction, analysis, relations, vision-ocr");
