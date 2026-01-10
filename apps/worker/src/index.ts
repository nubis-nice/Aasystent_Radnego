import 'dotenv/config';
import { type Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

const redisHost = process.env.REDIS_HOST ?? 'localhost';
const redisPort = Number(process.env.REDIS_PORT ?? 6379);

const connection = new Redis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
});

export const documentQueue = new Queue('document-jobs', { connection });

const worker = new Worker(
  'document-jobs',
  async (job: Job) => {
    // MVP: placeholder. W kolejnych krokach: ingest -> ekstrakcja -> analiza -> embedding.
    return {
      ok: true,
      jobName: job.name,
      payload: job.data,
    };
  },
  { connection }
);

worker.on('completed', (job: Job, result: unknown) => {
  // eslint-disable-next-line no-console
  console.log('[worker] completed', job.id, result);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  // eslint-disable-next-line no-console
  console.error('[worker] failed', job?.id, err);
});

// eslint-disable-next-line no-console
console.log(`[worker] started (redis=${redisHost}:${redisPort})`);
