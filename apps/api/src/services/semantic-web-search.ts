/**
 * Semantic Web Search Service
 * - Wyszukiwanie semantyczne w internecie
 * - Ważenie wyników na podstawie wiarygodności źródła
 * - Wykrywanie fake newsów i nieprawdziwych informacji
 * - Cross-referencing między źródłami
 */

/* global fetch, URL */

import OpenAI from "openai";
import { getLLMClient, getAIConfig } from "../ai/index.js";

// ============================================================================
// TYPES
// ============================================================================

export interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
  content?: string;
  publishedDate?: string;
  author?: string;
  domain: string;
}

export interface CredibilityScore {
  overall: number; // 0-100
  domainTrust: number; // 0-100
  contentQuality: number; // 0-100
  factualAccuracy: number; // 0-100
  biasLevel: number; // 0-100 (0 = no bias, 100 = highly biased)
  freshness: number; // 0-100
  flags: CredibilityFlag[];
}

export interface CredibilityFlag {
  type:
    | "fake_news"
    | "misleading"
    | "outdated"
    | "biased"
    | "unverified"
    | "satire"
    | "opinion";
  severity: "low" | "medium" | "high";
  reason: string;
}

export interface VerifiedResult extends WebSearchResult {
  credibility: CredibilityScore;
  crossReferences: CrossReference[];
  weightedScore: number;
  isReliable: boolean;
  warnings: string[];
}

export interface CrossReference {
  claim: string;
  supportingSources: number;
  contradictingSources: number;
  confidence: number;
}

export interface SemanticSearchQuery {
  query: string;
  maxResults?: number;
  minCredibility?: number;
  requireCrossReference?: boolean;
  excludeDomains?: string[];
  preferredDomains?: string[];
  language?: string;
}

export interface SemanticSearchResponse {
  success: boolean;
  query: string;
  results: VerifiedResult[];
  summary: string;
  overallConfidence: number;
  warnings: string[];
  processingTimeMs: number;
  sourcesAnalyzed: number;
  reliableSourcesCount: number;
}

// ============================================================================
// DOMAIN CREDIBILITY DATABASE
// ============================================================================

const TRUSTED_DOMAINS: Record<string, number> = {
  // Oficjalne źródła rządowe PL
  "gov.pl": 95,
  "sejm.gov.pl": 95,
  "isap.sejm.gov.pl": 95,
  "stat.gov.pl": 95,
  "bdl.stat.gov.pl": 95,
  "bip.gov.pl": 90,
  "funduszeeuropejskie.gov.pl": 90,
  "geoportal.gov.pl": 90,
  "ms.gov.pl": 90,
  "mf.gov.pl": 90,

  // Samorządy
  "bip.": 85, // wildcard for BIP domains

  // Oficjalne źródła EU
  "europa.eu": 90,
  "eur-lex.europa.eu": 95,

  // Agencje prasowe
  "pap.pl": 85,
  "reuters.com": 85,
  "apnews.com": 85,

  // Renomowane media
  "tvn24.pl": 75,
  "onet.pl": 70,
  "wp.pl": 70,
  "gazeta.pl": 70,
  "rp.pl": 75,
  "wyborcza.pl": 70,
  "polskieradio.pl": 75,
  "tvp.info": 70,

  // Źródła naukowe/edukacyjne
  ".edu.pl": 85,
  ".edu": 85,
  "wikipedia.org": 65, // Wymaga weryfikacji
  "scholar.google.com": 80,

  // Źródła prawne
  "sip.lex.pl": 85,
  "legalis.pl": 85,
};

const UNTRUSTED_DOMAINS: string[] = [
  "niepoprawni.pl",
  "niezalezna.pl",
  "wolnemedia.net",
  // Add more known unreliable sources
];

const SATIRE_DOMAINS: string[] = [
  "aszdziennik.pl",
  "theonion.com",
  "babylonbee.com",
];

