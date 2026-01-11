import { supabase } from "../lib/supabase.js";
/**
 * Provider Routes
 * Endpoints for provider capabilities and defaults
 */
export async function providerRoutes(fastify) {
    // GET /api/providers/capabilities - List all providers with capabilities
    fastify.get("/providers/capabilities", async (_request, reply) => {
        try {
            const { data: capabilities, error } = await supabase
                .from("provider_capabilities")
                .select("*")
                .order("provider", { ascending: true });
            if (error) {
                throw error;
            }
            return reply.send({ capabilities: capabilities || [] });
        }
        catch (error) {
            fastify.log.error("Error fetching provider capabilities:", error);
            return reply
                .status(500)
                .send({ error: "Failed to fetch provider capabilities" });
        }
    });
    // GET /api/providers/:provider/defaults - Get default settings for provider
    fastify.get("/providers/:provider/defaults", async (request, reply) => {
        try {
            const { provider } = request.params;
            const { data: capability, error } = await supabase
                .from("provider_capabilities")
                .select("*")
                .eq("provider", provider)
                .single();
            if (error || !capability) {
                return reply.status(404).send({ error: "Provider not found" });
            }
            // Return default configuration
            const defaults = {
                provider: capability.provider,
                provider_version: null,
                base_url: capability.default_base_url,
                chat_endpoint: capability.default_chat_endpoint,
                embeddings_endpoint: capability.default_embeddings_endpoint,
                models_endpoint: capability.default_models_endpoint,
                auth_method: capability.auth_methods[0] || "bearer",
                timeout_seconds: 30,
                max_retries: 3,
                capabilities: {
                    supports_chat: capability.supports_chat,
                    supports_embeddings: capability.supports_embeddings,
                    supports_streaming: capability.supports_streaming,
                    supports_function_calling: capability.supports_function_calling,
                    supports_vision: capability.supports_vision,
                },
                rate_limits: {
                    requests_per_minute: capability.rate_limit_rpm,
                    tokens_per_minute: capability.rate_limit_tpm,
                },
                documentation_url: capability.documentation_url,
            };
            return reply.send({ defaults });
        }
        catch (error) {
            fastify.log.error("Error fetching provider defaults:", error);
            return reply
                .status(500)
                .send({ error: "Failed to fetch provider defaults" });
        }
    });
    // GET /api/providers/supported - List supported provider types
    fastify.get("/providers/supported", async (_request, reply) => {
        try {
            const { data: providers, error } = await supabase
                .from("provider_capabilities")
                .select("provider, supports_chat, supports_embeddings")
                .order("provider", { ascending: true });
            if (error) {
                throw error;
            }
            const supportedProviders = (providers || []).map((p) => ({
                provider: p.provider,
                supports_chat: p.supports_chat,
                supports_embeddings: p.supports_embeddings,
            }));
            return reply.send({ providers: supportedProviders });
        }
        catch (error) {
            fastify.log.error("Error fetching supported providers:", error);
            return reply
                .status(500)
                .send({ error: "Failed to fetch supported providers" });
        }
    });
}
//# sourceMappingURL=providers.js.map