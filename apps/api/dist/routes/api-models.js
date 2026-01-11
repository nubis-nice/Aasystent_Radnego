export const apiModelsRoutes = async (fastify) => {
    // POST /api/fetch-models - Pobierz listę modeli z API providera (public endpoint)
    fastify.post("/fetch-models", async (request, reply) => {
        try {
            const { provider, apiKey, baseUrl } = request.body;
            if (!provider) {
                return reply.status(400).send({
                    error: "Provider jest wymagany",
                });
            }
            // Dla lokalnych providerów (Ollama) nie wymagamy API key
            if (!apiKey && provider !== "local") {
                return reply.status(400).send({
                    error: "Klucz API jest wymagany dla tego providera",
                });
            }
            // Domyślne URL dla providerów - tylko OpenAI API compatible
            const providerBaseUrls = {
                openai: "https://api.openai.com/v1",
                local: "http://localhost:11434/v1", // Ollama default
                other: "", // Custom endpoint
            };
            const finalBaseUrl = baseUrl || providerBaseUrls[provider];
            if (!finalBaseUrl) {
                return reply.status(400).send({
                    error: "Nieznany provider lub brak URL API",
                });
            }
            // Pobierz listę modeli z API
            const modelsUrl = `${finalBaseUrl.replace(/\/$/, "")}/models`;
            console.log(`[FetchModels] Fetching from: ${modelsUrl}`);
            // Różne providery używają różnych metod autoryzacji
            const headers = {
                "Content-Type": "application/json",
            };
            // Google Gemini używa x-goog-api-key dla native API
            if (provider === "google" && !finalBaseUrl.includes("/openai")) {
                headers["x-goog-api-key"] = apiKey;
            }
            else {
                // Pozostali providerzy używają Bearer token
                headers["Authorization"] = `Bearer ${apiKey}`;
            }
            const response = await globalThis.fetch(modelsUrl, {
                method: "GET",
                headers: headers,
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[FetchModels] Error: ${response.status} - ${errorText}`);
                return reply.status(response.status).send({
                    error: `Błąd API: ${response.status}`,
                    details: errorText,
                });
            }
            const data = (await response.json());
            // Różne providery zwracają różne formaty
            let models = [];
            // Google Gemini: { models: [{ name: "models/gemini-...", displayName: "..." }] }
            if (data.models && Array.isArray(data.models)) {
                models = data.models.map((m) => ({
                    id: m.name?.replace("models/", "") || m.displayName || "",
                    name: m.displayName || m.name?.replace("models/", "") || "",
                    owned_by: "google",
                }));
            }
            // OpenAI: { data: [{ id, object, ... }] }
            else if (data.data && Array.isArray(data.data)) {
                models = data.data.map((m) => ({
                    id: m.id,
                    name: m.name || m.id,
                    owned_by: m.owned_by,
                }));
            }
            // Inne formaty: bezpośrednia tablica
            else if (Array.isArray(data)) {
                models = data.map((m) => ({
                    id: m.id || m.model || m.name || "",
                    name: m.name || m.id || m.model || "",
                }));
            }
            // Kategoryzuj modele według typu
            const chatModels = models.filter((m) => {
                const id = m.id.toLowerCase();
                return (!id.includes("embedding") &&
                    !id.includes("whisper") &&
                    !id.includes("dall-e") &&
                    !id.includes("tts") &&
                    !id.includes("moderation") &&
                    !id.includes("imagen") &&
                    !id.includes("veo") &&
                    !id.includes("aqa"));
            });
            const embeddingModels = models.filter((m) => {
                const id = m.id.toLowerCase();
                return id.includes("embedding") || id.includes("embed");
            });
            const transcriptionModels = models.filter((m) => {
                const id = m.id.toLowerCase();
                return id.includes("whisper");
            });
            const visionModels = models.filter((m) => {
                const id = m.id.toLowerCase();
                return ((id.includes("gpt-4") && id.includes("vision")) ||
                    id.includes("gpt-4o") ||
                    id.includes("gpt-4-turbo") ||
                    (id.includes("gemini") && id.includes("vision")) ||
                    (id.includes("claude") && id.includes("vision")));
            });
            // Sortuj modele chat
            chatModels.sort((a, b) => {
                const aId = a.id.toLowerCase();
                const bId = b.id.toLowerCase();
                if (aId.includes("gpt-4o") && !bId.includes("gpt-4o"))
                    return -1;
                if (bId.includes("gpt-4o") && !aId.includes("gpt-4o"))
                    return 1;
                if (aId.includes("gpt-4") && !bId.includes("gpt-4"))
                    return -1;
                if (bId.includes("gpt-4") && !aId.includes("gpt-4"))
                    return 1;
                if (aId.includes("gemini-2") && !bId.includes("gemini-2"))
                    return -1;
                if (bId.includes("gemini-2") && !aId.includes("gemini-2"))
                    return 1;
                if (aId.includes("gemini-3") && !bId.includes("gemini-3"))
                    return -1;
                if (bId.includes("gemini-3") && !aId.includes("gemini-3"))
                    return 1;
                if (aId.includes("claude-3") && !bId.includes("claude-3"))
                    return -1;
                if (bId.includes("claude-3") && !aId.includes("claude-3"))
                    return 1;
                return a.id.localeCompare(b.id);
            });
            // Wzbogać modele o metadane
            const enrichedChatModels = chatModels.map((model) => enrichModelMetadata(model));
            addModelBadges(enrichedChatModels);
            console.log(`[FetchModels] Found ${enrichedChatModels.length} chat, ${embeddingModels.length} embedding, ${transcriptionModels.length} transcription, ${visionModels.length} vision models`);
            return reply.send({
                success: true,
                models: enrichedChatModels,
                embeddingModels: embeddingModels,
                transcriptionModels: transcriptionModels,
                visionModels: visionModels,
                total: enrichedChatModels.length,
            });
        }
        catch (error) {
            console.error("[FetchModels] Error:", error);
            return reply.status(500).send({
                error: "Nie udało się pobrać listy modeli",
                details: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
};
/**
 * Wzbogaca model o metadane: koszty, wydajność
 */
function enrichModelMetadata(model) {
    const modelId = model.id.toLowerCase();
    // Baza danych cen i wydajności (styczeń 2026)
    const metadata = {
        // OpenAI GPT-4o
        "gpt-4o": {
            pricing: { input: 2.5, output: 10 },
            performance: { speed: "fast", contextWindow: 128000, quality: "high" },
        },
        "gpt-4o-mini": {
            pricing: { input: 0.15, output: 0.6 },
            performance: { speed: "fast", contextWindow: 128000, quality: "medium" },
        },
        // OpenAI GPT-4 Turbo
        "gpt-4-turbo": {
            pricing: { input: 10, output: 30 },
            performance: { speed: "medium", contextWindow: 128000, quality: "high" },
        },
        "gpt-4-turbo-preview": {
            pricing: { input: 10, output: 30 },
            performance: { speed: "medium", contextWindow: 128000, quality: "high" },
        },
        // OpenAI GPT-4
        "gpt-4": {
            pricing: { input: 30, output: 60 },
            performance: { speed: "slow", contextWindow: 8192, quality: "high" },
        },
        "gpt-4-32k": {
            pricing: { input: 60, output: 120 },
            performance: { speed: "slow", contextWindow: 32768, quality: "high" },
        },
        // OpenAI GPT-3.5
        "gpt-3.5-turbo": {
            pricing: { input: 0.5, output: 1.5 },
            performance: { speed: "fast", contextWindow: 16385, quality: "medium" },
        },
        // Lokalne modele (Ollama) - darmowe, ale różna wydajność
        "llama3.2": {
            pricing: { input: 0, output: 0 },
            performance: { speed: "medium", contextWindow: 8192, quality: "medium" },
        },
        "llama3.1": {
            pricing: { input: 0, output: 0 },
            performance: { speed: "medium", contextWindow: 128000, quality: "high" },
        },
        mistral: {
            pricing: { input: 0, output: 0 },
            performance: { speed: "fast", contextWindow: 32768, quality: "medium" },
        },
        mixtral: {
            pricing: { input: 0, output: 0 },
            performance: { speed: "medium", contextWindow: 32768, quality: "high" },
        },
        "qwen2.5": {
            pricing: { input: 0, output: 0 },
            performance: { speed: "fast", contextWindow: 32768, quality: "medium" },
        },
        "deepseek-r1": {
            pricing: { input: 0, output: 0 },
            performance: { speed: "slow", contextWindow: 64000, quality: "high" },
        },
        codellama: {
            pricing: { input: 0, output: 0 },
            performance: { speed: "medium", contextWindow: 16384, quality: "medium" },
        },
    };
    // Znajdź najbardziej pasujące metadane
    let matchedMetadata;
    for (const [key, value] of Object.entries(metadata)) {
        if (modelId.includes(key)) {
            matchedMetadata = value;
            break;
        }
    }
    return {
        ...model,
        pricing: matchedMetadata?.pricing,
        performance: matchedMetadata?.performance,
        badges: [],
    };
}
/**
 * Dodaje wskaźniki (badges) do modeli:
 * - cheapest: najtańszy model
 * - best-value: najlepszy stosunek jakość/cena
 * - fastest: najszybszy model
 */
function addModelBadges(models) {
    if (models.length === 0)
        return;
    // Znajdź najtańszy model (suma input + output)
    const modelsWithPricing = models.filter((m) => m.pricing);
    if (modelsWithPricing.length > 0) {
        const cheapest = modelsWithPricing.reduce((prev, curr) => {
            const prevCost = (prev.pricing?.input || 0) + (prev.pricing?.output || 0);
            const currCost = (curr.pricing?.input || 0) + (curr.pricing?.output || 0);
            return currCost < prevCost ? curr : prev;
        });
        cheapest.badges?.push("cheapest");
    }
    // Znajdź najszybszy model
    const fastModels = models.filter((m) => m.performance?.speed === "fast");
    if (fastModels.length > 0) {
        // Jeśli jest więcej niż jeden fast, wybierz ten z największym context window
        const fastest = fastModels.reduce((prev, curr) => {
            const prevContext = prev.performance?.contextWindow || 0;
            const currContext = curr.performance?.contextWindow || 0;
            return currContext > prevContext ? curr : prev;
        });
        fastest.badges?.push("fastest");
    }
    // Znajdź najlepszy stosunek jakość/cena
    // Formuła: quality_score / (input_cost + output_cost)
    const modelsWithQualityAndPrice = models.filter((m) => m.pricing && m.performance?.quality);
    if (modelsWithQualityAndPrice.length > 0) {
        const qualityScores = { high: 3, medium: 2, low: 1 };
        const bestValue = modelsWithQualityAndPrice.reduce((prev, curr) => {
            const prevQuality = qualityScores[prev.performance.quality];
            const prevCost = prev.pricing.input + prev.pricing.output || 0.01; // Unikaj dzielenia przez 0
            const prevRatio = prevQuality / prevCost;
            const currQuality = qualityScores[curr.performance.quality];
            const currCost = curr.pricing.input + curr.pricing.output || 0.01;
            const currRatio = currQuality / currCost;
            return currRatio > prevRatio ? curr : prev;
        });
        bestValue.badges?.push("best-value");
    }
}
//# sourceMappingURL=api-models.js.map