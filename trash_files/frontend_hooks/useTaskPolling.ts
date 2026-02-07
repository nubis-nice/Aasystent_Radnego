/**
 * useTaskPolling - Prosty hook do polling statusu systemu
 *
 * Zastępuje problematyczne SSE/WebSocket prostym REST polling.
 * Używa GLOBALNEGO mechanizmu - tylko 1 żądanie co 15s niezależnie od liczby instancji.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const POLLING_INTERVAL = 15000; // 15 sekund
const MIN_INTERVAL = 10000; // minimum 10s między żądaniami

// ============================================================================
// GLOBAL STATE - współdzielone między wszystkimi instancjami hooka
// ============================================================================
let globalLastFetch = 0;
let globalIsFetching = false;
let globalData: SystemStatus | null = null;
let globalIntervalId: ReturnType<typeof setInterval> | null = null;
let globalInstanceCount = 0;

// ============================================================================
// TYPES
// ============================================================================

export interface TaskStatus {
  id: string;
  type: "scraping" | "transcription" | "ocr" | "embedding" | "analysis";
  status: "queued" | "running" | "completed" | "failed";
  title: string;
  progress?: number;
  startedAt?: string;
}

export interface GISNotification {
  id: string;
  title: string;
  notification_type: string;
  priority: string;
  created_at: string;
}

export interface SystemStatus {
  status: "ok" | "error";
  timestamp: string;
  activeTasks: TaskStatus[];
  notifications: GISNotification[];
  unreadNotificationsCount: number;
  systemHealth: {
    api: "ok" | "error";
    database: "ok" | "error";
  };
}

export interface UseTaskPollingOptions {
  enabled?: boolean;
  intervalMs?: number;
  onNewNotification?: (notification: GISNotification) => void;
  onTaskComplete?: (task: TaskStatus) => void;
}

export interface UseTaskPollingReturn {
  isConnected: boolean;
  isLoading: boolean;
  activeTasks: TaskStatus[];
  notifications: GISNotification[];
  unreadCount: number;
  systemHealth: SystemStatus["systemHealth"] | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

// Globalna funkcja fetch - wywoływana tylko raz na interval
async function globalFetchStatus(): Promise<SystemStatus | null> {
  const now = Date.now();

  // Throttling globalny
  if (now - globalLastFetch < MIN_INTERVAL) {
    return globalData;
  }

  if (globalIsFetching) {
    return globalData;
  }

  globalIsFetching = true;
  globalLastFetch = now;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return null;
    }

    const response = await fetch(`${API_URL}/api/dashboard/status`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    globalData = await response.json();
    return globalData;
  } catch (error) {
    console.error("[TaskPolling] Error:", error);
    return null;
  } finally {
    globalIsFetching = false;
  }
}

export function useTaskPolling(
  options: UseTaskPollingOptions = {},
): UseTaskPollingReturn {
  const { enabled = true, onTaskComplete } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTasks, setActiveTasks] = useState<TaskStatus[]>([]);
  const [notifications, setNotifications] = useState<GISNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [systemHealth, setSystemHealth] = useState<
    SystemStatus["systemHealth"] | null
  >(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const updateFromGlobal = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    const data = await globalFetchStatus();
    setIsLoading(false);

    if (data) {
      setActiveTasks(data.activeTasks);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadNotificationsCount);
      setSystemHealth(data.systemHealth);
      setLastUpdated(new Date());
      setIsConnected(true);
    } else {
      setIsConnected(false);
    }
  }, [enabled]);

  // Zarządzaj globalnym intervalem
  useEffect(() => {
    if (!enabled) return;

    globalInstanceCount++;

    // Pierwsze pobranie
    updateFromGlobal();

    // Uruchom globalny interval tylko jeśli nie istnieje
    if (!globalIntervalId) {
      globalIntervalId = setInterval(() => {
        globalFetchStatus();
      }, POLLING_INTERVAL);
    }

    // Lokalny interval do odświeżania stanu z globalData
    const localInterval = setInterval(() => {
      if (globalData) {
        setActiveTasks(globalData.activeTasks);
        setNotifications(globalData.notifications);
        setUnreadCount(globalData.unreadNotificationsCount);
        setSystemHealth(globalData.systemHealth);
        setLastUpdated(new Date());
        setIsConnected(true);
      }
    }, POLLING_INTERVAL);

    return () => {
      globalInstanceCount--;
      clearInterval(localInterval);

      // Zatrzymaj globalny interval gdy nie ma instancji
      if (globalInstanceCount === 0 && globalIntervalId) {
        clearInterval(globalIntervalId);
        globalIntervalId = null;
      }
    };
  }, [enabled, updateFromGlobal]);

  return {
    isConnected,
    isLoading,
    activeTasks,
    notifications,
    unreadCount,
    systemHealth,
    lastUpdated,
    refresh: updateFromGlobal,
  };
}
