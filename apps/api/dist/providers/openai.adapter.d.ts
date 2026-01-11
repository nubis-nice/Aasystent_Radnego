import { ProviderConfig, ChatMessage, ProviderChatResponse, ModelInfo, TestResult } from "@aasystent-radnego/shared";
import { BaseProviderAdapter, ChatOptions } from "./base.adapter.js";
/**
 * OpenAI Provider Adapter
 * Supports: OpenAI, Azure OpenAI, and OpenAI-compatible APIs
 */
export declare class OpenAIAdapter extends BaseProviderAdapter {
    constructor(config: ProviderConfig);
    testConnection(): Promise<TestResult>;
    chat(messages: ChatMessage[], options?: ChatOptions): Promise<ProviderChatResponse>;
    embeddings(text: string): Promise<number[]>;
    listModels(): Promise<ModelInfo[]>;
}
//# sourceMappingURL=openai.adapter.d.ts.map