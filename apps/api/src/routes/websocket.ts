/**
 * WebSocket Routes - Endpoint WebSocket dla real-time powiadomień
 */

import type { FastifyInstance } from "fastify";
import type WebSocket from "ws";
import { wsHub } from "../services/websocket-hub.js";

export async function websocketRoutes(fastify: FastifyInstance) {
  // GET /api/ws - WebSocket endpoint
  // W @fastify/websocket v11+ handler otrzymuje WebSocket bezpośrednio
  fastify.get(
    "/ws",
    { websocket: true },
    async function wsHandler(socket: WebSocket, request) {
      // Pobierz userId z query params lub headers
      const query = request.query as { userId?: string };
      const userId =
        query.userId || (request.headers["x-user-id"] as string) || "anonymous";

      console.log(
        `[WebSocket Route] New connection for user ${userId}, readyState: ${socket.readyState}`,
      );

      // Zarejestruj połączenie w hub
      wsHub.registerConnection(userId, socket);

      // Obsługa błędów
      socket.on("error", (err) => {
        console.error(
          `[WebSocket Route] Socket error for ${userId}:`,
          err.message,
        );
      });

      // Utrzymuj połączenie otwarte - czekaj na zamknięcie socketu
      await new Promise<void>((resolve) => {
        socket.on("close", () => {
          console.log(`[WebSocket Route] Connection closed for user ${userId}`);
          resolve();
        });
      });
    },
  );

  // GET /api/ws/stats - Statystyki WebSocket (REST endpoint)
  fastify.get("/ws/stats", async (_request, reply) => {
    const stats = wsHub.getStats();
    return reply.send(stats);
  });
}
