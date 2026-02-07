/**
 * useSSE - Hook do połączenia Server-Sent Events z backendem
 *
 * Prostsze i stabilniejsze niż WebSocket.
 * Obsługuje:
 * - GIS Notifications
 * - Task Status (scraping, transkrypcja, OCR)
 * - System Alerts
 * - Auto-reconnect
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ============================================================================
// TYPES
// ============================================================================

export type SSEEventType =
  | "connection_ack"
  | "gis_notification"
  | "task_update"
  | "task_complete"
  | "task_error"
  | "system_alert";

export interface TaskStatus {
  id: string;
  type: "scraping" | "transcription" | "ocr" | "embedding" | "analysis";
  status: "queued" | "running" | "completed" | "failed";
  title: string;
  description?: string;
  progress?: number;
  estimatedTimeMs?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface GISNotification {
  id: string;
  type: "new_document" | "update" | "alert" | "reminder" | "system";
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
  createdAt: string;
}

export interface UseSSEOptions {
  enabled?: boolean;
  onGISNotification?: (notification: GISNotification) => void;
  onTaskUpdate?: (task: TaskStatus) => void;
  onTaskComplete?: (task: TaskStatus) => void;
  onTaskError?: (task: TaskStatus) => void;
  onSystemAlert?: (alert: { message: string; level: string }) => void;
  reconnectIntervalMs?: number;
}

export interface UseSSEReturn {
  isConnected: boolean;
  activeTasks: TaskStatus[];
  notifications: GISNotification[];
  reconnect: () => void;
  disconnect: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSSE(options: UseSSEOptions = {}): UseSSEReturn {
  const {
    enabled = true,
    onGISNotification,
    onTaskUpdate,
    onTaskComplete,
    onTaskError,
    onSystemAlert,
    reconnectIntervalMs = 5000,
  } = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [isConnected, setIsConnected] = useState(false);
  const [activeTasks, setActiveTasks] = useState<TaskStatus[]>([]);
  const [notifications, setNotifications] = useState<GISNotification[]>([]);

  const connect = useCallback(async () => {
    if (!enabled) return;
    if (eventSourceRef.current?.readyState === EventSource.OPEN) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id || "anonymous";

      // Buduj URL SSE
      const sseUrl = `${API_URL}/api/sse/events?userId=${userId}`;

      console.log("[SSE] Connecting to:", sseUrl);

      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log("[SSE] Connected");
        setIsConnected(true);
      };

      // Obsługa connection_ack
      eventSource.addEventListener("connection_ack", (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[SSE] Connection acknowledged:", data);
          if (data.activeTasks) {
            setActiveTasks(data.activeTasks);
          }
        } catch (e) {
          console.error("[SSE] Error parsing connection_ack:", e);
        }
      });

      // Obsługa task_update
      eventSource.addEventListener("task_update", (event) => {
        try {
          const task: TaskStatus = JSON.parse(event.data);
          console.log("[SSE] Task update:", task);

          setActiveTasks((prev) => {
            const existing = prev.find((t) => t.id === task.id);
            if (existing) {
              return prev.map((t) => (t.id === task.id ? task : t));
            }
            return [...prev, task];
          });

          onTaskUpdate?.(task);
        } catch (e) {
          console.error("[SSE] Error parsing task_update:", e);
        }
      });

      // Obsługa task_complete
      eventSource.addEventListener("task_complete", (event) => {
        try {
          const task: TaskStatus = JSON.parse(event.data);
          console.log("[SSE] Task complete:", task);

          setActiveTasks((prev) => prev.filter((t) => t.id !== task.id));
          onTaskComplete?.(task);
        } catch (e) {
          console.error("[SSE] Error parsing task_complete:", e);
        }
      });

      // Obsługa task_error
      eventSource.addEventListener("task_error", (event) => {
        try {
          const task: TaskStatus = JSON.parse(event.data);
          console.error("[SSE] Task error:", task);

          setActiveTasks((prev) => prev.filter((t) => t.id !== task.id));
          onTaskError?.(task);
        } catch (e) {
          console.error("[SSE] Error parsing task_error:", e);
        }
      });

      // Obsługa gis_notification
      eventSource.addEventListener("gis_notification", (event) => {
        try {
          const notification: GISNotification = JSON.parse(event.data);
          console.log("[SSE] GIS notification:", notification);

          setNotifications((prev) => [notification, ...prev].slice(0, 50));
          onGISNotification?.(notification);
        } catch (e) {
          console.error("[SSE] Error parsing gis_notification:", e);
        }
      });

      // Obsługa system_alert
      eventSource.addEventListener("system_alert", (event) => {
        try {
          const alert = JSON.parse(event.data);
          console.log("[SSE] System alert:", alert);
          onSystemAlert?.(alert);
        } catch (e) {
          console.error("[SSE] Error parsing system_alert:", e);
        }
      });

      eventSource.onerror = (error) => {
        console.error("[SSE] Error:", error);
        setIsConnected(false);

        // Auto-reconnect
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[SSE] Reconnecting...");
            connect();
          }, reconnectIntervalMs);
        }
      };
    } catch (error) {
      console.error("[SSE] Connection error:", error);

      // Retry
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, reconnectIntervalMs);
    }
  }, [
    enabled,
    reconnectIntervalMs,
    onGISNotification,
    onTaskUpdate,
    onTaskComplete,
    onTaskError,
    onSystemAlert,
  ]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    connect();
  }, [disconnect, connect]);

  // Połącz przy montowaniu
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    activeTasks,
    notifications,
    reconnect,
    disconnect,
  };
}
