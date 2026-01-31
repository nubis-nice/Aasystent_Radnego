/**
 * API Key Resolver - Pobiera klucze API z bazy danych
 *
 * Obsługuje pobieranie kluczy dla zewnętrznych serwisów:
 * - GUS (Bank Danych Lokalnych)
 * - Geoportal
 * - ISAP
 * - i innych
 */
export interface ResolvedApiConfig {
    apiKey: string;
    baseUrl: string;
    isActive: boolean;
}
/**
 * Pobiera klucz API dla danego providera z bazy danych
 */
export declare function getApiKeyForProvider(userId: string, provider: string): Promise<ResolvedApiConfig | null>;
/**
 * Pobiera klucz GUS API
 */
export declare function getGUSApiKey(userId: string): Promise<string | null>;
/**
 * Pobiera wszystkie aktywne konfiguracje API dla użytkownika
 */
export declare function getAllActiveApiConfigs(userId: string): Promise<Map<string, ResolvedApiConfig>>;
//# sourceMappingURL=api-key-resolver.d.ts.map