/**
 * Deep Research Service - Research Orchestrator
 * Agent AI "Winsdurf" - Deep Internet Researcher
 * Main service coordinating multi-provider research with AI synthesis
 */

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import type {
  DeepResearchRequest,
  DeepResearchReport,
  ResearchResult,
  SearchOptions,
} from "@aasystent-radnego/shared";
import { ExaProvider } from "./research-providers/exa-provider.js";
import { TavilyProvider } from "./research-providers/tavily-provider.js";
import { SerperProvider } from "./research-providers/serper-provider.js";
import { BraveProvider } from "./research-providers/brave-provider.js";
import { BaseResearchProvider } from "./research-providers/base-provider.js";
import {
  RESEARCH_PROVIDERS,
  SEARCH_DEPTH_CONFIG,
  getDomainsForResearchType,
} from "../config/research-providers.js";
import { getLLMClient, getAIConfig } from "../ai/index.js";

// Type definitions for Supabase queries
interface ApiConfigRow {
  provider: string;
  api_key_encrypted: string;
  is_active: boolean;
}

interface ProcessedDocumentRow {
  id: string;
  title: string;
  content: string;
  document_type: string;
  publish_date: string | null;
  processed_at: string | null;
}

interface ResearchReportInsert {
  id: string;
  user_id: string;
  query: string;
  research_type: string;
  depth: string;
  summary: string;
  key_findings: string[];
  results: ResearchResult[];
  sources: { name: string; count: number; avgRelevance: number }[];
  related_queries: string[];
  confidence: number;
  processing_time: number;
  created_at: string;
}

export class DeepResearchService {
  private providers: Map<string, BaseResearchProvider>;
  private openai: OpenAI;
  private supabase: ReturnType<typeof createClient>;
  private userId: string;
  private initialized: boolean = false;
  private model: string = "gpt-4";

  constructor(userId: string) {
    this.userId = userId;
    this.providers = new Map();

    // Initialize Supabase
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // OpenAI will be initialized in initializeProviders()
    this.openai = null as unknown as OpenAI;
  }

