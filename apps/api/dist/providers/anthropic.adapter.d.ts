import { ProviderConfig, ChatMessage, ProviderChatResponse, ModelInfo, TestResult } from "@aasystent-radnego/shared";
import { BaseProviderAdapter, ChatOptions } from "./base.adapter.js";
/**
 * Anthropic Claude Provider Adapter
 */
export declare class AnthropicAdapter extends BaseProviderAdapter {
    constructor(config: ProviderConfig);
    protected buildHeaders(): Record<string, string>;
    testConnection(): Promise<TestResult>;
    chat(messages: ChatMessage[], options?: ChatOptions): Promise<ProviderChatResponse>;
    embeddings(_text: string): Promise<number[]>;
    listModels(): Promise<ModelInfo[]>;
}
//# sourceMappingURL=anthropic.adapter.d.ts.map