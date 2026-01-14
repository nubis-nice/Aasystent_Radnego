/**
 * Exa AI Provider
 * Agent AI "Winsdurf" - Deep Internet Researcher
 * Primary provider for semantic/neural search
 */
import { BaseResearchProvider } from "./base-provider.js";
import type { ResearchResult, SearchOptions } from "@aasystent-radnego/shared";
export declare class ExaProvider extends BaseResearchProvider {
    search(query: string, options?: SearchOptions): Promise<ResearchResult[]>;
    private getContentsWithHighlights;
    protected transformResults(data: unknown): ResearchResult[];
    private createExcerpt;
    private detectDocumentType;
    private detectJurisdiction;
    protected getAuthHeaders(): Record<string, string>;
}
//# sourceMappingURL=exa-provider.d.ts.map