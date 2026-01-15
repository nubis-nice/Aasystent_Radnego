"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Check,
  X,
  Calendar,
  FileText,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Alert {
  id: string;
  title: string;
  message?: string;
  alert_type: string;
  priority: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

const ALERT_TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string }
> = {
  session: {
    icon: <Calendar className="h-4 w-4" />,
    color: "text-purple-600 bg-purple-100",
  },
  deadline: {
    icon: <Clock className="h-4 w-4" />,
    color: "text-red-600 bg-red-100",
  },
  document: {
    icon: <FileText className="h-4 w-4" />,
    color: "text-blue-600 bg-blue-100",
  },
  budget: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-orange-600 bg-orange-100",
  },
  interpellation: {
    icon: <FileText className="h-4 w-4" />,
    color: "text-indigo-600 bg-indigo-100",
  },
  info: {
    icon: <Bell className="h-4 w-4" />,
    color: "text-gray-600 bg-gray-100",
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-yellow-600 bg-yellow-100",
  },
  error: { icon: <X className="h-4 w-4" />, color: "text-red-600 bg-red-100" },
};

export function AlertsWidget() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${API_URL}/api/dashboard/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error loading alerts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleMarkAsRead = async (alertId: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch(`${API_URL}/api/dashboard/alerts/${alertId}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking alert as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch(`${API_URL}/api/dashboard/alerts/read-all`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all alerts as read:", error);
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch(`${API_URL}/api/dashboard/alerts/${alertId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (error) {
      console.error("Error dismissing alert:", error);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Teraz";
    if (diffMins < 60) return `${diffMins} min temu`;
    if (diffHours < 24) return `${diffHours} godz. temu`;
    if (diffDays < 7) return `${diffDays} dni temu`;
    return date.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  };

  return (
    <div className="bg-white rounded-2xl border border-border shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-amber-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center relative">
              <Bell className="h-5 w-5 text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-text">Powiadomienia</h3>
              <p className="text-xs text-text-secondary">
                {unreadCount > 0
                  ? `${unreadCount} nieprzeczytanych`
                  : "Wszystko przeczytane"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs text-primary-600 hover:underline font-medium"
            >
              Oznacz wszystkie
            </button>
          )}
        </div>
      </div>

      {/* Alerts List */}
      <div className="max-h-[300px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Bell className="h-12 w-12 text-secondary-300 mx-auto mb-3" />
            <p className="text-text-secondary text-sm">Brak powiadomień</p>
          </div>
        ) : (
          <div className="divide-y divide-secondary-100">
            {alerts.map((alert) => {
              const config =
                ALERT_TYPE_CONFIG[alert.alert_type] || ALERT_TYPE_CONFIG.info;

              return (
                <div
                  key={alert.id}
                  className={`
                    group flex items-start gap-3 p-4 transition-colors
                    ${alert.is_read ? "bg-white" : "bg-amber-50"}
                    hover:bg-secondary-50
                  `}
                >
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 p-2 rounded-lg ${config.color}`}
                  >
                    {config.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm font-medium ${
                          alert.is_read
                            ? "text-text"
                            : "text-text font-semibold"
                        }`}
                      >
                        {alert.title}
                      </p>
                      <span className="text-xs text-text-secondary whitespace-nowrap">
                        {formatTime(alert.created_at)}
                      </span>
                    </div>
                    {alert.message && (
                      <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                        {alert.message}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!alert.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(alert.id)}
                          className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                        >
                          <Check className="h-3 w-3" />
                          Przeczytane
                        </button>
                      )}
                      <button
                        onClick={() => handleDismiss(alert.id)}
                        className="text-xs text-red-600 hover:underline flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Odrzuć
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
