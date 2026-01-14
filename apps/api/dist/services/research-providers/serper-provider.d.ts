/**
 * Serper Provider (Google Search API)
 * Agent AI "Winsdurf" - Deep Internet Researcher
 * Backup provider for Google Search access
 */
import { BaseResearchProvider } from "./base-provider.js";
import type { ResearchResult, SearchOptions } from "@aasystent-radnego/shared";
export declare class SerperProvider extends BaseResearchProvider {
    search(query: string, options?: SearchOptions): Promise<ResearchResult[]>;
    /**
     * Search Google Scholar for academic/legal content
     */
    searchScholar(query: string, options?: SearchOptions): Promise<ResearchResult[]>;
    protected transformResults(data: unknown): ResearchResult[];
    private calculateRelevanceFromPosition;
    private extractHighlights;
    private detectDocumentType;
    private detectJurisdiction;
    protected getAuthHeaders(): Record<string, string>;
}
//# sourceMappingURL=serper-provider.d.ts.map