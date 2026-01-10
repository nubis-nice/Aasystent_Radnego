"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getDashboardStats, type DashboardStats } from "@/lib/api/dashboard";
import { supabase } from "@/lib/supabase/client";

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
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
          Pulpit
        </h1>
        <p className="text-text-secondary mt-2 text-base font-medium">
          Witaj w panelu Asystenta Radnego. Oto podsumowanie Twoich ostatnich
          aktywności.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Stat Card 1 */}
        <div className="group rounded-2xl border border-border bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-start justify-between pb-3">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                Ostatnie dokumenty
              </h3>
              <span className="text-4xl font-bold bg-gradient-to-br from-primary-600 to-primary-700 bg-clip-text text-transparent mt-2 block">
                {stats.documentsCount}
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg
                className="h-6 w-6 text-primary-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
          <p className="text-sm text-success font-semibold">
            {stats.documentsThisWeek > 0
              ? `+${stats.documentsThisWeek} w tym tygodniu`
              : "Brak nowych"}
          </p>
        </div>

        {/* Stat Card 2 */}
        <div className="group rounded-2xl border border-border bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-start justify-between pb-3">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                Konwersacje AI
              </h3>
              <span className="text-4xl font-bold bg-gradient-to-br from-primary-600 to-primary-700 bg-clip-text text-transparent mt-2 block">
                {stats.conversationsCount}
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-success/20 to-success/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg
                className="h-6 w-6 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <p className="text-sm text-text-secondary font-medium">
            {stats.conversationsCount > 0
              ? "Aktywne rozmowy z asystentem"
              : "Rozpocznij pierwszą rozmowę"}
          </p>
        </div>

        {/* Stat Card 3 */}
        <div className="group rounded-2xl border border-border bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-start justify-between pb-3">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                Zapytania do AI
              </h3>
              <span className="text-4xl font-bold bg-gradient-to-br from-primary-600 to-primary-700 bg-clip-text text-transparent mt-2 block">
                {stats.messagesCount}
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg
                className="h-6 w-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
          </div>
          <p className="text-sm text-text-secondary font-medium">
            {stats.messagesCount > 0
              ? `Wymieniono ${stats.messagesCount} wiadomości`
              : "Brak wiadomości"}
          </p>
        </div>
      </div>

      {/* Ostatnia aktywność */}
      <div className="rounded-2xl border border-border bg-white p-8 shadow-md">
        <h3 className="font-bold text-xl text-text mb-6">Ostatnia aktywność</h3>
        <div className="space-y-5">
          {stats.recentActivity.length > 0 ? (
            stats.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-4 rounded-xl hover:bg-secondary-50 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text">
                    {activity.title}
                  </p>
                  <p className="text-xs text-text-secondary mt-1 font-medium">
                    {getTimeAgo(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-text-secondary">
              <p>Brak ostatniej aktywności</p>
              <p className="text-sm mt-2">
                Dodaj dokumenty lub rozpocznij rozmowę z AI
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
