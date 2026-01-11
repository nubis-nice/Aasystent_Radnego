import { BaseProviderAdapter } from "./base.adapter.js";
/**
 * Local Model Provider Adapter
 * Supports: Ollama, LM Studio, LocalAI, etc.
 */
export class LocalModelAdapter extends BaseProviderAdapter {
    constructor(config) {
        super(config);
        this.validateConfig();
    }
    buildHeaders() {
        const headers = {
            "Content-Type": "application/json",
        };
        // Local models may not require authentication
        if (this.config.apiKey && this.config.apiKey !== "none") {
            if (this.config.authMethod === "bearer") {
                headers["Authorization"] = `Bearer ${this.config.apiKey}`;
            }
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
            const endpoint = this.config.chatEndpoint || "/api/chat";
            const url = this.buildUrl(endpoint);
            const body = {
                model: this.config.modelName || "llama2",
                messages: messages.map((msg) => ({
                    role: msg.role,
                    content: msg.content,
                })),
                stream: false,
                options: {
                    temperature: options.temperature ?? 0.7,
                    num_predict: options.max_tokens,
                    top_p: options.top_p,
                },
            };
            const response = await this.makeRequest(url, {
                method: "POST",
                headers: this.buildHeaders(),
                body: JSON.stringify(body),
            });
            return {
                content: response.message?.content || response.response || "",
                model: response.model,
                usage: response.usage
                    ? {
                        prompt_tokens: response.usage.prompt_tokens || 0,
                        completion_tokens: response.usage.completion_tokens || 0,
                        total_tokens: response.usage.total_tokens || 0,
                    }
                    : undefined,
            };
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    async embeddings(text) {
        try {
            const endpoint = this.config.embeddingsEndpoint || "/api/embeddings";
            const url = this.buildUrl(endpoint);
            const body = {
                model: this.config.embeddingModel || "nomic-embed-text",
                prompt: text,
            };
            const response = await this.makeRequest(url, {
                method: "POST",
                headers: this.buildHeaders(),
                body: JSON.stringify(body),
            });
            return response.embedding;
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    async listModels() {
        try {
            const endpoint = this.config.modelsEndpoint || "/api/tags";
            const url = this.buildUrl(endpoint);
            const response = await this.makeRequest(url, {
                method: "GET",
                headers: this.buildHeaders(),
            });
            return (response.models || []).map((model) => ({
                id: model.name,
                name: model.name,
                created: model.modified_at
                    ? new Date(model.modified_at).getTime() / 1000
                    : undefined,
                owned_by: "local",
            }));
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
}
//# sourceMappingURL=local.adapter.js.map