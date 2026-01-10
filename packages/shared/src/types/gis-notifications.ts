/**
 * Typy dla GIS (Global Information System) - Powiadomienia
 */

export type NotificationType =
  | "new_document" // Nowy dokument
  | "update" // Aktualizacja dokumentu
  | "alert" // Alert/ostrzeżenie
  | "reminder" // Przypomnienie
  | "system"; // Powiadomienie systemowe

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationChannel = "email" | "push" | "inapp" | "sms";

export type EmailFrequency =
  | "immediate" // Natychmiast
  | "daily_digest" // Dzienny digest
  | "weekly_digest" // Tygodniowy digest
  | "never"; // Nigdy

export type NotificationStatus = "sent" | "failed" | "queued" | "skipped";

export interface GISNotification {
  id: string;
  user_id: string;
  source_id: string | null;
  document_id: string | null;
  notification_type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  action_url: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

export interface GISNotificationSettings {
  id: string;
  user_id: string;

  // Email
  email_enabled: boolean;
  email_frequency: EmailFrequency;
  email_types: NotificationType[];

  // Push
  push_enabled: boolean;
  push_types: NotificationType[];

  // In-app
  inapp_enabled: boolean;

  // Filtry
  enabled_source_types: string[];
  muted_sources: string[];

  // Godziny ciszy
  quiet_hours_enabled: boolean;
  quiet_hours_start: string; // HH:MM
  quiet_hours_end: string; // HH:MM

  created_at: string;
  updated_at: string;
}

export interface GISNotificationLog {
  id: string;
  notification_id: string;
  user_id: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  error_message: string | null;
  sent_at: string;
}

// Request/Response types

export interface GetNotificationsRequest {
  unread_only?: boolean;
  types?: NotificationType[];
  priorities?: NotificationPriority[];
  limit?: number;
  offset?: number;
}

export interface GetNotificationsResponse {
  notifications: Array<GISNotification & { source_name?: string }>;
  total: number;
  unread_count: number;
}

export interface MarkAsReadRequest {
  notification_ids?: string[]; // Jeśli puste, oznacz wszystkie
}

export interface UpdateNotificationSettingsRequest {
  email_enabled?: boolean;
  email_frequency?: EmailFrequency;
  email_types?: NotificationType[];
  push_enabled?: boolean;
  push_types?: NotificationType[];
  inapp_enabled?: boolean;
  enabled_source_types?: string[];
  muted_sources?: string[];
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  by_type: Record<NotificationType, number>;
  by_priority: Record<NotificationPriority, number>;
  recent_count_24h: number;
}

// Pomocnicze funkcje

export function getNotificationTypeLabel(type: NotificationType): string {
  const labels: Record<NotificationType, string> = {
    new_document: "Nowy dokument",
    update: "Aktualizacja",
    alert: "Alert",
    reminder: "Przypomnienie",
    system: "System",
  };
  return labels[type];
}

export function getNotificationTypeIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    new_document: "FileText",
    update: "RefreshCw",
    alert: "AlertTriangle",
    reminder: "Bell",
    system: "Info",
  };
  return icons[type];
}

export function getPriorityLabel(priority: NotificationPriority): string {
  const labels: Record<NotificationPriority, string> = {
    low: "Niski",
    normal: "Normalny",
    high: "Wysoki",
    urgent: "Pilny",
  };
  return labels[priority];
}

export function getPriorityColor(priority: NotificationPriority): string {
  const colors: Record<NotificationPriority, string> = {
    low: "text-text-secondary",
    normal: "text-primary-600",
    high: "text-warning",
    urgent: "text-danger",
  };
  return colors[priority];
}

export function getEmailFrequencyLabel(frequency: EmailFrequency): string {
  const labels: Record<EmailFrequency, string> = {
    immediate: "Natychmiast",
    daily_digest: "Dzienny digest",
    weekly_digest: "Tygodniowy digest",
    never: "Nigdy",
  };
  return labels[frequency];
}

export function formatNotificationTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Teraz";
  if (diffMins < 60) return `${diffMins} min temu`;
  if (diffHours < 24) return `${diffHours} godz. temu`;
  if (diffDays < 7) return `${diffDays} dni temu`;

  return date.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
