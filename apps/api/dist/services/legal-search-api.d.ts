/**
 * Legal Search API - wyszukiwanie prawne (fulltext + semantic)
 * Agent AI "Winsdurf" - wyszukiwanie w dokumentach prawnych
 */
import type { LegalSearchQuery, LegalSearchResult } from "@aasystent-radnego/shared";
export declare class LegalSearchAPI {
    private userId;
    private embeddingsClient;
    private embeddingModel;
    constructor(userId: string);
    private initializeOpenAI;
    search(query: LegalSearchQuery): Promise<LegalSearchResult[]>;
    private fulltextSearch;
    private semanticSearch;
    private hybridSearch;
    private applyFilters;
    private formatResults;
    private formatSemanticResults;
    private generateExcerpt;
    private generateHighlights;
    private calculateRelevanceScore;
    private deduplicateResults;
}
//# sourceMappingURL=legal-search-api.d.ts.map