/**
 * API client dla Dashboard
 */

import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface DashboardStats {
  documentsCount: number;
  documentsThisWeek: number;
  conversationsCount: number;
  messagesCount: number;
  recentActivity: Activity[];
}

export interface Activity {
  id: string;
  type: "document" | "conversation" | "login";
  title: string;
  timestamp: string;
}

/**
 * Pobierz statystyki Dashboard
 */
export async function getDashboardStats(
  accessToken?: string
): Promise<DashboardStats> {
  let token = accessToken;

  if (!token) {
    token = await getAccessToken();
  }

  if (!token) {
    throw new Error("Musisz być zalogowany aby zobaczyć statystyki");
  }

  const response = await fetch(`${API_URL}/api/dashboard/stats`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to fetch dashboard stats");
  }

  return response.json();
}

/**
 * Pomocnicza funkcja do pobierania access token z Supabase
 */
async function getAccessToken(): Promise<string> {
  if (typeof window === "undefined") {
    return "";
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log(
    "[Dashboard API] getAccessToken result:",
    session?.access_token ? "token found" : "no token"
  );
  return session?.access_token || "";
}
