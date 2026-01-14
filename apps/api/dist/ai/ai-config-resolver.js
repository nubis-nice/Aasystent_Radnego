/**
 * AI Config Resolver
 * Pobiera i cache'uje konfigurację AI użytkownika
 */
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getPresetFunction } from "./defaults.js";
// ═══════════════════════════════════════════════════════════════════════════
// AIConfigResolver
// ═══════════════════════════════════════════════════════════════════════════
export class AIConfigResolver {
    supabase;
    cache = new Map();
    cacheTTL = 5 * 60 * 1000; // 5 minut
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
    async resolve(userId) {
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
    async resolveFunction(userId, functionType) {
        const config = await this.resolve(userId);
        return config[functionType];
    }
    /**
     * Wyczyść cache dla użytkownika
     */
    invalidateCache(userId) {
        this.cache.delete(userId);
    }
    /**
     * Wyczyść cały cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Pobierz konfigurację z bazy danych
     */
    async fetchFromDatabase(userId) {
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
        const dbConfig = configData;
        // Pobierz providerów dla tej konfiguracji
        const { data: providersData, error: providersError } = await this.supabase
            .from("ai_providers")
            .select("*")
            .eq("config_id", dbConfig.id)
            .eq("is_enabled", true);
        if (providersError) {
            console.error("[AIConfigResolver] Error fetching providers:", providersError);
            return this.getEmptyConfig();
        }
        const providers = (providersData || []);
        // Mapuj providerów na ResolvedAIConfig
        return this.mapProvidersToConfig(providers, dbConfig.preset);
    }
    /**
     * Fallback do starej tabeli api_configurations
     */
    async fallbackToLegacyConfig(userId) {
        const { data: legacyConfig, error } = await this.supabase
            .from("api_configurations")
            .select("*")
            .eq("user_id", userId)
            .eq("is_default", true)
            .eq("is_active", true)
            .single();
        if (error || !legacyConfig) {
            console.log("[AIConfigResolver] No configuration found for user - returning empty config");
            return this.getEmptyConfig();
        }
        // Konwertuj starą konfigurację na nowy format
        return this.convertLegacyConfig(legacyConfig);
    }
    /**
     * Konwertuj starą konfigurację na nowy format
     */
    convertLegacyConfig(legacy) {
        const provider = legacy.provider || "openai";
        const baseUrl = legacy.base_url || this.getDefaultBaseUrl(provider);
        const apiKey = this.decryptApiKey(legacy.api_key_encrypted, legacy.encryption_iv);
        const baseProvider = {
            id: legacy.id,
            configId: legacy.id,
            provider,
            apiProtocol: "openai_compatible",
            baseUrl,
            endpoint: null,
            apiKey,
            authMethod: provider === "local" || provider === "ollama" ? "none" : "bearer",
            customHeaders: null,
            timeoutSeconds: legacy.timeout_seconds ||
                (provider === "local" || provider === "ollama" ? 180 : 120),
            maxRetries: legacy.max_retries || 3,
            isEnabled: true,
            lastTestAt: null,
            lastTestStatus: null,
        };
        // STT może używać osobnego serwera (np. faster-whisper-server)
        // Pobierz z provider_meta lub użyj domyślnego dla local/ollama
        const sttBaseUrl = legacy.provider_meta
            ?.stt_base_url ||
            (provider === "local" || provider === "ollama"
                ? "http://localhost:8000/v1"
                : baseUrl);
        return {
            llm: {
                ...baseProvider,
                functionType: "llm",
                modelName: legacy.model_name ||
                    process.env.OPENAI_MODEL ||
                    "gpt-4o-mini",
            },
            embeddings: {
                ...baseProvider,
                functionType: "embeddings",
                modelName: legacy.embedding_model || "text-embedding-3-small",
                timeoutSeconds: provider === "local" || provider === "ollama" ? 300 : 120, // 5 minut dla lokalnych embeddings
            },
            vision: {
                ...baseProvider,
                functionType: "vision",
                modelName: legacy.vision_model ||
                    legacy.model_name ||
                    process.env.OPENAI_VISION_MODEL ||
                    "gpt-4o",
            },
            stt: {
                ...baseProvider,
                functionType: "stt",
                baseUrl: sttBaseUrl,
                modelName: legacy.transcription_model ||
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
    mapProvidersToConfig(providers, preset) {
        const config = {
            llm: null,
            embeddings: null,
            vision: null,
            stt: null,
            tts: null,
        };
        for (const provider of providers) {
            const functionType = provider.function_type;
            const apiKey = this.decryptApiKey(provider.api_key_encrypted, provider.encryption_iv);
            // Użyj domyślnych wartości z presetu jeśli brakuje
            const presetDefaults = getPresetFunction(preset, functionType);
            // Dla Ollama/local zwiększ minimalny timeout do 180s (modele lokalne są wolniejsze)
            let timeoutSeconds = provider.timeout_seconds;
            if ((provider.provider === "local" || provider.provider === "ollama") &&
                timeoutSeconds < 120) {
                timeoutSeconds = 180;
            }
            config[functionType] = {
                id: provider.id,
                configId: provider.config_id,
                functionType,
                provider: provider.provider,
                apiProtocol: provider.api_protocol,
                baseUrl: provider.base_url || presetDefaults?.baseUrl || "",
                endpoint: provider.endpoint || presetDefaults?.endpoint || null,
                apiKey,
                authMethod: provider.auth_method,
                customHeaders: provider.custom_headers,
                modelName: provider.model_name || presetDefaults?.defaultModel || "",
                timeoutSeconds,
                maxRetries: provider.max_retries,
                isEnabled: provider.is_enabled,
                lastTestAt: provider.last_test_at,
                lastTestStatus: provider.last_test_status,
            };
        }
        return config;
    }
    /**
     * Odszyfruj klucz API
     */
    decryptApiKey(encrypted, iv) {
        if (!encrypted) {
            return "";
        }
        // Jeśli jest IV, użyj AES-256-GCM
        if (iv && iv.trim().length > 0) {
            try {
                const masterKey = process.env.ENCRYPTION_MASTER_KEY;
                if (!masterKey) {
                    console.warn("[AIConfigResolver] No ENCRYPTION_MASTER_KEY, falling back to base64");
                    return this.decodeBase64(encrypted);
                }
                const combined = Buffer.from(encrypted, "base64");
                const ivBuffer = Buffer.from(iv, "base64");
                const authTag = combined.subarray(combined.length - 16);
                const encryptedData = combined.subarray(0, combined.length - 16);
                const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(masterKey, "hex"), ivBuffer);
                decipher.setAuthTag(authTag);
                let decrypted = decipher.update(encryptedData, undefined, "utf8");
                decrypted += decipher.final("utf8");
                return decrypted;
            }
            catch (e) {
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
    decodeBase64(encoded) {
        try {
            const decoded = Buffer.from(encoded, "base64").toString("utf-8");
            // Obsługa encodeURIComponent
            try {
                return decodeURIComponent(decoded);
            }
            catch {
                return decoded;
            }
        }
        catch {
            return encoded;
        }
    }
    /**
     * Pobierz domyślny base URL dla providera
     */
    getDefaultBaseUrl(provider) {
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
    getEnvFallbackConfig() {
        const apiKey = process.env.OPENAI_API_KEY || "";
        const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
        if (!apiKey) {
            console.warn("[AIConfigResolver] No OPENAI_API_KEY in environment");
            return this.getEmptyConfig();
        }
        const baseProvider = {
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
                modelName: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
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
    getEmptyConfig() {
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
let resolverInstance = null;
export function getConfigResolver() {
    if (!resolverInstance) {
        resolverInstance = new AIConfigResolver();
    }
    return resolverInstance;
}
//# sourceMappingURL=ai-config-resolver.js.map