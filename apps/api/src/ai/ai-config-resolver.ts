/**
 * AI Config Resolver
 * Pobiera i cache'uje konfigurację AI użytkownika
 */

import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  AIFunctionType,
  AIProviderConfig,
  ResolvedAIConfig,
  PresetId,
} from "./types.js";
import { getPresetFunction } from "./defaults.js";

// ═══════════════════════════════════════════════════════════════════════════
// Typy wewnętrzne
// ═══════════════════════════════════════════════════════════════════════════

interface DBConfiguration {
  id: string;
  user_id: string;
  name: string;
  preset: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DBProvider {
  id: string;
  config_id: string;
  function_type: string;
  provider: string;
  api_protocol: string;
  base_url: string;
  endpoint: string | null;
  api_key_encrypted: string | null;
  encryption_iv: string | null;
  auth_method: string;
  custom_headers: Record<string, string> | null;
  model_name: string;
  timeout_seconds: number;
  max_retries: number;
  is_enabled: boolean;
  last_test_at: string | null;
  last_test_status: string | null;
}

interface CacheEntry {
  config: ResolvedAIConfig;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// AIConfigResolver
// ═══════════════════════════════════════════════════════════════════════════

export class AIConfigResolver {
  private supabase: SupabaseClient;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minut

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Pobierz rozwiązaną konfigurację AI dla użytkownika
   */
  async resolve(userId: string): Promise<ResolvedAIConfig> {
    // Sprawdź cache
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.config;
    }

    // Pobierz z bazy danych
    const config = await this.fetchFromDatabase(userId);

    // Zapisz w cache
    this.cache.set(userId, {
      config,
      timestamp: Date.now(),
    });

    return config;
  }

  /**
   * Pobierz konfigurację dla konkretnej funkcji AI
   */
  async resolveFunction(
    userId: string,
    functionType: AIFunctionType
  ): Promise<AIProviderConfig | null> {
    const config = await this.resolve(userId);
    return config[functionType];
  }

