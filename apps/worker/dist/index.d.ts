import "dotenv/config";
import { Queue } from "bullmq";
import { type VisionJobData, type VisionJobResult } from "./jobs/vision.js";
import { type DocumentProcessJobData, type DocumentProcessJobResult } from "./jobs/document-process.js";
import type { TranscriptionJobData, TranscriptionJobResult } from "../../api/src/services/transcription-queue.js";
export declare const documentQueue: Queue<any, any, string, any, any, string>;
export declare const userQueue: Queue<any, any, string, any, any, string>;
export declare const visionQueue: Queue<VisionJobData, VisionJobResult, string, VisionJobData, VisionJobResult, string>;
export declare const transcriptionQueue: Queue<TranscriptionJobData, TranscriptionJobResult, string, TranscriptionJobData, TranscriptionJobResult, string>;
export declare const documentProcessQueue: Queue<DocumentProcessJobData, DocumentProcessJobResult, string, DocumentProcessJobData, DocumentProcessJobResult, string>;
//# sourceMappingURL=index.d.ts.map