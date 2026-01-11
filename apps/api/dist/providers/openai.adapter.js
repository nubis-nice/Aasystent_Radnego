import { BaseProviderAdapter } from "./base.adapter.js";
/**
 * OpenAI Provider Adapter
 * Supports: OpenAI, Azure OpenAI, and OpenAI-compatible APIs
 */
export class OpenAIAdapter extends BaseProviderAdapter {
    constructor(config) {
        super(config);
        this.validateConfig();
    }
    async testConnection() {
        const startTime = Date.now();
        try {
            // Test by listing models
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
            const endpoint = this.config.chatEndpoint || "/chat/completions";
            const url = this.buildUrl(endpoint);
            const body = {
                model: this.config.modelName || "gpt-3.5-turbo",
                messages: messages.map((msg) => ({
                    role: msg.role,
                    content: msg.content,
                })),
                temperature: options.temperature ?? 0.7,
                max_tokens: options.max_tokens,
                top_p: options.top_p,
                frequency_penalty: options.frequency_penalty,
                presence_penalty: options.presence_penalty,
                stop: options.stop,
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
                usage: response.usage
                    ? {
                        prompt_tokens: response.usage.prompt_tokens,
                        completion_tokens: response.usage.completion_tokens,
                        total_tokens: response.usage.total_tokens,
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
            const endpoint = this.config.embeddingsEndpoint || "/embeddings";
            const url = this.buildUrl(endpoint);
            const body = {
                model: this.config.embeddingModel || "text-embedding-3-small",
                input: text,
            };
            const response = await this.makeRequest(url, {
                method: "POST",
                headers: this.buildHeaders(),
                body: JSON.stringify(body),
            });
            return response.data[0].embedding;
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    async listModels() {
        try {
            const endpoint = this.config.modelsEndpoint || "/models";
            const url = this.buildUrl(endpoint);
            const response = await this.makeRequest(url, {
                method: "GET",
                headers: this.buildHeaders(),
            });
            // Handle both {data: [...]} and {models: [...]} formats
            const models = response.data || response.models || [];
            return models.map((model) => ({
                id: model.id,
                name: model.id,
                created: model.created,
                owned_by: model.owned_by,
            }));
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
}
//# sourceMappingURL=openai.adapter.js.map