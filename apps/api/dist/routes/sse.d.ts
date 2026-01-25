/**
 * Server-Sent Events (SSE) Routes
 * Prostsze i stabilniejsze niż WebSocket
 */
import type { FastifyInstance, FastifyReply } from "fastify";
declare const sseConnections: Map<string, Set<FastifyReply<import("fastify").RouteGenericInterface, import("fastify").RawServerDefault, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, unknown, import("fastify").FastifySchema, import("fastify").FastifyTypeProviderDefault, unknown>>>;
/**
 * Wysyła event do wszystkich połączeń użytkownika
 */
export declare function sendSSEEvent(userId: string, event: string, data: unknown): void;
/**
 * Wysyła event do wszystkich użytkowników
 */
export declare function broadcastSSEEvent(event: string, data: unknown): void;
export declare function sseRoutes(fastify: FastifyInstance): Promise<void>;
export { sseConnections };
//# sourceMappingURL=sse.d.ts.map