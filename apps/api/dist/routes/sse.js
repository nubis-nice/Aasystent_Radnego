/**
 * Server-Sent Events (SSE) Routes
 * Prostsze i stabilniejsze niż WebSocket
 */
import { wsHub } from "../services/websocket-hub.js";
// Przechowuj aktywne połączenia SSE
const sseConnections = new Map();
/**
 * Wysyła event do wszystkich połączeń użytkownika
 */
export function sendSSEEvent(userId, event, data) {
    const connections = sseConnections.get(userId);
    if (!connections)
        return;
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const reply of connections) {
        try {
            reply.raw.write(message);
        }
        catch {
            // Połączenie zamknięte - usuń
            connections.delete(reply);
        }
    }
}
/**
 * Wysyła event do wszystkich użytkowników
 */
export function broadcastSSEEvent(event, data) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [, connections] of sseConnections) {
        for (const reply of connections) {
            try {
                reply.raw.write(message);
            }
            catch {
                connections.delete(reply);
            }
        }
    }
}
export async function sseRoutes(fastify) {
    // GET /api/sse/events - SSE endpoint
    fastify.get("/sse/events", async (request, reply) => {
        const query = request.query;
        const userId = query.userId || request.headers["x-user-id"] || "anonymous";
        // Ustaw nagłówki SSE
        reply.raw.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "X-Accel-Buffering": "no", // Dla nginx
        });
        // Zarejestruj połączenie
        if (!sseConnections.has(userId)) {
            sseConnections.set(userId, new Set());
        }
        sseConnections.get(userId).add(reply);
        console.log(`[SSE] User ${userId} connected. Total: ${getTotalConnections()}`);
        // Wyślij potwierdzenie połączenia
        const ackData = {
            userId,
            connectedAt: new Date().toISOString(),
            activeTasks: wsHub.getActiveTasksForUser(userId),
        };
        reply.raw.write(`event: connection_ack\ndata: ${JSON.stringify(ackData)}\n\n`);
        // Heartbeat co 15 sekund (utrzymuje połączenie)
        const heartbeat = setInterval(() => {
            try {
                reply.raw.write(`: heartbeat\n\n`);
            }
            catch {
                clearInterval(heartbeat);
            }
        }, 15000);
        // Obsługa zamknięcia połączenia
        request.raw.on("close", () => {
            clearInterval(heartbeat);
            sseConnections.get(userId)?.delete(reply);
            console.log(`[SSE] User ${userId} disconnected. Total: ${getTotalConnections()}`);
        });
        // Nie zamykaj odpowiedzi - utrzymuj stream otwarty
        // Fastify automatycznie obsłuży to poprawnie
    });
    // GET /api/sse/stats - Statystyki SSE
    fastify.get("/sse/stats", async (_request, reply) => {
        const stats = {
            totalConnections: getTotalConnections(),
            connectedUsers: sseConnections.size,
            activeTasks: wsHub.getStats().activeTasks,
            tasksByType: wsHub.getStats().tasksByType,
        };
        return reply.send(stats);
    });
}
function getTotalConnections() {
    let total = 0;
    for (const connections of sseConnections.values()) {
        total += connections.size;
    }
    return total;
}
// Eksportuj funkcje do użycia w innych serwisach
export { sseConnections };
//# sourceMappingURL=sse.js.map