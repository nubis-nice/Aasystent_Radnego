/**
 * Scheduled Reports Service
 * Generowanie i wysyłanie raportów cyklicznych (dziennych, tygodniowych, miesięcznych)
 */
export type ReportFrequency = "daily" | "weekly" | "monthly";
export type ReportType = "documents" | "sessions" | "budget" | "activity" | "custom";
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
    topKeywords: Array<{
        keyword: string;
        count: number;
    }>;
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
    byCategory: Record<string, {
        planned: number;
        executed: number;
    }>;
    alerts: string[];
}
export interface ActivityStats {
    logins: number;
    searches: number;
    documentsViewed: number;
    analysisRequests: number;
    chatMessages: number;
}
export declare class ScheduledReportsService {
    private supabase;
    private userId;
    constructor();
    initialize(userId: string): Promise<void>;
    /**
     * Pobierz harmonogramy raportów użytkownika
     */
    getSchedules(): Promise<ReportSchedule[]>;
    /**
     * Utwórz nowy harmonogram
     */
    createSchedule(params: {
        name: string;
        reportType: ReportType;
        frequency: ReportFrequency;
        dayOfWeek?: number;
        dayOfMonth?: number;
        timeOfDay: string;
        emailNotification?: boolean;
        inAppNotification?: boolean;
        config?: ReportConfig;
    }): Promise<ReportSchedule>;
    /**
     * Aktualizuj harmonogram
     */
    updateSchedule(scheduleId: string, updates: Partial<{
        name: string;
        frequency: ReportFrequency;
        dayOfWeek: number;
        dayOfMonth: number;
        timeOfDay: string;
        enabled: boolean;
        emailNotification: boolean;
        inAppNotification: boolean;
        config: ReportConfig;
    }>): Promise<ReportSchedule>;
    /**
     * Usuń harmonogram
     */
    deleteSchedule(scheduleId: string): Promise<void>;
    /**
     * Generuj raport natychmiast
     */
    generateReport(scheduleId: string): Promise<GeneratedReport>;
    /**
     * Pobierz wygenerowane raporty
     */
    getReports(limit?: number): Promise<GeneratedReport[]>;
    /**
     * Pobierz szczegóły raportu
     */
    getReport(reportId: string): Promise<GeneratedReport | null>;
    private calculateNextRun;
    private calculateReportPeriod;
    private generateReportData;
    private getDocumentStats;
    private getSessionStats;
    private getBudgetStats;
    private getActivityStats;
    private generateSummary;
    private sendInAppNotification;
    private mapDBToSchedule;
    private mapDBToReport;
}
//# sourceMappingURL=scheduled-reports-service.d.ts.map