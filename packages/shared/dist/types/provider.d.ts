/**
 * Provider Types
 * Shared types for LLM provider management
 */
/**
 * Supported providers
 * - openai: Official OpenAI API
 * - local: Local models (Ollama, LM Studio, vLLM, etc.)
 * - azure: Azure OpenAI
 * - anthropic: Claude API
 * - other: Any OpenAI API compatible endpoint
 * - exa/perplexity/tavily: Semantic search providers
 */
export type ProviderType = "openai" | "local" | "azure" | "anthropic" | "other" | "exa" | "perplexity" | "tavily";
export type AuthMethod = "bearer" | "api-key" | "oauth" | "custom";
export type ConnectionStatus = "untested" | "working" | "failed" | "testing";
export type TestType = "connection" | "chat" | "embeddings" | "models" | "full";
export type TestStatus = "success" | "failed" | "timeout" | "error";
/**
 * Provider capabilities
 */
export interface ProviderCapability {
    provider: ProviderType;
    supports_chat: boolean;
    supports_embeddings: boolean;
    supports_streaming: boolean;
    supports_function_calling: boolean;
    supports_vision: boolean;
    auth_methods: AuthMethod[];
    default_base_url: string | null;
    default_chat_endpoint: string | null;
    default_embeddings_endpoint: string | null;
    default_models_endpoint: string | null;
    rate_limit_rpm: number | null;
    rate_limit_tpm: number | null;
    documentation_url: string | null;
    created_at: string;
    updated_at: string;
}
/**
 * API Configuration (extended)
 */
export interface ApiConfiguration {
    id: string;
    user_id: string;
    provider: ProviderType;
    provider_version: string | null;
    name: string;
    api_key_encrypted: string;
    encryption_iv: string | null;
    base_url: string | null;
    chat_endpoint: string | null;
    embeddings_endpoint: string | null;
    models_endpoint: string | null;
    model_name: string | null;
    embedding_model: string | null;
    transcription_model: string | null;
    auth_method: AuthMethod;
    custom_headers: Record<string, string> | null;
    timeout_seconds: number;
    max_retries: number;
    is_active: boolean;
    is_default: boolean;
    connection_status: ConnectionStatus;
    last_test_at: string | null;
    last_test_result: TestResult | null;
    last_used_at: string | null;
    created_at: string;
    updated_at: string;
}
/**
 * API Configuration Input (for creating/updating)
 */
export interface ApiConfigurationInput {
    provider: ProviderType;
    provider_version?: string;
    name: string;
    api_key: string;
    base_url?: string;
    chat_endpoint?: string;
    embeddings_endpoint?: string;
    models_endpoint?: string;
    model_name?: string;
    embedding_model?: string;
    transcription_model?: string;
    auth_method?: AuthMethod;
    custom_headers?: Record<string, string>;
    timeout_seconds?: number;
    max_retries?: number;
    is_active?: boolean;
    is_default?: boolean;
}
/**
 * Test result
 */
export interface TestResult {
    test_type: TestType;
    status: TestStatus;
    response_time_ms: number | null;
    error_message: string | null;
    error_details: {
        code?: string;
        status?: number;
        provider_error?: string;
        stack?: string;
    } | null;
    tested_at: string;
}
/**
 * Test history entry
 */
export interface TestHistoryEntry {
    id: string;
    config_id: string;
    test_type: TestType;
    status: TestStatus;
    response_time_ms: number | null;
    error_message: string | null;
    error_details: Record<string, unknown> | null;
    tested_at: string;
}
/**
 * Provider configuration for adapters
 */
export interface ProviderConfig {
    provider: ProviderType;
    apiKey: string;
    baseUrl: string;
    chatEndpoint?: string;
    embeddingsEndpoint?: string;
    modelsEndpoint?: string;
    modelName?: string;
    embeddingModel?: string;
    transcriptionModel?: string;
    authMethod: AuthMethod;
    customHeaders?: Record<string, string>;
    timeoutSeconds: number;
    maxRetries: number;
}
/**
 * Chat message
 */
export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
/**
 * Provider chat response
 */
export interface ProviderChatResponse {
    content: string;
    model: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
/**
 * Model info
 */
export interface ModelInfo {
    id: string;
    name: string;
    created?: number;
    owned_by?: string;
}
/**
 * Provider error
 */
export declare class ProviderError extends Error {
    code: string;
    status?: number | undefined;
    providerError?: string | undefined;
    constructor(message: string, code: string, status?: number | undefined, providerError?: string | undefined);
}
//# sourceMappingURL=provider.d.ts.map