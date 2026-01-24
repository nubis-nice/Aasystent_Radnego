import { GUSApiService } from "../services/gus-api-service.js";
import { supabase } from "../lib/supabase.js";
/**
 * Pobierz klucz API GUS dla użytkownika z bazy danych
 */
async function getUserGUSApiKey(userId) {
    const { data } = await supabase
        .from("data_sources")
        .select("metadata")
        .eq("user_id", userId)
        .eq("type", "statistics")
        .eq("name", "GUS - Bank Danych Lokalnych")
        .single();
    if (!data?.metadata) {
        return process.env.GUS_API_KEY || null;
    }
    // TypeScript type assertion dla metadata
    const metadata = data.metadata;
    return metadata.apiKey || process.env.GUS_API_KEY || null;
}
export async function gusRoutes(fastify) {
    // GET /api/gus/units - Lista jednostek terytorialnych
    fastify.get("/gus/units", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        try {
            const { parentId, level, year } = request.query;
            // Pobierz klucz API użytkownika
            const apiKey = await getUserGUSApiKey(userId);
            const gusService = new GUSApiService(apiKey || undefined);
            const units = await gusService.getUnits({
                parentId,
                level: level ? parseInt(level) : undefined,
                year: year ? parseInt(year) : undefined,
            });
            return reply.send({ units });
        }
        catch (error) {
            request.log.error({ err: error }, "GUS units error");
            return reply.status(500).send({
                error: "Failed to fetch GUS units",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // GET /api/gus/gmina/search - Wyszukaj gminę
    fastify.get("/gus/gmina/search", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        try {
            const { name } = request.query;
            if (!name) {
                return reply
                    .status(400)
                    .send({ error: "Missing query parameter: name" });
            }
            // Pobierz klucz API użytkownika
            const apiKey = await getUserGUSApiKey(userId);
            const gusService = new GUSApiService(apiKey || undefined);
            const gmina = await gusService.findGmina(name);
            if (!gmina) {
                return reply.status(404).send({ error: "Gmina not found" });
            }
            return reply.send({ gmina });
        }
        catch (error) {
            request.log.error({ err: error }, "GUS gmina search error");
            return reply.status(500).send({
                error: "Failed to search gmina",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // GET /api/gus/gmina/:id/stats - Statystyki gminy
    fastify.get("/gus/gmina/:id/stats", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        try {
            const { id } = request.params;
            const { year } = request.query;
            // Pobierz klucz API użytkownika
            const apiKey = await getUserGUSApiKey(userId);
            const gusService = new GUSApiService(apiKey || undefined);
            const stats = await gusService.getGminaStats(id, year ? parseInt(year) : undefined);
            if (!stats) {
                return reply.status(404).send({ error: "Stats not found" });
            }
            return reply.send({ stats });
        }
        catch (error) {
            request.log.error({ err: error }, "GUS gmina stats error");
            return reply.status(500).send({
                error: "Failed to fetch gmina stats",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // GET /api/gus/variables - Lista zmiennych (wskaźników)
    fastify.get("/gus/variables", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        try {
            const { subjectId, year, level } = request.query;
            // Pobierz klucz API użytkownika
            const apiKey = await getUserGUSApiKey(userId);
            const gusService = new GUSApiService(apiKey || undefined);
            const variables = await gusService.getVariables({
                subjectId,
                year: year ? parseInt(year) : undefined,
                level: level ? parseInt(level) : undefined,
            });
            return reply.send({ variables });
        }
        catch (error) {
            request.log.error({ err: error }, "GUS variables error");
            return reply.status(500).send({
                error: "Failed to fetch GUS variables",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // GET /api/gus/subjects - Tematy (hierarchia)
    fastify.get("/gus/subjects", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        try {
            const { parentId } = request.query;
            // Pobierz klucz API użytkownika
            const apiKey = await getUserGUSApiKey(userId);
            const gusService = new GUSApiService(apiKey || undefined);
            const subjects = await gusService.getSubjects(parentId);
            return reply.send({ subjects });
        }
        catch (error) {
            request.log.error({ err: error }, "GUS subjects error");
            return reply.status(500).send({
                error: "Failed to fetch GUS subjects",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // POST /api/gus/compare - Porównaj gminy
    fastify.post("/gus/compare", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        try {
            const { gminaIds, variableIds, year } = request.body;
            if (!gminaIds ||
                !variableIds ||
                gminaIds.length === 0 ||
                variableIds.length === 0) {
                return reply.status(400).send({
                    error: "Missing required fields: gminaIds, variableIds",
                });
            }
            // Pobierz klucz API użytkownika
            const apiKey = await getUserGUSApiKey(userId);
            const gusService = new GUSApiService(apiKey || undefined);
            const comparison = await gusService.compareGminy(gminaIds, variableIds, year);
            return reply.send(comparison);
        }
        catch (error) {
            request.log.error({ err: error }, "GUS compare error");
            return reply.status(500).send({
                error: "Failed to compare gminy",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // POST /api/gus/api-key - Zapisz klucz API użytkownika
    fastify.post("/gus/api-key", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        try {
            const { apiKey } = request.body;
            if (!apiKey) {
                return reply.status(400).send({ error: "Missing apiKey" });
            }
            // Zapisz klucz w metadata źródła danych GUS
            const { data: gusSources } = await supabase
                .from("data_sources")
                .select("id")
                .eq("user_id", userId)
                .eq("type", "statistics")
                .eq("name", "GUS - Bank Danych Lokalnych");
            if (!gusSources || gusSources.length === 0) {
                return reply.status(404).send({ error: "GUS data source not found" });
            }
            // Pobierz istniejące metadata
            const { data: existingSource } = await supabase
                .from("data_sources")
                .select("metadata")
                .eq("id", gusSources[0].id)
                .single();
            const existingMetadata = existingSource?.metadata || {};
            const { error } = await supabase
                .from("data_sources")
                .update({
                metadata: {
                    ...existingMetadata,
                    apiKey: apiKey,
                    apiKeyUpdatedAt: new Date().toISOString(),
                },
            })
                .eq("id", gusSources[0].id);
            if (error) {
                throw error;
            }
            return reply.send({
                success: true,
                message: "API key saved successfully",
            });
        }
        catch (error) {
            request.log.error({ err: error }, "GUS API key save error");
            return reply.status(500).send({
                error: "Failed to save API key",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // DELETE /api/gus/cache - Wyczyść cache
    fastify.delete("/gus/cache", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        try {
            // Wyczyść cache dla instancji użytkownika
            const apiKey = await getUserGUSApiKey(userId);
            const gusService = new GUSApiService(apiKey || undefined);
            gusService.clearCache();
            return reply.send({ success: true, message: "Cache cleared" });
        }
        catch (error) {
            request.log.error({ err: error }, "GUS cache clear error");
            return reply.status(500).send({
                error: "Failed to clear cache",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
}
//# sourceMappingURL=gus.js.map