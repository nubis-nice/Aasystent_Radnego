/**
 * useWebSocket - Hook do połączenia WebSocket z backendem
 *
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

export type WSMessageType =
  | "gis_notification"
  | "task_update"
  | "task_complete"
  | "task_error"
  | "system_alert"
  | "connection_ack"
  | "ping"
  | "pong";

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  timestamp: string;
  userId?: string;
}

export interface TaskStatus {
  id: string;
  type: "scraping" | "transcription" | "ocr" | "embedding" | "analysis";
  status: "queued" | "running" | "completed" | "failed";
  progress?: number;
  title: string;
  description?: string;
  startedAt?: string;
  estimatedTimeMs?: number;
  error?: string;
  result?: unknown;
}

export interface GISNotification {
  id: string;
  notification_type:
    | "new_document"
    | "update"
    | "alert"
    | "reminder"
    | "system";
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  message: string;
  action_url?: string;
  source_name?: string;
  metadata?: Record<string, unknown>;
}

export interface SystemAlert {
  level: "info" | "warning" | "error";
  title: string;
  message: string;
  action?: {
    label: string;
    url: string;
  };
}

export interface UseWebSocketOptions {
  enabled?: boolean;
  onGISNotification?: (notification: GISNotification) => void;
  onTaskUpdate?: (task: TaskStatus) => void;
  onTaskComplete?: (task: TaskStatus) => void;
  onTaskError?: (task: TaskStatus) => void;
  onSystemAlert?: (alert: SystemAlert) => void;
  reconnectIntervalMs?: number;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  activeTasks: TaskStatus[];
  notifications: GISNotification[];
  lastMessage: WSMessage | null;
  reconnect: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useWebSocket(
  options: UseWebSocketOptions = {},
): UseWebSocketReturn {
  const {
    enabled = true,
    onGISNotification,
    onTaskUpdate,
    onTaskComplete,
    onTaskError,
    onSystemAlert,
    reconnectIntervalMs = 5000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [activeTasks, setActiveTasks] = useState<TaskStatus[]>([]);
  const [notifications, setNotifications] = useState<GISNotification[]>([]);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  const connect = useCallback(async () => {
    if (!enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id || "anonymous";

      // Buduj URL WebSocket
      const wsUrl = API_URL.replace(/^http/, "ws") + `/api/ws?userId=${userId}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebSocket] Connected");
        setIsConnected(true);

        // Ping co 30 sekund
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          setLastMessage(message);

          switch (message.type) {
            case "connection_ack": {
              const payload = message.payload as { activeTasks?: TaskStatus[] };
              if (payload.activeTasks) {
                setActiveTasks(payload.activeTasks);
              }
              break;
            }

            case "gis_notification": {
              const notification = message.payload as GISNotification;
              setNotifications((prev) => [notification, ...prev.slice(0, 49)]);
              onGISNotification?.(notification);
              break;
            }

            case "task_update": {
              const task = message.payload as TaskStatus;
              setActiveTasks((prev) => {
                const existing = prev.findIndex((t) => t.id === task.id);
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = task;
                  return updated;
                }
                return [task, ...prev];
              });
              onTaskUpdate?.(task);
              break;
            }

            case "task_complete": {
              const task = message.payload as TaskStatus;
              setActiveTasks((prev) => prev.filter((t) => t.id !== task.id));
              onTaskComplete?.(task);
              break;
            }

            case "task_error": {
              const task = message.payload as TaskStatus;
              setActiveTasks((prev) => prev.filter((t) => t.id !== task.id));
              onTaskError?.(task);
              break;
            }

            case "system_alert": {
              const alert = message.payload as SystemAlert;
              onSystemAlert?.(alert);
              break;
            }

            case "pong":
              // Ignore pong
              break;
          }
        } catch (error) {
          console.error("[WebSocket] Parse error:", error);
        }
      };

      ws.onclose = () => {
        console.log("[WebSocket] Disconnected");
        setIsConnected(false);

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        // Auto-reconnect
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectIntervalMs);
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
      };
    } catch (error) {
      console.error("[WebSocket] Connection error:", error);

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
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    connect();
  }, [disconnect, connect]);

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
    lastMessage,
    reconnect,
  };
}

export default useWebSocket;
