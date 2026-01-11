import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export const diagnosticsRoutes = async (fastify) => {
    /**
     * GET /api/diagnostics/reasoning-engine
     * Sprawdza status wszystkich komponentów Reasoning Engine
     */
    fastify.get("/diagnostics/reasoning-engine", async (request, reply) => {
        try {
            // Pobierz userId z nagłówka ustawionego przez authMiddleware
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            // Sprawdź status RAG
            const ragDiagnostic = await checkRAGStatus(userId);
            // Sprawdź status Research providers
            const researchDiagnostic = await checkResearchStatus(userId);
            // Sprawdź status Transcription
            const transcriptionDiagnostic = await checkTranscriptionStatus(userId);
            // Sprawdź status Embedding
            const embeddingDiagnostic = await checkEmbeddingStatus(userId);
            const diagnostics = {
                rag: ragDiagnostic,
                research: researchDiagnostic,
                transcription: transcriptionDiagnostic,
                embedding: embeddingDiagnostic,
            };
            return reply.send(diagnostics);
        }
        catch (error) {
            console.error("[Diagnostics] Error:", error);
            return reply.status(500).send({
                error: "Failed to get diagnostics",
                details: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
};
/**
 * Sprawdza status systemu RAG
 */
async function checkRAGStatus(userId) {
    try {
        // Policz wszystkie dokumenty użytkownika
        const { count: totalDocs, error: countError } = await supabase
            .from("processed_documents")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);
        if (countError) {
            return {
                status: "error",
                message: `Database error: ${countError.message}`,
                documentsCount: 0,
                embeddingsCount: 0,
                lastIndexed: null,
            };
        }
        // Policz dokumenty z embeddingami
        const { count: docsWithEmbeddings, error: embError } = await supabase
            .from("processed_documents")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .not("embedding", "is", null);
        if (embError) {
            return {
                status: "error",
                message: `Database error: ${embError.message}`,
                documentsCount: totalDocs || 0,
                embeddingsCount: 0,
                lastIndexed: null,
            };
        }
        // Pobierz ostatnio zindeksowany dokument
        const { data: lastDoc } = await supabase
            .from("processed_documents")
            .select("created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        const documentsCount = totalDocs || 0;
        const embeddingsCount = docsWithEmbeddings || 0;
        const lastIndexed = lastDoc?.created_at || null;
        // Określ status
        let status;
        let message;
        if (documentsCount === 0) {
            status = "degraded";
            message = "Brak dokumentów w bazie RAG";
        }
        else if (embeddingsCount === 0) {
            status = "error";
            message = "Dokumenty bez embeddingów - RAG nie działa";
        }
        else if (embeddingsCount < documentsCount) {
            status = "degraded";
            message = `${documentsCount - embeddingsCount} dokumentów bez embeddingów`;
        }
        else {
            status = "healthy";
            message = `RAG działa poprawnie - ${documentsCount} dokumentów`;
        }
        return {
            status,
            message,
            documentsCount,
            embeddingsCount,
            lastIndexed,
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
            documentsCount: 0,
            embeddingsCount: 0,
            lastIndexed: null,
        };
    }
}
/**
 * Sprawdza status providerów Research
 */
async function checkResearchStatus(userId) {
    try {
        // Pobierz konfiguracje API dla research providerów
        const { data: configs, error } = await supabase
            .from("api_configurations")
            .select("provider, is_active")
            .eq("user_id", userId)
            .in("provider", ["exa", "tavily", "serper"]);
        if (error) {
            return {
                status: "error",
                message: `Database error: ${error.message}`,
                providers: {
                    exa: false,
                    tavily: false,
                    serper: false,
                },
            };
        }
        const providers = {
            exa: configs?.some((c) => c.provider === "exa" && c.is_active) || false,
            tavily: configs?.some((c) => c.provider === "tavily" && c.is_active) || false,
            serper: configs?.some((c) => c.provider === "serper" && c.is_active) || false,
        };
        const activeCount = Object.values(providers).filter(Boolean).length;
        let status;
        let message;
        if (activeCount === 0) {
            status = "error";
            message = "Brak aktywnych providerów research";
        }
        else if (activeCount === 1) {
            status = "degraded";
            message = `Tylko 1 provider aktywny - zalecane minimum 2`;
        }
        else {
            status = "healthy";
            message = `${activeCount} providerów aktywnych`;
        }
        return {
            status,
            message,
            providers,
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
            providers: {
                exa: false,
                tavily: false,
                serper: false,
            },
        };
    }
}
/**
 * Sprawdza status modelu transkrypcji
 */
async function checkTranscriptionStatus(userId) {
    try {
        // Pobierz domyślną konfigurację API
        const { data: config, error } = await supabase
            .from("api_configurations")
            .select("transcription_model, is_active")
            .eq("user_id", userId)
            .eq("is_default", true)
            .maybeSingle();
        if (error || !config) {
            return {
                status: "error",
                message: "Brak konfiguracji API",
                model: "unknown",
            };
        }
        const model = config.transcription_model || "whisper-1";
        if (!config.is_active) {
            return {
                status: "degraded",
                message: "Konfiguracja API nieaktywna",
                model,
            };
        }
        return {
            status: "healthy",
            message: `Model transkrypcji: ${model}`,
            model,
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
            model: "unknown",
        };
    }
}
/**
 * Sprawdza status modelu embedding
 */
async function checkEmbeddingStatus(userId) {
    try {
        // Pobierz domyślną konfigurację API
        const { data: config, error } = await supabase
            .from("api_configurations")
            .select("embedding_model, is_active")
            .eq("user_id", userId)
            .eq("is_default", true)
            .maybeSingle();
        if (error || !config) {
            return {
                status: "error",
                message: "Brak konfiguracji API",
                model: "unknown",
                dimensions: 0,
            };
        }
        const model = config.embedding_model || "text-embedding-3-small";
        // Określ wymiary na podstawie modelu
        let dimensions = 1536; // Domyślnie dla text-embedding-3-small i ada-002
        if (model === "text-embedding-3-large") {
            dimensions = 3072;
        }
        if (!config.is_active) {
            return {
                status: "degraded",
                message: "Konfiguracja API nieaktywna",
                model,
                dimensions,
            };
        }
        return {
            status: "healthy",
            message: `Model embedding: ${model} (${dimensions} dim)`,
            model,
            dimensions,
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
            model: "unknown",
            dimensions: 0,
        };
    }
}
//# sourceMappingURL=diagnostics.js.map