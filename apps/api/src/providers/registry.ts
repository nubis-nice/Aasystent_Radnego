import { ProviderType, ProviderConfig } from "@aasystent-radnego/shared";
import { BaseProviderAdapter } from "./base.adapter.js";
import { OpenAIAdapter } from "./openai.adapter.js";
import { LocalModelAdapter } from "./local.adapter.js";

/**
 * Provider Registry
 * Factory for creating provider adapter instances
 * Only supports OpenAI API compatible providers
 */
export class ProviderRegistry {
  private static adapters: Map<
    ProviderType,
    new (config: ProviderConfig) => BaseProviderAdapter
  > = new Map();

  /**
   * Register default adapters - only OpenAI API compatible
   */
  static initialize(): void {
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
  static registerAdapter(
    provider: ProviderType,
    adapterClass: new (config: ProviderConfig) => BaseProviderAdapter
  ): void {
    this.adapters.set(provider, adapterClass);
  }

  /**
   * Get adapter for provider
   */
  static getAdapter(config: ProviderConfig): BaseProviderAdapter {
    const AdapterClass = this.adapters.get(config.provider);

    if (!AdapterClass) {
      throw new Error(`No adapter registered for provider: ${config.provider}`);
    }

    return new AdapterClass(config);
  }

  /**
   * Check if provider is supported
   */
  static isSupported(provider: ProviderType): boolean {
    return this.adapters.has(provider);
  }

  /**
   * Get list of supported providers
   */
  static getSupportedProviders(): ProviderType[] {
    return Array.from(this.adapters.keys());
  }
}

// Initialize registry on module load
ProviderRegistry.initialize();
