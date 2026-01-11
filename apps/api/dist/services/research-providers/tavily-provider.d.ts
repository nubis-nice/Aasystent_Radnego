/**
 * Tavily AI Provider
 * Agent AI "Winsdurf" - Deep Internet Researcher
 * Secondary provider for research-focused search and fact-checking
 */
import { BaseResearchProvider } from "./base-provider.js";
import type { ResearchResult, SearchOptions } from "@shared/types/deep-research";
export declare class TavilyProvider extends BaseResearchProvider {
    search(query: string, options?: SearchOptions): Promise<ResearchResult[]>;
    protected transformResults(data: unknown): ResearchResult[];
    private extractHighlights;
    private detectDocumentType;
    protected getAuthHeaders(): Record<string, string>;
}
//# sourceMappingURL=tavily-provider.d.ts.map