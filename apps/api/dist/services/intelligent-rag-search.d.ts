/**
 * Intelligent RAG Search Service
 *
 * Zaawansowane wyszukiwanie dokumentów z:
 * 1. Przetwarzaniem zapytań (normalizacja, konwersja numerów)
 * 2. Wieloetapowym wyszukiwaniem (semantic + keyword + fuzzy)
 * 3. Kojarzeniem powiązanych dokumentów
 * 4. Rankingiem i filtrowaniem wyników
 */
export interface SearchQuery {
    query: string;
    sessionNumber?: number;
    documentType?: string;
    dateFrom?: string;
    dateTo?: string;
    maxResults?: number;
    includeRelated?: boolean;
}
export interface SearchResult {
    id: string;
    title: string;
    content: string;
    excerpt: string;
    documentType: string;
    publishDate?: string;
    sourceUrl?: string;
    similarity: number;
    matchType: "semantic" | "keyword" | "fuzzy" | "related";
    relatedDocuments?: RelatedDocument[];
}
export interface RelatedDocument {
    id: string;
    title: string;
    documentType: string;
    relationshipType: string;
    similarity: number;
}
export interface IntelligentSearchResult {
    success: boolean;
    query: {
        original: string;
        normalized: string;
        extractedEntities: ExtractedEntity[];
    };
    results: SearchResult[];
    totalFound: number;
    searchStats: {
        semanticMatches: number;
        keywordMatches: number;
        fuzzyMatches: number;
        relatedMatches: number;
        processingTimeMs: number;
    };
    debug?: DebugInfo;
}
export interface ExtractedEntity {
    type: "session" | "resolution" | "druk" | "date" | "topic";
    value: string;
    normalized: string;
}
export interface DebugInfo {
    embeddingGenerated: boolean;
    documentsInDb: number;
    documentsWithEmbedding: number;
    queryVariants: string[];
    thresholdUsed: number;
}
export declare class IntelligentRAGSearch {
    private userId;
    private embeddingsClient;
    private llmClient;
    private embeddingModel;
    private llmModel;
    constructor(userId: string);
    private initialize;
    search(query: SearchQuery): Promise<IntelligentSearchResult>;
    private normalizeQuery;
    private removeDiacritics;
    private semanticSearch;
    private keywordSearch;
    private findRelatedDocuments;
    private findSimilarDocuments;
    private transformDocument;
    private createExcerpt;
    private getDebugInfo;
    runDiagnostics(testQuery: string): Promise<{
        query: string;
        dbStats: {
            totalDocuments: number;
            documentsWithEmbedding: number;
            documentTypes: Record<string, number>;
        };
        searchResults: IntelligentSearchResult;
        recommendations: string[];
    }>;
}
//# sourceMappingURL=intelligent-rag-search.d.ts.map