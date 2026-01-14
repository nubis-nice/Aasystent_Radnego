/**
 * Brave Search Provider
 * Agent AI "Winsdurf" - Deep Internet Researcher
 * Web search with good Polish language support
 */
import { BaseResearchProvider } from "./base-provider.js";
import type { ResearchResult, SearchOptions } from "@aasystent-radnego/shared";
export declare class BraveProvider extends BaseResearchProvider {
    search(query: string, options?: SearchOptions): Promise<ResearchResult[]>;
    protected transformResults(data: unknown): ResearchResult[];
    private buildContent;
    private calculateDaysDiff;
    private detectDocumentType;
    private detectJurisdiction;
    protected getAuthHeaders(): Record<string, string>;
}
//# sourceMappingURL=brave-provider.d.ts.map