import OpenAI from "openai";
export const testApiRoutes = async (fastify) => {
    // POST /api/test-openai - Testowanie połączenia z API providera
    fastify.post("/test-openai", {
        schema: {
            body: {
                type: "object",
                required: ["apiKey"],
                properties: {
                    apiKey: { type: "string" },
                    baseUrl: { type: "string" },
                    modelName: { type: "string" },
                    provider: { type: "string" },
                },
            },
        },
    }, async (request, reply) => {
        const { apiKey, baseUrl, modelName, provider } = request.body;
        console.log("[TestAPI] Request params:", {
            provider,
            baseUrl,
            modelName,
            apiKeyLength: apiKey?.length,
        });
        try {
            // Konfiguracja klienta z obsługą różnych metod autoryzacji
            const clientConfig = {
                apiKey,
                baseURL: baseUrl || undefined,
            };
            // Google Gemini native API używa x-goog-api-key
            if (provider === "google" && baseUrl && !baseUrl.includes("/openai")) {
                clientConfig.defaultHeaders = {
                    "x-goog-api-key": apiKey,
                };
                clientConfig.apiKey = "dummy";
            }
            const openai = new OpenAI(clientConfig);
            // Test 1: Sprawdź dostępność modeli (pomijamy dla Google native API)
            let models = [];
            if (provider !== "google" || (baseUrl && baseUrl.includes("/openai"))) {
                try {
                    const modelsResponse = await openai.models.list();
                    models = modelsResponse.data.map((m) => m.id);
                }
                catch (e) {
                    // Jeśli lista modeli nie działa, kontynuuj z testem completion
                    console.log("Models list not available, skipping...");
                }
            }
            // Test 2: Jeśli podano model, sprawdź czy istnieje (tylko jeśli mamy listę modeli)
            if (modelName && models.length > 0 && !models.includes(modelName)) {
                return reply.status(400).send({
                    success: false,
                    error: `Model ${modelName} nie jest dostępny`,
                    availableModels: models.slice(0, 10),
                });
            }
            // Test 3: Wykonaj prosty request (chat completion)
            const testModel = modelName || "gpt-3.5-turbo";
            const completion = await openai.chat.completions.create({
                model: testModel,
                messages: [
                    {
                        role: "user",
                        content: "Odpowiedz jednym słowem: OK",
                    },
                ],
                max_tokens: 10,
                temperature: 0,
            });
            const response = completion.choices[0]?.message?.content || "";
            return reply.send({
                success: true,
                message: "Połączenie z OpenAI działa poprawnie",
                details: {
                    modelsCount: models.length,
                    testedModel: testModel,
                    testResponse: response,
                    availableModels: models.slice(0, 10),
                },
            });
        }
        catch (error) {
            fastify.log.error("OpenAI test failed: " +
                String(error instanceof Error ? error.message : error));
            console.error("[TestAPI] Full error:", JSON.stringify(error, null, 2));
            console.error("[TestAPI] Error message:", error.message);
            console.error("[TestAPI] Error stack:", error.stack);
            let errorMessage = "Nieznany błąd";
            if (error.status === 401) {
                errorMessage = "Nieprawidłowy klucz API";
            }
            else if (error.status === 429) {
                errorMessage = "Przekroczono limit zapytań";
            }
            else if (error.status === 404) {
                errorMessage = "Nieprawidłowy URL lub endpoint";
            }
            else if (error.code === "ENOTFOUND") {
                errorMessage = "Nie można połączyć się z serwerem";
            }
            else if (error.message) {
                errorMessage = error.message;
            }
            return reply.status(400).send({
                success: false,
                error: errorMessage,
                details: {
                    status: error.status,
                    code: error.code,
                    type: error.type,
                    message: error.message,
                },
            });
        }
    });
    // POST /api/test-local-model - Testowanie lokalnego modelu
    fastify.post("/test-local-model", {
        schema: {
            body: {
                type: "object",
                required: ["baseUrl"],
                properties: {
                    baseUrl: { type: "string" },
                    modelName: { type: "string" },
                },
            },
        },
    }, async (request, reply) => {
        const { baseUrl, modelName } = request.body;
        try {
            // Utwórz klienta dla lokalnego modelu (np. Ollama, LM Studio)
            const openai = new OpenAI({
                apiKey: "not-needed", // Lokalne modele często nie wymagają klucza
                baseURL: baseUrl,
            });
            // Test: Wykonaj prosty request
            const testModel = modelName || "llama2";
            const completion = await openai.chat.completions.create({
                model: testModel,
                messages: [
                    {
                        role: "user",
                        content: "Odpowiedz jednym słowem: OK",
                    },
                ],
                max_tokens: 10,
                temperature: 0,
            });
            const response = completion.choices[0]?.message?.content || "";
            return reply.send({
                success: true,
                message: "Połączenie z lokalnym modelem działa poprawnie",
                details: {
                    testedModel: testModel,
                    testResponse: response,
                    baseUrl,
                },
            });
        }
        catch (error) {
            fastify.log.error("Local model test failed: " +
                String(error instanceof Error ? error.message : error));
            let errorMessage = "Nieznany błąd";
            if (error.code === "ECONNREFUSED") {
                errorMessage =
                    "Nie można połączyć się z lokalnym serwerem. Upewnij się, że serwer jest uruchomiony.";
            }
            else if (error.code === "ENOTFOUND") {
                errorMessage = "Nieprawidłowy adres URL";
            }
            else if (error.message) {
                errorMessage = error.message;
            }
            return reply.status(400).send({
                success: false,
                error: errorMessage,
                details: {
                    code: error.code,
                    baseUrl,
                },
            });
        }
    });
};
//# sourceMappingURL=test-api.js.map