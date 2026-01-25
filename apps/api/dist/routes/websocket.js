/**
 * WebSocket Routes - Endpoint WebSocket dla real-time powiadomień
 */
import { wsHub } from "../services/websocket-hub.js";
export async function websocketRoutes(fastify) {
    // GET /api/ws - WebSocket endpoint
    // W @fastify/websocket v11+ handler otrzymuje WebSocket bezpośrednio
    fastify.get("/ws", { websocket: true }, async function wsHandler(socket, request) {
        // Pobierz userId z query params lub headers
        const query = request.query;
        const userId = query.userId || request.headers["x-user-id"] || "anonymous";
        console.log(`[WebSocket Route] New connection for user ${userId}, readyState: ${socket.readyState}`);
        // Zarejestruj połączenie w hub
        wsHub.registerConnection(userId, socket);
        // Obsługa błędów
        socket.on("error", (err) => {
            console.error(`[WebSocket Route] Socket error for ${userId}:`, err.message);
        });
        // Utrzymuj połączenie otwarte - czekaj na zamknięcie socketu
        await new Promise((resolve) => {
            socket.on("close", () => {
                console.log(`[WebSocket Route] Connection closed for user ${userId}`);
                resolve();
            });
        });
    });
    // GET /api/ws/stats - Statystyki WebSocket (REST endpoint)
    fastify.get("/ws/stats", async (_request, reply) => {
        const stats = wsHub.getStats();
        return reply.send(stats);
    });
}
//# sourceMappingURL=websocket.js.map