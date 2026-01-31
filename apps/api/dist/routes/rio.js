/**
 * RIO API Routes
 * Endpointy dla dostępu do decyzji Regionalnych Izb Obrachunkowych
 */
import { RIOApiService } from "../services/rio-api-service.js";
export const rioRoutes = async (fastify) => {
    const rioService = new RIOApiService();
    fastify.get("/rio/chambers", async (_request, reply) => {
        try {
            const chambers = rioService.getChambers();
            return reply.send({ success: true, chambers });
        }
        catch (error) {
            fastify.log.error("Error fetching chambers: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/rio/decision-types", async (_request, reply) => {
        try {
            const types = rioService.getDecisionTypes();
            return reply.send({ success: true, types });
        }
        catch (error) {
            fastify.log.error("Error fetching decision types: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/rio/decisions/search", async (request, reply) => {
        try {
            const { rio, decisionType, municipality, query, dateFrom, dateTo, limit, offset, } = request.query;
            const result = await rioService.searchDecisions({
                rio,
                decisionType,
                municipality,
                query,
                dateFrom,
                dateTo,
                limit: limit ? parseInt(limit) : 20,
                offset: offset ? parseInt(offset) : 0,
            });
            return reply.send({ success: true, ...result });
        }
        catch (error) {
            fastify.log.error("Error searching decisions: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/rio/decisions/:id", async (request, reply) => {
        try {
            const { id } = request.params;
            const decision = await rioService.getDecisionDetails(decodeURIComponent(id));
            if (!decision) {
                return reply.status(404).send({
                    success: false,
                    error: "Decyzja nie znaleziona",
                });
            }
            return reply.send({ success: true, decision });
        }
        catch (error) {
            fastify.log.error("Error fetching decision: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/rio/decisions/municipality", async (request, reply) => {
        try {
            const { municipality, limit } = request.query;
            if (!municipality) {
                return reply.status(400).send({
                    success: false,
                    error: "Parametr 'municipality' jest wymagany",
                });
            }
            const decisions = await rioService.searchByMunicipality(municipality, limit ? parseInt(limit) : 20);
            return reply.send({
                success: true,
                count: decisions.length,
                items: decisions,
            });
        }
        catch (error) {
            fastify.log.error("Error fetching municipality decisions: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    fastify.get("/rio/decisions/budget", async (request, reply) => {
        try {
            const { rio, limit } = request.query;
            const decisions = await rioService.searchBudgetDecisions(rio, limit ? parseInt(limit) : 20);
            return reply.send({
                success: true,
                count: decisions.length,
                items: decisions,
            });
        }
        catch (error) {
            fastify.log.error("Error fetching budget decisions: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
};
//# sourceMappingURL=rio.js.map