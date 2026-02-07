/**
 * AI Config Resolver
 * Pobiera i cache'uje konfigurację AI użytkownika
 */
import type { AIFunctionType, AIProviderConfig, ResolvedAIConfig } from "./types.js";
export declare class AIConfigResolver {
    private supabase;
    private cache;
    private cacheTTL;
    constructor();
    /**
     * Pobierz rozwiązaną konfigurację AI dla użytkownika
     */
    resolve(userId: string): Promise<ResolvedAIConfig>;
    /**
     * Pobierz konfigurację dla konkretnej funkcji AI
     */
    resolveFunction(userId: string, functionType: AIFunctionType): Promise<AIProviderConfig | null>;
    /**
     * Wyczyść cache dla użytkownika
     */
    invalidateCache(userId: string): void;
    /**
     * Wyczyść cały cache
     */
    clearCache(): void;
    /**
     * Pobierz konfigurację z bazy danych
     */
    private fetchFromDatabase;
    /**
     * Fallback do starej tabeli api_configurations
     */
    private fallbackToLegacyConfig;
    /**
     * Konwertuj starą konfigurację na nowy format
     */
    private convertLegacyConfig;
    /**
     * Mapuj providerów z bazy na ResolvedAIConfig
     */
    private mapProvidersToConfig;
    /**
     * Odszyfruj klucz API
     */
    private decryptApiKey;
    /**
     * Dekoduj base64
     */
    private decodeBase64;
    /**
     * Pobierz domyślny base URL dla providera
     */
    private getDefaultBaseUrl;
    /**
     * Pobierz konfigurację z zmiennych środowiskowych (fallback)
     */
    private getEnvFallbackConfig;
    /**
     * Zwróć pustą konfigurację
     */
    private getEmptyConfig;
}
export declare function getConfigResolver(): AIConfigResolver;
//# sourceMappingURL=ai-config-resolver.d.ts.map