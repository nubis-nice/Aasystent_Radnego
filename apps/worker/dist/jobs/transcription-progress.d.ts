/**
 * Transcription Progress Helper - Zarządzanie detailed progress w workerze
 */
import { type Job } from "bullmq";
import type { TranscriptionJobData, TranscriptionStepProgress, DetailedTranscriptionProgress } from "../../../api/src/services/transcription-queue.js";
export declare class TranscriptionProgressTracker {
    private detailedProgress;
    private job;
    private stepStartTimes;
    constructor(job: Job<TranscriptionJobData>);
    /**
     * Rozpocznij krok
     */
    startStep(stepName: string, message: string, details?: TranscriptionStepProgress["details"]): Promise<void>;
    /**
     * Aktualizuj postęp kroku
     */
    updateStep(stepName: string, stepProgress: number, message?: string, details?: Partial<TranscriptionStepProgress["details"]>): Promise<void>;
    /**
     * Zakończ krok
     */
    completeStep(stepName: string, details?: Partial<TranscriptionStepProgress["details"]>): Promise<void>;
    /**
     * Oznacz krok jako failed
     */
    failStep(stepName: string, error: string): Promise<void>;
    /**
     * Oblicz estymację czasu pozostałego
     */
    private updateTimeEstimate;
    /**
     * Aktualizuj job w queue
     */
    private updateJob;
    /**
     * Pobierz aktualny detailed progress
     */
    getDetailedProgress(): DetailedTranscriptionProgress;
}
//# sourceMappingURL=transcription-progress.d.ts.map