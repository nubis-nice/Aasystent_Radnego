/**
 * ISAP API Routes
 * Endpointy dla dostępu do aktów prawnych (Dziennik Ustaw, Monitor Polski)
 */
import { ISAPApiService } from "../services/isap-api-service.js";
export const isapRoutes = async (fastify) => {
    const isapService = new ISAPApiService();
    fastify.get("/isap/publishers", async (_request, reply) => {
        try {
            const publishers = await isapService.getPublishers();
            return reply.send({ success: true, publishers });
        }
        catch (error) {
            fastify.log.error("Error fetching publishers: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/isap/acts/:publisher/:year", async (request, reply) => {
        try {
            const { publisher, year } = request.params;
            const result = await isapService.getActsByYear(publisher, parseInt(year));
            return reply.send({ success: true, ...result });
        }
        catch (error) {
            fastify.log.error("Error fetching acts by year: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/isap/acts/search", async (request, reply) => {
        try {
            const { publisher, year, title, type, keyword, dateFrom, dateTo, inForce, limit, offset, } = request.query;
            const result = await isapService.searchActs({
                publisher,
                year: year ? parseInt(year) : undefined,
                title,
                type,
                keyword: keyword ? keyword.split(",") : undefined,
                dateFrom,
                dateTo,
                inForce: inForce === "1" || inForce === "true",
                limit: limit ? parseInt(limit) : 20,
                offset: offset ? parseInt(offset) : 0,
            });
            return reply.send({ success: true, ...result });
        }
        catch (error) {
            fastify.log.error("Error searching acts: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/isap/acts/:publisher/:year/:position", async (request, reply) => {
        try {
            const { publisher, year, position } = request.params;
            const act = await isapService.getActDetails(publisher, parseInt(year), parseInt(position));
            return reply.send({ success: true, act });
        }
        catch (error) {
            fastify.log.error("Error fetching act details: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/isap/acts/:publisher/:year/:position/text", async (request, reply) => {
        try {
            const { publisher, year, position } = request.params;
            const text = await isapService.getActTextHTML(publisher, parseInt(year), parseInt(position));
            return reply.type("text/html").send(text);
        }
        catch (error) {
            fastify.log.error("Error fetching act text: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/isap/latest/:publisher", async (request, reply) => {
        try {
            const { publisher } = request.params;
            const limit = request.query.limit ? parseInt(request.query.limit) : 20;
            const acts = await isapService.getLatestActs(publisher, limit);
            return reply.send({ success: true, count: acts.length, acts });
        }
        catch (error) {
            fastify.log.error("Error fetching latest acts: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/isap/local-government", async (request, reply) => {
        try {
            const { topic, limit } = request.query;
            const acts = await isapService.searchLocalGovernmentActs(topic, limit ? parseInt(limit) : 30);
            return reply.send({ success: true, count: acts.length, acts });
        }
        catch (error) {
            fastify.log.error("Error fetching local government acts: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/isap/types", async (_request, reply) => {
        try {
            const types = await isapService.getActTypes();
            return reply.send({ success: true, types });
        }
        catch (error) {
            fastify.log.error("Error fetching act types: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/isap/keywords", async (_request, reply) => {
        try {
            const keywords = await isapService.getKeywords();
            return reply.send({ success: true, keywords });
        }
        catch (error) {
            fastify.log.error("Error fetching keywords: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
};
//# sourceMappingURL=isap.js.map