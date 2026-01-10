import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { authRoutes } from "./routes/auth.js";
import { documentsRoutes } from "./routes/documents.js";
import { testApiRoutes } from "./routes/test-api.js";
import { chatRoutes } from "./routes/chat.js";
import { dataSourcesRoutes } from "./routes/data-sources.js";
import { legalAnalysisRoutes } from "./routes/legal-analysis.js";
import { deepResearchRoutes } from "./routes/deep-research.js";
import { providerRoutes } from "./routes/providers.js";
import { testRoutes } from "./routes/test.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { youtubeRoutes } from "./routes/youtube.js";
import { diagnosticsRoutes } from "./routes/diagnostics.js";
import { apiModelsRoutes } from "./routes/api-models.js";
import { documentGraphRoutes } from "./routes/document-graph.js";
import { authMiddleware } from "./middleware/auth.js";

const port = Number(process.env.API_PORT ?? 3001);

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
});

// CORS
app.register(cors, {
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// Multipart for file uploads
app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Health check
app.get("/health", async () => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };
});

// Register routes
app.register(authRoutes, { prefix: "/api" });

// Protected routes (require authentication)
app.register(async (protectedApp) => {
  protectedApp.addHook("onRequest", authMiddleware);
  protectedApp.register(documentsRoutes, { prefix: "/api" });
  protectedApp.register(chatRoutes, { prefix: "/api" });
  protectedApp.register(dataSourcesRoutes, { prefix: "/api" });
  protectedApp.register(legalAnalysisRoutes, { prefix: "/api" });
  protectedApp.register(deepResearchRoutes, { prefix: "/api" });
  protectedApp.register(dashboardRoutes, { prefix: "/api" });
  protectedApp.register(youtubeRoutes, { prefix: "/api" });
  protectedApp.register(diagnosticsRoutes, { prefix: "/api" });
  protectedApp.register(documentGraphRoutes, { prefix: "/api" });
  protectedApp.register(testRoutes, { prefix: "/api" });
});

// Public routes
app.register(testApiRoutes, { prefix: "/api" });
app.register(apiModelsRoutes, { prefix: "/api" });
app.register(providerRoutes, { prefix: "/api" });

// Error handler
app.setErrorHandler((error: any, request, reply) => {
  app.log.error(error);

  reply.status(error.statusCode || 500).send({
    error: error.message || "Internal Server Error",
    statusCode: error.statusCode || 500,
  });
});

// Start server
app.listen({ port, host: "0.0.0.0" }).catch((err: unknown) => {
  app.log.error(err);
  process.exit(1);
});
