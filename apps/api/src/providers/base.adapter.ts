import {
  ProviderConfig,
  ChatMessage,
  ProviderChatResponse,
  ModelInfo,
  TestResult,
  ProviderError,
} from "@aasystent-radnego/shared";

/**
 * Base Provider Adapter
 * Abstract class that all provider adapters must extend
 */
export abstract class BaseProviderAdapter {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Test connection to provider
   * @returns Test result with status and timing
   */
  abstract testConnection(): Promise<TestResult>;

  /**
   * Send chat completion request
   * @param messages - Array of chat messages
   * @param options - Additional options (temperature, max_tokens, etc.)
   * @returns Chat response
   */
  abstract chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ProviderChatResponse>;

  /**
   * Generate embeddings for text
   * @param text - Text to embed
   * @returns Array of embedding values
   */
  abstract embeddings(text: string): Promise<number[]>;

  /**
   * List available models
   * @returns Array of model information
   */
  abstract listModels(): Promise<ModelInfo[]>;

  /**
   * Build HTTP headers for requests
   * @returns Headers object
   */
  protected buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add authentication based on method
    switch (this.config.authMethod) {
      case "bearer":
        headers["Authorization"] = `Bearer ${this.config.apiKey}`;
        break;
      case "api-key":
        headers["x-api-key"] = this.config.apiKey;
        break;
      case "custom":
        // Custom headers from config
        break;
    }

    // Add custom headers
    if (this.config.customHeaders) {
      Object.assign(headers, this.config.customHeaders);
    }

    return headers;
  }

  /**
   * Build full URL for endpoint
   * @param endpoint - Endpoint path
   * @returns Full URL
   */
  protected buildUrl(endpoint: string): string {
    const baseUrl = this.config.baseUrl.replace(/\/$/, "");
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${baseUrl}${path}`;
  }

  /**
   * Make HTTP request with retry logic
   * @param url - Request URL
   * @param options - Fetch options
   * @returns Response data
   */
  protected async makeRequest<T>(
    url: string,
    options: RequestInit,
  ): Promise<T> {
    const maxRetries = this.config.maxRetries || 3;
    const timeout = (this.config.timeoutSeconds || 30) * 1000;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }

          throw new ProviderError(
            errorData.message || `HTTP ${response.status}`,
            "HTTP_ERROR",
            response.status,
            errorText,
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on authentication errors
        if (
          error instanceof ProviderError &&
          (error.status === 401 || error.status === 403)
        ) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000),
          );
        }
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  /**
   * Handle and normalize errors
   * @param error - Error object
   * @returns Normalized ProviderError
   */
  protected handleError(error: unknown): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return new ProviderError(
          "Request timeout",
          "TIMEOUT",
          undefined,
          error.message,
        );
      }

      return new ProviderError(
        error.message,
        "UNKNOWN_ERROR",
        undefined,
        error.stack,
      );
    }

    return new ProviderError(
      "Unknown error occurred",
      "UNKNOWN_ERROR",
      undefined,
      String(error),
    );
  }

  /**
   * Validate configuration
   * @throws Error if configuration is invalid
   */
  protected validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error("API key is required");
    }

    if (!this.config.baseUrl) {
      throw new Error("Base URL is required");
    }

    try {
      new URL(this.config.baseUrl);
    } catch {
      throw new Error("Invalid base URL format");
    }
  }
}

/**
 * Chat options
 */
export interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
}
