import { ProviderConfig, ChatMessage, ProviderChatResponse, ModelInfo, TestResult } from "@aasystent-radnego/shared";
import { BaseProviderAdapter, ChatOptions } from "./base.adapter.js";
/**
 * Local Model Provider Adapter
 * Supports: Ollama, LM Studio, LocalAI, etc.
 */
export declare class LocalModelAdapter extends BaseProviderAdapter {
    constructor(config: ProviderConfig);
    protected buildHeaders(): Record<string, string>;
    testConnection(): Promise<TestResult>;
    chat(messages: ChatMessage[], options?: ChatOptions): Promise<ProviderChatResponse>;
    embeddings(text: string): Promise<number[]>;
    listModels(): Promise<ModelInfo[]>;
}
//# sourceMappingURL=local.adapter.d.ts.map