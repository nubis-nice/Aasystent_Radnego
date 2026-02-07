/**
 * AI Client Factory
 * Fabryka klientów AI - singleton zarządzający wszystkimi klientami
 */
import OpenAI from "openai";
import type { AIFunctionType, AIProviderConfig, ResolvedAIConfig } from "./types.js";
export declare class AIClientFactory {
    private configResolver;
    private clientCache;
    private cacheTTL;
    constructor();
    /**
     * Pobierz klienta OpenAI dla LLM (chat)
     */
    getLLMClient(userId: string): Promise<OpenAI>;
    /**
     * Pobierz klienta OpenAI dla Embeddings
     */
    getEmbeddingsClient(userId: string): Promise<OpenAI>;
    /**
     * Pobierz klienta OpenAI dla Vision
     */
    getVisionClient(userId: string): Promise<OpenAI>;
    /**
     * Pobierz klienta OpenAI dla STT (Speech-to-Text)
     */
    getSTTClient(userId: string): Promise<OpenAI>;
    /**
     * Pobierz klienta OpenAI dla TTS (Text-to-Speech)
     */
    getTTSClient(userId: string): Promise<OpenAI>;
    /**
     * Pobierz konfigurację dla funkcji AI
     */
    getConfig(userId: string, functionType: AIFunctionType): Promise<AIProviderConfig>;
    /**
     * Pobierz pełną rozwiązaną konfigurację
     */
    getFullConfig(userId: string): Promise<ResolvedAIConfig>;
    /**
     * Wyczyść cache dla użytkownika
     */
    invalidateCache(userId: string): void;
    /**
     * Wyczyść cały cache
     */
    clearCache(): void;
    /**
     * Pobierz lub utwórz klienta OpenAI dla danej funkcji
     */
    private getClient;
    /**
     * Utwórz klienta OpenAI z konfiguracji
     */
    private createClient;
}
export declare function getAIClientFactory(): AIClientFactory;
/**
 * Pobierz klienta LLM dla użytkownika
 */
export declare function getLLMClient(userId: string): Promise<OpenAI>;
/**
 * Pobierz klienta Embeddings dla użytkownika
 */
export declare function getEmbeddingsClient(userId: string): Promise<OpenAI>;
/**
 * Pobierz klienta Vision dla użytkownika
 */
export declare function getVisionClient(userId: string): Promise<OpenAI>;
/**
 * Pobierz klienta STT dla użytkownika
 */
export declare function getSTTClient(userId: string): Promise<OpenAI>;
/**
 * Pobierz klienta TTS dla użytkownika
 */
export declare function getTTSClient(userId: string): Promise<OpenAI>;
/**
 * Pobierz konfigurację dla funkcji AI
 */
export declare function getAIConfig(userId: string, functionType: AIFunctionType): Promise<AIProviderConfig>;
/**
 * Wyczyść cache dla użytkownika
 */
export declare function invalidateUserCache(userId: string): void;
//# sourceMappingURL=ai-client-factory.d.ts.map