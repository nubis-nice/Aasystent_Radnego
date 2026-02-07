/**
 * Deep Research API Routes
 * ~~bez~~RADNY - Deep Internet Researcher
 */
import { DeepResearchService } from "../services/deep-research-service.js";
export async function deepResearchRoutes(fastify) {
    // POST /api/research - Main research endpoint
    fastify.post("/research", {
        schema: {
            body: {
                type: "object",
                required: ["query", "researchType", "depth"],
                properties: {
                    query: { type: "string", minLength: 3 },
                    researchType: {
                        type: "string",
                        enum: ["legal", "financial", "procedural", "general"],
                    },
                    depth: {
                        type: "string",
                        enum: ["quick", "standard", "deep"],
                    },
                    sources: {
                        type: "array",
                        items: { type: "string" },
                    },
                    dateRange: {
                        type: "object",
                        properties: {
                            from: { type: "string" },
                            to: { type: "string" },
                        },
                    },
                    maxResults: { type: "number", minimum: 1, maximum: 100 },
                },
            },
        },
    }, async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.code(401).send({ error: "Unauthorized" });
        }
        try {
            fastify.log.info(`[DeepResearch] Research request from user ${userId}`);
            const researchService = new DeepResearchService(userId);
            const report = await researchService.research(request.body);
            return reply.send({ report });
        }
        catch (error) {
            fastify.log.error("[DeepResearch] Research failed: " +
                String(error instanceof Error ? error.message : error));
            return reply.code(500).send({
                error: "Research failed",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // GET /api/research/history - Research history
    fastify.get("/research/history", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.code(401).send({ error: "Unauthorized" });
        }
        try {
            const { createClient } = await import("@supabase/supabase-js");
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const { data: reports, error } = await supabase
                .from("research_reports")
                .select("id, query, research_type, depth, summary, confidence, created_at, processing_time")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(50);
            if (error)
                throw error;
            return reply.send({ reports: reports || [] });
        }
        catch (error) {
            fastify.log.error("[DeepResearch] Failed to fetch history: " +
                String(error instanceof Error ? error.message : error));
            return reply.code(500).send({
                error: "Failed to fetch history",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // GET /api/research/:id - Get specific report
    fastify.get("/research/:id", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        const { id } = request.params;
        if (!userId) {
            return reply.code(401).send({ error: "Unauthorized" });
        }
        try {
            const { createClient } = await import("@supabase/supabase-js");
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const { data: report, error } = await supabase
                .from("research_reports")
                .select("*")
                .eq("id", id)
                .eq("user_id", userId)
                .single();
            if (error)
                throw error;
            if (!report) {
                return reply.code(404).send({ error: "Report not found" });
            }
            return reply.send({ report });
        }
        catch (error) {
            fastify.log.error("[DeepResearch] Failed to fetch report: " +
                String(error instanceof Error ? error.message : error));
            return reply.code(500).send({
                error: "Failed to fetch report",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // DELETE /api/research/:id - Delete report
    fastify.delete("/research/:id", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        const { id } = request.params;
        if (!userId) {
            return reply.code(401).send({ error: "Unauthorized" });
        }
        try {
            const { createClient } = await import("@supabase/supabase-js");
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const { error } = await supabase
                .from("research_reports")
                .delete()
                .eq("id", id)
                .eq("user_id", userId);
            if (error)
                throw error;
            return reply.send({ success: true });
        }
        catch (error) {
            fastify.log.error("[DeepResearch] Failed to delete report: " +
                String(error instanceof Error ? error.message : error));
            return reply.code(500).send({
                error: "Failed to delete report",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // GET /api/research/providers/status - Get providers status
    fastify.get("/research/providers/status", async (request, reply) => {
        const { RESEARCH_PROVIDERS } = await import("../config/research-providers.js");
        const providersStatus = Object.entries(RESEARCH_PROVIDERS).map(([key, config]) => ({
            name: key,
            displayName: config.name,
            enabled: config.enabled,
            priority: config.priority,
            hasApiKey: !!config.apiKey,
        }));
        return reply.send({ providers: providersStatus });
    });
}
//# sourceMappingURL=deep-research.js.map