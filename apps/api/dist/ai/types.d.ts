/**
 * AI Provider Types
 * Typy i interfejsy dla systemu zarządzania providerami AI
 */
import { Buffer } from "node:buffer";
import type { Readable } from "node:stream";
/**
 * Funkcje AI obsługiwane przez system
 */
export type AIFunctionType = "llm" | "embeddings" | "vision" | "stt" | "tts";
/**
 * Protokoły API
 */
export type APIProtocol = "openai_compatible" | "anthropic" | "custom";
/**
 * Metody uwierzytelniania
 */
export type AuthMethod = "bearer" | "api-key" | "none" | "custom";
/**
 * Identyfikatory presetów
 */
export type PresetId = "openai" | "ollama" | "custom";
/**
 * Status testu połączenia
 */
export type TestStatus = "success" | "failed" | "pending" | "testing";
/**
 * Konfiguracja pojedynczej funkcji AI (np. LLM, STT)
 */
export interface AIFunctionConfig {
    name: string;
    provider: string;
    apiProtocol: APIProtocol;
    baseUrl: string;
    endpoint: string;
    defaultModel: string;
    authMethod: AuthMethod;
    requiresApiKey: boolean;
}
/**
 * Preset konfiguracji (OpenAI, Ollama, Custom)
 */
export interface ConfigPreset {
    id: PresetId;
    name: string;
    description: string;
    functions: Partial<Record<AIFunctionType, AIFunctionConfig>>;
}
/**
 * Konfiguracja providera z bazy danych
 */
export interface AIProviderConfig {
    id: string;
    configId: string;
    functionType: AIFunctionType;
    provider: string;
    apiProtocol: APIProtocol;
    baseUrl: string;
    endpoint: string | null;
    apiKey: string;
    authMethod: AuthMethod;
    customHeaders: Record<string, string> | null;
    modelName: string;
    timeoutSeconds: number;
    maxRetries: number;
    isEnabled: boolean;
    lastTestAt: string | null;
    lastTestStatus: TestStatus | null;
}
/**
 * Główna konfiguracja AI użytkownika
 */
export interface AIConfiguration {
    id: string;
    userId: string;
    name: string;
    preset: PresetId;
    isDefault: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    providers: AIProviderConfig[];
}
/**
 * Rozwiązana konfiguracja dla wszystkich funkcji AI
 */
export interface ResolvedAIConfig {
    llm: AIProviderConfig | null;
    embeddings: AIProviderConfig | null;
    vision: AIProviderConfig | null;
    stt: AIProviderConfig | null;
    tts: AIProviderConfig | null;
}
/**
 * Wiadomość czatu
 */
export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
    images?: string[];
}
/**
 * Opcje czatu
 */
export interface ChatOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
    stream?: boolean;
}
/**
 * Odpowiedź czatu
 */
export interface ChatResponse {
    content: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason?: string;
}
/**
 * Chunk streamu czatu
 */
export interface ChatStreamChunk {
    content: string;
    done: boolean;
}
/**
 * Opcje transkrypcji
 */
export interface TranscribeOptions {
    language?: string;
    prompt?: string;
    responseFormat?: "json" | "text" | "srt" | "vtt";
    temperature?: number;
}
/**
 * Wynik transkrypcji
 */
export interface TranscribeResult {
    text: string;
    language?: string;
    duration?: number;
    segments?: TranscribeSegment[];
}
/**
 * Segment transkrypcji
 */
export interface TranscribeSegment {
    id: number;
    start: number;
    end: number;
    text: string;
}
/**
 * Opcje TTS
 */
export interface TTSOptions {
    voice?: string;
    speed?: number;
    responseFormat?: "mp3" | "opus" | "aac" | "flac" | "wav";
}
/**
 * Klient LLM
 */
export interface ILLMClient {
    chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
    stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<ChatStreamChunk>;
}
/**
 * Klient Embeddings
 */
export interface IEmbeddingsClient {
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
}
/**
 * Klient Vision
 */
export interface IVisionClient {
    analyze(images: string[], prompt: string, options?: ChatOptions): Promise<ChatResponse>;
}
/**
 * Klient STT (Speech-to-Text)
 */
export interface ISTTClient {
    transcribe(audio: Buffer | Readable, options?: TranscribeOptions): Promise<TranscribeResult>;
}
/**
 * Klient TTS (Text-to-Speech)
 */
export interface ITTSClient {
    synthesize(text: string, options?: TTSOptions): Promise<Buffer>;
}
/**
 * Kody błędów AI
 */
export declare enum AIErrorCode {
    AUTHENTICATION_ERROR = "AUTH_ERROR",
    RATE_LIMIT = "RATE_LIMIT",
    MODEL_NOT_FOUND = "MODEL_NOT_FOUND",
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE",
    INVALID_REQUEST = "INVALID_REQUEST",
    TIMEOUT = "TIMEOUT",
    CONFIGURATION_ERROR = "CONFIG_ERROR",
    UNSUPPORTED_FUNCTION = "UNSUPPORTED_FUNCTION"
}
/**
 * Błąd AI
 */
export declare class AIError extends Error {
    code: AIErrorCode;
    provider: string;
    functionType: AIFunctionType;
    cause?: Error;
    constructor(message: string, code: AIErrorCode, provider: string, functionType: AIFunctionType, cause?: Error);
}
//# sourceMappingURL=types.d.ts.map