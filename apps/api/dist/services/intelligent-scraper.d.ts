/**
 * Intelligent Scraper Service
 * Zaawansowany scraper z analizą LLM, pełnym mapowaniem strony i inkrementalnym scrapingiem
 */
export interface SiteMapNode {
    url: string;
    title: string;
    depth: number;
    children: string[];
    contentType: "page" | "document" | "calendar" | "materials" | "session" | "unknown";
    priority: number;
    lastModified?: string;
    contentHash?: string;
}
export interface LLMAnalysisResult {
    relevanceScore: number;
    contentType: string;
    summary: string;
    keyTopics: string[];
    isRelevantForCouncilor: boolean;
    extractedDates: string[];
    extractedEntities: string[];
    recommendedAction: "scrape" | "skip" | "priority";
}
export interface IntelligentScrapingConfig {
    maxPages: number;
    maxDepth: number;
    delayMs: number;
    enableLLMAnalysis: boolean;
    councilLocation: string;
    focusAreas: string[];
    incrementalMode: boolean;
}
export interface IntelligentScrapeResult {
    success: boolean;
    siteMap: SiteMapNode[];
    pagesAnalyzed: number;
    documentsFound: number;
    documentsProcessed: number;
    newDocuments: number;
    skippedDocuments: number;
    llmAnalyses: number;
    errors: string[];
    processingTimeMs: number;
}
export declare class IntelligentScraper {
    private config;
    private baseUrl;
    private visitedUrls;
    private siteMap;
    private errors;
    private openai;
    private userId;
    private sourceId;
    constructor(baseUrl: string, userId: string, sourceId: string, customConfig?: Partial<IntelligentScrapingConfig>);
    private normalizeUrl;
    private initializeOpenAI;
    generateSiteMap(): Promise<SiteMapNode[]>;
    private extractLinks;
    private classifyPageType;
    private calculatePriority;
    private calculateUrlPriority;
    private generateContentHash;
    analyzeContentWithLLM(url: string, title: string, content: string): Promise<LLMAnalysisResult | null>;
    checkIfContentChanged(url: string, newHash: string): Promise<boolean>;
    scrape(): Promise<IntelligentScrapeResult>;
    private extractMainContent;
    private cleanText;
    private extractPdfLinks;
    private saveScrapedContent;
    private processToRAG;
    private classifyDocumentType;
    private extractKeywords;
    private fetchPage;
    private delay;
    /**
     * Przetwarza załączniki PDF znalezione podczas scrapingu
     * Automatycznie wykrywa skany bez warstwy tekstowej i używa OCR (GPT-4 Vision)
     */
    private processPDFAttachments;
}
export declare function intelligentScrapeDataSource(sourceId: string, userId: string, customConfig?: Partial<IntelligentScrapingConfig>): Promise<IntelligentScrapeResult>;
//# sourceMappingURL=intelligent-scraper.d.ts.map