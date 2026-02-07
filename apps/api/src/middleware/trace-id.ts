/**
 * TraceId Middleware
 * Generowanie i propagacja traceId dla wszystkich requestów API
 * Umożliwia śledzenie requestów przez całą aplikację
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";

// Nagłówki do propagacji traceId
const TRACE_ID_HEADER = "x-trace-id";
const REQUEST_ID_HEADER = "x-request-id";
const SPAN_ID_HEADER = "x-span-id";

// Rozszerzenie typu request o traceId
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

// Aktywny kontekst trace (thread-local storage simulation)
const activeTraces = new Map<string, TraceContext>();

/**
 * Generuj nowy traceId
 */
export function generateTraceId(): string {
  return randomUUID().replace(/-/g, "");
}

/**
 * Generuj nowy spanId
 */
export function generateSpanId(): string {
  return randomUUID().replace(/-/g, "").substring(0, 16);
}

/**
 * Pobierz aktywny trace context
 */
export function getTraceContext(traceId: string): TraceContext | undefined {
  return activeTraces.get(traceId);
}

/**
 * Plugin Fastify dla traceId
 */
export const traceIdPlugin: FastifyPluginAsync = async (fastify) => {
  // Dodaj traceId do każdego requesta
  fastify.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Użyj istniejącego traceId z nagłówka lub wygeneruj nowy
      const incomingTraceId = request.headers[TRACE_ID_HEADER] as
        | string
        | undefined;
      const traceId = incomingTraceId || generateTraceId();
      const spanId = generateSpanId();

      request.traceId = traceId;
      request.spanId = spanId;
      request.requestStartTime = Date.now();

      // Zapisz trace context
      const context: TraceContext = {
        traceId,
        spanId,
        parentSpanId: request.headers[SPAN_ID_HEADER] as string | undefined,
        serviceName: "aasystent-api",
        operationName: `${request.method} ${request.url}`,
        startTime: request.requestStartTime,
      };
      activeTraces.set(traceId, context);

      // Dodaj traceId do odpowiedzi
      reply.header(TRACE_ID_HEADER, traceId);
      reply.header(REQUEST_ID_HEADER, spanId);
    },
  );

  // Logowanie po zakończeniu requesta
  fastify.addHook(
    "onResponse",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const duration = Date.now() - request.requestStartTime;
      const context = activeTraces.get(request.traceId);

      if (context) {
        context.duration = duration;
        context.status = reply.statusCode >= 400 ? "error" : "ok";
      }

      // Strukturalne logowanie
      const logData = {
        traceId: request.traceId,
        spanId: request.spanId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration,
        userAgent: request.headers["user-agent"],
        userId: (request as { userId?: string }).userId,
        ip: request.ip,
        timestamp: new Date().toISOString(),
      };

      if (reply.statusCode >= 500) {
        fastify.log.error(logData, "Request completed with error");
      } else if (reply.statusCode >= 400) {
        fastify.log.warn(logData, "Request completed with client error");
      } else if (duration > 5000) {
        fastify.log.warn(logData, "Slow request");
      } else {
        fastify.log.info(logData, "Request completed");
      }

      // Cleanup
      activeTraces.delete(request.traceId);
    },
  );

  // Logowanie błędów z traceId
  fastify.addHook(
    "onError",
    async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
      fastify.log.error(
        {
          traceId: request.traceId,
          spanId: request.spanId,
          method: request.method,
          url: request.url,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          userId: (request as { userId?: string }).userId,
          timestamp: new Date().toISOString(),
        },
        "Request error",
      );
    },
  );
};

/**
 * Helper do logowania z traceId w serwisach
 */
export function createLogger(serviceName: string) {
  return {
    info: (
      traceId: string,
      message: string,
      data?: Record<string, unknown>,
    ) => {
      console.log(
        JSON.stringify({
          level: "info",
          traceId,
          service: serviceName,
          message,
          ...data,
          timestamp: new Date().toISOString(),
        }),
      );
    },
    warn: (
      traceId: string,
      message: string,
      data?: Record<string, unknown>,
    ) => {
      console.warn(
        JSON.stringify({
          level: "warn",
          traceId,
          service: serviceName,
          message,
          ...data,
          timestamp: new Date().toISOString(),
        }),
      );
    },
    error: (
      traceId: string,
      message: string,
      error?: Error,
      data?: Record<string, unknown>,
    ) => {
      console.error(
        JSON.stringify({
          level: "error",
          traceId,
          service: serviceName,
          message,
          error: error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : undefined,
          ...data,
          timestamp: new Date().toISOString(),
        }),
      );
    },
    debug: (
      traceId: string,
      message: string,
      data?: Record<string, unknown>,
    ) => {
      if (process.env.LOG_LEVEL === "debug") {
        console.log(
          JSON.stringify({
            level: "debug",
            traceId,
            service: serviceName,
            message,
            ...data,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    },
  };
}

/**
 * Dekorator do śledzenia funkcji async
 */
export function traced(operationName: string) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        console.log(
          JSON.stringify({
            level: "debug",
            spanId,
            operation: operationName,
            duration,
            status: "ok",
            timestamp: new Date().toISOString(),
          }),
        );

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        console.error(
          JSON.stringify({
            level: "error",
            spanId,
            operation: operationName,
            duration,
            status: "error",
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                  }
                : String(error),
            timestamp: new Date().toISOString(),
          }),
        );

        throw error;
      }
    };

    return descriptor;
  };
}
