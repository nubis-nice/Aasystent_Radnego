/**
 * Scheduled Reports Service
 * Generowanie i wysyłanie raportów cyklicznych (dziennych, tygodniowych, miesięcznych)
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
  dayOfWeek?: number; // 0-6 dla weekly (0 = niedziela)
  dayOfMonth?: number; // 1-31 dla monthly
  timeOfDay: string; // HH:MM
  enabled: boolean;
  emailNotification: boolean;
  inAppNotification: boolean;
  lastRunAt?: string;
  nextRunAt: string;
  config: ReportConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ReportConfig {
  title?: string;
  filters?: Record<string, unknown>;
  includeCharts?: boolean;
  includeSummary?: boolean;
  customSections?: string[];
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
  documents?: DocumentStats;
  sessions?: SessionStats;
  budget?: BudgetStats;
  activity?: ActivityStats;
  custom?: Record<string, unknown>;
}

export interface DocumentStats {
  total: number;
  new: number;
  processed: number;
  byType: Record<string, number>;
  topKeywords: Array<{ keyword: string; count: number }>;
}

export interface SessionStats {
  total: number;
  upcoming: number;
  past: number;
  resolutions: number;
  nextSession?: {
    date: string;
    title: string;
  };
}

export interface BudgetStats {
  totalBudget: number;
  executed: number;
  executionRate: number;
  byCategory: Record<string, { planned: number; executed: number }>;
  alerts: string[];
}

export interface ActivityStats {
  logins: number;
  searches: number;
  documentsViewed: number;
  analysisRequests: number;
  chatMessages: number;
}

export class ScheduledReportsService {
  private supabase;
  private userId: string | null = null;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  async initialize(userId: string): Promise<void> {
    this.userId = userId;
  }

  /**
   * Pobierz harmonogramy raportów użytkownika
   */
  async getSchedules(): Promise<ReportSchedule[]> {
    if (!this.userId) throw new Error("Serwis nie zainicjalizowany");

    const { data, error } = await this.supabase
      .from("report_schedules")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    if (error)
      throw new Error("Błąd pobierania harmonogramów: " + error.message);

    return (data || []).map(this.mapDBToSchedule);
  }

  /**
   * Utwórz nowy harmonogram
   */
  async createSchedule(params: {
    name: string;
    reportType: ReportType;
    frequency: ReportFrequency;
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay: string;
    emailNotification?: boolean;
    inAppNotification?: boolean;
    config?: ReportConfig;
  }): Promise<ReportSchedule> {
    if (!this.userId) throw new Error("Serwis nie zainicjalizowany");

    const nextRunAt = this.calculateNextRun(
      params.frequency,
      params.timeOfDay,
      params.dayOfWeek,
      params.dayOfMonth,
    );

    const { data, error } = await this.supabase
      .from("report_schedules")
      .insert({
        user_id: this.userId,
        name: params.name,
        report_type: params.reportType,
        frequency: params.frequency,
        day_of_week: params.dayOfWeek,
        day_of_month: params.dayOfMonth,
        time_of_day: params.timeOfDay,
        enabled: true,
        email_notification: params.emailNotification ?? true,
        in_app_notification: params.inAppNotification ?? true,
        next_run_at: nextRunAt.toISOString(),
        config: params.config || {},
      })
      .select()
      .single();

    if (error) throw new Error("Błąd tworzenia harmonogramu: " + error.message);

    return this.mapDBToSchedule(data);
  }

  /**
   * Aktualizuj harmonogram
   */
  async updateSchedule(
    scheduleId: string,
    updates: Partial<{
      name: string;
      frequency: ReportFrequency;
      dayOfWeek: number;
      dayOfMonth: number;
      timeOfDay: string;
      enabled: boolean;
      emailNotification: boolean;
      inAppNotification: boolean;
      config: ReportConfig;
    }>,
  ): Promise<ReportSchedule> {
    if (!this.userId) throw new Error("Serwis nie zainicjalizowany");

    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.frequency !== undefined)
      dbUpdates.frequency = updates.frequency;
    if (updates.dayOfWeek !== undefined)
      dbUpdates.day_of_week = updates.dayOfWeek;
    if (updates.dayOfMonth !== undefined)
      dbUpdates.day_of_month = updates.dayOfMonth;
    if (updates.timeOfDay !== undefined)
      dbUpdates.time_of_day = updates.timeOfDay;
    if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
    if (updates.emailNotification !== undefined)
      dbUpdates.email_notification = updates.emailNotification;
    if (updates.inAppNotification !== undefined)
      dbUpdates.in_app_notification = updates.inAppNotification;
    if (updates.config !== undefined) dbUpdates.config = updates.config;

    // Przelicz next_run_at jeśli zmieniono parametry czasowe
    if (
      updates.frequency ||
      updates.timeOfDay ||
      updates.dayOfWeek ||
      updates.dayOfMonth
    ) {
      const { data: current } = await this.supabase
        .from("report_schedules")
        .select("frequency, time_of_day, day_of_week, day_of_month")
        .eq("id", scheduleId)
        .single();

      if (current) {
        const nextRunAt = this.calculateNextRun(
          updates.frequency || current.frequency,
          updates.timeOfDay || current.time_of_day,
          updates.dayOfWeek ?? current.day_of_week,
          updates.dayOfMonth ?? current.day_of_month,
        );
        dbUpdates.next_run_at = nextRunAt.toISOString();
      }
    }

    const { data, error } = await this.supabase
      .from("report_schedules")
      .update(dbUpdates)
      .eq("id", scheduleId)
      .eq("user_id", this.userId)
      .select()
      .single();

    if (error)
      throw new Error("Błąd aktualizacji harmonogramu: " + error.message);

    return this.mapDBToSchedule(data);
  }

  /**
   * Usuń harmonogram
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    if (!this.userId) throw new Error("Serwis nie zainicjalizowany");

    const { error } = await this.supabase
      .from("report_schedules")
      .delete()
      .eq("id", scheduleId)
      .eq("user_id", this.userId);

    if (error) throw new Error("Błąd usuwania harmonogramu: " + error.message);
  }

  /**
   * Generuj raport natychmiast
   */
  async generateReport(scheduleId: string): Promise<GeneratedReport> {
    if (!this.userId) throw new Error("Serwis nie zainicjalizowany");

    // Pobierz harmonogram
    const { data: schedule, error } = await this.supabase
      .from("report_schedules")
      .select("*")
      .eq("id", scheduleId)
      .eq("user_id", this.userId)
      .single();

    if (error || !schedule) {
      throw new Error("Harmonogram nie znaleziony");
    }

    // Oblicz okres raportu
    const { periodStart, periodEnd } = this.calculateReportPeriod(
      schedule.frequency,
    );

    // Generuj dane raportu
    const reportData = await this.generateReportData(
      schedule.report_type,
      periodStart,
      periodEnd,
      schedule.config,
    );

    // Zapisz raport
    const { data: report, error: saveError } = await this.supabase
      .from("generated_reports")
      .insert({
        schedule_id: scheduleId,
        user_id: this.userId,
        report_type: schedule.report_type,
        title: schedule.name,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        data: reportData,
        summary: this.generateSummary(reportData),
      })
      .select()
      .single();

    if (saveError) throw new Error("Błąd zapisu raportu: " + saveError.message);

    // Aktualizuj last_run_at i next_run_at
    const nextRunAt = this.calculateNextRun(
      schedule.frequency,
      schedule.time_of_day,
      schedule.day_of_week,
      schedule.day_of_month,
    );

    await this.supabase
      .from("report_schedules")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRunAt.toISOString(),
      })
      .eq("id", scheduleId);

    // Wyślij powiadomienia
    if (schedule.in_app_notification) {
      await this.sendInAppNotification(report);
    }

    return this.mapDBToReport(report);
  }

  /**
   * Pobierz wygenerowane raporty
   */
  async getReports(limit: number = 20): Promise<GeneratedReport[]> {
    if (!this.userId) throw new Error("Serwis nie zainicjalizowany");

    const { data, error } = await this.supabase
      .from("generated_reports")
      .select("*")
      .eq("user_id", this.userId)
      .order("generated_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error("Błąd pobierania raportów: " + error.message);

    return (data || []).map(this.mapDBToReport);
  }

  /**
   * Pobierz szczegóły raportu
   */
  async getReport(reportId: string): Promise<GeneratedReport | null> {
    if (!this.userId) throw new Error("Serwis nie zainicjalizowany");

    const { data, error } = await this.supabase
      .from("generated_reports")
      .select("*")
      .eq("id", reportId)
      .eq("user_id", this.userId)
      .maybeSingle();

    if (error) throw new Error("Błąd pobierania raportu: " + error.message);
    if (!data) return null;

    return this.mapDBToReport(data);
  }

  // =========================================================================
  // Metody prywatne
  // =========================================================================

  private calculateNextRun(
    frequency: ReportFrequency,
    timeOfDay: string,
    dayOfWeek?: number,
    dayOfMonth?: number,
  ): Date {
    const [hours, minutes] = timeOfDay.split(":").map(Number);
    const now = new Date();
    const next = new Date();

    next.setHours(hours, minutes, 0, 0);

    switch (frequency) {
      case "daily":
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        break;

      case "weekly": {
        const targetDay = dayOfWeek ?? 1; // Domyślnie poniedziałek
        const currentDay = now.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0 || (daysUntil === 0 && next <= now)) {
          daysUntil += 7;
        }
        next.setDate(next.getDate() + daysUntil);
        break;
      }

      case "monthly": {
        const targetDate = dayOfMonth ?? 1;
        next.setDate(targetDate);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        break;
      }
    }

    return next;
  }

  private calculateReportPeriod(frequency: ReportFrequency): {
    periodStart: Date;
    periodEnd: Date;
  } {
    const now = new Date();
    const periodEnd = new Date(now);
    const periodStart = new Date(now);

    switch (frequency) {
      case "daily":
        periodStart.setDate(periodStart.getDate() - 1);
        break;
      case "weekly":
        periodStart.setDate(periodStart.getDate() - 7);
        break;
      case "monthly":
        periodStart.setMonth(periodStart.getMonth() - 1);
        break;
    }

    return { periodStart, periodEnd };
  }

  private async generateReportData(
    reportType: ReportType,
    periodStart: Date,
    periodEnd: Date,
    // config will be used for custom filtering in future
    config: ReportConfig,
  ): Promise<ReportData> {
    void config; // Reserved for future use
    const data: ReportData = {};

    switch (reportType) {
      case "documents":
        data.documents = await this.getDocumentStats(periodStart, periodEnd);
        break;
      case "sessions":
        data.sessions = await this.getSessionStats(periodStart, periodEnd);
        break;
      case "budget":
        data.budget = await this.getBudgetStats();
        break;
      case "activity":
        data.activity = await this.getActivityStats(periodStart, periodEnd);
        break;
      case "custom":
        // Custom łączy wszystkie
        data.documents = await this.getDocumentStats(periodStart, periodEnd);
        data.sessions = await this.getSessionStats(periodStart, periodEnd);
        data.activity = await this.getActivityStats(periodStart, periodEnd);
        break;
    }

    return data;
  }

  private async getDocumentStats(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<DocumentStats> {
    const { data: docs } = await this.supabase
      .from("processed_documents")
      .select("id, document_type, keywords, created_at")
      .eq("user_id", this.userId)
      .gte("created_at", periodStart.toISOString())
      .lte("created_at", periodEnd.toISOString());

    const documents = docs || [];
    const byType: Record<string, number> = {};
    const keywordCounts: Record<string, number> = {};

    documents.forEach((doc) => {
      const type = doc.document_type || "unknown";
      byType[type] = (byType[type] || 0) + 1;

      const keywords = doc.keywords || [];
      keywords.forEach((kw: string) => {
        keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
      });
    });

    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));

    return {
      total: documents.length,
      new: documents.length,
      processed: documents.filter((d) => d.document_type).length,
      byType,
      topKeywords,
    };
  }

  private async getSessionStats(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<SessionStats> {
    void periodStart;
    void periodEnd; // Reserved for filtering
    const now = new Date();

    const { data: sessions } = await this.supabase
      .from("processed_documents")
      .select("id, session_date, session_number, metadata")
      .eq("user_id", this.userId)
      .eq("document_type", "session")
      .order("session_date", { ascending: true });

    const allSessions = sessions || [];
    const upcoming = allSessions.filter(
      (s) => s.session_date && new Date(s.session_date) > now,
    );
    const past = allSessions.filter(
      (s) => s.session_date && new Date(s.session_date) <= now,
    );

    return {
      total: allSessions.length,
      upcoming: upcoming.length,
      past: past.length,
      resolutions: 0, // TODO: policzyć uchwały
      nextSession: upcoming[0]
        ? {
            date: upcoming[0].session_date,
            title: `Sesja nr ${upcoming[0].session_number || "?"}`,
          }
        : undefined,
    };
  }

  private async getBudgetStats(): Promise<BudgetStats> {
    // TODO: Implementacja pobierania danych budżetowych
    return {
      totalBudget: 0,
      executed: 0,
      executionRate: 0,
      byCategory: {},
      alerts: [],
    };
  }

  private async getActivityStats(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<ActivityStats> {
    void periodStart;
    void periodEnd; // Reserved for filtering
    // TODO: Implementacja statystyk aktywności z audit_logs
    return {
      logins: 0,
      searches: 0,
      documentsViewed: 0,
      analysisRequests: 0,
      chatMessages: 0,
    };
  }

  private generateSummary(data: ReportData): string {
    const parts: string[] = [];

    if (data.documents) {
      parts.push(
        `Dokumenty: ${data.documents.total} (nowe: ${data.documents.new})`,
      );
    }
    if (data.sessions) {
      parts.push(
        `Sesje: ${data.sessions.total} (nadchodzące: ${data.sessions.upcoming})`,
      );
    }
    if (data.activity) {
      parts.push(`Wyszukiwania: ${data.activity.searches}`);
    }

    return parts.join(" | ") || "Brak danych";
  }

  private async sendInAppNotification(
    report: Record<string, unknown>,
  ): Promise<void> {
    // Zapisz powiadomienie do tabeli notifications
    await this.supabase.from("notifications").insert({
      user_id: this.userId,
      type: "report_generated",
      title: `Raport: ${report.title}`,
      message: `Wygenerowano raport za okres ${report.period_start} - ${report.period_end}`,
      data: { reportId: report.id },
      read: false,
    });
  }

  private mapDBToSchedule(row: Record<string, unknown>): ReportSchedule {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      reportType: row.report_type as ReportType,
      frequency: row.frequency as ReportFrequency,
      dayOfWeek: row.day_of_week as number | undefined,
      dayOfMonth: row.day_of_month as number | undefined,
      timeOfDay: row.time_of_day as string,
      enabled: row.enabled as boolean,
      emailNotification: row.email_notification as boolean,
      inAppNotification: row.in_app_notification as boolean,
      lastRunAt: row.last_run_at as string | undefined,
      nextRunAt: row.next_run_at as string,
      config: (row.config as ReportConfig) || {},
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private mapDBToReport(row: Record<string, unknown>): GeneratedReport {
    return {
      id: row.id as string,
      scheduleId: row.schedule_id as string,
      userId: row.user_id as string,
      reportType: row.report_type as ReportType,
      title: row.title as string,
      generatedAt: row.generated_at as string,
      periodStart: row.period_start as string,
      periodEnd: row.period_end as string,
      data: (row.data as ReportData) || {},
      summary: row.summary as string,
      pdfUrl: row.pdf_url as string | undefined,
    };
  }
}
