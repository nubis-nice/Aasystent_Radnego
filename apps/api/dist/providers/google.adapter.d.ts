import { ProviderConfig, ChatMessage, ProviderChatResponse, ModelInfo, TestResult } from "@aasystent-radnego/shared";
import { BaseProviderAdapter, ChatOptions } from "./base.adapter.js";
/**
 * Google Gemini Provider Adapter
 * Supports both native API and OpenAI-compatible endpoint
 */
export declare class GoogleGeminiAdapter extends BaseProviderAdapter {
    private useOpenAICompatible;
    constructor(config: ProviderConfig);
    protected buildHeaders(): Record<string, string>;
    testConnection(): Promise<TestResult>;
    chat(messages: ChatMessage[], options?: ChatOptions): Promise<ProviderChatResponse>;
    private chatOpenAI;
    private chatNative;
    embeddings(text: string): Promise<number[]>;
    private embeddingsOpenAI;
    private embeddingsNative;
    listModels(): Promise<ModelInfo[]>;
}
//# sourceMappingURL=google.adapter.d.ts.map