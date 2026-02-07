/**
 * AI Client Factory
 * Fabryka klientów AI - singleton zarządzający wszystkimi klientami
 */
import OpenAI from "openai";
import { AIError } from "./types.js";
import { getConfigResolver } from "./ai-config-resolver.js";
// ═══════════════════════════════════════════════════════════════════════════
// AIClientFactory
// ═══════════════════════════════════════════════════════════════════════════
export class AIClientFactory {
    configResolver;
    clientCache = new Map();
    cacheTTL = 5 * 60 * 1000; // 5 minut
    constructor() {
        this.configResolver = getConfigResolver();
    }
    /**
     * Pobierz klienta OpenAI dla LLM (chat)
     */
    async getLLMClient(userId) {
        return this.getClient(userId, "llm");
    }
    /**
     * Pobierz klienta OpenAI dla Embeddings
     */
    async getEmbeddingsClient(userId) {
        return this.getClient(userId, "embeddings");
    }
    /**
     * Pobierz klienta OpenAI dla Vision
     */
    async getVisionClient(userId) {
        return this.getClient(userId, "vision");
    }
    /**
     * Pobierz klienta OpenAI dla STT (Speech-to-Text)
     */
    async getSTTClient(userId) {
        return this.getClient(userId, "stt");
    }
    /**
     * Pobierz klienta OpenAI dla TTS (Text-to-Speech)
     */
    async getTTSClient(userId) {
        return this.getClient(userId, "tts");
    }
    /**
     * Pobierz konfigurację dla funkcji AI
     */
    async getConfig(userId, functionType) {
        const config = await this.configResolver.resolveFunction(userId, functionType);
        if (!config) {
            throw new AIError(`Brak konfiguracji dla funkcji ${functionType}. Przejdź do ustawień.`, "CONFIG_ERROR", "unknown", functionType);
        }
        return config;
    }
    /**
     * Pobierz pełną rozwiązaną konfigurację
     */
    async getFullConfig(userId) {
        return this.configResolver.resolve(userId);
    }
    /**
     * Wyczyść cache dla użytkownika
     */
    invalidateCache(userId) {
        this.clientCache.delete(userId);
        this.configResolver.invalidateCache(userId);
    }
    /**
     * Wyczyść cały cache
     */
    clearCache() {
        this.clientCache.clear();
        this.configResolver.clearCache();
    }
    /**
     * Pobierz lub utwórz klienta OpenAI dla danej funkcji
     */
    async getClient(userId, functionType) {
        // Sprawdź cache
        const userCache = this.clientCache.get(userId);
        const cached = userCache?.[functionType];
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.client;
        }
        // Pobierz konfigurację
        const config = await this.getConfig(userId, functionType);
        // Utwórz klienta
        const client = this.createClient(config);
        // Zapisz w cache
        if (!userCache) {
            this.clientCache.set(userId, {});
        }
        this.clientCache.get(userId)[functionType] = {
            client,
            config,
            timestamp: Date.now(),
        };
        console.log(`[AIClientFactory] Created ${functionType} client for user ${userId.substring(0, 8)}... ` +
            `provider=${config.provider}, baseUrl=${config.baseUrl}, model=${config.modelName}`);
        return client;
    }
    /**
     * Utwórz klienta OpenAI z konfiguracji
     */
    createClient(config) {
        const options = {
            apiKey: config.apiKey || "dummy-key", // Niektóre lokalne serwery nie wymagają klucza
            baseURL: config.baseUrl,
            timeout: config.timeoutSeconds * 1000,
            maxRetries: config.maxRetries,
        };
        // Dodaj custom headers jeśli są
        if (config.customHeaders) {
            options.defaultHeaders = config.customHeaders;
        }
        return new OpenAI(options);
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// Singleton i eksport
// ═══════════════════════════════════════════════════════════════════════════
let factoryInstance = null;
export function getAIClientFactory() {
    if (!factoryInstance) {
        factoryInstance = new AIClientFactory();
    }
    return factoryInstance;
}
// ═══════════════════════════════════════════════════════════════════════════
// Pomocnicze funkcje (skróty)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Pobierz klienta LLM dla użytkownika
 */
export async function getLLMClient(userId) {
    return getAIClientFactory().getLLMClient(userId);
}
/**
 * Pobierz klienta Embeddings dla użytkownika
 */
export async function getEmbeddingsClient(userId) {
    return getAIClientFactory().getEmbeddingsClient(userId);
}
/**
 * Pobierz klienta Vision dla użytkownika
 */
export async function getVisionClient(userId) {
    return getAIClientFactory().getVisionClient(userId);
}
/**
 * Pobierz klienta STT dla użytkownika
 */
export async function getSTTClient(userId) {
    return getAIClientFactory().getSTTClient(userId);
}
/**
 * Pobierz klienta TTS dla użytkownika
 */
export async function getTTSClient(userId) {
    return getAIClientFactory().getTTSClient(userId);
}
/**
 * Pobierz konfigurację dla funkcji AI
 */
export async function getAIConfig(userId, functionType) {
    return getAIClientFactory().getConfig(userId, functionType);
}
/**
 * Wyczyść cache dla użytkownika
 */
export function invalidateUserCache(userId) {
    getAIClientFactory().invalidateCache(userId);
}
//# sourceMappingURL=ai-client-factory.js.map