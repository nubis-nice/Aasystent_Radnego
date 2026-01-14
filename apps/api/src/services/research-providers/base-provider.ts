/**
 * Base Research Provider
 * Agent AI "Winsdurf" - Deep Internet Researcher
 */

import type {
  ResearchResult,
  SearchOptions,
  ResearchProviderConfig,
  ResearchProviderResponse,
  ResearchProvider,
} from "@aasystent-radnego/shared";

export abstract class BaseResearchProvider {
  protected config: ResearchProviderConfig;
  protected lastRequestTime: number = 0;
  protected requestCount: number = 0;
  protected resetTime: number = 0;

  constructor(config: ResearchProviderConfig) {
    this.config = config;
  }

  /**
   * Search for content using the provider
   */
  abstract search(
    query: string,
    options: SearchOptions
  ): Promise<ResearchResult[]>;

  /**
   * Get full content from a URL (optional, not all providers support this)
   */
  async getContent(url: string): Promise<string> {
    throw new Error("getContent not implemented for this provider");
  }

  /**
   * Transform provider-specific results to unified format
   */
  protected abstract transformResults(data: unknown): ResearchResult[];

  /**
   * Rate limiting - wait if necessary
   */
  protected async rateLimitWait(): Promise<void> {
    if (!this.config.rateLimit) return;

    const now = Date.now();
    const { maxRequests, perSeconds } = this.config.rateLimit;
    const windowMs = perSeconds * 1000;

    // Reset counter if window has passed
    if (now - this.resetTime > windowMs) {
      this.requestCount = 0;
      this.resetTime = now;
    }

    // Check if we've hit the limit
    if (this.requestCount >= maxRequests) {
      const waitTime = windowMs - (now - this.resetTime);
      if (waitTime > 0) {
        console.log(
          `[${this.config.name}] Rate limit reached, waiting ${waitTime}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.resetTime = Date.now();
      }
    }

    this.requestCount++;
    this.lastRequestTime = now;
  }

  /**
   * Make HTTP request with error handling
   */
  protected async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.rateLimitWait();

    const url = `${this.config.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `${this.config.name} API error: ${response.status} - ${errorText}`
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      console.error(`[${this.config.name}] Request failed:`, error);
      throw error;
    }
  }

  /**
   * Get authentication headers for the provider
   */
  protected getAuthHeaders(): Record<string, string> {
    // Default: use x-api-key header
    // Override in subclasses if provider uses different auth
    return {
      "x-api-key": this.config.apiKey,
    };
  }

  /**
   * Generate unique ID for result
   */
  protected generateResultId(url: string, provider: ResearchProvider): string {
    const hash = this.simpleHash(url);
    return `${provider}-${hash}`;
  }

  /**
   * Simple hash function for generating IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Extract domain from URL
   */
  protected extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return "";
    }
  }

  /**
   * Calculate relevance score (0-1)
   * Obsługuje undefined/null/NaN - zwraca domyślną wartość 0.5
   */
  protected calculateRelevance(
    score: number | undefined | null,
    maxScore: number = 1
  ): number {
    // Jeśli score jest undefined/null/NaN, zwracamy domyślną wartość 0.5
    if (score === undefined || score === null || isNaN(score)) {
      return 0.5; // Domyślna wartość - brak danych o trafności
    }
    return Math.min(Math.max(score / maxScore, 0), 1);
  }

  /**
   * Truncate text to max length
   */
  protected truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  }

  /**
   * Clean HTML/markdown from text
   */
  protected cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove markdown links
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  /**
   * Get provider name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Check if provider is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && !!this.config.apiKey;
  }

  /**
   * Get provider priority
   */
  getPriority(): number {
    return this.config.priority;
  }
}
