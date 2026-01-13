/**
 * Brave Search Provider
 * Agent AI "Winsdurf" - Deep Internet Researcher
 * Web search with good Polish language support
 */

import { BaseResearchProvider } from "./base-provider.js";
import type {
  ResearchResult,
  SearchOptions,
  BraveSearchRequest,
  BraveSearchResponse,
  BraveSearchResult,
} from "@shared/types/deep-research";

export class BraveProvider extends BaseResearchProvider {
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<ResearchResult[]> {
    const request: BraveSearchRequest = {
      q: query,
      count: options.maxResults || 10,
      country: "PL",
      search_lang: "pl",
      ui_lang: "pl",
      safesearch: "moderate",
      extra_snippets: true,
    };

    // Date filtering
    if (options.dateFrom) {
      const daysDiff = this.calculateDaysDiff(options.dateFrom);
      if (daysDiff <= 1) request.freshness = "pd";
      else if (daysDiff <= 7) request.freshness = "pw";
      else if (daysDiff <= 30) request.freshness = "pm";
      else if (daysDiff <= 365) request.freshness = "py";
    }

    console.log(`[Brave] Searching: "${query}"`);

    try {
      const params = new URLSearchParams();
      params.append("q", request.q);
      if (request.count) params.append("count", request.count.toString());
      if (request.country) params.append("country", request.country);
      if (request.search_lang)
        params.append("search_lang", request.search_lang);
      if (request.safesearch) params.append("safesearch", request.safesearch);
      if (request.freshness) params.append("freshness", request.freshness);
      if (request.extra_snippets) params.append("extra_snippets", "true");

      const response = await this.makeRequest<BraveSearchResponse>(
        `/res/v1/web/search?${params.toString()}`,
        { method: "GET" }
      );

      const results = response.web?.results || [];
      console.log(`[Brave] Found ${results.length} results`);

      return this.transformResults(results);
    } catch (error) {
      console.error("[Brave] Search failed:", error);
      return [];
    }
  }

  protected transformResults(data: unknown): ResearchResult[] {
    const results = data as BraveSearchResult[];
    const totalResults = results.length;

    return results.map((result, index) => {
      const id = this.generateResultId(result.url, "brave");

      // Score based on position (Brave doesn't return relevance scores)
      const positionBasedScore =
        0.95 - (index / Math.max(totalResults, 1)) * 0.45;

      return {
        id,
        title: result.title || "Untitled",
        url: result.url,
        content: this.buildContent(result),
        excerpt: this.cleanText(result.description || ""),
        source: "brave" as const,
        relevanceScore: positionBasedScore,
        publishDate: result.page_fetched,
        highlights: result.extra_snippets || [],
        metadata: {
          documentType: this.detectDocumentType(result.url),
          jurisdiction: this.detectJurisdiction(result.url),
        },
      };
    });
  }

  private buildContent(result: BraveSearchResult): string {
    let content = result.description || "";

    if (result.extra_snippets && result.extra_snippets.length > 0) {
      content += "\n\n" + result.extra_snippets.join("\n");
    }

    return this.cleanText(content);
  }

  private calculateDaysDiff(dateStr: string): number {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private detectDocumentType(url: string): string | undefined {
    const domain = this.extractDomain(url);

    if (domain.includes("orzeczenia")) return "orzeczenie";
    if (domain.includes("isap") || domain.includes("dziennikustaw"))
      return "akt_prawny";
    if (domain.includes("rio")) return "stanowisko_rio";
    if (domain.includes("bip")) return "dokument_bip";
    if (domain.includes("sejm")) return "dokument_sejm";
    if (url.includes(".pdf")) return "pdf";

    return undefined;
  }

  private detectJurisdiction(url: string): string | undefined {
    const domain = this.extractDomain(url);

    if (domain.includes("nsa")) return "NSA";
    if (domain.includes("wsa")) return "WSA";
    if (domain.includes("sn.pl")) return "SN";
    if (domain.includes("trybunal")) return "TK";

    return undefined;
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      "X-Subscription-Token": this.config.apiKey,
      Accept: "application/json",
      "Accept-Encoding": "gzip",
    };
  }
}