// ============================================================================
// SEMANTIC WEB SEARCH SERVICE
// ============================================================================

export class SemanticWebSearchService {
  private userId: string;
  private llmClient: OpenAI | null = null;
  private model: string = "gpt-4o-mini";

  constructor(userId: string) {
    this.userId = userId;
  }

  private async initialize(): Promise<void> {
    if (this.llmClient) return;
    this.llmClient = await getLLMClient(this.userId);
    const config = await getAIConfig(this.userId, "llm");
    this.model = config.modelName;
  }

  /**
   * Main search method with credibility verification
   */
  async search(query: SemanticSearchQuery): Promise<SemanticSearchResponse> {
    const startTime = Date.now();
    await this.initialize();

    const results: VerifiedResult[] = [];
    const warnings: string[] = [];

    try {
      // 1. Wykonaj wyszukiwanie (symulacja - w produkcji użyj prawdziwego API)
      const rawResults = await this.performWebSearch(query);

      // 2. Oceń wiarygodność każdego wyniku
      for (const result of rawResults) {
        const credibility = await this.assessCredibility(result, query.query);
        const crossRefs = query.requireCrossReference
          ? await this.crossReference(result, rawResults)
          : [];

        const weightedScore = this.calculateWeightedScore(
          credibility,
          crossRefs,
        );
        const isReliable = weightedScore >= (query.minCredibility || 50);

        const verified: VerifiedResult = {
          ...result,
          credibility,
          crossReferences: crossRefs,
          weightedScore,
          isReliable,
          warnings: this.generateWarnings(credibility),
        };

        results.push(verified);
      }

      // 3. Sortuj po ważonym score
      results.sort((a, b) => b.weightedScore - a.weightedScore);

      // 4. Filtruj po minimalnej wiarygodności
      const filteredResults = query.minCredibility
        ? results.filter((r) => r.weightedScore >= query.minCredibility!)
        : results;

      // 5. Generuj podsumowanie
      const summary = await this.generateSummary(filteredResults, query.query);

      // 6. Oblicz ogólną pewność
      const overallConfidence =
        this.calculateOverallConfidence(filteredResults);

      // 7. Dodaj globalne ostrzeżenia
      if (filteredResults.length < 3) {
        warnings.push(
          "Mało wiarygodnych źródeł - zalecana dodatkowa weryfikacja",
        );
      }

      const contradictions = this.detectContradictions(filteredResults);
      if (contradictions.length > 0) {
        warnings.push(
          `Wykryto sprzeczne informacje w ${contradictions.length} źródłach`,
        );
      }

      return {
        success: true,
        query: query.query,
        results: filteredResults.slice(0, query.maxResults || 10),
        summary,
        overallConfidence,
        warnings,
        processingTimeMs: Date.now() - startTime,
        sourcesAnalyzed: rawResults.length,
        reliableSourcesCount: filteredResults.filter((r) => r.isReliable)
          .length,
      };
    } catch (error) {
      console.error("[SemanticWebSearch] Error:", error);
      return {
        success: false,
        query: query.query,
        results: [],
        summary: "Wystąpił błąd podczas wyszukiwania",
        overallConfidence: 0,
        warnings: [error instanceof Error ? error.message : "Unknown error"],
        processingTimeMs: Date.now() - startTime,
        sourcesAnalyzed: 0,
        reliableSourcesCount: 0,
      };
    }
  }

