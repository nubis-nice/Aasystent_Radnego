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

// ============================================================================
// TYPES
// ============================================================================

export type WSMessageType =
  | "gis_notification" // Powiadomienie GIS
  | "task_update" // Aktualizacja zadania
  | "task_complete" // Zadanie zakończone
  | "task_error" // Błąd zadania
  | "system_alert" // Alert systemowy
  | "connection_ack" // Potwierdzenie połączenia
  | "ping" // Ping
  | "pong"; // Pong

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
  progress?: number; // 0-100
  title: string;
  description?: string;
  startedAt?: string;
  estimatedTimeMs?: number;
  error?: string;
  result?: unknown;
}

export interface GISNotificationPayload {
  id: string;
  notification_type:
    | "new_document"
    | "update"
    | "alert"
    | "reminder"
    | "system";
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

// ============================================================================
// WEBSOCKET HUB
// ============================================================================

class WebSocketHub extends EventEmitter {
  private static instance: WebSocketHub | null = null;
  private connections: Map<string, Set<WebSocket>> = new Map(); // userId -> Set<WebSocket>
  private taskStatuses: Map<string, TaskStatus> = new Map(); // taskId -> TaskStatus

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): WebSocketHub {
    if (!WebSocketHub.instance) {
      WebSocketHub.instance = new WebSocketHub();
    }
    return WebSocketHub.instance;
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Rejestruje nowe połączenie WebSocket dla użytkownika
   */
  registerConnection(userId: string, ws: WebSocket): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(ws);

    console.log(
      `[WebSocketHub] User ${userId} connected. Total connections: ${this.getConnectionCount()}. readyState: ${ws.readyState}`,
    );

    // Wyślij potwierdzenie połączenia
    const ackMessage = {
      type: "connection_ack",
      payload: {
        userId,
        connectedAt: new Date().toISOString(),
        activeTasks: this.getActiveTasksForUser(userId),
      },
      timestamp: new Date().toISOString(),
    };

    // Jeśli socket jest już otwarty, wyślij od razu
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(ackMessage));
      console.log(`[WebSocketHub] Sent connection_ack to ${userId}`);
    } else {
      // Poczekaj na otwarcie socketu
      ws.on("open", () => {
        ws.send(JSON.stringify(ackMessage));
        console.log(
          `[WebSocketHub] Sent connection_ack to ${userId} (after open)`,
        );
      });
    }

    // Obsługa rozłączenia
    ws.on("close", () => {
      this.unregisterConnection(userId, ws);
    });

    // Obsługa ping/pong
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === "ping") {
          this.sendToSocket(ws, {
            type: "pong",
            payload: { serverTime: new Date().toISOString() },
            timestamp: new Date().toISOString(),
          });
        }
      } catch {
        // Ignore invalid messages
      }
    });
  }

  /**
   * Usuwa połączenie WebSocket
   */
  unregisterConnection(userId: string, ws: WebSocket): void {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }
    console.log(
      `[WebSocketHub] User ${userId} disconnected. Total connections: ${this.getConnectionCount()}`,
    );
  }

  /**
   * Liczba aktywnych połączeń
   */
  getConnectionCount(): number {
    let count = 0;
    for (const connections of this.connections.values()) {
      count += connections.size;
    }
    return count;
  }

  // ============================================================================
  // SENDING MESSAGES
  // ============================================================================

  /**
   * Wysyła wiadomość do konkretnego socketu
   */
  private sendToSocket(ws: WebSocket, message: WSMessage): void {
    // WebSocket.OPEN = 1
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Wysyła wiadomość do wszystkich połączeń użytkownika
   */
  sendToUser(userId: string, message: WSMessage): void {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      for (const ws of userConnections) {
        this.sendToSocket(ws, { ...message, userId });
      }
    }
  }

  /**
   * Broadcast do wszystkich połączonych użytkowników
   */
  broadcast(message: WSMessage): void {
    for (const [userId, connections] of this.connections) {
      for (const ws of connections) {
        this.sendToSocket(ws, { ...message, userId });
      }
    }
  }

  // ============================================================================
  // GIS NOTIFICATIONS
  // ============================================================================

  /**
   * Wysyła powiadomienie GIS do użytkownika
   */
  sendGISNotification(
    userId: string,
    notification: GISNotificationPayload,
  ): void {
    this.sendToUser(userId, {
      type: "gis_notification",
      payload: notification,
      timestamp: new Date().toISOString(),
    });

    this.emit("gis_notification", { userId, notification });
  }

  // ============================================================================
  // TASK STATUS
  // ============================================================================

  /**
   * Rejestruje nowe zadanie
   */
  registerTask(userId: string, task: TaskStatus): void {
    this.taskStatuses.set(task.id, task);

    this.sendToUser(userId, {
      type: "task_update",
      payload: task,
      timestamp: new Date().toISOString(),
    });

    this.emit("task_registered", { userId, task });
  }

  /**
   * Aktualizuje status zadania
   */
  updateTask(
    userId: string,
    taskId: string,
    update: Partial<TaskStatus>,
  ): void {
    const task = this.taskStatuses.get(taskId);
    if (task) {
      Object.assign(task, update);

      const messageType: WSMessageType =
        update.status === "completed"
          ? "task_complete"
          : update.status === "failed"
            ? "task_error"
            : "task_update";

      this.sendToUser(userId, {
        type: messageType,
        payload: task,
        timestamp: new Date().toISOString(),
      });

      // Usuń zakończone zadania po 30 sekundach
      if (update.status === "completed" || update.status === "failed") {
        setTimeout(() => {
          this.taskStatuses.delete(taskId);
        }, 30000);
      }

      this.emit("task_updated", { userId, task });
    }
  }

  /**
   * Pobiera aktywne zadania użytkownika
   */
  getActiveTasksForUser(userId: string): TaskStatus[] {
    // W przyszłości można filtrować po userId
    return Array.from(this.taskStatuses.values()).filter(
      (t) => t.status === "queued" || t.status === "running",
    );
  }

  /**
   * Pobiera wszystkie aktywne zadania
   */
  getAllActiveTasks(): TaskStatus[] {
    return Array.from(this.taskStatuses.values()).filter(
      (t) => t.status === "queued" || t.status === "running",
    );
  }

  // ============================================================================
  // SYSTEM ALERTS
  // ============================================================================

  /**
   * Wysyła alert systemowy do użytkownika
   */
  sendSystemAlert(userId: string, alert: SystemAlertPayload): void {
    this.sendToUser(userId, {
      type: "system_alert",
      payload: alert,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast alertu systemowego do wszystkich
   */
  broadcastSystemAlert(alert: SystemAlertPayload): void {
    this.broadcast({
      type: "system_alert",
      payload: alert,
      timestamp: new Date().toISOString(),
    });
  }

  // ============================================================================
  // STATS
  // ============================================================================

  getStats(): {
    totalConnections: number;
    connectedUsers: number;
    activeTasks: number;
    tasksByType: Record<string, number>;
  } {
    const tasksByType: Record<string, number> = {};
    for (const task of this.taskStatuses.values()) {
      if (task.status === "running" || task.status === "queued") {
        tasksByType[task.type] = (tasksByType[task.type] || 0) + 1;
      }
    }

    return {
      totalConnections: this.getConnectionCount(),
      connectedUsers: this.connections.size,
      activeTasks: this.getAllActiveTasks().length,
      tasksByType,
    };
  }
}

// Singleton export
export const wsHub = WebSocketHub.getInstance();
export default wsHub;
