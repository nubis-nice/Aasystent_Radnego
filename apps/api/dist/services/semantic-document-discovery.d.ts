/**
 * Semantic Document Discovery Service
 * Inteligentne wyszukiwanie dokumentów w źródłach danych podobne do Exa AI
 *
 * Funkcje:
 * 1. Semantic search w zapisanych źródłach (embeddingi)
 * 2. Auto-discovery powiązanych dokumentów
 * 3. Deep extraction z OCR
 * 4. Relevance scoring z LLM
 */
export interface SemanticSearchQuery {
    query: string;
    sourceId?: string;
    maxResults?: number;
    minRelevance?: number;
    includeContent?: boolean;
    deepCrawl?: boolean;
    extractPDFs?: boolean;
    enableIntelligentScraping?: boolean;
    minResultsBeforeScraping?: number;
}
export interface DiscoveredDocument {
    id: string;
    url: string;
    title: string;
    content: string;
    excerpt: string;
    relevanceScore: number;
    source: {
        id: string;
        name: string;
        type: string;
    };
    metadata: {
        contentType: string;
        publishDate?: string;
        extractedDates: string[];
        extractedEntities: string[];
        pdfLinks: string[];
        wordCount: number;
    };
    llmAnalysis?: {
        summary: string;
        keyTopics: string[];
        isRelevant: boolean;
        recommendedAction: string;
    };
}
export interface SemanticSearchResult {
    success: boolean;
    query: string;
    totalFound: number;
    documents: DiscoveredDocument[];
    newDocumentsProcessed: number;
    errors: string[];
    processingTimeMs: number;
}
export declare class SemanticDocumentDiscovery {
    private userId;
    private llmClient;
    private embeddingsClient;
    private embeddingModel;
    private llmModel;
    private errors;
    constructor(userId: string);
    private initializeOpenAI;
    search(query: SemanticSearchQuery): Promise<SemanticSearchResult>;
    private searchRAGDocuments;
    private fallbackRAGSearch;
    private transformRAGDocument;
    private searchScrapedContent;
    private transformScrapedDocument;
    private mergeAndDeduplicate;
    private scoreRelevance;
    private scoreBatch;
    private deepCrawlDocuments;
    private extractLinksFromPage;
    private filterRelevantLinks;
    private crawlAndSave;
    private extractPDFDocuments;
    private processPDF;
    private createExcerpt;
    private runIntelligentScraping;
    private extractFocusAreasFromQuery;
}
export declare function semanticDocumentSearch(userId: string, query: SemanticSearchQuery): Promise<SemanticSearchResult>;
//# sourceMappingURL=semantic-document-discovery.d.ts.map