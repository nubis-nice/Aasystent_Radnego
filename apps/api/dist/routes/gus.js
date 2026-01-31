import { Buffer } from "node:buffer";
import { GUSApiService } from "../services/gus-api-service.js";
import { supabase } from "../lib/supabase.js";
/**
 * Pobierz klucz API GUS dla użytkownika z api_configurations
 */
async function getUserGUSApiKey(userId) {
    const { data } = await supabase
        .from("api_configurations")
        .select("api_key_encrypted")
        .eq("user_id", userId)
        .eq("provider", "gus")
        .single();
    if (data?.api_key_encrypted) {
        // Klucz jest zakodowany w base64
        try {
            return Buffer.from(data.api_key_encrypted, "base64").toString("utf-8");
        }
        catch {
            return data.api_key_encrypted;
        }
    }
    return process.env.GUS_API_KEY || null;
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
    // POST /api/gus/api-key - Zapisz klucz API użytkownika do api_configurations
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
            // Zakoduj klucz w base64
            const encodedKey = Buffer.from(apiKey).toString("base64");
            // Sprawdź czy istnieje konfiguracja GUS dla użytkownika
            const { data: existing } = await supabase
                .from("api_configurations")
                .select("id")
                .eq("user_id", userId)
                .eq("provider", "gus")
                .maybeSingle();
            let error;
            if (existing) {
                // Update istniejącej konfiguracji
                const result = await supabase
                    .from("api_configurations")
                    .update({
                    api_key_encrypted: encodedKey,
                    connection_status: "untested",
                    updated_at: new Date().toISOString(),
                })
                    .eq("id", existing.id);
                error = result.error;
            }
            else {
                // Insert nowej konfiguracji
                const result = await supabase.from("api_configurations").insert({
                    user_id: userId,
                    provider: "gus",
                    name: "GUS - Bank Danych Lokalnych",
                    api_key_encrypted: encodedKey,
                    base_url: "https://bdl.stat.gov.pl/api/v1",
                    is_active: true,
                    is_default: false,
                    config_type: "statistical",
                    connection_status: "untested",
                    auth_method: "api-key",
                    timeout_seconds: 30,
                    max_retries: 3,
                });
                error = result.error;
            }
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