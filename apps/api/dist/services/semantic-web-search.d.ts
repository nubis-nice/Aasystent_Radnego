/**
 * Semantic Web Search Service
 * - Wyszukiwanie semantyczne w internecie
 * - Ważenie wyników na podstawie wiarygodności źródła
 * - Wykrywanie fake newsów i nieprawdziwych informacji
 * - Cross-referencing między źródłami
 */
export interface WebSearchResult {
    url: string;
    title: string;
    snippet: string;
    content?: string;
    publishedDate?: string;
    author?: string;
    domain: string;
}
export interface CredibilityScore {
    overall: number;
    domainTrust: number;
    contentQuality: number;
    factualAccuracy: number;
    biasLevel: number;
    freshness: number;
    flags: CredibilityFlag[];
}
export interface CredibilityFlag {
    type: "fake_news" | "misleading" | "outdated" | "biased" | "unverified" | "satire" | "opinion";
    severity: "low" | "medium" | "high";
    reason: string;
}
export interface VerifiedResult extends WebSearchResult {
    credibility: CredibilityScore;
    crossReferences: CrossReference[];
    weightedScore: number;
    isReliable: boolean;
    warnings: string[];
}
export interface CrossReference {
    claim: string;
    supportingSources: number;
    contradictingSources: number;
    confidence: number;
}
export interface SemanticSearchQuery {
    query: string;
    maxResults?: number;
    minCredibility?: number;
    requireCrossReference?: boolean;
    excludeDomains?: string[];
    preferredDomains?: string[];
    language?: string;
}
export interface SemanticSearchResponse {
    success: boolean;
    query: string;
    results: VerifiedResult[];
    summary: string;
    overallConfidence: number;
    warnings: string[];
    processingTimeMs: number;
    sourcesAnalyzed: number;
    reliableSourcesCount: number;
}
export declare class SemanticWebSearchService {
    private userId;
    private llmClient;
    private model;
    constructor(userId: string);
    private initialize;
    /**
     * Main search method with credibility verification
     */
    search(query: SemanticSearchQuery): Promise<SemanticSearchResponse>;
    /**
     * Perform web search using Brave Search API or fallback
     */
    private performWebSearch;
    /**
     * Search using Brave Search API
     */
    private searchWithBrave;
    /**
     * Search using DuckDuckGo HTML API (no key needed, rate limited)
     */
    private searchWithDuckDuckGo;
    /**
     * Assess credibility of a single result
     */
    private assessCredibility;
    /**
     * Get domain trust score
     */
    private getDomainTrust;
    /**
     * Analyze content quality using LLM
     */
    private analyzeContentQuality;
    /**
     * Cross-reference information between sources
     */
    private crossReference;
    /**
     * Calculate weighted score
     */
    private calculateWeightedScore;
    /**
     * Calculate freshness score based on publish date
     */
    private calculateFreshness;
    /**
     * Generate warnings for a result
     */
    private generateWarnings;
    /**
     * Detect contradictions between results
     */
    private detectContradictions;
    /**
     * Calculate overall confidence in search results
     */
    private calculateOverallConfidence;
    /**
     * Generate summary of findings
     */
    private generateSummary;
}
export declare function semanticWebSearch(userId: string, query: SemanticSearchQuery): Promise<SemanticSearchResponse>;
//# sourceMappingURL=semantic-web-search.d.ts.map