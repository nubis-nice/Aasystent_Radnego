/**
 * useBackgroundTasks - Hook do śledzenia zadań w tle
 *
 * Używa polling HTTP co 5s zamiast Realtime (unika problemów z mismatch bindings).
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

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
  updated_at: string;
}

export interface UseBackgroundTasksOptions {
  enabled?: boolean;
  onTaskComplete?: (task: BackgroundTask) => void;
  onTaskError?: (task: BackgroundTask) => void;
}

export interface UseBackgroundTasksReturn {
  tasks: BackgroundTask[];
  activeTasks: BackgroundTask[];
  completedTasks: BackgroundTask[];
  failedTasks: BackgroundTask[];
  isLoading: boolean;
  isConnected: boolean;
  refresh: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useBackgroundTasks(
  options: UseBackgroundTasksOptions = {},
): UseBackgroundTasksReturn {
  const { enabled = true, onTaskComplete, onTaskError } = options;

  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const previousTasksRef = useRef<Map<string, BackgroundTask>>(new Map());

  // Pobierz zadania z flagą mounted
  const fetchTasks = useCallback(
    async (isMounted: () => boolean) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!isMounted()) return;

        if (!user) {
          setTasks([]);
          return;
        }

        // Pobierz zadania z ostatnich 24h
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const { data, error } = await supabase
          .from("background_tasks")
          .select("*")
          .eq("user_id", user.id)
          .gte("created_at", oneDayAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(20);

        if (!isMounted()) return;

        if (error) {
          if (
            error.code === "42P01" ||
            error.message?.includes("does not exist")
          ) {
            console.warn("[BackgroundTasks] Tabela nie istnieje - pomijam");
          } else {
            console.error("[BackgroundTasks] Fetch error:", error.message);
          }
          return;
        }

        // Filtruj osierocone zadania (queued/running starsze niż 1h)
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);

        const newTasks = (data || []).map((task) => {
          // Oznacz stare queued/running jako stale (traktuj jak failed)
          if (
            (task.status === "queued" || task.status === "running") &&
            new Date(task.created_at) < oneHourAgo
          ) {
            return {
              ...task,
              status: "failed" as const,
              error_message: "Zadanie przekroczyło limit czasu",
            };
          }
          return task;
        });

        // Sprawdź zmiany statusów dla callbacków
        newTasks.forEach((task) => {
          const prev = previousTasksRef.current.get(task.id);
          if (prev) {
            if (prev.status !== "completed" && task.status === "completed") {
              onTaskComplete?.(task);
            }
            if (prev.status !== "failed" && task.status === "failed") {
              onTaskError?.(task);
            }
          }
        });

        // Aktualizuj referencję
        previousTasksRef.current = new Map(newTasks.map((t) => [t.id, t]));
        setTasks(newTasks);
        setIsConnected(true);
      } catch (error: unknown) {
        const err = error as Error;
        // Ignoruj AbortError - to normalne przy cleanup
        if (err.name === "AbortError") return;
        if (!isMounted()) return;
        console.error("[BackgroundTasks] Fetch error:", err.message);
      } finally {
        if (isMounted()) {
          setIsLoading(false);
        }
      }
    },
    [onTaskComplete, onTaskError],
  );

  // Polling co 2 sekundy z mounted flag
  useEffect(() => {
    if (!enabled) return;

    let mounted = true;
    const isMounted = () => mounted;

    // Ustaw connected od razu - polling działa
    setIsConnected(true);
    setIsLoading(true);
    fetchTasks(isMounted);

    const pollInterval = setInterval(() => {
      if (mounted) fetchTasks(isMounted);
    }, 2000);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
    };
  }, [enabled, fetchTasks]);

  // Filtrowane listy
  const activeTasks = tasks.filter(
    (t) => t.status === "queued" || t.status === "running",
  );
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const failedTasks = tasks.filter((t) => t.status === "failed");

  // Wrapper dla refresh bez argumentu
  const refresh = useCallback(async () => {
    await fetchTasks(() => true);
  }, [fetchTasks]);

  return {
    tasks,
    activeTasks,
    completedTasks,
    failedTasks,
    isLoading,
    isConnected,
    refresh,
  };
}
