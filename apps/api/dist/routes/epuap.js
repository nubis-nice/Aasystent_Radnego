/**
 * ePUAP API Routes
 * Endpointy dla integracji z ePUAP
 */
import { EPUAPService, } from "../services/epuap-service.js";
export const epuapRoutes = async (fastify) => {
    fastify.get("/epuap/status", async (request, reply) => {
        try {
            const userId = request.userId;
            if (!userId) {
                return reply
                    .status(401)
                    .send({ success: false, error: "Unauthorized" });
            }
            const service = new EPUAPService();
            await service.initialize(userId);
            return reply.send({
                success: true,
                configured: service.isConfigured(),
                stats: await service.getStats(),
            });
        }
        catch (error) {
            fastify.log.error("Error getting ePUAP status: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/epuap/messages", async (request, reply) => {
        try {
            const userId = request.userId;
            if (!userId) {
                return reply
                    .status(401)
                    .send({ success: false, error: "Unauthorized" });
            }
            const service = new EPUAPService();
            await service.initialize(userId);
            const { status, sender, dateFrom, dateTo, documentType, limit, offset } = request.query;
            const result = await service.getMessages({
                status: status,
                sender,
                dateFrom,
                dateTo,
                documentType,
                limit: limit ? parseInt(limit) : 20,
                offset: offset ? parseInt(offset) : 0,
            });
            return reply.send({ success: true, ...result });
        }
        catch (error) {
            fastify.log.error("Error fetching ePUAP messages: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/epuap/messages/:id", async (request, reply) => {
        try {
            const userId = request.userId;
            if (!userId) {
                return reply
                    .status(401)
                    .send({ success: false, error: "Unauthorized" });
            }
            const service = new EPUAPService();
            await service.initialize(userId);
            const message = await service.getMessage(request.params.id);
            if (!message) {
                return reply.status(404).send({
                    success: false,
                    error: "Wiadomość nie znaleziona",
                });
            }
            return reply.send({ success: true, message });
        }
        catch (error) {
            fastify.log.error("Error fetching ePUAP message: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.post("/epuap/messages/:id/read", async (request, reply) => {
        try {
            const userId = request.userId;
            if (!userId) {
                return reply
                    .status(401)
                    .send({ success: false, error: "Unauthorized" });
            }
            const service = new EPUAPService();
            await service.initialize(userId);
            await service.markAsRead(request.params.id);
            return reply.send({ success: true });
        }
        catch (error) {
            fastify.log.error("Error marking message as read: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.post("/epuap/messages/:id/process", async (request, reply) => {
        try {
            const userId = request.userId;
            if (!userId) {
                return reply
                    .status(401)
                    .send({ success: false, error: "Unauthorized" });
            }
            const service = new EPUAPService();
            await service.initialize(userId);
            await service.markAsProcessed(request.params.id, request.body?.caseNumber);
            return reply.send({ success: true });
        }
        catch (error) {
            fastify.log.error("Error marking message as processed: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.post("/epuap/sync", async (request, reply) => {
        try {
            const userId = request.userId;
            if (!userId) {
                return reply
                    .status(401)
                    .send({ success: false, error: "Unauthorized" });
            }
            const service = new EPUAPService();
            await service.initialize(userId);
            const result = await service.syncMessages();
            return reply.send({ success: true, ...result });
        }
        catch (error) {
            fastify.log.error("Error syncing ePUAP messages: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.post("/epuap/config", async (request, reply) => {
        try {
            const userId = request.userId;
            if (!userId) {
                return reply
                    .status(401)
                    .send({ success: false, error: "Unauthorized" });
            }
            const service = new EPUAPService();
            await service.initialize(userId);
            await service.saveConfig({
                espAddress: request.body.espAddress,
                testMode: request.body.testMode ?? true,
            });
            return reply.send({ success: true, message: "Konfiguracja zapisana" });
        }
        catch (error) {
            fastify.log.error("Error saving ePUAP config: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // Webhook endpoint (publiczny - bez autoryzacji JWT)
    fastify.post("/epuap/webhook", async (request, reply) => {
        try {
            // TODO: Weryfikacja podpisu webhooka
            const signature = request.headers["x-epuap-signature"];
            if (!signature) {
                fastify.log.warn("[ePUAP] Webhook without signature");
            }
            const payload = request.body;
            fastify.log.info(`[ePUAP] Webhook: ${payload.eventType} for ${payload.messageId}`);
            // Obsłuż webhook (bez userId - to jest systemowy callback)
            const service = new EPUAPService();
            await service.handleWebhook(payload);
            return reply.send({ success: true });
        }
        catch (error) {
            fastify.log.error("Error handling ePUAP webhook: " + String(error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
};
//# sourceMappingURL=epuap.js.map