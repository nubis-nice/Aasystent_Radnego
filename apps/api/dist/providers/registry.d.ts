import { ProviderType, ProviderConfig } from "@aasystent-radnego/shared";
import { BaseProviderAdapter } from "./base.adapter.js";
/**
 * Provider Registry
 * Factory for creating provider adapter instances
 * Only supports OpenAI API compatible providers
 */
export declare class ProviderRegistry {
    private static adapters;
    /**
     * Register default adapters - only OpenAI API compatible
     */
    static initialize(): void;
    /**
     * Register a new adapter
     */
    static registerAdapter(provider: ProviderType, adapterClass: new (config: ProviderConfig) => BaseProviderAdapter): void;
    /**
     * Get adapter for provider
     */
    static getAdapter(config: ProviderConfig): BaseProviderAdapter;
    /**
     * Check if provider is supported
     */
    static isSupported(provider: ProviderType): boolean;
    /**
     * Get list of supported providers
     */
    static getSupportedProviders(): ProviderType[];
}
//# sourceMappingURL=registry.d.ts.map