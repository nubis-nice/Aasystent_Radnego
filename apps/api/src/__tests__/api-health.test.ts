/**
 * API Health Check Tests
 * Integration tests for basic API functionality
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

describe("API Health Check", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Register health check route
    app.get("/health", async () => {
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      };
    });

    app.get("/api/status", async () => {
      return {
        api: "running",
        database: "connected",
        redis: "connected",
      };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /health", () => {
    it("should return status ok", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.status).toBe("ok");
      expect(body.timestamp).toBeDefined();
      expect(body.version).toBe("1.0.0");
    });

    it("should return JSON content type", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.headers["content-type"]).toContain("application/json");
    });
  });

  describe("GET /api/status", () => {
    it("should return service status", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/status",
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.api).toBe("running");
      expect(body.database).toBeDefined();
      expect(body.redis).toBeDefined();
    });
  });
});

describe("API Error Handling", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    app.get("/api/error-test", async () => {
      throw new Error("Test error");
    });

    app.setErrorHandler((error, request, reply) => {
      reply.status(500).send({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should handle errors gracefully", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/error-test",
    });

    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body);
    expect(body.error).toBe("Internal Server Error");
  });
});

describe("API Request Validation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    app.post(
      "/api/validate",
      {
        schema: {
          body: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string", minLength: 1 },
              email: { type: "string", format: "email" },
            },
          },
        },
      },
      async (request) => {
        return { received: request.body };
      },
    );

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should accept valid request body", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/validate",
      payload: { name: "Test User", email: "test@example.com" },
    });

    expect(response.statusCode).toBe(200);
  });

  it("should reject request without required fields", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/validate",
      payload: { email: "test@example.com" },
    });

    expect(response.statusCode).toBe(400);
  });
});
