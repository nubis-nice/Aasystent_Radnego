import { ProviderConfig, ChatMessage, ProviderChatResponse, ModelInfo, TestResult, ProviderError } from "@aasystent-radnego/shared";
/**
 * Base Provider Adapter
 * Abstract class that all provider adapters must extend
 */
export declare abstract class BaseProviderAdapter {
    protected config: ProviderConfig;
    constructor(config: ProviderConfig);
    /**
     * Test connection to provider
     * @returns Test result with status and timing
     */
    abstract testConnection(): Promise<TestResult>;
    /**
     * Send chat completion request
     * @param messages - Array of chat messages
     * @param options - Additional options (temperature, max_tokens, etc.)
     * @returns Chat response
     */
    abstract chat(messages: ChatMessage[], options?: ChatOptions): Promise<ProviderChatResponse>;
    /**
     * Generate embeddings for text
     * @param text - Text to embed
     * @returns Array of embedding values
     */
    abstract embeddings(text: string): Promise<number[]>;
    /**
     * List available models
     * @returns Array of model information
     */
    abstract listModels(): Promise<ModelInfo[]>;
    /**
     * Build HTTP headers for requests
     * @returns Headers object
     */
    protected buildHeaders(): Record<string, string>;
    /**
     * Build full URL for endpoint
     * @param endpoint - Endpoint path
     * @returns Full URL
     */
    protected buildUrl(endpoint: string): string;
    /**
     * Make HTTP request with retry logic
     * @param url - Request URL
     * @param options - Fetch options
     * @returns Response data
     */
    protected makeRequest<T>(url: string, options: RequestInit): Promise<T>;
    /**
     * Handle and normalize errors
     * @param error - Error object
     * @returns Normalized ProviderError
     */
    protected handleError(error: unknown): ProviderError;
    /**
     * Validate configuration
     * @throws Error if configuration is invalid
     */
    protected validateConfig(): void;
}
/**
 * Chat options
 */
export interface ChatOptions {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string[];
    stream?: boolean;
}
//# sourceMappingURL=base.adapter.d.ts.map