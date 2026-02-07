/**
 * Reports API Client
 * Klient dla raportów cyklicznych
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function getAccessToken(): Promise<string> {
  if (typeof window === "undefined") return "";
  const { supabase } = await import("@/lib/supabase/client");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || "";
}

async function getAuthHeaders() {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Typy
export type ReportFrequency = "daily" | "weekly" | "monthly";
export type ReportType =
  | "documents"
  | "sessions"
  | "budget"
  | "activity"
  | "custom";

export interface ReportSchedule {
  id: string;
  userId: string;
  name: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
  enabled: boolean;
  emailNotification: boolean;
  inAppNotification: boolean;
  lastRunAt?: string;
  nextRunAt: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedReport {
  id: string;
  scheduleId: string;
  userId: string;
  reportType: ReportType;
  title: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  data: ReportData;
  summary: string;
  pdfUrl?: string;
}

export interface ReportData {
  documents?: {
    total: number;
    new: number;
    processed: number;
    byType: Record<string, number>;
    topKeywords: Array<{ keyword: string; count: number }>;
  };
  sessions?: {
    total: number;
    upcoming: number;
    past: number;
    resolutions: number;
    nextSession?: { date: string; title: string };
  };
  budget?: {
    totalBudget: number;
    executed: number;
    executionRate: number;
    byCategory: Record<string, { planned: number; executed: number }>;
    alerts: string[];
  };
  activity?: {
    logins: number;
    searches: number;
    documentsViewed: number;
    analysisRequests: number;
    chatMessages: number;
  };
}

/**
 * Pobierz harmonogramy raportów
 */
export async function getReportSchedules(): Promise<ReportSchedule[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/reports/schedules`, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Nie udało się pobrać harmonogramów");
  }

  const data = await response.json();
  return data.schedules;
}

/**
 * Utwórz harmonogram
 */
export async function createReportSchedule(params: {
  name: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
  emailNotification?: boolean;
  inAppNotification?: boolean;
  config?: Record<string, unknown>;
}): Promise<ReportSchedule> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/reports/schedules`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error("Nie udało się utworzyć harmonogramu");
  }

  const data = await response.json();
  return data.schedule;
}

/**
 * Aktualizuj harmonogram
 */
export async function updateReportSchedule(
  id: string,
  updates: Partial<{
    name: string;
    frequency: ReportFrequency;
    dayOfWeek: number;
    dayOfMonth: number;
    timeOfDay: string;
    enabled: boolean;
    emailNotification: boolean;
    inAppNotification: boolean;
    config: Record<string, unknown>;
  }>,
): Promise<ReportSchedule> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/reports/schedules/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error("Nie udało się zaktualizować harmonogramu");
  }

  const data = await response.json();
  return data.schedule;
}

/**
 * Usuń harmonogram
 */
export async function deleteReportSchedule(id: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/reports/schedules/${id}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error("Nie udało się usunąć harmonogramu");
  }
}

/**
 * Generuj raport natychmiast
 */
export async function generateReport(
  scheduleId: string,
): Promise<GeneratedReport> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/reports/schedules/${scheduleId}/generate`,
    {
      method: "POST",
      headers,
    },
  );

  if (!response.ok) {
    throw new Error("Nie udało się wygenerować raportu");
  }

  const data = await response.json();
  return data.report;
}

/**
 * Pobierz wygenerowane raporty
 */
export async function getGeneratedReports(
  limit: number = 20,
): Promise<GeneratedReport[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/reports?limit=${limit}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Nie udało się pobrać raportów");
  }

  const data = await response.json();
  return data.reports;
}

/**
 * Pobierz szczegóły raportu
 */
export async function getReportDetails(id: string): Promise<GeneratedReport> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/reports/${id}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Nie udało się pobrać raportu");
  }

  const data = await response.json();
  return data.report;
}
