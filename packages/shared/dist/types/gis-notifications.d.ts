/**
 * Typy dla GIS (Global Information System) - Powiadomienia
 */
export type NotificationType = "new_document" | "update" | "alert" | "reminder" | "system";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type NotificationChannel = "email" | "push" | "inapp" | "sms";
export type EmailFrequency = "immediate" | "daily_digest" | "weekly_digest" | "never";
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
    email_enabled: boolean;
    email_frequency: EmailFrequency;
    email_types: NotificationType[];
    push_enabled: boolean;
    push_types: NotificationType[];
    inapp_enabled: boolean;
    enabled_source_types: string[];
    muted_sources: string[];
    quiet_hours_enabled: boolean;
    quiet_hours_start: string;
    quiet_hours_end: string;
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
export interface GetNotificationsRequest {
    unread_only?: boolean;
    types?: NotificationType[];
    priorities?: NotificationPriority[];
    limit?: number;
    offset?: number;
}
export interface GetNotificationsResponse {
    notifications: Array<GISNotification & {
        source_name?: string;
    }>;
    total: number;
    unread_count: number;
}
export interface MarkAsReadRequest {
    notification_ids?: string[];
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
export declare function getNotificationTypeLabel(type: NotificationType): string;
export declare function getNotificationTypeIcon(type: NotificationType): string;
export declare function getPriorityLabel(priority: NotificationPriority): string;
export declare function getPriorityColor(priority: NotificationPriority): string;
export declare function getEmailFrequencyLabel(frequency: EmailFrequency): string;
export declare function formatNotificationTime(timestamp: string): string;
//# sourceMappingURL=gis-notifications.d.ts.map