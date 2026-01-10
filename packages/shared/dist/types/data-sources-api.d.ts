/**
 * Typy dla systemu źródeł danych opartego na API
 * Agent AI "Winsdurf" - architektura bez MCP, tylko API/scraping
 */
export type DataSourceType = "api_isap" | "api_rcl" | "api_wsa_nsa" | "api_rio" | "scraper_bip" | "scraper_dziennik" | "scraper_custom" | "api_custom";
export type DataFetchMethod = "api" | "scraping" | "hybrid";
export interface ApiClientConfig {
    method: "GET" | "POST" | "PUT" | "DELETE";
    baseUrl: string;
    endpoint?: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    bodyTemplate?: Record<string, unknown>;
    authentication?: {
        type: "none" | "api_key" | "bearer" | "basic" | "oauth2";
        apiKey?: string;
        apiKeyHeader?: string;
        token?: string;
        username?: string;
        password?: string;
        oauth2Config?: {
            tokenUrl: string;
            clientId: string;
            clientSecret: string;
            scope?: string;
        };
    };
    rateLimit?: {
        requestsPerMinute: number;
        requestsPerHour: number;
    };
    pagination?: {
        type: "offset" | "page" | "cursor" | "none";
        limitParam?: string;
        offsetParam?: string;
        pageParam?: string;
        cursorParam?: string;
        maxPages?: number;
    };
    responseMapping?: {
        dataPath: string;
        titlePath?: string;
        contentPath?: string;
        datePath?: string;
        urlPath?: string;
        metadataPath?: string;
    };
}
export interface ScraperConfig {
    maxPages: number;
    maxDepth: number;
    delayMs: number;
    selectors: {
        documentList?: string;
        title?: string;
        content?: string;
        links?: string;
        date?: string;
        pdfLinks?: string;
        metadata?: Record<string, string>;
    };
    urlPatterns?: {
        include?: string[];
        exclude?: string[];
    };
    javascript?: {
        enabled: boolean;
        waitForSelector?: string;
        waitTime?: number;
    };
}
export interface DataSourceConfig {
    id: string;
    userId: string;
    name: string;
    description?: string;
    url?: string;
    sourceType: DataSourceType;
    fetchMethod: DataFetchMethod;
    apiConfig?: ApiClientConfig;
    scraperConfig?: ScraperConfig;
    schedule: {
        enabled: boolean;
        frequency: "hourly" | "daily" | "weekly" | "monthly" | "custom";
        cronExpression?: string;
        nextRunAt?: string;
    };
    processing: {
        enableEmbeddings: boolean;
        enableClassification: boolean;
        enableKeywordExtraction: boolean;
        enableSummarization: boolean;
        customProcessors?: string[];
    };
    metadata: {
        category: "legal" | "administrative" | "financial" | "statistical" | "other";
        tags: string[];
        priority: "low" | "normal" | "high" | "critical";
        jurisdiction?: string;
        legalScope?: string[];
    };
    isActive: boolean;
    lastFetchedAt?: string;
    lastSuccessAt?: string;
    lastErrorAt?: string;
    lastErrorMessage?: string;
    createdAt: string;
    updatedAt: string;
}
export interface FetchedDocument {
    sourceId: string;
    sourceType: DataSourceType;
    fetchMethod: DataFetchMethod;
    title: string;
    content: string;
    contentType: "html" | "text" | "json" | "xml" | "pdf";
    url?: string;
    publishDate?: string;
    author?: string;
    documentNumber?: string;
    legalClassification?: {
        type: "ustawa" | "rozporządzenie" | "uchwała" | "zarządzenie" | "wyrok" | "postanowienie" | "inne";
        issuer?: string;
        subject?: string[];
        legalBasis?: string[];
    };
    contentHash: string;
    fetchedAt: string;
    rawData?: Record<string, unknown>;
    relatedDocuments?: string[];
    amendments?: string[];
    repeals?: string[];
}
export interface LegalSearchQuery {
    query: string;
    filters?: {
        sourceTypes?: DataSourceType[];
        dateFrom?: string;
        dateTo?: string;
        documentTypes?: string[];
        jurisdiction?: string;
        legalScope?: string[];
    };
    searchMode: "fulltext" | "semantic" | "hybrid";
    maxResults?: number;
}
export interface LegalSearchResult {
    documentId: string;
    title: string;
    content: string;
    excerpt: string;
    relevanceScore: number;
    sourceType: DataSourceType;
    url?: string;
    publishDate?: string;
    legalClassification?: FetchedDocument["legalClassification"];
    highlights?: string[];
}
export interface LegalReasoningRequest {
    question: string;
    context?: {
        documentIds?: string[];
        legalScope?: string[];
        jurisdiction?: string;
    };
    analysisType: "legality" | "financial_risk" | "procedural_compliance" | "general";
}
export interface LegalReasoningResponse {
    answer: string;
    reasoning: string[];
    legalBasis: {
        documentId: string;
        title: string;
        excerpt: string;
        relevance: number;
    }[];
    risks: {
        level: "low" | "medium" | "high" | "critical";
        description: string;
        legalBasis?: string;
        recommendation?: string;
    }[];
    citations: {
        documentId: string;
        quote: string;
        context: string;
    }[];
}
export interface BudgetAnalysisRequest {
    documentId: string;
    analysisType: "changes" | "compliance" | "risk" | "comparison";
    compareWith?: string;
}
export interface BudgetAnalysisResult {
    documentId: string;
    analysisType: string;
    findings: {
        type: "change" | "risk" | "violation" | "anomaly";
        severity: "low" | "medium" | "high" | "critical";
        description: string;
        affectedItems: {
            chapter?: string;
            section?: string;
            paragraph?: string;
            amount?: number;
            change?: number;
        }[];
        recommendation?: string;
    }[];
    summary: string;
    rioReferences?: {
        title: string;
        url: string;
        relevance: string;
    }[];
}
export declare const PREDEFINED_SOURCES: Record<string, Partial<DataSourceConfig>>;
export interface DataFetchResult {
    sourceId: string;
    success: boolean;
    fetchMethod: DataFetchMethod;
    itemsFetched: number;
    itemsProcessed: number;
    errors: string[];
    warnings: string[];
    duration: number;
    nextFetchAt?: string;
    metadata?: {
        apiCallsUsed?: number;
        pagesScraped?: number;
        rateLimitRemaining?: number;
    };
}
//# sourceMappingURL=data-sources-api.d.ts.map