  /**
   * Wyczyść cache dla użytkownika
   */
  invalidateCache(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * Wyczyść cały cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Pobierz konfigurację z bazy danych
   */
  private async fetchFromDatabase(userId: string): Promise<ResolvedAIConfig> {
    // Pobierz domyślną aktywną konfigurację użytkownika
    const { data: configData, error: configError } = await this.supabase
      .from("ai_configurations")
      .select("*")
      .eq("user_id", userId)
      .eq("is_default", true)
      .eq("is_active", true)
      .single();

    // Jeśli nie ma nowej konfiguracji, spróbuj starej tabeli
    if (configError || !configData) {
      return this.fallbackToLegacyConfig(userId);
    }

    const dbConfig = configData as DBConfiguration;

    // Pobierz providerów dla tej konfiguracji
    const { data: providersData, error: providersError } = await this.supabase
      .from("ai_providers")
      .select("*")
      .eq("config_id", dbConfig.id)
      .eq("is_enabled", true);

    if (providersError) {
      console.error(
        "[AIConfigResolver] Error fetching providers:",
        providersError
      );
      return this.getEmptyConfig();
    }

    const providers = (providersData || []) as DBProvider[];

    // Mapuj providerów na ResolvedAIConfig
    return this.mapProvidersToConfig(providers, dbConfig.preset as PresetId);
  }

  /**
   * Fallback do starej tabeli api_configurations
   */
  private async fallbackToLegacyConfig(
    userId: string
  ): Promise<ResolvedAIConfig> {
    const { data: legacyConfig, error } = await this.supabase
      .from("api_configurations")
      .select("*")
      .eq("user_id", userId)
      .eq("is_default", true)
      .eq("is_active", true)
      .single();

    if (error || !legacyConfig) {
      console.log(
        "[AIConfigResolver] No configuration found for user - returning empty config"
      );
      return this.getEmptyConfig();
    }

    // Konwertuj starą konfigurację na nowy format
    return this.convertLegacyConfig(legacyConfig);
  }

  /**
   * Konwertuj starą konfigurację na nowy format
   */
  private convertLegacyConfig(
    legacy: Record<string, unknown>
  ): ResolvedAIConfig {
    const provider = (legacy.provider as string) || "openai";
    const baseUrl =
      (legacy.base_url as string) || this.getDefaultBaseUrl(provider);
    const apiKey = this.decryptApiKey(
      legacy.api_key_encrypted as string,
      legacy.encryption_iv as string | null
    );

    const baseProvider: Omit<AIProviderConfig, "functionType" | "modelName"> = {
      id: legacy.id as string,
      configId: legacy.id as string,
      provider,
      apiProtocol: "openai_compatible",
      baseUrl,
      endpoint: null,
      apiKey,
      authMethod:
        provider === "local" || provider === "ollama" ? "none" : "bearer",
      customHeaders: null,
      timeoutSeconds:
        (legacy.timeout_seconds as number) ||
        (provider === "local" || provider === "ollama" ? 180 : 120),
      maxRetries: (legacy.max_retries as number) || 3,
      isEnabled: true,
      lastTestAt: null,
      lastTestStatus: null,
    };

    // STT może używać osobnego serwera (np. faster-whisper-server)
    // Pobierz z provider_meta lub użyj domyślnego dla local/ollama
    const sttBaseUrl =
      ((legacy.provider_meta as Record<string, unknown>)
        ?.stt_base_url as string) ||
      (provider === "local" || provider === "ollama"
        ? "http://localhost:8001/v1"
        : baseUrl);

    return {
      llm: {
        ...baseProvider,
        functionType: "llm",
        modelName:
          (legacy.model_name as string) ||
          process.env.OPENAI_MODEL ||
          "gpt-4o-mini",
      },
      embeddings: {
        ...baseProvider,
        functionType: "embeddings",
        modelName:
          (legacy.embedding_model as string) || "text-embedding-3-small",
        timeoutSeconds:
          provider === "local" || provider === "ollama" ? 300 : 120, // 5 minut dla lokalnych embeddings
      },
      vision: {
        ...baseProvider,
        functionType: "vision",
        modelName:
          (legacy.vision_model as string) ||
          (legacy.model_name as string) ||
          process.env.OPENAI_VISION_MODEL ||
          "gpt-4o",
      },
      stt: {
        ...baseProvider,
        functionType: "stt",
        baseUrl: sttBaseUrl,
        modelName:
          (legacy.transcription_model as string) ||
          (provider === "local" || provider === "ollama"
            ? "Systran/faster-whisper-large-v3"
            : "whisper-1"),
        timeoutSeconds: 1800, // 30 minut dla bardzo długich plików audio (sesje rady)
      },
      tts: null, // TTS nie było w starej konfiguracji
    };
  }

  /**
   * Mapuj providerów z bazy na ResolvedAIConfig
   */
  private mapProvidersToConfig(
    providers: DBProvider[],
    preset: PresetId
  ): ResolvedAIConfig {
    const config: ResolvedAIConfig = {
      llm: null,
      embeddings: null,
      vision: null,
      stt: null,
      tts: null,
    };

    for (const provider of providers) {
      const functionType = provider.function_type as AIFunctionType;
      const apiKey = this.decryptApiKey(
        provider.api_key_encrypted,
        provider.encryption_iv
      );

      // Użyj domyślnych wartości z presetu jeśli brakuje
      const presetDefaults = getPresetFunction(preset, functionType);

      // Dla Ollama/local zwiększ minimalny timeout do 180s (modele lokalne są wolniejsze)
      let timeoutSeconds = provider.timeout_seconds;
      if (
        (provider.provider === "local" || provider.provider === "ollama") &&
        timeoutSeconds < 120
      ) {
        timeoutSeconds = 180;
      }

      config[functionType] = {
        id: provider.id,
        configId: provider.config_id,
        functionType,
        provider: provider.provider,
        apiProtocol: provider.api_protocol as AIProviderConfig["apiProtocol"],
        baseUrl: provider.base_url || presetDefaults?.baseUrl || "",
        endpoint: provider.endpoint || presetDefaults?.endpoint || null,
        apiKey,
        authMethod: provider.auth_method as AIProviderConfig["authMethod"],
        customHeaders: provider.custom_headers,
        modelName: provider.model_name || presetDefaults?.defaultModel || "",
        timeoutSeconds,
        maxRetries: provider.max_retries,
        isEnabled: provider.is_enabled,
        lastTestAt: provider.last_test_at,
        lastTestStatus:
          provider.last_test_status as AIProviderConfig["lastTestStatus"],
      };
    }

    return config;
  }

  /**
   * Odszyfruj klucz API
   */
  private decryptApiKey(encrypted: string | null, iv: string | null): string {
    if (!encrypted) {
      return "";
    }

    // Jeśli jest IV, użyj AES-256-GCM
    if (iv && iv.trim().length > 0) {
      try {
        const masterKey = process.env.ENCRYPTION_MASTER_KEY;

        if (!masterKey) {
          console.warn(
            "[AIConfigResolver] No ENCRYPTION_MASTER_KEY, falling back to base64"
          );
          return this.decodeBase64(encrypted);
        }

        const combined = Buffer.from(encrypted, "base64");
        const ivBuffer = Buffer.from(iv, "base64");
        const authTag = combined.subarray(combined.length - 16);
        const encryptedData = combined.subarray(0, combined.length - 16);

        const decipher = crypto.createDecipheriv(
          "aes-256-gcm",
          Buffer.from(masterKey, "hex"),
          ivBuffer
        );
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedData, undefined, "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
      } catch (e) {
        console.error("[AIConfigResolver] AES decryption failed:", e);
        return this.decodeBase64(encrypted);
      }
    }

    // Fallback do base64
    return this.decodeBase64(encrypted);
  }

  /**
   * Dekoduj base64
   */
  private decodeBase64(encoded: string): string {
    try {
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      // Obsługa encodeURIComponent
      try {
        return decodeURIComponent(decoded);
      } catch {
        return decoded;
      }
    } catch {
      return encoded;
    }
  }

  /**
   * Pobierz domyślny base URL dla providera
   */
  private getDefaultBaseUrl(provider: string): string {
    switch (provider) {
      case "openai":
        return "https://api.openai.com/v1";
      case "local":
      case "ollama":
        return "http://localhost:11434/v1";
      default:
        return "";
    }
  }

  /**
   * Pobierz konfigurację z zmiennych środowiskowych (fallback)
   */
  private getEnvFallbackConfig(): ResolvedAIConfig {
    const apiKey = process.env.OPENAI_API_KEY || "";
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

    if (!apiKey) {
      console.warn("[AIConfigResolver] No OPENAI_API_KEY in environment");
      return this.getEmptyConfig();
    }

    const baseProvider: Omit<AIProviderConfig, "functionType" | "modelName"> = {
      id: "env-fallback",
      configId: "env-fallback",
      provider: "openai",
      apiProtocol: "openai_compatible",
      baseUrl,
      endpoint: null,
      apiKey,
      authMethod: "bearer",
      customHeaders: null,
      timeoutSeconds: 120,
      maxRetries: 3,
      isEnabled: true,
      lastTestAt: null,
      lastTestStatus: null,
    };

    return {
      llm: {
        ...baseProvider,
        functionType: "llm",
        modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
        timeoutSeconds: 180, // 3 minuty dla LLM (Ollama może być wolna)
      },
      embeddings: {
        ...baseProvider,
        functionType: "embeddings",
        modelName:
          process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
        timeoutSeconds: 300, // 5 minut dla embeddings (batch processing)
      },
      vision: {
        ...baseProvider,
        functionType: "vision",
        modelName: process.env.OPENAI_VISION_MODEL || "gpt-4o",
      },
      stt: {
        ...baseProvider,
        functionType: "stt",
        modelName: "whisper-1",
        timeoutSeconds: 1800, // 30 minut dla bardzo długich plików audio (sesje rady)
      },
      tts: {
        ...baseProvider,
        functionType: "tts",
        modelName: "tts-1",
      },
    };
  }

  /**
   * Zwróć pustą konfigurację
   */
  private getEmptyConfig(): ResolvedAIConfig {
    return {
      llm: null,
      embeddings: null,
      vision: null,
      stt: null,
      tts: null,
    };
  }
}

// Singleton
let resolverInstance: AIConfigResolver | null = null;

export function getConfigResolver(): AIConfigResolver {
  if (!resolverInstance) {
    resolverInstance = new AIConfigResolver();
  }
  return resolverInstance;
}
