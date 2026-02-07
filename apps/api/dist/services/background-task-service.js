/**
 * BackgroundTaskService - Zarządzanie statusami zadań w tle
 *
 * Zapisuje statusy do tabeli background_tasks w Supabase.
 * Frontend subskrybuje zmiany przez Supabase Realtime.
 */
import { createClient } from "@supabase/supabase-js";
// ============================================================================
// SERVICE
// ============================================================================
class BackgroundTaskService {
    supabase;
    constructor() {
        this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    }
    /**
     * Utwórz nowe zadanie (status: queued)
     */
    async createTask(params) {
        try {
            const insertData = {
                user_id: params.userId,
                task_type: params.taskType,
                type: params.taskType, // Kolumna 'type' jest NOT NULL w schemacie
                status: "queued",
                title: params.title,
                description: params.description,
                progress: 0,
                metadata: params.metadata || {},
            };
            // Użyj predefiniowanego ID jeśli podano
            if (params.taskId) {
                insertData.id = params.taskId;
            }
            const { data, error } = await this.supabase
                .from("background_tasks")
                .insert(insertData)
                .select("id")
                .single();
            if (error) {
                console.error("[BackgroundTask] Create error:", error);
                return null;
            }
            return data.id;
        }
        catch (error) {
            console.error("[BackgroundTask] Create exception:", error);
            return null;
        }
    }
    /**
     * Rozpocznij zadanie (status: running)
     */
    async startTask(taskId) {
        try {
            const { error } = await this.supabase
                .from("background_tasks")
                .update({
                status: "running",
                started_at: new Date().toISOString(),
            })
                .eq("id", taskId);
            if (error) {
                console.error("[BackgroundTask] Start error:", error);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error("[BackgroundTask] Start exception:", error);
            return false;
        }
    }
    /**
     * Aktualizuj postęp zadania (0-100)
     */
    async updateProgress(taskId, progress, description) {
        try {
            const updateData = {
                progress: Math.min(100, Math.max(0, progress)),
            };
            if (description) {
                updateData.description = description;
            }
            const { error } = await this.supabase
                .from("background_tasks")
                .update(updateData)
                .eq("id", taskId);
            if (error) {
                console.error("[BackgroundTask] Update progress error:", error);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error("[BackgroundTask] Update progress exception:", error);
            return false;
        }
    }
    /**
     * Zakończ zadanie sukcesem (status: completed)
     */
    async completeTask(taskId, metadata) {
        try {
            const updateData = {
                status: "completed",
                progress: 100,
                completed_at: new Date().toISOString(),
            };
            if (metadata) {
                // Merge metadata
                const { data: existing } = await this.supabase
                    .from("background_tasks")
                    .select("metadata")
                    .eq("id", taskId)
                    .single();
                updateData.metadata = { ...(existing?.metadata || {}), ...metadata };
            }
            const { error } = await this.supabase
                .from("background_tasks")
                .update(updateData)
                .eq("id", taskId);
            if (error) {
                console.error("[BackgroundTask] Complete error:", error);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error("[BackgroundTask] Complete exception:", error);
            return false;
        }
    }
    /**
     * Zakończ zadanie błędem (status: failed)
     */
    async failTask(taskId, errorMessage) {
        try {
            const { error } = await this.supabase
                .from("background_tasks")
                .update({
                status: "failed",
                error_message: errorMessage,
                completed_at: new Date().toISOString(),
            })
                .eq("id", taskId);
            if (error) {
                console.error("[BackgroundTask] Fail error:", error);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error("[BackgroundTask] Fail exception:", error);
            return false;
        }
    }
    /**
     * Aktualizuj zadanie przez jobId z metadata
     */
    async updateByJobId(jobId, updates) {
        try {
            const updateData = {};
            if (updates.status) {
                updateData.status = updates.status;
                if (updates.status === "running") {
                    updateData.started_at = new Date().toISOString();
                }
                if (updates.status === "completed" || updates.status === "failed") {
                    updateData.completed_at = new Date().toISOString();
                }
            }
            if (updates.progress !== undefined) {
                updateData.progress = updates.progress;
            }
            if (updates.description) {
                updateData.description = updates.description;
            }
            if (updates.error_message) {
                updateData.error_message = updates.error_message;
            }
            // Merge metadata if provided
            if (updates.metadata) {
                const { data: existing } = await this.supabase
                    .from("background_tasks")
                    .select("metadata")
                    .eq("metadata->>jobId", jobId)
                    .single();
                updateData.metadata = {
                    ...(existing?.metadata || {}),
                    ...updates.metadata,
                };
            }
            const { error } = await this.supabase
                .from("background_tasks")
                .update(updateData)
                .eq("metadata->>jobId", jobId);
            if (error) {
                console.error("[BackgroundTask] UpdateByJobId error:", error);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error("[BackgroundTask] UpdateByJobId exception:", error);
            return false;
        }
    }
    /**
     * Pobierz zadanie po ID
     */
    async getTask(taskId) {
        try {
            const { data, error } = await this.supabase
                .from("background_tasks")
                .select("*")
                .eq("id", taskId)
                .single();
            if (error) {
                return null;
            }
            return data;
        }
        catch {
            return null;
        }
    }
    /**
     * Pobierz aktywne zadania użytkownika
     */
    async getActiveTasks(userId) {
        try {
            const { data, error } = await this.supabase
                .from("background_tasks")
                .select("*")
                .eq("user_id", userId)
                .in("status", ["queued", "running"])
                .order("created_at", { ascending: false });
            if (error) {
                return [];
            }
            return data || [];
        }
        catch {
            return [];
        }
    }
    /**
     * Usuń stare zakończone zadania (cleanup)
     */
    async cleanupOldTasks(daysOld = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            const { data, error } = await this.supabase
                .from("background_tasks")
                .delete()
                .in("status", ["completed", "failed"])
                .lt("completed_at", cutoffDate.toISOString())
                .select("id");
            if (error) {
                console.error("[BackgroundTask] Cleanup error:", error);
                return 0;
            }
            return data?.length || 0;
        }
        catch {
            return 0;
        }
    }
}
// Singleton instance
export const backgroundTaskService = new BackgroundTaskService();
//# sourceMappingURL=background-task-service.js.map