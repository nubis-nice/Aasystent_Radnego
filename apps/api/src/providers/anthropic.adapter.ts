import {
  ProviderConfig,
  ChatMessage,
  ProviderChatResponse,
  ModelInfo,
  TestResult,
} from "@aasystent-radnego/shared";
import { BaseProviderAdapter, ChatOptions } from "./base.adapter.js";

/**
 * Anthropic Claude Provider Adapter
 */
export class AnthropicAdapter extends BaseProviderAdapter {
  constructor(config: ProviderConfig) {
    super(config);
    this.validateConfig();
  }

  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.config.apiKey,
      "anthropic-version": "2023-06-01",
      ...this.config.customHeaders,
    };
  }

  async testConnection(): Promise<TestResult> {
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
    } catch (error) {
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

  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {}
  ): Promise<ProviderChatResponse> {
    try {
      const endpoint = this.config.chatEndpoint || "/messages";
      const url = this.buildUrl(endpoint);

      // Extract system message
      const systemMessage = messages.find((msg) => msg.role === "system");
      const conversationMessages = messages.filter(
        (msg) => msg.role !== "system"
      );

      const body: Record<string, unknown> = {
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

      const response = await this.makeRequest<AnthropicChatResponse>(url, {
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
          total_tokens:
            response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async embeddings(_text: string): Promise<number[]> {
    throw new Error("Anthropic does not support embeddings API");
  }

  async listModels(): Promise<ModelInfo[]> {
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

interface AnthropicChatResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