  /**
   * Perform web search using Brave Search API or fallback
   */
  private async performWebSearch(
    query: SemanticSearchQuery,
  ): Promise<WebSearchResult[]> {
    console.log(`[SemanticWebSearch] Performing search for: "${query.query}"`);

    const results: WebSearchResult[] = [];

    // Try Brave Search API first
    const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (braveApiKey) {
      try {
        const braveResults = await this.searchWithBrave(
          query.query,
          braveApiKey,
          query.maxResults || 10,
        );
        results.push(...braveResults);
      } catch (error) {
        console.error("[SemanticWebSearch] Brave Search failed:", error);
      }
    }

    // If no results from Brave, try DuckDuckGo (no API key needed)
    if (results.length === 0) {
      try {
        const ddgResults = await this.searchWithDuckDuckGo(
          query.query,
          query.maxResults || 10,
        );
        results.push(...ddgResults);
      } catch (error) {
        console.error("[SemanticWebSearch] DuckDuckGo Search failed:", error);
      }
    }

    // Filter by preferred/excluded domains
    let filteredResults = results;

    if (query.excludeDomains && query.excludeDomains.length > 0) {
      filteredResults = filteredResults.filter(
        (r) => !query.excludeDomains!.some((d) => r.domain.includes(d)),
      );
    }

    if (query.preferredDomains && query.preferredDomains.length > 0) {
      const preferred = filteredResults.filter((r) =>
        query.preferredDomains!.some((d) => r.domain.includes(d)),
      );
      const others = filteredResults.filter(
        (r) => !query.preferredDomains!.some((d) => r.domain.includes(d)),
      );
      filteredResults = [...preferred, ...others];
    }

    return filteredResults.slice(0, query.maxResults || 10);
  }

  /**
   * Search using Brave Search API
   */
  private async searchWithBrave(
    query: string,
    apiKey: string,
    count: number,
  ): Promise<WebSearchResult[]> {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", Math.min(count, 20).toString());
    url.searchParams.set("search_lang", "pl");
    url.searchParams.set("country", "PL");
    url.searchParams.set("safesearch", "moderate");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      web?: {
        results?: Array<{
          url: string;
          title: string;
          description: string;
          page_age?: string;
          profile?: { name?: string };
        }>;
      };
    };

