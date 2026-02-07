/**
 * useBackgroundTasks - Hook do śledzenia zadań w tle
 *
 * Używa Supabase Realtime (WebSocket) zamiast pollingu.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Stabilne referencje callbacków
  const onTaskCompleteRef = useRef(onTaskComplete);
  const onTaskErrorRef = useRef(onTaskError);
  onTaskCompleteRef.current = onTaskComplete;
  onTaskErrorRef.current = onTaskError;

  // Przetwórz zadanie (oznacz stare jako failed)
  const processTask = useCallback((task: BackgroundTask): BackgroundTask => {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

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
  }, []);

  // Obsłuż zmianę zadania (INSERT/UPDATE)
  const handleTaskChange = useCallback(
    (payload: { new: BackgroundTask; old?: BackgroundTask }) => {
      const newTask = processTask(payload.new);

      setTasks((prev) => {
        const existingIndex = prev.findIndex((t) => t.id === newTask.id);
        if (existingIndex >= 0) {
          // UPDATE - zamień istniejące
          const updated = [...prev];
          updated[existingIndex] = newTask;
          return updated;
        } else {
          // INSERT - dodaj na początek
          return [newTask, ...prev].slice(0, 20);
        }
      });

      // Sprawdź callbacki (używamy refów dla stabilności)
      const prevTask = previousTasksRef.current.get(newTask.id);
      if (prevTask) {
        if (prevTask.status !== "completed" && newTask.status === "completed") {
          onTaskCompleteRef.current?.(newTask);
        }
        if (prevTask.status !== "failed" && newTask.status === "failed") {
          onTaskErrorRef.current?.(newTask);
        }
      }
      previousTasksRef.current.set(newTask.id, newTask);
    },
    [processTask],
  );

  // Obsłuż usunięcie zadania
  const handleTaskDelete = useCallback((payload: { old: { id: string } }) => {
    setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
    previousTasksRef.current.delete(payload.old.id);
  }, []);

  // Pobierz początkowe zadania
  const fetchTasks = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setTasks([]);
        setIsLoading(false);
        return;
      }

      userIdRef.current = user.id;

      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data, error } = await supabase
        .from("background_tasks")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", oneDayAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        if (
          error.code === "42P01" ||
          error.message?.includes("does not exist")
        ) {
          console.warn("[BackgroundTasks] Tabela nie istnieje - pomijam");
        } else {
          console.error("[BackgroundTasks] Fetch error:", error.message);
        }
        setIsLoading(false);
        return;
      }

      const processedTasks = (data || []).map(processTask);
      previousTasksRef.current = new Map(processedTasks.map((t) => [t.id, t]));
      setTasks(processedTasks);
      setIsConnected(true); // Dane pobrane pomyślnie
    } catch (error) {
      console.error("[BackgroundTasks] Fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [processTask]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const setup = async () => {
      // Pobierz początkowe dane
      await fetchTasks();

      if (!mounted || !userIdRef.current) return;

      // Utwórz subscription WebSocket
      const channel = supabase
        .channel("background-tasks-changes")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "background_tasks",
            filter: `user_id=eq.${userIdRef.current}`,
          },
          (payload) => {
            if (mounted)
              handleTaskChange({ new: payload.new as BackgroundTask });
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "background_tasks",
            filter: `user_id=eq.${userIdRef.current}`,
          },
          (payload) => {
            if (mounted)
              handleTaskChange({
                new: payload.new as BackgroundTask,
                old: payload.old as BackgroundTask,
              });
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "background_tasks",
            filter: `user_id=eq.${userIdRef.current}`,
          },
          (payload) => {
            if (mounted && payload.old?.id) {
              handleTaskDelete({ old: { id: payload.old.id as string } });
            }
          },
        )
        .subscribe((status) => {
          if (mounted) {
            setIsConnected(status === "SUBSCRIBED");
            console.log("[BackgroundTasks] Realtime status:", status);
          }
        });

      channelRef.current = channel;
    };

    setup();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]); // Tylko enabled - funkcje używają refów dla stabilności

  // Filtrowane listy
  const activeTasks = tasks.filter(
    (t) => t.status === "queued" || t.status === "running",
  );
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const failedTasks = tasks.filter((t) => t.status === "failed");

  // Wrapper dla refresh
  const refresh = useCallback(async () => {
    await fetchTasks();
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
