import { OpenAIAdapter } from "./openai.adapter.js";
import { LocalModelAdapter } from "./local.adapter.js";
/**
 * Provider Registry
 * Factory for creating provider adapter instances
 * Only supports OpenAI API compatible providers
 */
export class ProviderRegistry {
    static adapters = new Map();
    /**
     * Register default adapters - only OpenAI API compatible
     */
    static initialize() {
        // OpenAI official API
        this.registerAdapter("openai", OpenAIAdapter);
        // Local models (Ollama, LM Studio, vLLM, etc.)
        this.registerAdapter("local", LocalModelAdapter);
        // Any other OpenAI API compatible endpoint
        this.registerAdapter("other", OpenAIAdapter);
    }
    /**
     * Register a new adapter
     */
    static registerAdapter(provider, adapterClass) {
        this.adapters.set(provider, adapterClass);
    }
    /**
     * Get adapter for provider
     */
    static getAdapter(config) {
        const AdapterClass = this.adapters.get(config.provider);
        if (!AdapterClass) {
            throw new Error(`No adapter registered for provider: ${config.provider}`);
        }
        return new AdapterClass(config);
    }
    /**
     * Check if provider is supported
     */
    static isSupported(provider) {
        return this.adapters.has(provider);
    }
    /**
     * Get list of supported providers
     */
    static getSupportedProviders() {
        return Array.from(this.adapters.keys());
    }
}
// Initialize registry on module load
ProviderRegistry.initialize();
//# sourceMappingURL=registry.js.map