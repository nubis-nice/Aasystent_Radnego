/**
 * Tavily AI Provider
 * Agent AI "Winsdurf" - Deep Internet Researcher
 * Secondary provider for research-focused search and fact-checking
 */

import { BaseResearchProvider } from "./base-provider.js";
import type {
  ResearchResult,
  SearchOptions,
  TavilySearchRequest,
  TavilySearchResponse,
} from "@aasystent-radnego/shared";

export class TavilyProvider extends BaseResearchProvider {
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<ResearchResult[]> {
    const request: TavilySearchRequest = {
      query,
      search_depth: options.searchType === "deep" ? "advanced" : "basic",
      include_domains: options.domains,
      exclude_domains: options.excludeDomains,
      max_results: options.maxResults || 5,
      include_answer: true,
      include_raw_content: false,
    };

    console.log(`[Tavily] Searching: "${query}" (${request.search_depth})`);

    try {
      const response = await this.makeRequest<TavilySearchResponse>("/search", {
        method: "POST",
        body: JSON.stringify(request),
      });

      console.log(`[Tavily] Found ${response.results.length} results`);

      return this.transformResults(response);
    } catch (error) {
      console.error("[Tavily] Search failed:", error);
      return [];
    }
  }

  protected transformResults(data: unknown): ResearchResult[] {
    const response = data as TavilySearchResponse;

    return response.results.map((result) => {
      const id = this.generateResultId(result.url, "tavily");

      return {
        id,
        title: result.title || "Untitled",
        url: result.url,
        content: result.raw_content || result.content || "",
        excerpt: this.truncate(this.cleanText(result.content), 300),
        source: "tavily" as const,
        relevanceScore: this.calculateRelevance(result.score, 1),
        publishDate: result.published_date,
        highlights: this.extractHighlights(result.content),
        metadata: {
          documentType: this.detectDocumentType(result.url),
        },
      };
    });
  }

  private extractHighlights(content: string): string[] {
    // Extract first 3 sentences as highlights
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    return sentences.slice(0, 3).map((s) => s.trim());
  }

  private detectDocumentType(url: string): string | undefined {
    const domain = this.extractDomain(url);

    if (domain.includes("gov.pl")) return "dokument_urzędowy";
    if (domain.includes("sejm.gov.pl")) return "akt_prawny";
    if (url.includes(".pdf")) return "pdf";

    return undefined;
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      "content-type": "application/json",
      "api-key": this.config.apiKey,
    };
  }
}
