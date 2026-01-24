"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface CalendarNotification {
  id: string;
  event_id: string;
  title: string;
  event_type: string;
  start_date: string;
  location?: string;
  minutes_until_event: number;
  reminder_type: "day" | "hour" | "minutes";
  reminder_minutes: number;
}

interface UseCalendarNotificationsOptions {
  enabled?: boolean;
  pollingIntervalMs?: number;
  onNotification?: (notification: CalendarNotification) => void;
}

export function useCalendarNotifications(
  options: UseCalendarNotificationsOptions = {},
) {
  const {
    enabled = true,
    pollingIntervalMs = 60000, // Co minutę
    onNotification,
  } = options;

  const [notifications, setNotifications] = useState<CalendarNotification[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const notifiedRef = useRef<Set<string>>(new Set());

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setNotifications([]);
        return;
      }

      const response = await fetch(
        `${API_URL}/api/dashboard/notifications/upcoming`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "x-user-id": session.user?.id || "",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();
      const newNotifications = (data.notifications || []).filter(
        (n: CalendarNotification) => !dismissedRef.current.has(n.id),
      );

      setNotifications(newNotifications);
      setError(null);

      // Wywołaj callback dla nowych powiadomień
      if (onNotification) {
        for (const notification of newNotifications) {
          if (!notifiedRef.current.has(notification.id)) {
            notifiedRef.current.add(notification.id);
            onNotification(notification);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [enabled, onNotification]);

  const dismissNotification = useCallback(async (notificationId: string) => {
    dismissedRef.current.add(notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch(
          `${API_URL}/api/dashboard/notifications/${notificationId}/dismiss`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "x-user-id": session.user?.id || "",
            },
          },
        );
      }
    } catch {
      // Ignore dismiss errors
    }
  }, []);

  const dismissAll = useCallback(() => {
    for (const n of notifications) {
      dismissedRef.current.add(n.id);
    }
    setNotifications([]);
  }, [notifications]);

  // Polling
  useEffect(() => {
    if (!enabled) return;

    fetchNotifications();
    const interval = setInterval(fetchNotifications, pollingIntervalMs);

    return () => clearInterval(interval);
  }, [enabled, pollingIntervalMs, fetchNotifications]);

  return {
    notifications,
    loading,
    error,
    dismissNotification,
    dismissAll,
    refresh: fetchNotifications,
  };
}

// Helper do formatowania czasu
export function formatTimeUntilEvent(minutes: number): string {
  if (minutes < 0) return "już się rozpoczęło";
  if (minutes < 1) return "za chwilę";
  if (minutes < 60) return `za ${Math.round(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  if (hours < 24) {
    if (remainingMinutes === 0) return `za ${hours} godz.`;
    return `za ${hours} godz. ${remainingMinutes} min`;
  }

  const days = Math.floor(hours / 24);
  return `za ${days} dni`;
}
