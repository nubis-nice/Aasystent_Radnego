"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
} from "lucide-react";
import { getDashboardStats, type DashboardStats } from "@/lib/api/dashboard";
import { supabase } from "@/lib/supabase/client";
import { CalendarWidget } from "@/components/dashboard/CalendarWidget";
import { TasksWidget } from "@/components/dashboard/TasksWidget";
import { QuickToolsWidget } from "@/components/dashboard/QuickToolsWidget";
import { AlertsWidget } from "@/components/dashboard/AlertsWidget";

type ProcessingTone = "ok" | "info" | "warning" | "danger";

interface ProcessingSignal {
  id: string;
  title: string;
  statusLabel: string;
  tone: ProcessingTone;
  description: string;
  eta: string;
}

const toneStyles: Record<
  ProcessingTone,
  { badge: string; dot: string; icon: ReactNode }
> = {
  ok: {
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dot: "bg-emerald-500",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  },
  info: {
    badge: "bg-sky-50 text-sky-700 border border-sky-200",
    dot: "bg-sky-500",
    icon: <Activity className="h-4 w-4 text-sky-600" />,
  },
  warning: {
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    dot: "bg-amber-500",
    icon: <Clock3 className="h-4 w-4 text-amber-600" />,
  },
  danger: {
    badge: "bg-rose-50 text-rose-700 border border-rose-200",
    dot: "bg-rose-500",
    icon: <AlertTriangle className="h-4 w-4 text-rose-600" />,
  },
};

const layoutClasses = {
  page: "space-y-6 w-full px-4 lg:px-6",
  statsGrid: "grid gap-4 grid-cols-2 lg:grid-cols-4 flex-1",
  topRow:
    "grid gap-6 items-stretch lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]",
  calendarWrapper: "h-full",
  sidebar: "flex flex-col gap-6 h-full w-full min-w-0 lg:min-w-[320px]",
  sidebarPanel: "flex-1 flex flex-col",
  bottomRow: "grid gap-6 lg:grid-cols-3",
  widgetShell:
    "rounded-2xl border border-border bg-white shadow-md overflow-hidden",
};

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

  const processingSignals: ProcessingSignal[] = [
    {
      id: "ocr",
      title: "Transkrypcje i OCR",
      statusLabel: "W toku",
      tone: "info",
      description: "Przetwarzamy 2 nagrania z ostatniej sesji oraz 1 skan PDF.",
      eta: "ok. 8 minut",
    },
    {
      id: "scraper",
      title: "Scraping BIP / RIO",
      statusLabel: "Ostrzeżenie",
      tone: "warning",
      description:
        "Źródło BIP Gminy Drawno odpowiada wolno – dane zostaną zsynchronizowane po 06:30.",
      eta: "kolejna próba za 12 min",
    },
    {
      id: "analysis",
      title: "Analizy i scoring dokumentów",
      statusLabel: "Stabilne",
      tone: "ok",
      description: `Zakończono ${stats.documentsThisWeek} analiz w tym tygodniu. Brak błędów krytycznych.`,
      eta: "ostatnia analiza 12 min temu",
    },
    {
      id: "imports",
      title: "Integracje kalendarza",
      statusLabel: "Potrzebna uwaga",
      tone: "danger",
      description:
        "Webhook Google Calendar zwrócił błąd autoryzacji. Sprawdź token usługowy lub połącz konto ponownie.",
      eta: "ostatnia próba 3 min temu",
    },
  ];

  return (
    <div className={layoutClasses.page}>
      {/* Header + Statystyki */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-primary-50 via-white to-secondary-50 shadow-md p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
              Pulpit Radnego
            </h1>
            <p className="text-text-secondary mt-2 text-base font-medium">
              Twoje centrum zarządzania pracą w Radzie
            </p>
          </div>

          <div className={layoutClasses.statsGrid}>
            {[
              {
                label: "Dokumentów",
                value: stats.documentsCount,
                icon: "📄",
                valueClass: "text-primary-600",
                gradient: "from-primary-100 to-primary-200",
              },
              {
                label: "Konwersacji",
                value: stats.conversationsCount,
                icon: "💬",
                valueClass: "text-emerald-600",
                gradient: "from-emerald-100 to-emerald-200",
              },
              {
                label: "Zapytań AI",
                value: stats.messagesCount,
                icon: "🤖",
                valueClass: "text-purple-600",
                gradient: "from-purple-100 to-purple-200",
              },
              {
                label: "Ten tydzień",
                value: `+${stats.documentsThisWeek}`,
                icon: "📊",
                valueClass: "text-amber-600",
                gradient: "from-amber-100 to-amber-200",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-border/70 bg-white/90 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center`}
                  >
                    <span className="text-lg">{card.icon}</span>
                  </div>
                  <div>
                    <span className={`text-2xl font-bold ${card.valueClass}`}>
                      {card.value}
                    </span>
                    <p className="text-xs text-text-secondary">{card.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wiersz główny: kalendarz + panel boczny */}
      <div className={layoutClasses.topRow}>
        <div className={layoutClasses.calendarWrapper}>
          <CalendarWidget />
        </div>
        <div className={layoutClasses.sidebar}>
          <div className={`${layoutClasses.sidebarPanel} min-h-0`}>
            <TasksWidget />
          </div>
          <div className={`${layoutClasses.sidebarPanel} min-h-0`}>
            <AlertsWidget />
          </div>
        </div>
      </div>

      {/* Wiersz dolny: przetwarzanie, szybkie narzędzia, aktywność */}
      <div className={layoutClasses.bottomRow}>
        <div className="h-full">
          <QuickToolsWidget />
        </div>

        <div className={`${layoutClasses.widgetShell} flex flex-col`}>
          <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-secondary-50 to-white">
            <h3 className="font-bold text-text flex items-center gap-2">
              📊 Ostatnia aktywność
            </h3>
          </div>
          <div className="p-4 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                      className="group flex items-start gap-3 p-3 rounded-xl border border-secondary-200 bg-white hover:border-primary-300 hover:shadow-md transition-all"
                    >
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                        <span className="text-white text-sm">
                          {activity.type === "document" ? "📄" : "💬"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text group-hover:text-primary-600 transition-colors">
                          {activity.title}
                        </p>
                        <p className="text-xs text-text-secondary mt-1 whitespace-pre-wrap break-words">
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

        <div className={`${layoutClasses.widgetShell} flex flex-col`}>
          <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-amber-50 to-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-text">
                  Przetwarzanie danych i alarmy
                </h3>
                <p className="text-xs text-text-secondary">
                  Inteligentny agregator logów i trwających procesów
                </p>
              </div>
              <span className="text-[11px] font-medium text-text-secondary">
                ostatnia aktualizacja: przed chwilą
              </span>
            </div>
          </div>
          <div className="divide-y divide-border/80 flex-1 overflow-auto">
            {processingSignals.map((signal) => (
              <div key={signal.id} className="p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-text">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          toneStyles[signal.tone].dot
                        }`}
                      />
                      {signal.title}
                    </div>
                    <p className="text-sm text-text-secondary mt-1">
                      {signal.description}
                    </p>
                  </div>
                  <div
                    className={`text-[11px] px-3 py-1 rounded-full ${
                      toneStyles[signal.tone].badge
                    }`}
                  >
                    {signal.statusLabel}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
                  {toneStyles[signal.tone].icon}
                  <span>{signal.eta}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
