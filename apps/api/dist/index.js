import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { authRoutes } from "./routes/auth.js";
import { documentsRoutes } from "./routes/documents.js";
import { testApiRoutes } from "./routes/test-api.js";
import { chatRoutes } from "./routes/chat.js";
import { dataSourcesRoutes } from "./routes/data-sources.js";
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
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
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
});
// Public routes
app.register(testApiRoutes, { prefix: "/api" });
// Error handler
app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    reply.status(error.statusCode || 500).send({
        error: error.message || "Internal Server Error",
        statusCode: error.statusCode || 500,
    });
});
// Start server
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
    app.log.error(err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map