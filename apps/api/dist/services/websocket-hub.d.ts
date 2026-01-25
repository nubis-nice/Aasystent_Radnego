/**
 * WebSocket Hub - Centralny serwis WebSocket dla powiadomień real-time
 *
 * Obsługuje:
 * - GIS Notifications (powiadomienia o nowych dokumentach)
 * - Task Status (status przetwarzanych zadań: scraping, transkrypcja, OCR)
 * - System Events (alerty, aktualizacje)
 */
import { EventEmitter } from "events";
import type { WebSocket } from "ws";
export type WSMessageType = "gis_notification" | "task_update" | "task_complete" | "task_error" | "system_alert" | "connection_ack" | "ping" | "pong";
export interface WSMessage {
    type: WSMessageType;
    payload: unknown;
    timestamp: string;
    userId?: string;
}
export interface TaskStatus {
    id: string;
    type: "scraping" | "transcription" | "ocr" | "embedding" | "analysis";
    status: "queued" | "running" | "completed" | "failed";
    progress?: number;
    title: string;
    description?: string;
    startedAt?: string;
    estimatedTimeMs?: number;
    error?: string;
    result?: unknown;
}
export interface GISNotificationPayload {
    id: string;
    notification_type: "new_document" | "update" | "alert" | "reminder" | "system";
    priority: "low" | "normal" | "high" | "urgent";
    title: string;
    message: string;
    action_url?: string;
    source_name?: string;
    metadata?: Record<string, unknown>;
}
export interface SystemAlertPayload {
    level: "info" | "warning" | "error";
    title: string;
    message: string;
    action?: {
        label: string;
        url: string;
    };
}
declare class WebSocketHub extends EventEmitter {
    private static instance;
    private connections;
    private taskStatuses;
    private constructor();
    static getInstance(): WebSocketHub;
    /**
     * Rejestruje nowe połączenie WebSocket dla użytkownika
     */
    registerConnection(userId: string, ws: WebSocket): void;
    /**
     * Usuwa połączenie WebSocket
     */
    unregisterConnection(userId: string, ws: WebSocket): void;
    /**
     * Liczba aktywnych połączeń
     */
    getConnectionCount(): number;
    /**
     * Wysyła wiadomość do konkretnego socketu
     */
    private sendToSocket;
    /**
     * Wysyła wiadomość do wszystkich połączeń użytkownika
     */
    sendToUser(userId: string, message: WSMessage): void;
    /**
     * Broadcast do wszystkich połączonych użytkowników
     */
    broadcast(message: WSMessage): void;
    /**
     * Wysyła powiadomienie GIS do użytkownika
     */
    sendGISNotification(userId: string, notification: GISNotificationPayload): void;
    /**
     * Rejestruje nowe zadanie
     */
    registerTask(userId: string, task: TaskStatus): void;
    /**
     * Aktualizuje status zadania
     */
    updateTask(userId: string, taskId: string, update: Partial<TaskStatus>): void;
    /**
     * Pobiera aktywne zadania użytkownika
     */
    getActiveTasksForUser(userId: string): TaskStatus[];
    /**
     * Pobiera wszystkie aktywne zadania
     */
    getAllActiveTasks(): TaskStatus[];
    /**
     * Wysyła alert systemowy do użytkownika
     */
    sendSystemAlert(userId: string, alert: SystemAlertPayload): void;
    /**
     * Broadcast alertu systemowego do wszystkich
     */
    broadcastSystemAlert(alert: SystemAlertPayload): void;
    getStats(): {
        totalConnections: number;
        connectedUsers: number;
        activeTasks: number;
        tasksByType: Record<string, number>;
    };
}
export declare const wsHub: WebSocketHub;
export default wsHub;
//# sourceMappingURL=websocket-hub.d.ts.map