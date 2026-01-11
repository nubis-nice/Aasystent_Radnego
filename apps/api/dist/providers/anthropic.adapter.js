import { BaseProviderAdapter } from "./base.adapter.js";
/**
 * Anthropic Claude Provider Adapter
 */
export class AnthropicAdapter extends BaseProviderAdapter {
    constructor(config) {
        super(config);
        this.validateConfig();
    }
    buildHeaders() {
        return {
            "Content-Type": "application/json",
            "x-api-key": this.config.apiKey,
            "anthropic-version": "2023-06-01",
            ...this.config.customHeaders,
        };
    }
    async testConnection() {
        const startTime = Date.now();
        try {
            // Test with a simple message
            await this.chat([{ role: "user", content: "Hi" }], { max_tokens: 10 });
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
            const endpoint = this.config.chatEndpoint || "/messages";
            const url = this.buildUrl(endpoint);
            // Extract system message
            const systemMessage = messages.find((msg) => msg.role === "system");
            const conversationMessages = messages.filter((msg) => msg.role !== "system");
            const body = {
                model: this.config.modelName || "claude-3-5-sonnet-20241022",
                messages: conversationMessages.map((msg) => ({
                    role: msg.role,
                    content: msg.content,
                })),
                max_tokens: options.max_tokens || 4096,
                temperature: options.temperature ?? 0.7,
                top_p: options.top_p,
                stream: false,
            };
            if (systemMessage) {
                body.system = systemMessage.content;
            }
            const response = await this.makeRequest(url, {
                method: "POST",
                headers: this.buildHeaders(),
                body: JSON.stringify(body),
            });
            return {
                content: response.content[0].text,
                model: response.model,
                usage: {
                    prompt_tokens: response.usage.input_tokens,
                    completion_tokens: response.usage.output_tokens,
                    total_tokens: response.usage.input_tokens + response.usage.output_tokens,
                },
            };
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    async embeddings(_text) {
        throw new Error("Anthropic does not support embeddings API");
    }
    async listModels() {
        // Anthropic doesn't have a models endpoint, return known models
        return [
            {
                id: "claude-3-5-sonnet-20241022",
                name: "Claude 3.5 Sonnet",
                owned_by: "anthropic",
            },
            {
                id: "claude-3-opus-20240229",
                name: "Claude 3 Opus",
                owned_by: "anthropic",
            },
            {
                id: "claude-3-sonnet-20240229",
                name: "Claude 3 Sonnet",
                owned_by: "anthropic",
            },
            {
                id: "claude-3-haiku-20240307",
                name: "Claude 3 Haiku",
                owned_by: "anthropic",
            },
        ];
    }
}
//# sourceMappingURL=anthropic.adapter.js.map