/**
 * Base Research Provider
 * Agent AI "Winsdurf" - Deep Internet Researcher
 */
import type { ResearchResult, SearchOptions, ResearchProviderConfig, ResearchProvider } from "@shared/types/deep-research";
export declare abstract class BaseResearchProvider {
    protected config: ResearchProviderConfig;
    protected lastRequestTime: number;
    protected requestCount: number;
    protected resetTime: number;
    constructor(config: ResearchProviderConfig);
    /**
     * Search for content using the provider
     */
    abstract search(query: string, options: SearchOptions): Promise<ResearchResult[]>;
    /**
     * Get full content from a URL (optional, not all providers support this)
     */
    getContent(url: string): Promise<string>;
    /**
     * Transform provider-specific results to unified format
     */
    protected abstract transformResults(data: unknown): ResearchResult[];
    /**
     * Rate limiting - wait if necessary
     */
    protected rateLimitWait(): Promise<void>;
    /**
     * Make HTTP request with error handling
     */
    protected makeRequest<T>(endpoint: string, options?: RequestInit): Promise<T>;
    /**
     * Get authentication headers for the provider
     */
    protected getAuthHeaders(): Record<string, string>;
    /**
     * Generate unique ID for result
     */
    protected generateResultId(url: string, provider: ResearchProvider): string;
    /**
     * Simple hash function for generating IDs
     */
    private simpleHash;
    /**
     * Extract domain from URL
     */
    protected extractDomain(url: string): string;
    /**
     * Calculate relevance score (0-1)
     * Obsługuje undefined/null/NaN - zwraca domyślną wartość 0.5
     */
    protected calculateRelevance(score: number | undefined | null, maxScore?: number): number;
    /**
     * Truncate text to max length
     */
    protected truncate(text: string, maxLength: number): string;
    /**
     * Clean HTML/markdown from text
     */
    protected cleanText(text: string): string;
    /**
     * Get provider name
     */
    getName(): string;
    /**
     * Check if provider is enabled
     */
    isEnabled(): boolean;
    /**
     * Get provider priority
     */
    getPriority(): number;
}
//# sourceMappingURL=base-provider.d.ts.map