  private async initializeProviders(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log(`[DeepResearch] Initializing for user: ${this.userId}`);

      // Initialize LLM client via AIClientFactory - REQUIRED
      this.openai = await getLLMClient(this.userId);
      const llmConfig = await getAIConfig(this.userId, "llm");
      this.model = llmConfig.modelName;
      console.log(
        `[DeepResearch] Using LLM: provider=${llmConfig.provider}, model=${this.model}`,
      );

      if (!this.openai) {
        throw new Error(
          "Brak skonfigurowanego klienta LLM. Skonfiguruj providera AI w ustawieniach.",
        );
      }

      // Get research provider configs (Exa, Tavily, Serper, Brave)
      const { data: configs, error } = await this.supabase
        .from("api_configurations")
        .select("provider, api_key_encrypted, is_active")
        .eq("user_id", this.userId)
        .eq("is_active", true)
        .in("provider", ["exa", "tavily", "serper", "brave", "firecrawl"]);

      if (error) throw error;

      const apiKeys: Record<string, string> = {};

      // Map API keys for research providers (decode from base64)
      for (const config of (configs || []) as ApiConfigRow[]) {
        apiKeys[config.provider] = Buffer.from(
          config.api_key_encrypted,
          "base64",
        ).toString("utf-8");
      }

      console.log(
        `[DeepResearch] Found research providers:`,
        Object.keys(apiKeys),
      );

      // Initialize Exa AI
      if (apiKeys.exa) {
        const config = {
          ...RESEARCH_PROVIDERS.exa,
          apiKey: apiKeys.exa,
          enabled: true,
        };
        this.providers.set("exa", new ExaProvider(config));
      }

      // Initialize Tavily AI
      if (apiKeys.tavily) {
        const config = {
          ...RESEARCH_PROVIDERS.tavily,
          apiKey: apiKeys.tavily,
          enabled: true,
        };
        this.providers.set("tavily", new TavilyProvider(config));
      }

      // Initialize Serper (Google)
      if (apiKeys.serper) {
        const config = {
          ...RESEARCH_PROVIDERS.serper,
          apiKey: apiKeys.serper,
          enabled: true,
        };
        this.providers.set("serper", new SerperProvider(config));
      }

      // Initialize Brave Search
      if (apiKeys.brave) {
        const config = {
          ...RESEARCH_PROVIDERS.brave,
          apiKey: apiKeys.brave,
          enabled: true,
        };
        this.providers.set("brave", new BraveProvider(config));
      }

      // Fallback to env vars if no DB configs
      if (this.providers.size === 0) {
        console.log("[DeepResearch] No API keys in DB, using env vars");

        if (RESEARCH_PROVIDERS.exa.enabled) {
          this.providers.set("exa", new ExaProvider(RESEARCH_PROVIDERS.exa));
        }
        if (RESEARCH_PROVIDERS.tavily.enabled) {
          this.providers.set(
            "tavily",
            new TavilyProvider(RESEARCH_PROVIDERS.tavily),
          );
        }
        if (RESEARCH_PROVIDERS.serper.enabled) {
          this.providers.set(
            "serper",
            new SerperProvider(RESEARCH_PROVIDERS.serper),
          );
        }
      }

      this.initialized = true;
      console.log(
        `[DeepResearch] Initialized ${this.providers.size} providers`,
      );
    } catch (error) {
      console.error("[DeepResearch] Failed to initialize providers:", error);
      this.initialized = true; // Prevent retry loops
    }
  }

  /**
   * Get base URL for LLM provider
   */
  private getProviderBaseUrl(provider: string): string {
    const urls: Record<string, string> = {
      openai: "https://api.openai.com/v1",
      azure: "",
      google: "https://generativelanguage.googleapis.com/v1beta/openai",
      anthropic: "https://api.anthropic.com/v1",
      moonshot: "https://api.moonshot.cn/v1",
      deepseek: "https://api.deepseek.com/v1",
      qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      zhipu: "https://open.bigmodel.cn/api/paas/v4",
      mistral: "https://api.mistral.ai/v1",
      cohere: "https://api.cohere.ai/v1",
      together: "https://api.together.xyz/v1",
      groq: "https://api.groq.com/openai/v1",
      local: "http://localhost:11434/v1",
    };
    return urls[provider] || "https://api.openai.com/v1";
  }

  /**
   * Main research method - orchestrates multi-provider search and AI synthesis
   */
  async research(request: DeepResearchRequest): Promise<DeepResearchReport> {
    const startTime = Date.now();
    console.log(`[DeepResearch] Starting research: "${request.query}"`);

    // Initialize providers from database
    await this.initializeProviders();

    try {
      // 1. Decompose complex queries (for deep research)
      const queries =
        request.depth === "deep"
          ? await this.decomposeQuery(request.query)
          : [request.query];

      console.log(`[DeepResearch] Queries to search: ${queries.length}`);

      // 2. Multi-provider search
      const allResults = await this.multiProviderSearch(queries, request);

      // 3. Merge with local sources
      const localResults = await this.searchLocalSources(request.query);
      allResults.push(...localResults);

      console.log(
        `[DeepResearch] Total results before dedup: ${allResults.length}`,
      );

      // 4. Deduplication & ranking
      const rankedResults = await this.rankAndDeduplicate(allResults);

      console.log(
        `[DeepResearch] Results after dedup: ${rankedResults.length}`,
      );

      // 5. Generate AI summary
      const summary = await this.generateSummary(request.query, rankedResults);

      // 6. Extract key findings
      const keyFindings = await this.extractKeyFindings(
        request.query,
        rankedResults,
      );

      // 7. Generate related queries
      const relatedQueries = await this.generateRelatedQueries(request.query);

      // 8. Calculate confidence
      const confidence = this.calculateConfidence(rankedResults);

      const processingTime = Date.now() - startTime;

      const report: DeepResearchReport = {
        id: randomUUID(),
        query: request.query,
        researchType: request.researchType,
        depth: request.depth,
        summary,
        keyFindings,
        results: rankedResults.slice(0, request.maxResults || 20),
        sources: this.aggregateSources(rankedResults),
        relatedQueries,
        confidence,
        generatedAt: new Date().toISOString(),
        processingTime,
      };

      // Save report to database
      await this.saveReport(report);

      console.log(`[DeepResearch] Research completed in ${processingTime}ms`);

      return report;
    } catch (error) {
      console.error("[DeepResearch] Research failed:", error);
      throw error;
    }
  }

  /**
   * Decompose complex query into sub-queries using GPT-4
   */
  private async decomposeQuery(query: string): Promise<string[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "Jesteś ekspertem od researchu. Rozłóż pytanie na 2-4 prostsze pod-pytania do wyszukiwania. ZAWSZE zwracaj pytania, NIGDY nie odmawiaj. Zwróć tylko listę pytań, każde w nowej linii, bez numeracji.",
          },
          {
            role: "user",
            content: `Rozłóż to pytanie na pod-pytania: ${query}`,
          },
        ],
        temperature: 0.3,
      });

      const response = completion.choices[0].message.content?.trim() || "";

      // Check for refusal patterns
      const refusalPatterns = [
        "i'm sorry",
        "i can't",
        "i cannot",
        "nie mogę",
        "przepraszam",
        "sorry, but",
        "unable to",
      ];

      const isRefusal = refusalPatterns.some((pattern) =>
        response.toLowerCase().includes(pattern),
      );

      if (isRefusal || response.length < 10) {
        console.log(
          "[DeepResearch] LLM refused or invalid response, using original query",
        );
        return [query];
      }

      const subQueries = response
        .split("\n")
        .map((q) => q.replace(/^[-*\d.)\s]+/, "").trim())
        .filter((q) => q.length > 10);

      return subQueries.length > 0 ? subQueries : [query];
    } catch (error) {
      console.error("[DeepResearch] Query decomposition failed:", error);
      return [query];
    }
  }

  /**
   * Search across multiple providers
   */
  private async multiProviderSearch(
    queries: string[],
    request: DeepResearchRequest,
  ): Promise<ResearchResult[]> {
    const depthConfig = SEARCH_DEPTH_CONFIG[request.depth];
    const activeProviders = Array.from(this.providers.entries())
      .filter(([name]) => depthConfig.providers.includes(name))
      .sort(([, a], [, b]) => a.getPriority() - b.getPriority());

    console.log(
      `[DeepResearch] Using providers: ${activeProviders
        .map(([name]) => name)
        .join(", ")}`,
    );

    const allResults: ResearchResult[] = [];

    // Get priority domains for research type
    const priorityDomains =
      request.sources || getDomainsForResearchType(request.researchType);

    const searchOptions: SearchOptions = {
      maxResults: Math.ceil(depthConfig.maxResults / queries.length),
      domains: priorityDomains,
      dateFrom: request.dateRange?.from,
      dateTo: request.dateRange?.to,
      includeHighlights: true,
      includeSummary: request.depth === "deep",
    };

    // Search each query across providers
    for (const query of queries) {
      for (const [name, provider] of activeProviders) {
        try {
          console.log(`[DeepResearch] Searching "${query}" with ${name}`);
          const results = await provider.search(query, searchOptions);
          allResults.push(...results);
        } catch (error) {
          console.error(`[DeepResearch] Provider ${name} failed:`, error);
        }
      }
    }

    return allResults;
  }

  /**
   * Search local sources (ISAP, RIO, WSA/NSA from database)
   */
  private async searchLocalSources(query: string): Promise<ResearchResult[]> {
    try {
      // Search in processed_documents using full-text search
      const { data, error } = await this.supabase
        .from("processed_documents")
        .select("id, title, content, document_type, publish_date, processed_at")
        .textSearch("content", query, { type: "websearch", config: "simple" })
        .limit(10);

      if (error) throw error;

      return ((data || []) as ProcessedDocumentRow[]).map((doc) => ({
        id: `local-${doc.id}`,
        title: doc.title,
        url: `#/documents/${doc.id}`,
        content: doc.content,
        excerpt: doc.content.substring(0, 300) + "...",
        source: "local" as const,
        relevanceScore: 0.8, // High relevance for local sources
        publishDate: doc.publish_date || doc.processed_at || undefined,
        metadata: {
          documentType: doc.document_type,
        },
      }));
    } catch (error) {
      console.error("[DeepResearch] Local search failed:", error);
      return [];
    }
  }

  /**
   * Deduplicate and rank results
   */
  private async rankAndDeduplicate(
    results: ResearchResult[],
  ): Promise<ResearchResult[]> {
    // 1. Deduplicate by URL similarity
    const uniqueResults = new Map<string, ResearchResult>();

    for (const result of results) {
      const normalizedUrl = this.normalizeUrl(result.url);

      if (!uniqueResults.has(normalizedUrl)) {
        uniqueResults.set(normalizedUrl, result);
      } else {
        // Keep result with higher relevance score
        const existing = uniqueResults.get(normalizedUrl)!;
        if (result.relevanceScore > existing.relevanceScore) {
          uniqueResults.set(normalizedUrl, result);
        }
      }
    }

    // 2. Convert to array and sort by relevance
    let rankedResults = Array.from(uniqueResults.values());

    // 3. Boost local sources
    rankedResults = rankedResults.map((result) => {
      if (result.source === "local") {
        return { ...result, relevanceScore: result.relevanceScore * 1.2 };
      }
      return result;
    });

    // 4. Sort by relevance score
    rankedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return rankedResults;
  }

  /**
   * Generate AI summary of research results
   */
  private async generateSummary(
    query: string,
    results: ResearchResult[],
  ): Promise<string> {
    try {
      const topResults = results.slice(0, 10);
      const context = topResults
        .map((r, i) => `${i + 1}. ${r.title}\n${r.excerpt}`)
        .join("\n\n");

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "Jesteś ekspertem prawnym. Na podstawie wyników researchu napisz zwięzłe podsumowanie (2-3 akapity) odpowiadające na pytanie użytkownika.",
          },
          {
            role: "user",
            content: `Pytanie: ${query}\n\nWyniki researchu:\n${context}\n\nPodsumowanie:`,
          },
        ],
        temperature: 0.5,
        max_tokens: 500,
      });

      return completion.choices[0].message.content || "Brak podsumowania.";
    } catch (error) {
      console.error("[DeepResearch] Summary generation failed:", error);
      return "Nie udało się wygenerować podsumowania.";
    }
  }

  /**
   * Extract key findings from results
   */
  private async extractKeyFindings(
    query: string,
    results: ResearchResult[],
  ): Promise<string[]> {
    try {
      const topResults = results.slice(0, 10);
      const context = topResults
        .map((r, i) => `${i + 1}. ${r.title}\n${r.excerpt}`)
        .join("\n\n");

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "Wyodrębnij 3-5 kluczowych ustaleń z wyników researchu. Każde ustalenie w osobnej linii, zwięźle (1-2 zdania).",
          },
          {
            role: "user",
            content: `Pytanie: ${query}\n\nWyniki:\n${context}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      const findings =
        completion.choices[0].message.content
          ?.split("\n")
          .map((f) => f.replace(/^[-*\d.)\s]+/, "").trim())
          .filter((f) => f.length > 10) || [];

      return findings.slice(0, 5);
    } catch (error) {
      console.error("[DeepResearch] Key findings extraction failed:", error);
      return [];
    }
  }

  /**
   * Generate related queries
   */
  private async generateRelatedQueries(query: string): Promise<string[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "Zaproponuj 3-5 powiązanych pytań prawnych, które mogą być przydatne. Każde pytanie w nowej linii.",
          },
          {
            role: "user",
            content: query,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      });

      const relatedQueries =
        completion.choices[0].message.content
          ?.split("\n")
          .map((q) => q.replace(/^[-*\d.)\s]+/, "").trim())
          .filter((q) => q.length > 10) || [];

      return relatedQueries.slice(0, 5);
    } catch (error) {
      console.error("[DeepResearch] Related queries generation failed:", error);
      return [];
    }
  }

  /**
   * Calculate confidence score based on cross-source verification
   * Pewność obliczana na podstawie potwierdzeń z wielu źródeł vs informacji sprzecznych
   */
  private calculateConfidence(results: ResearchResult[]): number {
    if (results.length === 0) return 0;

    // 1. Analiza potwierdzeń między źródłami (cross-source verification)
    const { confirmations, contradictions } =
      this.analyzeSourceAgreement(results);

    // 2. Różnorodność źródeł
    const uniqueSources = new Set(results.map((r) => r.source)).size;
    const sourceDiversityScore = Math.min(uniqueSources / 4, 1); // max 4 różne źródła = 100%

    // 3. Średnia trafność wyników (z obsługą undefined/NaN)
    const validScores = results.filter(
      (r) => typeof r.relevanceScore === "number" && !isNaN(r.relevanceScore),
    );
    const avgRelevance =
      validScores.length > 0
        ? validScores.reduce((sum, r) => sum + r.relevanceScore, 0) /
          validScores.length
        : 0.5; // domyślna wartość gdy brak score'ów

    // 4. Ilość wyników (więcej = większa baza do weryfikacji)
    const resultCountScore = Math.min(results.length / 10, 1); // 10+ wyników = max

    // 5. Obecność źródeł lokalnych (zaufanych)
    const hasLocalSources = results.some((r) => r.source === "local");
    const localSourceBonus = hasLocalSources ? 0.1 : 0;

    // 6. Stosunek potwierdzeń do sprzeczności
    const totalComparisons = confirmations + contradictions;
    const agreementRatio =
      totalComparisons > 0 ? confirmations / totalComparisons : 0.5; // brak porównań = neutralne 50%

    // 7. Kara za sprzeczności
    const contradictionPenalty =
      contradictions > 0
        ? Math.min(contradictions * 0.1, 0.3) // max 30% kary
        : 0;

    // Obliczenie końcowej pewności z wagami:
    // - 35% stosunek potwierdzeń
    // - 25% średnia trafność
    // - 15% różnorodność źródeł
    // - 15% ilość wyników
    // - 10% bonus za lokalne źródła
    // - minus kara za sprzeczności
    const confidence =
      agreementRatio * 0.35 +
      avgRelevance * 0.25 +
      sourceDiversityScore * 0.15 +
      resultCountScore * 0.15 +
      localSourceBonus -
      contradictionPenalty;

    console.log(`[DeepResearch] Confidence calculation:`, {
      results: results.length,
      confirmations,
      contradictions,
      agreementRatio: Math.round(agreementRatio * 100),
      avgRelevance: Math.round(avgRelevance * 100),
      sourceDiversity: uniqueSources,
      finalConfidence: Math.round(Math.max(0, Math.min(confidence, 1)) * 100),
    });

    return Math.max(0, Math.min(confidence, 1));
  }

  /**
   * Analyze agreement between sources by comparing content similarity
   * Wykrywa potwierdzenia i sprzeczności między źródłami
   */
  private analyzeSourceAgreement(results: ResearchResult[]): {
    confirmations: number;
    contradictions: number;
  } {
    let confirmations = 0;
    let contradictions = 0;

    // Grupuj wyniki według źródła
    const resultsBySource = new Map<string, ResearchResult[]>();
    for (const result of results) {
      const source = result.source;
      if (!resultsBySource.has(source)) {
        resultsBySource.set(source, []);
      }
      resultsBySource.get(source)!.push(result);
    }

    // Jeśli mniej niż 2 źródła, nie możemy porównywać
    if (resultsBySource.size < 2) {
      return { confirmations: 0, contradictions: 0 };
    }

    // Porównaj zawartość między różnymi źródłami
    const sources = Array.from(resultsBySource.keys());

    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const resultsA = resultsBySource.get(sources[i])!;
        const resultsB = resultsBySource.get(sources[j])!;

        // Porównaj każdy wynik z jednego źródła z wynikami z drugiego
        for (const a of resultsA) {
          for (const b of resultsB) {
            const similarity = this.calculateTextSimilarity(
              a.excerpt || a.content,
              b.excerpt || b.content,
            );

            // Wysoka podobieństwo = potwierdzenie
            if (similarity > 0.4) {
              confirmations++;
            }
            // Sprawdź sprzeczności (podobny temat, różne wnioski)
            else if (this.detectContradiction(a, b)) {
              contradictions++;
            }
          }
        }
      }
    }

    return { confirmations, contradictions };
  }

  /**
   * Calculate text similarity using Jaccard index on words
   */
  private calculateTextSimilarity(textA: string, textB: string): number {
    if (!textA || !textB) return 0;

    // Normalizuj i tokenizuj
    const normalize = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^\w\sąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3); // ignoruj krótkie słowa

    const wordsA = new Set(normalize(textA));
    const wordsB = new Set(normalize(textB));

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    // Jaccard index: intersection / union
    const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);

    return intersection.size / union.size;
  }

  /**
   * Detect contradiction between two results
   * Wykrywa sprzeczności na podstawie słów kluczowych negacji
   */
  private detectContradiction(a: ResearchResult, b: ResearchResult): boolean {
    const textA = (a.excerpt || a.content || "").toLowerCase();
    const textB = (b.excerpt || b.content || "").toLowerCase();

    // Słowa wskazujące na negację/sprzeczność
    const negationWords = [
      "nie ",
      "nieprawda",
      "błędne",
      "fałszywe",
      "sprzeczne",
      "wbrew",
      "przeciwnie",
      "jednak",
      "natomiast",
      "ale ",
      "odrzucono",
      "uchylono",
      "nieważne",
      "bezprawne",
    ];

    // Sprawdź czy teksty dotyczą podobnego tematu
    const similarity = this.calculateTextSimilarity(textA, textB);
    if (similarity < 0.15) return false; // różne tematy

    // Sprawdź czy jeden tekst neguje drugi
    for (const neg of negationWords) {
      const hasNegA = textA.includes(neg);
      const hasNegB = textB.includes(neg);

      // Jeden ma negację, drugi nie = potencjalna sprzeczność
      if (hasNegA !== hasNegB && similarity > 0.2) {
        return true;
      }
    }

    return false;
  }

  /**
   * Aggregate sources statistics
   */
  private aggregateSources(
    results: ResearchResult[],
  ): DeepResearchReport["sources"] {
    const sourceStats = new Map<
      string,
      { count: number; totalRelevance: number }
    >();

    for (const result of results) {
      const source = result.source;
      const stats = sourceStats.get(source) || { count: 0, totalRelevance: 0 };
      stats.count++;
      stats.totalRelevance += result.relevanceScore;
      sourceStats.set(source, stats);
    }

    return Array.from(sourceStats.entries()).map(([name, stats]) => ({
      name,
      count: stats.count,
      avgRelevance: stats.totalRelevance / stats.count,
    }));
  }

  /**
   * Save research report to database
   */
  private async saveReport(report: DeepResearchReport): Promise<void> {
    try {
      const insertData: ResearchReportInsert = {
        id: report.id,
        user_id: this.userId,
        query: report.query,
        research_type: report.researchType,
        depth: report.depth,
        summary: report.summary,
        key_findings: report.keyFindings,
        results: report.results,
        sources: report.sources,
        related_queries: report.relatedQueries,
        confidence: report.confidence,
        processing_time: report.processingTime,
        created_at: report.generatedAt,
      };
      const { error } = await this.supabase
        .from("research_reports")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(insertData as any);

      if (error) throw error;
    } catch (error) {
      console.error("[DeepResearch] Failed to save report:", error);
      // Don't throw - report generation succeeded even if save failed
    }
  }

  /**
   * Normalize URL for deduplication
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove trailing slash, www, and query params for comparison
      return (
        urlObj.hostname.replace(/^www\./, "") +
        urlObj.pathname.replace(/\/$/, "")
      );
    } catch {
      return url;
    }
  }

  /**
   * Verify a claim using multi-source research
   */
  async verifyClaim(
    claim: string,
  ): Promise<{ verified: boolean; evidence: ResearchResult[] }> {
    // TODO: Implement claim verification
    // This would search for supporting and contradicting evidence
    throw new Error(
      `Claim verification not yet implemented for: ${claim.substring(0, 50)}`,
    );
  }
}
