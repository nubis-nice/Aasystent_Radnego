/**
 * BackgroundTaskService - Zarządzanie statusami zadań w tle
 *
 * Zapisuje statusy do tabeli background_tasks w Supabase.
 * Frontend subskrybuje zmiany przez Supabase Realtime.
 */
export type TaskType = "transcription" | "ocr" | "scraping" | "embedding" | "analysis";
export type TaskStatus = "queued" | "running" | "completed" | "failed";
export interface BackgroundTask {
    id: string;
    user_id: string;
    task_type: TaskType;
    status: TaskStatus;
    title: string;
    description?: string;
    progress: number;
    error_message?: string;
    metadata: Record<string, unknown>;
    created_at: string;
    started_at?: string;
    completed_at?: string;
}
export interface CreateTaskParams {
    taskId?: string;
    userId: string;
    taskType: TaskType;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
}
declare class BackgroundTaskService {
    private supabase;
    constructor();
    /**
     * Utwórz nowe zadanie (status: queued)
     */
    createTask(params: CreateTaskParams): Promise<string | null>;
    /**
     * Rozpocznij zadanie (status: running)
     */
    startTask(taskId: string): Promise<boolean>;
    /**
     * Aktualizuj postęp zadania (0-100)
     */
    updateProgress(taskId: string, progress: number, description?: string): Promise<boolean>;
    /**
     * Zakończ zadanie sukcesem (status: completed)
     */
    completeTask(taskId: string, metadata?: Record<string, unknown>): Promise<boolean>;
    /**
     * Zakończ zadanie błędem (status: failed)
     */
    failTask(taskId: string, errorMessage: string): Promise<boolean>;
    /**
     * Aktualizuj zadanie przez jobId z metadata
     */
    updateByJobId(jobId: string, updates: {
        status?: TaskStatus;
        progress?: number;
        description?: string;
        error_message?: string;
        metadata?: Record<string, unknown>;
    }): Promise<boolean>;
    /**
     * Pobierz zadanie po ID
     */
    getTask(taskId: string): Promise<BackgroundTask | null>;
    /**
     * Pobierz aktywne zadania użytkownika
     */
    getActiveTasks(userId: string): Promise<BackgroundTask[]>;
    /**
     * Usuń stare zakończone zadania (cleanup)
     */
    cleanupOldTasks(daysOld?: number): Promise<number>;
}
export declare const backgroundTaskService: BackgroundTaskService;
export {};
//# sourceMappingURL=background-task-service.d.ts.map