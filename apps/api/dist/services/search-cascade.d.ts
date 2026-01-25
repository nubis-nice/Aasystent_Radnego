/**
 * Search Cascade - System kaskadowego wyszukiwania
 *
 * Architektura:
 * 1. Lokalne źródła (RAG) - najszybsze, najwyższy priorytet
 * 2. Rejestry publiczne (API) - specjalistyczne dane
 * 3. Wyszukiwanie internetowe - fallback z weryfikacją
 *
 * Zasada: Wyczerpać wszystkie źródła aż do uzyskania wyników
 */
export type SearchSourceType = "rag" | "session" | "youtube" | "isap" | "gus" | "web_verified" | "deep_research";
export interface SearchSourceConfig {
    type: SearchSourceType;
    priority: number;
    timeout: number;
    minResultsToStop: number;
    enabled: boolean;
}
export interface CascadeResult {
    source: SearchSourceType;
    success: boolean;
    results: CascadeSearchResult[];
    executionTimeMs: number;
    error?: string;
}
export interface CascadeSearchResult {
    title: string;
    content: string;
    url?: string;
    relevance: number;
    sourceType: SearchSourceType;
    credibility?: number;
    metadata?: Record<string, unknown>;
}
export interface SearchCascadeResponse {
    success: boolean;
    query: string;
    totalResults: number;
    sourcesQueried: SearchSourceType[];
    sourcesWithResults: SearchSourceType[];
    results: CascadeSearchResult[];
    cascadeResults: CascadeResult[];
    stoppedAt?: SearchSourceType;
    executionTimeMs: number;
    exhausted: boolean;
}
declare const DEFAULT_CASCADE_CONFIG: SearchSourceConfig[];
export declare class SearchCascadeService {
    private userId;
    private config;
    constructor(userId: string, config?: SearchSourceConfig[]);
    /**
     * Wykonaj kaskadowe wyszukiwanie
     * Przeszukuje źródła w kolejności priorytetów, aż znajdzie wystarczającą liczbę wyników
     */
    search(query: string, options?: {
        exhaustive?: boolean;
        maxResults?: number;
        stopAfterResults?: number;
        enabledSources?: SearchSourceType[];
        sessionNumber?: number;
    }): Promise<SearchCascadeResponse>;
    /**
     * Wykonaj pojedyncze źródło wyszukiwania
     */
    private executeSource;
    /**
     * Wyszukaj w konkretnym źródle
     */
    private searchSource;
    private searchRAG;
    private searchSession;
    private searchYouTube;
    private searchISAP;
    private searchGUS;
    private searchWebVerified;
    private searchDeepResearch;
    private groupByPriority;
    private deduplicateResults;
    private timeout;
}
export declare function cascadeSearch(userId: string, query: string, options?: {
    exhaustive?: boolean;
    maxResults?: number;
    sessionNumber?: number;
    enabledSources?: SearchSourceType[];
}): Promise<SearchCascadeResponse>;
export { DEFAULT_CASCADE_CONFIG };
//# sourceMappingURL=search-cascade.d.ts.map