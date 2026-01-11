/**
 * Exa AI Provider
 * Agent AI "Winsdurf" - Deep Internet Researcher
 * Primary provider for semantic/neural search
 */
import { BaseResearchProvider } from "./base-provider.js";
export class ExaProvider extends BaseResearchProvider {
    async search(query, options = {}) {
        const request = {
            query,
            type: options.searchType === "keyword" ? "keyword" : "neural",
            numResults: options.maxResults || 10,
            includeDomains: options.domains,
            excludeDomains: options.excludeDomains,
            startPublishedDate: options.dateFrom,
            endPublishedDate: options.dateTo,
            useAutoprompt: true, // Let Exa optimize the query
        };
        console.log(`[Exa] Searching: "${query}" (${request.type})`);
        try {
            const response = await this.makeRequest("/search", {
                method: "POST",
                body: JSON.stringify(request),
            });
            console.log(`[Exa] Found ${response.results.length} results`);
            // Get contents with highlights if requested
            if (options.includeHighlights || options.includeSummary) {
                return await this.getContentsWithHighlights(response.results, options);
            }
            return this.transformResults(response.results);
        }
        catch (error) {
            console.error("[Exa] Search failed:", error);
            return [];
        }
    }
    async getContentsWithHighlights(results, options) {
        try {
            const ids = results.map((r) => r.id);
            const contentsResponse = await this.makeRequest("/contents", {
                method: "POST",
                body: JSON.stringify({
                    ids,
                    text: true,
                    highlights: options.includeHighlights
                        ? {
                            numSentences: 3,
                            highlightsPerUrl: 3,
                        }
                        : undefined,
                    summary: options.includeSummary
                        ? {
                            query: results[0]?.title || "",
                        }
                        : undefined,
                }),
            });
            return this.transformResults(contentsResponse.results);
        }
        catch (error) {
            console.error("[Exa] Failed to get contents:", error);
            // Fallback to basic results
            return this.transformResults(results);
        }
    }
    transformResults(data) {
        const results = data;
        const totalResults = results.length;
        // Exa Auto search nie zwraca score (od lipca 2025)
        // Obliczamy trafność na podstawie pozycji w wynikach
        // Pierwszy wynik = 95%, ostatni = 50% (wyniki są już posortowane wg trafności)
        return results.map((result, index) => {
            const id = this.generateResultId(result.url, "exa");
            // Oblicz trafność na podstawie pozycji (jeśli brak score)
            // Formuła: 0.95 - (index / totalResults) * 0.45
            // Pierwszy: 95%, Ostatni: ~50%
            const positionBasedScore = result.score !== undefined
                ? this.calculateRelevance(result.score, 1)
                : 0.95 - (index / Math.max(totalResults, 1)) * 0.45;
            return {
                id,
                title: result.title || "Untitled",
                url: result.url,
                content: result.text || result.summary || "",
                excerpt: this.createExcerpt(result),
                source: "exa",
                relevanceScore: positionBasedScore,
                publishDate: result.publishedDate,
                highlights: result.highlights || [],
                metadata: {
                    author: result.author,
                    documentType: this.detectDocumentType(result.url),
                    jurisdiction: this.detectJurisdiction(result.url),
                },
            };
        });
    }
    createExcerpt(result) {
        // Priority: highlights > summary > text
        if (result.highlights && result.highlights.length > 0) {
            return this.cleanText(result.highlights[0]);
        }
        if (result.summary) {
            return this.truncate(this.cleanText(result.summary), 300);
        }
        if (result.text) {
            return this.truncate(this.cleanText(result.text), 300);
        }
        return "";
    }
    detectDocumentType(url) {
        const domain = this.extractDomain(url);
        if (domain.includes("orzeczenia"))
            return "orzeczenie";
        if (domain.includes("isap") || domain.includes("dziennikustaw"))
            return "akt_prawny";
        if (domain.includes("rio"))
            return "stanowisko_rio";
        if (domain.includes("bip"))
            return "dokument_bip";
        if (url.includes(".pdf"))
            return "pdf";
        return undefined;
    }
    detectJurisdiction(url) {
        const domain = this.extractDomain(url);
        if (domain.includes("nsa"))
            return "NSA";
        if (domain.includes("wsa"))
            return "WSA";
        if (domain.includes("sn.pl"))
            return "SN";
        if (domain.includes("trybunal"))
            return "TK";
        return undefined;
    }
    getAuthHeaders() {
        return {
            "x-api-key": this.config.apiKey,
            accept: "application/json",
        };
    }
}
//# sourceMappingURL=exa-provider.js.map