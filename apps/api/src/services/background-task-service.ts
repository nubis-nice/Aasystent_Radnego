/**
 * BackgroundTaskService - Zarządzanie statusami zadań w tle
 *
 * Zapisuje statusy do tabeli background_tasks w Supabase.
 * Frontend subskrybuje zmiany przez Supabase Realtime.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// TYPES
// ============================================================================

export type TaskType =
  | "transcription"
  | "ocr"
  | "scraping"
  | "embedding"
  | "analysis";

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
  userId: string;
  taskType: TaskType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// SERVICE
// ============================================================================

class BackgroundTaskService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  /**
   * Utwórz nowe zadanie (status: queued)
   */
  async createTask(params: CreateTaskParams): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from("background_tasks")
        .insert({
          user_id: params.userId,
          task_type: params.taskType,
          status: "queued",
          title: params.title,
          description: params.description,
          progress: 0,
          metadata: params.metadata || {},
        })
        .select("id")
        .single();

      if (error) {
        console.error("[BackgroundTask] Create error:", error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error("[BackgroundTask] Create exception:", error);
      return null;
    }
  }

  /**
   * Rozpocznij zadanie (status: running)
   */
  async startTask(taskId: string): Promise<boolean> {
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
    } catch (error) {
      console.error("[BackgroundTask] Start exception:", error);
      return false;
    }
  }

  /**
   * Aktualizuj postęp zadania (0-100)
   */
  async updateProgress(
    taskId: string,
    progress: number,
    description?: string,
  ): Promise<boolean> {
    try {
      const updateData: Record<string, unknown> = {
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
    } catch (error) {
      console.error("[BackgroundTask] Update progress exception:", error);
      return false;
    }
  }

  /**
   * Zakończ zadanie sukcesem (status: completed)
   */
  async completeTask(
    taskId: string,
    metadata?: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const updateData: Record<string, unknown> = {
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
    } catch (error) {
      console.error("[BackgroundTask] Complete exception:", error);
      return false;
    }
  }

  /**
   * Zakończ zadanie błędem (status: failed)
   */
  async failTask(taskId: string, errorMessage: string): Promise<boolean> {
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
    } catch (error) {
      console.error("[BackgroundTask] Fail exception:", error);
      return false;
    }
  }

  /**
   * Aktualizuj zadanie przez jobId z metadata
   */
  async updateByJobId(
    jobId: string,
    updates: {
      status?: TaskStatus;
      progress?: number;
      description?: string;
      error_message?: string;
    },
  ): Promise<boolean> {
    try {
      const updateData: Record<string, unknown> = {};

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

      const { error } = await this.supabase
        .from("background_tasks")
        .update(updateData)
        .eq("metadata->>jobId", jobId);

      if (error) {
        console.error("[BackgroundTask] UpdateByJobId error:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[BackgroundTask] UpdateByJobId exception:", error);
      return false;
    }
  }

  /**
   * Pobierz zadanie po ID
   */
  async getTask(taskId: string): Promise<BackgroundTask | null> {
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
    } catch {
      return null;
    }
  }

  /**
   * Pobierz aktywne zadania użytkownika
   */
  async getActiveTasks(userId: string): Promise<BackgroundTask[]> {
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
    } catch {
      return [];
    }
  }

  /**
   * Usuń stare zakończone zadania (cleanup)
   */
  async cleanupOldTasks(daysOld: number = 7): Promise<number> {
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
    } catch {
      return 0;
    }
  }
}

// Singleton instance
export const backgroundTaskService = new BackgroundTaskService();