    return (data.web?.results || []).map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.description,
      domain: new URL(r.url).hostname,
      publishedDate: r.page_age,
      author: r.profile?.name,
    }));
  }

  /**
   * Search using DuckDuckGo HTML API (no key needed, rate limited)
   */
  private async searchWithDuckDuckGo(
    query: string,
    count: number,
  ): Promise<WebSearchResult[]> {
    // DuckDuckGo Instant Answer API
    const url = new URL("https://api.duckduckgo.com/");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("no_redirect", "1");
    url.searchParams.set("no_html", "1");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "AsystentRadnego/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      AbstractText?: string;
      AbstractSource?: string;
      AbstractURL?: string;
      RelatedTopics?: Array<{
        Text?: string;
        FirstURL?: string;
      }>;
    };

    const results: WebSearchResult[] = [];

    // Add abstract if exists
    if (data.AbstractText && data.AbstractURL) {
      results.push({
        url: data.AbstractURL,
        title: data.AbstractSource || "Wikipedia",
        snippet: data.AbstractText,
        domain: new URL(data.AbstractURL).hostname,
      });
    }

    // Add related topics
    for (const topic of (data.RelatedTopics || []).slice(0, count - 1)) {
      if (topic.FirstURL && topic.Text) {
        try {
          results.push({
            url: topic.FirstURL,
            title: topic.Text.split(" - ")[0] || topic.Text.substring(0, 50),
            snippet: topic.Text,
            domain: new URL(topic.FirstURL).hostname,
          });
        } catch {
          // Invalid URL, skip
        }
      }
    }

    return results;
  }

  /**
   * Assess credibility of a single result
   */
  private async assessCredibility(
    result: WebSearchResult,
    originalQuery: string,
  ): Promise<CredibilityScore> {
    const flags: CredibilityFlag[] = [];

    // 1. Domain trust score
    const domainTrust = this.getDomainTrust(result.domain);

    // 2. Check for known problematic domains
    if (UNTRUSTED_DOMAINS.some((d) => result.domain.includes(d))) {
      flags.push({
        type: "fake_news",
        severity: "high",
        reason: "Domena znana z rozpowszechniania dezinformacji",
      });
    }

    if (SATIRE_DOMAINS.some((d) => result.domain.includes(d))) {
      flags.push({
        type: "satire",
        severity: "medium",
        reason: "Strona satyryczna - nie traktować jako źródło faktów",
      });
    }

    // 3. Content quality analysis (using LLM)
    const contentAnalysis = await this.analyzeContentQuality(
      result,
      originalQuery,
    );

    // 4. Freshness score
    const freshness = this.calculateFreshness(result.publishedDate);

    // 5. Combine scores
    const overall = Math.round(
      domainTrust * 0.3 +
        contentAnalysis.quality * 0.3 +
        contentAnalysis.factualAccuracy * 0.25 +
        freshness * 0.15,
    );

    return {
      overall,
      domainTrust,
      contentQuality: contentAnalysis.quality,
      factualAccuracy: contentAnalysis.factualAccuracy,
      biasLevel: contentAnalysis.biasLevel,
      freshness,
      flags: [...flags, ...contentAnalysis.flags],
    };
  }

  /**
   * Get domain trust score
   */
  private getDomainTrust(domain: string): number {
    // Check exact match first
    if (TRUSTED_DOMAINS[domain]) {
      return TRUSTED_DOMAINS[domain];
    }

    // Check partial matches (e.g., "bip." prefix)
    for (const [pattern, score] of Object.entries(TRUSTED_DOMAINS)) {
      if (domain.includes(pattern)) {
        return score;
      }
    }

    // Check for government/official domains
    if (domain.endsWith(".gov.pl") || domain.endsWith(".gov")) {
      return 85;
    }

    // Check for educational domains
    if (domain.endsWith(".edu.pl") || domain.endsWith(".edu")) {
      return 80;
    }

    // Default score for unknown domains
    return 50;
  }

  /**
   * Analyze content quality using LLM
   */
  private async analyzeContentQuality(
    result: WebSearchResult,
    originalQuery: string,
  ): Promise<{
    quality: number;
    factualAccuracy: number;
    biasLevel: number;
    flags: CredibilityFlag[];
  }> {
    if (!this.llmClient) {
      return { quality: 50, factualAccuracy: 50, biasLevel: 50, flags: [] };
    }

    const contentToAnalyze = result.content || result.snippet;

    try {
      const response = await this.llmClient.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `Jesteś ekspertem od weryfikacji faktów i analizy wiarygodności treści.
Oceń poniższy tekst pod kątem:
1. Jakości treści (0-100): czy jest profesjonalnie napisany, ma źródła, jest merytoryczny
2. Dokładności faktycznej (0-100): czy informacje wydają się prawdziwe i weryfikowalne
3. Poziomu stronniczości (0-100): 0 = neutralny, 100 = bardzo stronniczy

Zwróć uwagę na:
- Język emocjonalny vs merytoryczny
- Obecność źródeł i cytatów
- Spójność z powszechnie znanymi faktami
- Oznaki propagandy lub manipulacji

Odpowiedz TYLKO w formacie JSON:
{
  "quality": <number>,
  "factualAccuracy": <number>,
  "biasLevel": <number>,
  "flags": [
    {"type": "misleading|fake_news|biased|opinion|unverified", "severity": "low|medium|high", "reason": "..."}
  ]
}`,
          },
          {
            role: "user",
            content: `Zapytanie użytkownika: "${originalQuery}"

Treść do analizy (źródło: ${result.domain}):
"${contentToAnalyze.substring(0, 2000)}"

Tytuł: "${result.title}"`,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const analysis = JSON.parse(
        response.choices[0]?.message?.content || "{}",
      );

      return {
        quality: analysis.quality || 50,
        factualAccuracy: analysis.factualAccuracy || 50,
        biasLevel: analysis.biasLevel || 50,
        flags: analysis.flags || [],
      };
    } catch (error) {
      console.error("[SemanticWebSearch] Content analysis error:", error);
      return { quality: 50, factualAccuracy: 50, biasLevel: 50, flags: [] };
    }
  }

  /**
   * Cross-reference information between sources
   */
  private async crossReference(
    result: WebSearchResult,
    allResults: WebSearchResult[],
  ): Promise<CrossReference[]> {
    if (!this.llmClient || allResults.length < 2) {
      return [];
    }

    try {
      // Extract key claims from the result
      const claimsResponse = await this.llmClient.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `Wyodrębnij kluczowe twierdzenia faktyczne z tekstu. Zwróć max 3 najważniejsze.
Odpowiedz TYLKO w formacie JSON:
{ "claims": ["twierdzenie1", "twierdzenie2"] }`,
          },
          {
            role: "user",
            content: result.content || result.snippet,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const { claims } = JSON.parse(
        claimsResponse.choices[0]?.message?.content || '{"claims":[]}',
      );

      const crossRefs: CrossReference[] = [];

      for (const claim of claims) {
        let supporting = 0;
        let contradicting = 0;

        // Check each other source for support/contradiction
        for (const other of allResults) {
          if (other.url === result.url) continue;

          const otherContent = other.content || other.snippet;

          // Simple semantic similarity check
          const verifyResponse = await this.llmClient.chat.completions.create({
            model: this.model,
            messages: [
              {
                role: "system",
                content: `Czy poniższy tekst POTWIERDZA, ZAPRZECZA, czy jest NEUTRALNY wobec twierdzenia?
Odpowiedz TYLKO: "supports", "contradicts", lub "neutral"`,
              },
              {
                role: "user",
                content: `Twierdzenie: "${claim}"

Tekst: "${otherContent.substring(0, 1000)}"`,
              },
            ],
            temperature: 0.1,
          });

          const verdict = verifyResponse.choices[0]?.message?.content
            ?.toLowerCase()
            .trim();

          if (verdict?.includes("supports")) supporting++;
          else if (verdict?.includes("contradicts")) contradicting++;
        }

        crossRefs.push({
          claim,
          supportingSources: supporting,
          contradictingSources: contradicting,
          confidence:
            supporting > contradicting
              ? Math.min(100, 50 + supporting * 15 - contradicting * 20)
              : Math.max(0, 50 - contradicting * 20 + supporting * 10),
        });
      }

      return crossRefs;
    } catch (error) {
      console.error("[SemanticWebSearch] Cross-reference error:", error);
      return [];
    }
  }

  /**
   * Calculate weighted score
   */
  private calculateWeightedScore(
    credibility: CredibilityScore,
    crossRefs: CrossReference[],
  ): number {
    let score = credibility.overall;

    // Penalty for high bias
    if (credibility.biasLevel > 70) {
      score -= (credibility.biasLevel - 70) * 0.5;
    }

    // Penalty for flags
    for (const flag of credibility.flags) {
      if (flag.type === "fake_news")
        score -= flag.severity === "high" ? 40 : 20;
      else if (flag.type === "misleading")
        score -= flag.severity === "high" ? 30 : 15;
      else if (flag.type === "satire") score -= 50;
      else if (flag.type === "biased")
        score -= flag.severity === "high" ? 20 : 10;
    }

    // Bonus/penalty from cross-references
    if (crossRefs.length > 0) {
      const avgConfidence =
        crossRefs.reduce((sum, cr) => sum + cr.confidence, 0) /
        crossRefs.length;
      score = score * 0.7 + avgConfidence * 0.3;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate freshness score based on publish date
   */
  private calculateFreshness(publishedDate?: string): number {
    if (!publishedDate) return 50; // Unknown = neutral

    try {
      const published = new Date(publishedDate);
      const now = new Date();
      const daysDiff =
        (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff < 7) return 100;
      if (daysDiff < 30) return 90;
      if (daysDiff < 90) return 80;
      if (daysDiff < 365) return 70;
      if (daysDiff < 730) return 50;
      return 30;
    } catch {
      return 50;
    }
  }

  /**
   * Generate warnings for a result
   */
  private generateWarnings(credibility: CredibilityScore): string[] {
    const warnings: string[] = [];

    if (credibility.domainTrust < 50) {
      warnings.push("Źródło o niskiej wiarygodności");
    }

    if (credibility.biasLevel > 70) {
      warnings.push("Treść może być stronnicza");
    }

    if (credibility.factualAccuracy < 50) {
      warnings.push("Niska dokładność faktyczna - wymaga weryfikacji");
    }

    for (const flag of credibility.flags) {
      if (flag.type === "fake_news")
        warnings.push(`⚠️ FAKE NEWS: ${flag.reason}`);
      else if (flag.type === "misleading")
        warnings.push(`⚠️ Wprowadzające w błąd: ${flag.reason}`);
      else if (flag.type === "satire")
        warnings.push(`🎭 Satyra - nie jest źródłem faktów`);
      else if (flag.type === "outdated")
        warnings.push(`📅 Informacja może być nieaktualna`);
    }

    return warnings;
  }

  /**
   * Detect contradictions between results
   */
  private detectContradictions(results: VerifiedResult[]): string[] {
    const contradictions: string[] = [];

    for (const result of results) {
      for (const crossRef of result.crossReferences) {
        if (crossRef.contradictingSources > crossRef.supportingSources) {
          contradictions.push(
            `"${crossRef.claim}" - ${crossRef.contradictingSources} źródeł zaprzecza`,
          );
        }
      }
    }

    return contradictions;
  }

  /**
   * Calculate overall confidence in search results
   */
  private calculateOverallConfidence(results: VerifiedResult[]): number {
    if (results.length === 0) return 0;

    const reliableCount = results.filter((r) => r.isReliable).length;
    const avgScore =
      results.reduce((sum, r) => sum + r.weightedScore, 0) / results.length;

    // Factor in number of reliable sources
    const sourceFactor = Math.min(1, reliableCount / 3);

    return Math.round(avgScore * (0.7 + 0.3 * sourceFactor));
  }

  /**
   * Generate summary of findings
   */
  private async generateSummary(
    results: VerifiedResult[],
    query: string,
  ): Promise<string> {
    if (!this.llmClient || results.length === 0) {
      return "Brak wystarczających danych do podsumowania.";
    }

    try {
      const sourcesInfo = results.slice(0, 5).map((r) => ({
        title: r.title,
        snippet: r.snippet?.substring(0, 300),
        credibility: r.weightedScore,
        warnings: r.warnings,
      }));

      const response = await this.llmClient.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `Podsumuj zebrane informacje w 2-3 zdaniach. Uwzględnij:
- Główne ustalenia
- Poziom pewności (na podstawie wiarygodności źródeł)
- Ewentualne rozbieżności między źródłami

Bądź obiektywny i precyzyjny.`,
          },
          {
            role: "user",
            content: `Zapytanie: "${query}"

Źródła (${results.length} znalezionych, od najbardziej wiarygodnych):
${JSON.stringify(sourcesInfo, null, 2)}`,
          },
        ],
        temperature: 0.5,
      });

      return (
        response.choices[0]?.message?.content ||
        "Nie udało się wygenerować podsumowania."
      );
    } catch (error) {
      console.error("[SemanticWebSearch] Summary generation error:", error);
      return "Błąd podczas generowania podsumowania.";
    }
  }
}

// ============================================================================
// EXPORTED FUNCTION
// ============================================================================

export async function semanticWebSearch(
  userId: string,
  query: SemanticSearchQuery,
): Promise<SemanticSearchResponse> {
  const service = new SemanticWebSearchService(userId);
  return service.search(query);
}
