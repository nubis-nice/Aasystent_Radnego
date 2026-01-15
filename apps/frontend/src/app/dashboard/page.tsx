"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { getDashboardStats, type DashboardStats } from "@/lib/api/dashboard";
import { supabase } from "@/lib/supabase/client";
import { CalendarWidget } from "@/components/dashboard/CalendarWidget";
import { TasksWidget } from "@/components/dashboard/TasksWidget";
import { QuickToolsWidget } from "@/components/dashboard/QuickToolsWidget";
import { AlertsWidget } from "@/components/dashboard/AlertsWidget";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);

        // NAJPIERW sprawdź czy użytkownik jest zalogowany
        // Używamy getUser() zamiast getSession() bo getUser() waliduje token z serwerem
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          console.log(
            "[Dashboard] No valid user, redirecting to login",
            userError?.message
          );
          // Brak sesji - przekieruj do logowania BEZ wywoływania API
          window.location.href = "/login";
          return;
        }

        console.log("[Dashboard] User authenticated:", user.id);

        // Pobierz sesję z tokenem
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          console.log("[Dashboard] No access token in session");
          window.location.href = "/login";
          return;
        }

        // Użytkownik zalogowany - pobierz dane z przekazanym tokenem
        const data = await getDashboardStats(session.access_token);
        setStats(data);
        setError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Błąd pobierania danych";
        setError(errorMessage);

        // Jeśli błąd autoryzacji, przekieruj do logowania
        if (
          errorMessage.includes("zalogowany") ||
          errorMessage.includes("authorization")
        ) {
          setTimeout(() => {
            window.location.href = "/login";
          }, 2000);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} ${diffDays === 1 ? "dzień" : "dni"} temu`;
    } else if (diffHours > 0) {
      return `${diffHours} ${diffHours === 1 ? "godzinę" : "godzin"} temu`;
    } else {
      return "Przed chwilą";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-2xl p-6 text-center">
        <p className="text-danger font-semibold mb-2">
          {error || "Błąd ładowania danych"}
        </p>
        {(error?.includes("zalogowany") ||
          error?.includes("authorization")) && (
          <p className="text-sm text-text-secondary">
            Przekierowywanie do strony logowania...
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
          Pulpit Radnego
        </h1>
        <p className="text-text-secondary mt-2 text-base font-medium">
          Twoje centrum zarządzania pracą w Radzie
        </p>
      </div>

      {/* Statystyki - kompaktowe */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
              <span className="text-lg">📄</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-primary-600">
                {stats.documentsCount}
              </span>
              <p className="text-xs text-text-secondary">Dokumentów</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center">
              <span className="text-lg">💬</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-emerald-600">
                {stats.conversationsCount}
              </span>
              <p className="text-xs text-text-secondary">Konwersacji</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
              <span className="text-lg">🤖</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-purple-600">
                {stats.messagesCount}
              </span>
              <p className="text-xs text-text-secondary">Zapytań AI</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
              <span className="text-lg">📊</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-amber-600">
                +{stats.documentsThisWeek}
              </span>
              <p className="text-xs text-text-secondary">Ten tydzień</p>
            </div>
          </div>
        </div>
      </div>

      {/* Główny layout - 2 kolumny */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lewa kolumna - Kalendarz */}
        <div className="lg:col-span-2">
          <CalendarWidget />
        </div>

        {/* Prawa kolumna - Zadania i Alerty */}
        <div className="space-y-6">
          <div data-widget="tasks">
            <TasksWidget />
          </div>
          <AlertsWidget />
        </div>
      </div>

      {/* Dolna sekcja - Szybkie narzędzia i Aktywność */}
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickToolsWidget />

        {/* Ostatnia aktywność */}
        <div className="rounded-2xl border border-border bg-white shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-secondary-50 to-white">
            <h3 className="font-bold text-text flex items-center gap-2">
              📊 Ostatnia aktywność
            </h3>
          </div>
          <div className="p-4 max-h-[300px] overflow-y-auto">
            {stats.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActivity.slice(0, 5).map((activity) => {
                  const href =
                    activity.type === "document"
                      ? `/documents/${activity.id}`
                      : `/chat?conversation=${activity.id}`;

                  return (
                    <Link
                      key={activity.id}
                      href={href}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-secondary-50 transition-colors cursor-pointer group"
                    >
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                        <span className="text-white text-sm">
                          {activity.type === "document" ? "📄" : "💬"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate group-hover:text-primary-600 transition-colors">
                          {activity.title}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {getTimeAgo(activity.timestamp)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-text-secondary">
                <p className="text-sm">Brak ostatniej aktywności</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
