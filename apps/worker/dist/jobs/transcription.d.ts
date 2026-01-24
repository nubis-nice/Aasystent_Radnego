/**
 * Transcription Worker - Przetwarzanie zadań transkrypcji YouTube
 */
import { type Job } from "bullmq";
import type { TranscriptionJobData, TranscriptionJobResult } from "../../../api/src/services/transcription-queue.js";
export declare function processTranscription(job: Job<TranscriptionJobData>): Promise<TranscriptionJobResult>;
//# sourceMappingURL=transcription.d.ts.map