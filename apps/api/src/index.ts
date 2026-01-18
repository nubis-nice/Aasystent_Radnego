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
import { voiceRoutes } from "./routes/voice.js";
import { gusRoutes } from "./routes/gus.js";
import { isapRoutes } from "./routes/isap.js";
import { euFundsRoutes } from "./routes/eu-funds.js";
import { geoportalRoutes } from "./routes/geoportal.js";
import { terytRoutes } from "./routes/teryt.js";
import { krsRoutes } from "./routes/krs.js";
import { ceidgRoutes } from "./routes/ceidg.js";
import { gdosRoutes } from "./routes/gdos.js";
import { authMiddleware } from "./middleware/auth.js";
import { initializeTranscriptionRecovery } from "./services/transcription-recovery.js";
import { initializeTranscriptionWorker } from "./services/transcription-worker.js";

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

app.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-user-id"],
});

app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

app.get("/health", async () => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };
});

app.register(authRoutes, { prefix: "/api" });

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
  protectedApp.register(voiceRoutes, { prefix: "/api" });
  protectedApp.register(gusRoutes, { prefix: "/api" });
  protectedApp.register(isapRoutes, { prefix: "/api" });
  protectedApp.register(euFundsRoutes, { prefix: "/api" });
  protectedApp.register(geoportalRoutes, { prefix: "/api" });
  protectedApp.register(terytRoutes, { prefix: "/api" });
  protectedApp.register(krsRoutes, { prefix: "/api" });
  protectedApp.register(ceidgRoutes, { prefix: "/api" });
  protectedApp.register(gdosRoutes, { prefix: "/api" });
  protectedApp.register(testRoutes, { prefix: "/api" });
});

app.register(testApiRoutes, { prefix: "/api" });
app.register(apiModelsRoutes, { prefix: "/api" });
app.register(providerRoutes, { prefix: "/api" });

app.setErrorHandler(
  (error: Error & { statusCode?: number }, request, reply) => {
    app.log.error(error);
    reply.status(error.statusCode || 500).send({
      error: error.message || "Internal Server Error",
      statusCode: error.statusCode || 500,
    });
  }
);

app
  .listen({ port, host: "0.0.0.0" })
  .then(async () => {
    app.log.info(`🚀 API server started on port ${port}`);

    try {
      await initializeTranscriptionWorker();
    } catch (err) {
      app.log.error({ err }, "Failed to initialize transcription worker");
    }

    try {
      await initializeTranscriptionRecovery();
    } catch (err) {
      app.log.error({ err }, "Failed to initialize transcription recovery");
    }
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
