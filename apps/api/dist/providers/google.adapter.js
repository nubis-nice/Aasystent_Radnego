import { BaseProviderAdapter } from "./base.adapter.js";
/**
 * Google Gemini Provider Adapter
 * Supports both native API and OpenAI-compatible endpoint
 */
export class GoogleGeminiAdapter extends BaseProviderAdapter {
    useOpenAICompatible;
    constructor(config) {
        super(config);
        this.validateConfig();
        // Detect if using OpenAI-compatible endpoint
        this.useOpenAICompatible =
            config.baseUrl.includes("/openai") ||
                config.chatEndpoint?.includes("/openai");
    }
    buildHeaders() {
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.useOpenAICompatible) {
            // OpenAI-compatible endpoint uses Bearer token
            headers["Authorization"] = `Bearer ${this.config.apiKey}`;
        }
        else {
            // Native API uses x-goog-api-key
            headers["x-goog-api-key"] = this.config.apiKey;
        }
        if (this.config.customHeaders) {
            Object.assign(headers, this.config.customHeaders);
        }
        return headers;
    }
    async testConnection() {
        const startTime = Date.now();
        try {
            await this.listModels();
            return {
                test_type: "connection",
                status: "success",
                response_time_ms: Date.now() - startTime,
                error_message: null,
                error_details: null,
                tested_at: new Date().toISOString(),
            };
        }
        catch (error) {
            const providerError = this.handleError(error);
            return {
                test_type: "connection",
                status: "failed",
                response_time_ms: Date.now() - startTime,
                error_message: providerError.message,
                error_details: {
                    code: providerError.code,
                    status: providerError.status,
                    provider_error: providerError.providerError,
                },
                tested_at: new Date().toISOString(),
            };
        }
    }
    async chat(messages, options = {}) {
        try {
            if (this.useOpenAICompatible) {
                return await this.chatOpenAI(messages, options);
            }
            else {
                return await this.chatNative(messages, options);
            }
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    async chatOpenAI(messages, options) {
        const endpoint = this.config.chatEndpoint || "/openai/chat/completions";
        const url = this.buildUrl(endpoint);
        const body = {
            model: this.config.modelName || "gemini-pro",
            messages: messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            })),
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens,
            top_p: options.top_p,
            stream: false,
        };
        const response = await this.makeRequest(url, {
            method: "POST",
            headers: this.buildHeaders(),
            body: JSON.stringify(body),
        });
        return {
            content: response.choices[0].message.content,
            model: response.model,
            usage: response.usage,
        };
    }
    async chatNative(messages, options) {
        const model = this.config.modelName || "gemini-pro";
        const endpoint = `/models/${model}:generateContent`;
        const url = this.buildUrl(endpoint);
        // Convert messages to Gemini format
        const contents = messages
            .filter((msg) => msg.role !== "system")
            .map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));
        const systemInstruction = messages.find((msg) => msg.role === "system");
        const body = {
            contents,
            generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.max_tokens,
                topP: options.top_p,
            },
        };
        if (systemInstruction) {
            body.systemInstruction = {
                parts: [{ text: systemInstruction.content }],
            };
        }
        const response = await this.makeRequest(url, {
            method: "POST",
            headers: this.buildHeaders(),
            body: JSON.stringify(body),
        });
        const content = response.candidates[0].content.parts[0].text;
        return {
            content,
            model: model,
            usage: response.usageMetadata
                ? {
                    prompt_tokens: response.usageMetadata.promptTokenCount,
                    completion_tokens: response.usageMetadata.candidatesTokenCount,
                    total_tokens: response.usageMetadata.totalTokenCount,
                }
                : undefined,
        };
    }
    async embeddings(text) {
        try {
            if (this.useOpenAICompatible) {
                return await this.embeddingsOpenAI(text);
            }
            else {
                return await this.embeddingsNative(text);
            }
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    async embeddingsOpenAI(text) {
        const endpoint = this.config.embeddingsEndpoint || "/openai/embeddings";
        const url = this.buildUrl(endpoint);
        const body = {
            model: this.config.embeddingModel || "text-embedding-004",
            input: text,
        };
        const response = await this.makeRequest(url, {
            method: "POST",
            headers: this.buildHeaders(),
            body: JSON.stringify(body),
        });
        return response.data[0].embedding;
    }
    async embeddingsNative(text) {
        const model = this.config.embeddingModel || "text-embedding-004";
        const endpoint = `/models/${model}:embedContent`;
        const url = this.buildUrl(endpoint);
        const body = {
            content: {
                parts: [{ text }],
            },
        };
        const response = await this.makeRequest(url, {
            method: "POST",
            headers: this.buildHeaders(),
            body: JSON.stringify(body),
        });
        return response.embedding.values;
    }
    async listModels() {
        try {
            const endpoint = this.config.modelsEndpoint || "/models";
            const url = this.buildUrl(endpoint);
            const response = await this.makeRequest(url, {
                method: "GET",
                headers: this.buildHeaders(),
            });
            // Handle both formats: {data: [...]} and {models: [...]}
            const models = response.data || response.models || [];
            return models.map((model) => ({
                id: model.id || model.name,
                name: model.displayName || model.name || model.id,
                created: model.created,
                owned_by: model.owned_by || "google",
            }));
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
}
//# sourceMappingURL=google.adapter.js.map