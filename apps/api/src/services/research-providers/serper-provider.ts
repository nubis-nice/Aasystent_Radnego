/**
 * Serper Provider (Google Search API)
 * Agent AI "Winsdurf" - Deep Internet Researcher
 * Backup provider for Google Search access
 */

import { BaseResearchProvider } from "./base-provider.js";
import type {
  ResearchResult,
  SearchOptions,
  SerperSearchRequest,
  SerperSearchResponse,
} from "@shared/types/deep-research";

export class SerperProvider extends BaseResearchProvider {
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<ResearchResult[]> {
    const request: SerperSearchRequest = {
      q: query,
      gl: "pl", // Poland
      hl: "pl", // Polish
      num: options.maxResults || 10,
      type: "search", // default to web search
    };

    console.log(`[Serper] Searching: "${query}"`);

    try {
      const response = await this.makeRequest<SerperSearchResponse>("/search", {
        method: "POST",
        body: JSON.stringify(request),
      });

      console.log(`[Serper] Found ${response.organic?.length || 0} results`);

      return this.transformResults(response);
    } catch (error) {
      console.error("[Serper] Search failed:", error);
      return [];
    }
  }

  /**
   * Search Google Scholar for academic/legal content
   */
  async searchScholar(
    query: string,
    options: SearchOptions = {}
  ): Promise<ResearchResult[]> {
    const request: SerperSearchRequest = {
      q: query,
      gl: "pl",
      hl: "pl",
      num: options.maxResults || 10,
      type: "scholar",
    };

    console.log(`[Serper Scholar] Searching: "${query}"`);

    try {
      const response = await this.makeRequest<SerperSearchResponse>(
        "/scholar",
        {
          method: "POST",
          body: JSON.stringify(request),
        }
      );

      console.log(
        `[Serper Scholar] Found ${response.organic?.length || 0} results`
      );

      return this.transformResults(response);
    } catch (error) {
      console.error("[Serper Scholar] Search failed:", error);
      return [];
    }
  }

  protected transformResults(data: unknown): ResearchResult[] {
    const response = data as SerperSearchResponse;

    if (!response.organic || response.organic.length === 0) {
      return [];
    }

    return response.organic.map((result) => {
      const id = this.generateResultId(result.link, "serper");

      return {
        id,
        title: result.title || "Untitled",
        url: result.link,
        content: result.snippet || "",
        excerpt: this.truncate(this.cleanText(result.snippet || ""), 300),
        source: "serper" as const,
        relevanceScore: this.calculateRelevanceFromPosition(result.position),
        publishDate: result.date,
        highlights: this.extractHighlights(result.snippet || ""),
        metadata: {
          documentType: this.detectDocumentType(result.link),
          jurisdiction: this.detectJurisdiction(result.link),
        },
      };
    });
  }

  private calculateRelevanceFromPosition(position: number): number {
    // Google ranks by relevance - position 1 is most relevant
    // Convert to 0-1 score (position 1 = 1.0, position 10 = 0.1)
    return Math.max(0, 1 - (position - 1) * 0.1);
  }

  private extractHighlights(snippet: string): string[] {
    // Extract sentences from snippet
    const sentences = snippet.match(/[^.!?]+[.!?]+/g) || [];
    return sentences.slice(0, 2).map((s) => s.trim());
  }

  private detectDocumentType(url: string): string | undefined {
    const domain = this.extractDomain(url);

    if (domain.includes("gov.pl")) return "dokument_urzędowy";
    if (domain.includes("sejm.gov.pl")) return "akt_prawny";
    if (domain.includes("orzeczenia")) return "orzeczenie";
    if (domain.includes("bip")) return "dokument_bip";
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
      "X-API-KEY": this.config.apiKey,
      "Content-Type": "application/json",
    };
  }
}
