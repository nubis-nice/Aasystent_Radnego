/**
 * AI Client Factory
 * Fabryka klientów AI - singleton zarządzający wszystkimi klientami
 */

import OpenAI from "openai";
import type {
  AIFunctionType,
  AIProviderConfig,
  ResolvedAIConfig,
  AIErrorCode,
} from "./types.js";
import { AIError } from "./types.js";
import { getConfigResolver, AIConfigResolver } from "./ai-config-resolver.js";

// ═══════════════════════════════════════════════════════════════════════════
// Typy
// ═══════════════════════════════════════════════════════════════════════════

interface CachedClient {
  client: OpenAI;
  config: AIProviderConfig;
  timestamp: number;
}

interface ClientCache {
  llm?: CachedClient;
  embeddings?: CachedClient;
  vision?: CachedClient;
  stt?: CachedClient;
  tts?: CachedClient;
}

// ═══════════════════════════════════════════════════════════════════════════
// AIClientFactory
// ═══════════════════════════════════════════════════════════════════════════

export class AIClientFactory {
  private configResolver: AIConfigResolver;
  private clientCache: Map<string, ClientCache> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minut

  constructor() {
    this.configResolver = getConfigResolver();
  }

  /**
   * Pobierz klienta OpenAI dla LLM (chat)
   */
  async getLLMClient(userId: string): Promise<OpenAI> {
    return this.getClient(userId, "llm");
  }

  /**
   * Pobierz klienta OpenAI dla Embeddings
   */
  async getEmbeddingsClient(userId: string): Promise<OpenAI> {
    return this.getClient(userId, "embeddings");
  }

  /**
   * Pobierz klienta OpenAI dla Vision
   */
  async getVisionClient(userId: string): Promise<OpenAI> {
    return this.getClient(userId, "vision");
  }

  /**
   * Pobierz klienta OpenAI dla STT (Speech-to-Text)
   */
  async getSTTClient(userId: string): Promise<OpenAI> {
    return this.getClient(userId, "stt");
  }

  /**
   * Pobierz klienta OpenAI dla TTS (Text-to-Speech)
   */
  async getTTSClient(userId: string): Promise<OpenAI> {
    return this.getClient(userId, "tts");
  }

  /**
   * Pobierz konfigurację dla funkcji AI
   */
  async getConfig(
    userId: string,
    functionType: AIFunctionType
  ): Promise<AIProviderConfig> {
    const config = await this.configResolver.resolveFunction(
      userId,
      functionType
    );

    if (!config) {
      throw new AIError(
        `Brak konfiguracji dla funkcji ${functionType}. Przejdź do ustawień.`,
        "CONFIG_ERROR" as AIErrorCode,
        "unknown",
        functionType
      );
    }

    return config;
  }

  /**
   * Pobierz pełną rozwiązaną konfigurację
   */
  async getFullConfig(userId: string): Promise<ResolvedAIConfig> {
    return this.configResolver.resolve(userId);
  }

  /**
   * Wyczyść cache dla użytkownika
   */
  invalidateCache(userId: string): void {
    this.clientCache.delete(userId);
    this.configResolver.invalidateCache(userId);
  }

  /**
   * Wyczyść cały cache
   */
  clearCache(): void {
    this.clientCache.clear();
    this.configResolver.clearCache();
  }

  /**
   * Pobierz lub utwórz klienta OpenAI dla danej funkcji
   */
  private async getClient(
    userId: string,
    functionType: AIFunctionType
  ): Promise<OpenAI> {
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

    this.clientCache.get(userId)![functionType] = {
      client,
      config,
      timestamp: Date.now(),
    };

    console.log(
      `[AIClientFactory] Created ${functionType} client for user ${userId.substring(
        0,
        8
      )}... ` +
        `provider=${config.provider}, baseUrl=${config.baseUrl}, model=${config.modelName}`
    );

    return client;
  }

  /**
   * Utwórz klienta OpenAI z konfiguracji
   */
  private createClient(config: AIProviderConfig): OpenAI {
    const options: ConstructorParameters<typeof OpenAI>[0] = {
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

let factoryInstance: AIClientFactory | null = null;

export function getAIClientFactory(): AIClientFactory {
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
export async function getLLMClient(userId: string): Promise<OpenAI> {
  return getAIClientFactory().getLLMClient(userId);
}

/**
 * Pobierz klienta Embeddings dla użytkownika
 */
export async function getEmbeddingsClient(userId: string): Promise<OpenAI> {
  return getAIClientFactory().getEmbeddingsClient(userId);
}

/**
 * Pobierz klienta Vision dla użytkownika
 */
export async function getVisionClient(userId: string): Promise<OpenAI> {
  return getAIClientFactory().getVisionClient(userId);
}

/**
 * Pobierz klienta STT dla użytkownika
 */
export async function getSTTClient(userId: string): Promise<OpenAI> {
  return getAIClientFactory().getSTTClient(userId);
}

/**
 * Pobierz klienta TTS dla użytkownika
 */
export async function getTTSClient(userId: string): Promise<OpenAI> {
  return getAIClientFactory().getTTSClient(userId);
}

/**
 * Pobierz konfigurację dla funkcji AI
 */
export async function getAIConfig(
  userId: string,
  functionType: AIFunctionType
): Promise<AIProviderConfig> {
  return getAIClientFactory().getConfig(userId, functionType);
}

/**
 * Wyczyść cache dla użytkownika
 */
export function invalidateUserCache(userId: string): void {
  getAIClientFactory().invalidateCache(userId);
}
