/**
 * Deep Internet Researcher - Types & Interfaces
 * Agent AI "Winsdurf" - Zaawansowany research internetowy
 */
export type ResearchDepth = "quick" | "standard" | "deep";
export type ResearchType = "legal" | "financial" | "procedural" | "general";
export type ResearchProvider = "exa" | "tavily" | "serper" | "firecrawl" | "local";
export interface DeepResearchRequest {
    query: string;
    researchType: ResearchType;
    depth: ResearchDepth;
    sources?: string[];
    dateRange?: {
        from: string;
        to: string;
    };
    maxResults?: number;
    enableDeepResearch?: boolean;
}
export interface ResearchResult {
    id: string;
    title: string;
    url: string;
    content: string;
    excerpt: string;
    source: ResearchProvider;
    relevanceScore: number;
    publishDate?: string;
    citations?: string[];
    highlights?: string[];
    metadata: {
        documentType?: string;
        jurisdiction?: string;
        legalScope?: string[];
        author?: string;
        institution?: string;
    };
}
export interface DeepResearchReport {
    id: string;
    query: string;
    researchType: ResearchType;
    depth: ResearchDepth;
    summary: string;
    keyFindings: string[];
    results: ResearchResult[];
    sources: {
        name: string;
        count: number;
        avgRelevance: number;
    }[];
    relatedQueries: string[];
    confidence: number;
    generatedAt: string;
    processingTime: number;
}
export interface SearchOptions {
    maxResults?: number;
    domains?: string[];
    excludeDomains?: string[];
    dateFrom?: string;
    dateTo?: string;
    searchType?: "neural" | "keyword" | "hybrid";
    includeHighlights?: boolean;
    includeSummary?: boolean;
}
export interface ResearchProviderConfig {
    name: string;
    baseUrl: string;
    apiKey: string;
    priority: number;
    enabled: boolean;
    rateLimit?: {
        maxRequests: number;
        perSeconds: number;
    };
}
export interface ResearchProviderResponse {
    results: ResearchResult[];
    totalResults: number;
    processingTime: number;
    provider: ResearchProvider;
}
export interface ExaSearchRequest {
    query: string;
    type?: "neural" | "keyword";
    numResults?: number;
    includeDomains?: string[];
    excludeDomains?: string[];
    startPublishedDate?: string;
    endPublishedDate?: string;
    useAutoprompt?: boolean;
    category?: string;
}
export interface ExaSearchResult {
    id: string;
    title: string;
    url: string;
    publishedDate?: string;
    author?: string;
    score: number;
    text?: string;
    highlights?: string[];
    highlightScores?: number[];
    summary?: string;
}
export interface ExaSearchResponse {
    results: ExaSearchResult[];
    autopromptString?: string;
}
export interface TavilySearchRequest {
    query: string;
    search_depth?: "basic" | "advanced";
    include_domains?: string[];
    exclude_domains?: string[];
    max_results?: number;
    include_answer?: boolean;
    include_raw_content?: boolean;
    include_images?: boolean;
}
export interface TavilySearchResult {
    title: string;
    url: string;
    content: string;
    score: number;
    raw_content?: string;
    published_date?: string;
}
export interface TavilySearchResponse {
    answer?: string;
    query: string;
    response_time: number;
    images?: string[];
    results: TavilySearchResult[];
}
export interface SerperSearchRequest {
    q: string;
    gl?: string;
    hl?: string;
    num?: number;
    page?: number;
    type?: "search" | "news" | "scholar";
}
export interface SerperSearchResult {
    title: string;
    link: string;
    snippet: string;
    date?: string;
    position: number;
}
export interface SerperSearchResponse {
    searchParameters: {
        q: string;
        gl: string;
        hl: string;
        num: number;
    };
    organic: SerperSearchResult[];
    answerBox?: {
        answer: string;
        snippet: string;
    };
}
export interface FirecrawlScrapeRequest {
    url: string;
    formats?: ("markdown" | "html" | "rawHtml" | "links" | "screenshot")[];
    onlyMainContent?: boolean;
    includeTags?: string[];
    excludeTags?: string[];
    waitFor?: number;
}
export interface FirecrawlScrapeResponse {
    success: boolean;
    data: {
        markdown?: string;
        html?: string;
        rawHtml?: string;
        metadata: {
            title: string;
            description?: string;
            language?: string;
            sourceURL: string;
        };
    };
}
export interface FirecrawlCrawlRequest {
    url: string;
    crawlerOptions?: {
        maxDepth?: number;
        limit?: number;
        allowBackwardCrawling?: boolean;
        allowExternalContentLinks?: boolean;
    };
    pageOptions?: {
        onlyMainContent?: boolean;
        includeHtml?: boolean;
    };
}
export interface ClaimVerification {
    claim: string;
    verdict: "true" | "false" | "partially_true" | "unverified";
    confidence: number;
    evidence: {
        supporting: ResearchResult[];
        contradicting: ResearchResult[];
    };
    explanation: string;
    sources: number;
}
//# sourceMappingURL=deep-research.d.ts.map