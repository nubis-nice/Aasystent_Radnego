import { FastifyPluginAsync } from "fastify";

interface ModelMetadata {
  id: string;
  name: string;
  owned_by?: string;
  // Koszty w USD za 1M tokenów
  pricing?: {
    input: number; // Koszt input tokenów
    output: number; // Koszt output tokenów
  };
  // Wydajność
  performance?: {
    speed: "fast" | "medium" | "slow"; // Szybkość odpowiedzi
    contextWindow: number; // Rozmiar okna kontekstu
    quality: "high" | "medium" | "low"; // Jakość odpowiedzi
  };
  // Wskaźniki
  badges?: string[]; // np. ["cheapest", "best-value", "fastest"]
}

export const apiModelsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/test/function - Test specific AI function (public endpoint)
  fastify.post<{
    Body: {
      provider: string;
      api_key: string;
      base_url: string;
      function_type: "llm" | "embeddings" | "vision" | "stt" | "tts";
      model_name: string;
    };
  }>("/test/function", async (request, reply) => {
    const startTime = Date.now();
    try {
      const { provider, api_key, base_url, function_type, model_name } =
        request.body;

      if (!provider || !model_name) {
        return reply.status(400).send({
          success: false,
          error: "Brak wymaganych parametrów (provider, model_name)",
        });
      }

      // Dla lokalnych providerów klucz API jest opcjonalny
      if (!api_key && provider !== "local") {
        return reply.status(400).send({
          success: false,
          error: "Brak klucza API",
        });
      }

      const baseUrl =
        base_url ||
        (provider === "local"
          ? "http://localhost:11434/v1"
          : "https://api.openai.com/v1");

      // Import OpenAI dynamicznie
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({
        apiKey: api_key || "ollama",
        baseURL: baseUrl,
        timeout: 30000,
      });

      let details: Record<string, unknown> = {};

      switch (function_type) {
        case "llm": {
          const response = await client.chat.completions.create({
            model: model_name,
            messages: [
              { role: "user", content: "Odpowiedz jednym słowem: OK" },
            ],
            max_tokens: 10,
          });
          details = {
            response: response.choices[0]?.message?.content || "",
            model: response.model,
            usage: response.usage,
          };
          break;
        }

        case "embeddings": {
          const response = await client.embeddings.create({
            model: model_name,
            input: "Test embedding",
          });
          details = {
            dimensions: response.data[0]?.embedding?.length || 0,
            model: response.model,
          };
          break;
        }

        case "vision": {
          // Dla Ollama używamy natywnego API - testujemy tylko tekstem
          // (obrazy mogą crashować modele z powodu braku zasobów)
          if (provider === "local" || baseUrl.includes("11434")) {
            const ollamaBaseUrl = baseUrl.replace(/\/v1\/?$/, "");

            // Test tekstowy - bezpieczny dla wszystkich modeli
            const textTestResponse = await globalThis.fetch(
              `${ollamaBaseUrl}/api/chat`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: model_name,
                  messages: [
                    {
                      role: "user",
                      content: "Odpowiedz jednym słowem: OK",
                    },
                  ],
                  stream: false,
                }),
              }
            );

            if (!textTestResponse.ok) {
              const errorText = await textTestResponse.text();
              throw new Error(
                `Ollama error: ${textTestResponse.status} - ${errorText}`
              );
            }

            const textData = (await textTestResponse.json()) as {
              message?: { content?: string };
              model?: string;
            };

            const isCloudModel =
              model_name.includes("-cloud") || model_name.includes(":cloud");
            details = {
              response: textData.message?.content || "",
              model: textData.model || model_name,
              note: isCloudModel
                ? "Model cloud - test tekstowy OK. Przetwarzanie obrazów przez Ollama cloud."
                : "Model lokalny - test tekstowy OK. Przetwarzanie obrazów wymaga wystarczających zasobów.",
            };
          } else {
            // Dla OpenAI i innych używamy standardowego formatu
            const response = await client.chat.completions.create({
              model: model_name,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Opisz ten obraz jednym słowem." },
                    {
                      type: "image_url",
                      image_url: {
                        url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                      },
                    },
                  ],
                },
              ],
              max_tokens: 10,
            });
            details = {
              response: response.choices[0]?.message?.content || "",
              model: response.model,
            };
          }
          break;
        }

        case "stt": {
          try {
            const models = await client.models.list();
            const modelExists = Array.from(models.data).some(
              (m) => m.id === model_name || m.id.includes("whisper")
            );
            if (modelExists) {
              details = { supported: true, note: "Model STT dostępny" };
            } else {
              details = {
                supported: true,
                note: "Endpoint dostępny, model może wymagać pobrania",
              };
            }
          } catch {
            if (provider === "local") {
              details = {
                supported: true,
                note: "Lokalny provider - zakładamy dostępność STT",
              };
            } else {
              throw new Error("Nie można zweryfikować modelu STT");
            }
          }
          break;
        }

        case "tts": {
          try {
            const response = await client.audio.speech.create({
              model: model_name,
              voice: "alloy",
              input: "Test",
            });
            details = {
              supported: true,
              contentType: response.headers.get("content-type"),
            };
          } catch (e: unknown) {
            const error = e as Error;
            if (
              error.message?.includes("not found") ||
              error.message?.includes("404")
            ) {
              throw new Error(`Model TTS "${model_name}" nie znaleziony`);
            }
            throw e;
          }
          break;
        }

        default:
          return reply.status(400).send({
            success: false,
            error: `Nieznany typ funkcji: ${function_type}`,
          });
      }

      return reply.send({
        success: true,
        function_type,
        model_name,
        response_time_ms: Date.now() - startTime,
        details,
      });
    } catch (error: unknown) {
      const err = error as Error & { status?: number; code?: string };
      fastify.log.error(
        { error: err, message: err.message },
        "Function test error"
      );

      return reply.status(200).send({
        success: false,
        error: err.message || "Test nieudany",
        response_time_ms: Date.now() - startTime,
        details: {
          code: err.code,
          status: err.status,
        },
      });
    }
  });

  // POST /api/fetch-models - Pobierz listę modeli z API providera (public endpoint)
  fastify.post("/fetch-models", async (request, reply) => {
    try {
      const { provider, apiKey, baseUrl } = request.body as {
        provider: string;
        apiKey: string;
        baseUrl?: string;
      };

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

      // Domyślne URL dla providerów
      const providerBaseUrls: Record<string, string> = {
        openai: "https://api.openai.com/v1",
        local: "http://localhost:11434", // Ollama default (bez /v1)
        other: "", // Custom endpoint
      };

      const finalBaseUrl = baseUrl || providerBaseUrls[provider];

      if (!finalBaseUrl) {
        return reply.status(400).send({
          error: "Nieznany provider lub brak URL API",
        });
      }

      // Ollama używa natywnego API /api/tags, nie OpenAI-compatible /v1/models
      let modelsUrl: string;
      let isOllama = false;

      if (provider === "local" || finalBaseUrl.includes("11434")) {
        // Ollama native API
        modelsUrl = `${finalBaseUrl
          .replace(/\/$/, "")
          .replace(/\/v1$/, "")}/api/tags`;
        isOllama = true;
      } else {
        // OpenAI-compatible API
        modelsUrl = `${finalBaseUrl.replace(/\/$/, "")}/models`;
      }

      console.log(
        `[FetchModels] Fetching from: ${modelsUrl} (isOllama: ${isOllama})`
      );

      // Różne providery używają różnych metod autoryzacji
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Google Gemini używa x-goog-api-key dla native API
      if (provider === "google" && !finalBaseUrl.includes("/openai")) {
        headers["x-goog-api-key"] = apiKey;
      } else if (!isOllama) {
        // Pozostali providerzy używają Bearer token (Ollama nie wymaga)
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

      const data = (await response.json()) as Record<string, unknown>;

      // Różne providery zwracają różne formaty
      let models: ModelMetadata[] = [];

      // Ollama native API: { models: [{ name: "llama3.2:latest", model: "llama3.2:latest", ... }] }
      if (isOllama && data.models && Array.isArray(data.models)) {
        models = (data.models as Array<{ name?: string; model?: string }>).map(
          (m) => ({
            id: m.name || m.model || "",
            name: m.name || m.model || "",
            owned_by: "ollama",
          })
        );
        console.log(`[FetchModels] Ollama models found: ${models.length}`);
      }
      // Google Gemini: { models: [{ name: "models/gemini-...", displayName: "..." }] }
      else if (data.models && Array.isArray(data.models)) {
        models = (
          data.models as Array<{ name?: string; displayName?: string }>
        ).map((m) => ({
          id: m.name?.replace("models/", "") || m.displayName || "",
          name: m.displayName || m.name?.replace("models/", "") || "",
          owned_by: "google",
        }));
      }
      // OpenAI: { data: [{ id, object, ... }] }
      else if (data.data && Array.isArray(data.data)) {
        models = (
          data.data as Array<{ id: string; name?: string; owned_by?: string }>
        ).map((m) => ({
          id: m.id,
          name: m.name || m.id,
          owned_by: m.owned_by,
        }));
      }
      // Inne formaty: bezpośrednia tablica
      else if (Array.isArray(data)) {
        models = (
          data as Array<{ id?: string; name?: string; model?: string }>
        ).map((m) => ({
          id: m.id || m.model || m.name || "",
          name: m.name || m.id || m.model || "",
        }));
      }

      // Kategoryzuj modele według typu
      const chatModels = models.filter((m) => {
        const id = m.id.toLowerCase();
        return (
          !id.includes("embedding") &&
          !id.includes("whisper") &&
          !id.includes("dall-e") &&
          !id.includes("tts") &&
          !id.includes("moderation") &&
          !id.includes("imagen") &&
          !id.includes("veo") &&
          !id.includes("aqa")
        );
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
        return (
          // OpenAI vision models
          (id.includes("gpt-4") && id.includes("vision")) ||
          id.includes("gpt-4o") ||
          id.includes("gpt-4-turbo") ||
          // Google vision models
          (id.includes("gemini") && id.includes("vision")) ||
          // Anthropic vision models
          (id.includes("claude") && id.includes("vision")) ||
          // Ollama/Local vision models
          id.includes("llava") ||
          id.includes("bakllava") ||
          id.includes("moondream") ||
          (id.includes("qwen") && id.includes("vl")) ||
          id.includes("minicpm-v") ||
          id.includes("llama3.2-vision") ||
          id.includes("cogvlm") ||
          id.includes("yi-vl")
        );
      });

      // Sortuj modele chat
      chatModels.sort((a, b) => {
        const aId = a.id.toLowerCase();
        const bId = b.id.toLowerCase();
        if (aId.includes("gpt-4o") && !bId.includes("gpt-4o")) return -1;
        if (bId.includes("gpt-4o") && !aId.includes("gpt-4o")) return 1;
        if (aId.includes("gpt-4") && !bId.includes("gpt-4")) return -1;
        if (bId.includes("gpt-4") && !aId.includes("gpt-4")) return 1;
        if (aId.includes("gemini-2") && !bId.includes("gemini-2")) return -1;
        if (bId.includes("gemini-2") && !aId.includes("gemini-2")) return 1;
        if (aId.includes("gemini-3") && !bId.includes("gemini-3")) return -1;
        if (bId.includes("gemini-3") && !aId.includes("gemini-3")) return 1;
        if (aId.includes("claude-3") && !bId.includes("claude-3")) return -1;
        if (bId.includes("claude-3") && !aId.includes("claude-3")) return 1;
        return a.id.localeCompare(b.id);
      });

      // Wzbogać modele o metadane
      const enrichedChatModels = chatModels.map((model) =>
        enrichModelMetadata(model)
      );
      addModelBadges(enrichedChatModels);

      console.log(
        `[FetchModels] Found ${enrichedChatModels.length} chat, ${embeddingModels.length} embedding, ${transcriptionModels.length} transcription, ${visionModels.length} vision models`
      );

      return reply.send({
        success: true,
        models: enrichedChatModels,
        embeddingModels: embeddingModels,
        transcriptionModels: transcriptionModels,
        visionModels: visionModels,
        total: enrichedChatModels.length,
      });
    } catch (error) {
      console.error("[FetchModels] Error:", error);
      return reply.status(500).send({
        error: "Nie udało się pobrać listy modeli",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PROXY ENDPOINTS DLA FASTER-WHISPER (omijają CORS)
  // ─────────────────────────────────────────────────────────────────────────
  /* eslint-disable no-undef */

  // GET /api/stt/status - Sprawdź status serwera STT
  fastify.get<{
    Querystring: { baseUrl?: string };
  }>("/stt/status", async (request, reply) => {
    const baseUrl = request.query.baseUrl || "http://localhost:8000/v1";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${baseUrl}/models`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as { data?: { id: string }[] };
        return reply.send({
          status: "online",
          models: data.data?.map((m) => m.id) || [],
        });
      } else {
        return reply.send({
          status: "offline",
          error: `HTTP ${response.status}`,
        });
      }
    } catch (err) {
      return reply.send({
        status: "offline",
        error: err instanceof Error ? err.message : "Connection failed",
      });
    }
  });

  // POST /api/stt/transcribe-test - Test transkrypcji audio
  fastify.post<{
    Querystring: { baseUrl?: string; model?: string };
  }>("/stt/transcribe-test", async (request, reply) => {
    const baseUrl = request.query.baseUrl || "http://localhost:8000/v1";
    const model = request.query.model || "Systran/faster-whisper-medium";

    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: "Brak pliku audio",
        });
      }

      const formData = new FormData();
      const buffer = await data.toBuffer();
      formData.append(
        "file",
        new Blob([buffer]),
        data.filename || "audio.webm"
      );
      formData.append("model", model);
      formData.append("language", "pl");

      const response = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = (await response.json()) as { text?: string };
        return reply.send({
          success: true,
          text: result.text || "",
        });
      } else {
        const error = await response.text();
        return reply.status(response.status).send({
          success: false,
          error: error,
        });
      }
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : "Transcription failed",
      });
    }
  });
};

/**
 * Wzbogaca model o metadane: koszty, wydajność
 */
function enrichModelMetadata(model: ModelMetadata): ModelMetadata {
  const modelId = model.id.toLowerCase();

  // Baza danych cen i wydajności (styczeń 2026)
  const metadata: Record<string, Partial<ModelMetadata>> = {
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
  let matchedMetadata: Partial<ModelMetadata> | undefined;
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
function addModelBadges(models: ModelMetadata[]): void {
  if (models.length === 0) return;

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
  const modelsWithQualityAndPrice = models.filter(
    (m) => m.pricing && m.performance?.quality
  );
  if (modelsWithQualityAndPrice.length > 0) {
    const qualityScores = { high: 3, medium: 2, low: 1 };
    const bestValue = modelsWithQualityAndPrice.reduce((prev, curr) => {
      const prevQuality = qualityScores[prev.performance!.quality];
      const prevCost = prev.pricing!.input + prev.pricing!.output || 0.01; // Unikaj dzielenia przez 0
      const prevRatio = prevQuality / prevCost;

      const currQuality = qualityScores[curr.performance!.quality];
      const currCost = curr.pricing!.input + curr.pricing!.output || 0.01;
      const currRatio = currQuality / currCost;

      return currRatio > prevRatio ? curr : prev;
    });
    bestValue.badges?.push("best-value");
  }
}
