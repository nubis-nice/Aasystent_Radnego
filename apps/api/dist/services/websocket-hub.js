/**
 * WebSocket Hub - Centralny serwis WebSocket dla powiadomień real-time
 *
 * Obsługuje:
 * - GIS Notifications (powiadomienia o nowych dokumentach)
 * - Task Status (status przetwarzanych zadań: scraping, transkrypcja, OCR)
 * - System Events (alerty, aktualizacje)
 */
import { EventEmitter } from "events";
// ============================================================================
// WEBSOCKET HUB
// ============================================================================
class WebSocketHub extends EventEmitter {
    static instance = null;
    connections = new Map(); // userId -> Set<WebSocket>
    taskStatuses = new Map(); // taskId -> TaskStatus
    constructor() {
        super();
        this.setMaxListeners(100);
    }
    static getInstance() {
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
    registerConnection(userId, ws) {
        if (!this.connections.has(userId)) {
            this.connections.set(userId, new Set());
        }
        this.connections.get(userId).add(ws);
        console.log(`[WebSocketHub] User ${userId} connected. Total connections: ${this.getConnectionCount()}. readyState: ${ws.readyState}`);
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
        }
        else {
            // Poczekaj na otwarcie socketu
            ws.on("open", () => {
                ws.send(JSON.stringify(ackMessage));
                console.log(`[WebSocketHub] Sent connection_ack to ${userId} (after open)`);
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
            }
            catch {
                // Ignore invalid messages
            }
        });
    }
    /**
     * Usuwa połączenie WebSocket
     */
    unregisterConnection(userId, ws) {
        const userConnections = this.connections.get(userId);
        if (userConnections) {
            userConnections.delete(ws);
            if (userConnections.size === 0) {
                this.connections.delete(userId);
            }
        }
        console.log(`[WebSocketHub] User ${userId} disconnected. Total connections: ${this.getConnectionCount()}`);
    }
    /**
     * Liczba aktywnych połączeń
     */
    getConnectionCount() {
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
    sendToSocket(ws, message) {
        // WebSocket.OPEN = 1
        if (ws.readyState === 1) {
            ws.send(JSON.stringify(message));
        }
    }
    /**
     * Wysyła wiadomość do wszystkich połączeń użytkownika
     */
    sendToUser(userId, message) {
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
    broadcast(message) {
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
    sendGISNotification(userId, notification) {
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
    registerTask(userId, task) {
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
    updateTask(userId, taskId, update) {
        const task = this.taskStatuses.get(taskId);
        if (task) {
            Object.assign(task, update);
            const messageType = update.status === "completed"
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
    getActiveTasksForUser(userId) {
        // W przyszłości można filtrować po userId
        return Array.from(this.taskStatuses.values()).filter((t) => t.status === "queued" || t.status === "running");
    }
    /**
     * Pobiera wszystkie aktywne zadania
     */
    getAllActiveTasks() {
        return Array.from(this.taskStatuses.values()).filter((t) => t.status === "queued" || t.status === "running");
    }
    // ============================================================================
    // SYSTEM ALERTS
    // ============================================================================
    /**
     * Wysyła alert systemowy do użytkownika
     */
    sendSystemAlert(userId, alert) {
        this.sendToUser(userId, {
            type: "system_alert",
            payload: alert,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Broadcast alertu systemowego do wszystkich
     */
    broadcastSystemAlert(alert) {
        this.broadcast({
            type: "system_alert",
            payload: alert,
            timestamp: new Date().toISOString(),
        });
    }
    // ============================================================================
    // STATS
    // ============================================================================
    getStats() {
        const tasksByType = {};
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
//# sourceMappingURL=websocket-hub.js.map