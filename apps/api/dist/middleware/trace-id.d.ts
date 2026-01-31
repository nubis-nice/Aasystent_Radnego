/**
 * TraceId Middleware
 * Generowanie i propagacja traceId dla wszystkich requestów API
 * Umożliwia śledzenie requestów przez całą aplikację
 */
import { FastifyPluginAsync } from "fastify";
declare module "fastify" {
    interface FastifyRequest {
        traceId: string;
        spanId: string;
        requestStartTime: number;
    }
}
export interface TraceContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    serviceName: string;
    operationName: string;
    startTime: number;
    duration?: number;
    status?: "ok" | "error";
    metadata?: Record<string, unknown>;
}
/**
 * Generuj nowy traceId
 */
export declare function generateTraceId(): string;
/**
 * Generuj nowy spanId
 */
export declare function generateSpanId(): string;
/**
 * Pobierz aktywny trace context
 */
export declare function getTraceContext(traceId: string): TraceContext | undefined;
/**
 * Plugin Fastify dla traceId
 */
export declare const traceIdPlugin: FastifyPluginAsync;
/**
 * Helper do logowania z traceId w serwisach
 */
export declare function createLogger(serviceName: string): {
    info: (traceId: string, message: string, data?: Record<string, unknown>) => void;
    warn: (traceId: string, message: string, data?: Record<string, unknown>) => void;
    error: (traceId: string, message: string, error?: Error, data?: Record<string, unknown>) => void;
    debug: (traceId: string, message: string, data?: Record<string, unknown>) => void;
};
/**
 * Dekorator do śledzenia funkcji async
 */
export declare function traced(operationName: string): (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
//# sourceMappingURL=trace-id.d.ts.map