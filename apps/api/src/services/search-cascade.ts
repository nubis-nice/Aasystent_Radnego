/**
 * Search Cascade - System kaskadowego wyszukiwania
 *
 * Architektura:
 * 1. Lokalne źródła (RAG) - najszybsze, najwyższy priorytet
 * 2. Rejestry publiczne (API) - specjalistyczne dane
 * 3. Wyszukiwanie internetowe - fallback z weryfikacją
 *
 * Zasada: Wyczerpać wszystkie źródła aż do uzyskania wyników
 */

import { LegalSearchAPI } from "./legal-search-api.js";
import { SessionDiscoveryService } from "./session-discovery-service.js";
import { semanticWebSearch } from "./semantic-web-search.js";
import { DeepResearchService } from "./deep-research-service.js";
import { GUSApiService } from "./gus-api-service.js";
import { ISAPApiService } from "./isap-api-service.js";
import { YouTubeSessionService } from "./youtube-session-service.js";

// ============================================================================
// TYPES
// ============================================================================

export type SearchSourceType =
  | "rag" // Lokalna baza dokumentów
  | "session" // Sesje rady
  | "youtube" // Nagrania YouTube
  | "isap" // Akty prawne ISAP
  | "gus" // Statystyki GUS
  | "web_verified" // Internet z weryfikacją
  | "deep_research"; // Głębokie wyszukiwanie

export interface SearchSourceConfig {
  type: SearchSourceType;
  priority: number; // 1 = najwyższy priorytet
  timeout: number; // ms
  minResultsToStop: number; // Minimalna liczba wyników do zakończenia kaskady
  enabled: boolean;
}

export interface CascadeResult {
  source: SearchSourceType;
  success: boolean;
  results: CascadeSearchResult[];
  executionTimeMs: number;
  error?: string;
}

export interface CascadeSearchResult {
  title: string;
  content: string;
  url?: string;
  relevance: number;
  sourceType: SearchSourceType;
  credibility?: number;
  metadata?: Record<string, unknown>;
}

export interface SearchCascadeResponse {
  success: boolean;
  query: string;
  totalResults: number;
  sourcesQueried: SearchSourceType[];
  sourcesWithResults: SearchSourceType[];
  results: CascadeSearchResult[];
  cascadeResults: CascadeResult[];
  stoppedAt?: SearchSourceType;
  executionTimeMs: number;
  exhausted: boolean; // Czy przeszukano wszystkie źródła
}

// ============================================================================
// DEFAULT SEARCH CASCADE CONFIGURATION
// ============================================================================

const DEFAULT_CASCADE_CONFIG: SearchSourceConfig[] = [
  // Tier 1: Lokalne źródła (najszybsze)
  {
    type: "rag",
    priority: 1,
    timeout: 5000,
    minResultsToStop: 3,
    enabled: true,
  },
  {
    type: "session",
    priority: 1,
    timeout: 5000,
    minResultsToStop: 1,
    enabled: true,
  },

  // Tier 2: YouTube (nagrania sesji)
  {
    type: "youtube",
    priority: 2,
    timeout: 8000,
    minResultsToStop: 1,
    enabled: true,
  },

  // Tier 3: Rejestry publiczne
  {
    type: "isap",
    priority: 3,
    timeout: 10000,
    minResultsToStop: 2,
    enabled: true,
  },
  {
    type: "gus",
    priority: 3,
    timeout: 10000,
    minResultsToStop: 1,
    enabled: true,
  },

  // Tier 4: Internet z weryfikacją (fallback)
  {
    type: "web_verified",
    priority: 4,
    timeout: 15000,
    minResultsToStop: 3,
    enabled: true,
  },

  // Tier 5: Głębokie wyszukiwanie (ostateczność)
  {
    type: "deep_research",
    priority: 5,
    timeout: 30000,
    minResultsToStop: 1,
    enabled: true,
  },
];

// ============================================================================
// SEARCH CASCADE SERVICE
// ============================================================================

export class SearchCascadeService {
  private userId: string;
  private config: SearchSourceConfig[];

  constructor(userId: string, config?: SearchSourceConfig[]) {
    this.userId = userId;
    this.config = config || DEFAULT_CASCADE_CONFIG;
  }

  /**
   * Wykonaj kaskadowe wyszukiwanie
   * Przeszukuje źródła w kolejności priorytetów, aż znajdzie wystarczającą liczbę wyników
   */
  async search(
    query: string,
    options?: {
      exhaustive?: boolean; // Przeszukaj WSZYSTKIE źródła niezależnie od wyników
      maxResults?: number; // Maksymalna liczba wyników
      stopAfterResults?: number; // Zatrzymaj po N wynikach (nadpisuje config)
      enabledSources?: SearchSourceType[]; // Ogranicz do tych źródeł
      sessionNumber?: number; // Numer sesji (jeśli dotyczy)
    },
  ): Promise<SearchCascadeResponse> {
    const startTime = Date.now();
    const exhaustive = options?.exhaustive ?? false;
    const maxResults = options?.maxResults ?? 20;
    const stopAfterResults = options?.stopAfterResults;

    const allResults: CascadeSearchResult[] = [];
    const cascadeResults: CascadeResult[] = [];
    const sourcesQueried: SearchSourceType[] = [];
    const sourcesWithResults: SearchSourceType[] = [];
    let stoppedAt: SearchSourceType | undefined;

    // Sortuj źródła według priorytetu
    const sortedSources = [...this.config]
      .filter((s) => s.enabled)
      .filter(
        (s) =>
          !options?.enabledSources || options.enabledSources.includes(s.type),
      )
      .sort((a, b) => a.priority - b.priority);

    // Grupuj źródła według priorytetu (wykonuj równolegle w ramach grupy)
    const priorityGroups = this.groupByPriority(sortedSources);

    for (const group of priorityGroups) {
      // Wykonaj źródła w grupie równolegle
      const groupResults = await Promise.all(
        group.map((source) => this.executeSource(source, query, options)),
      );

      for (let i = 0; i < group.length; i++) {
        const source = group[i];
        const result = groupResults[i];

        sourcesQueried.push(source.type);
        cascadeResults.push(result);

        if (result.success && result.results.length > 0) {
          sourcesWithResults.push(source.type);
          allResults.push(...result.results);
        }
      }

      // Sprawdź czy mamy wystarczającą liczbę wyników
      if (!exhaustive) {
        const minRequired =
          stopAfterResults ?? Math.min(...group.map((s) => s.minResultsToStop));

        if (allResults.length >= minRequired) {
          stoppedAt = group[group.length - 1].type;
          console.log(
            `[SearchCascade] Stopped at ${stoppedAt}, found ${allResults.length} results`,
          );
          break;
        }
      }
    }

    // Deduplikuj i sortuj wyniki
    const uniqueResults = this.deduplicateResults(allResults);
    const sortedResults = uniqueResults
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);

    return {
      success: sortedResults.length > 0,
      query,
      totalResults: sortedResults.length,
      sourcesQueried,
      sourcesWithResults,
      results: sortedResults,
      cascadeResults,
      stoppedAt,
      executionTimeMs: Date.now() - startTime,
      exhausted:
        !stoppedAt ||
        stoppedAt === sortedSources[sortedSources.length - 1]?.type,
    };
  }

  /**
   * Wykonaj pojedyncze źródło wyszukiwania
   */
  private async executeSource(
    source: SearchSourceConfig,
    query: string,
    options?: { sessionNumber?: number },
  ): Promise<CascadeResult> {
    const startTime = Date.now();

    try {
      const results = (await Promise.race([
        this.searchSource(source.type, query, options),
        this.timeout(source.timeout),
      ])) as CascadeSearchResult[];

      return {
        source: source.type,
        success: true,
        results,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error(`[SearchCascade] ${source.type} failed:`, error);
      return {
        source: source.type,
        success: false,
        results: [],
        executionTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Wyszukaj w konkretnym źródle
   */
  private async searchSource(
    type: SearchSourceType,
    query: string,
    options?: { sessionNumber?: number },
  ): Promise<CascadeSearchResult[]> {
    switch (type) {
      case "rag":
        return this.searchRAG(query);

      case "session":
        return this.searchSession(query, options?.sessionNumber);

      case "youtube":
        return this.searchYouTube(query);

      case "isap":
        return this.searchISAP(query);

      case "gus":
        return this.searchGUS(query);

      case "web_verified":
        return this.searchWebVerified(query);

      case "deep_research":
        return this.searchDeepResearch(query);

      default:
        return [];
    }
  }

  // ============================================================================
  // SOURCE IMPLEMENTATIONS
  // ============================================================================

  private async searchRAG(query: string): Promise<CascadeSearchResult[]> {
    const service = new LegalSearchAPI(this.userId);
    const results = await service.search({
      query,
      searchMode: "hybrid",
      maxResults: 10,
    });

    if (!Array.isArray(results)) return [];

    return results.map(
      (doc: {
        title?: string;
        content?: string;
        sourceUrl?: string;
        relevance?: number;
      }) => ({
        title: doc.title || "Dokument",
        content: doc.content?.substring(0, 500) || "",
        url: doc.sourceUrl,
        relevance: doc.relevance || 0.5,
        sourceType: "rag" as SearchSourceType,
      }),
    );
  }

  private async searchSession(
    query: string,
    sessionNumber?: number,
  ): Promise<CascadeSearchResult[]> {
    if (sessionNumber && sessionNumber > 0) {
      const service = new SessionDiscoveryService(this.userId);
      await service.initialize();
      const result = await service.discoverSession({
        sessionNumber,
        requestType: "ogolne",
        originalQuery: query,
      });

      if (!result) return [];

      const results: CascadeSearchResult[] = [];

      // Dodaj dokumenty z sesji
      if (result.documents && Array.isArray(result.documents)) {
        for (const doc of result.documents) {
          results.push({
            title: doc.title || `Dokument sesji ${sessionNumber}`,
            content: doc.content?.substring(0, 500) || "",
            url: (doc as { url?: string }).url,
            relevance: 0.9,
            sourceType: "session",
            metadata: { sessionNumber },
          });
        }
      }

      return results;
    }

    // Brak numeru sesji - szukaj w RAG z filtrem
    const service = new LegalSearchAPI(this.userId);
    const results = await service.search({
      query: `sesja rady ${query}`,
      searchMode: "hybrid",
      maxResults: 10,
      filters: { documentTypes: ["session", "protocol", "transcript"] },
    });

    if (!Array.isArray(results)) return [];

    return results.map(
      (doc: {
        title?: string;
        content?: string;
        sourceUrl?: string;
        relevance?: number;
      }) => ({
        title: doc.title || "Dokument sesji",
        content: doc.content?.substring(0, 500) || "",
        url: doc.sourceUrl,
        relevance: doc.relevance || 0.5,
        sourceType: "session" as SearchSourceType,
      }),
    );
  }

  private async searchYouTube(query: string): Promise<CascadeSearchResult[]> {
    try {
      const service = new YouTubeSessionService();
      await service.initializeWithUserConfig(this.userId);
      const result = await service.searchWithContext(query, {
        topics: [query],
      });

      if (!result.success || !result.sessions) return [];

      return result.sessions
        .slice(0, 5)
        .map(
          (video: {
            title?: string;
            description?: string;
            videoId?: string;
          }) => ({
            title: video.title || "Nagranie sesji",
            content: video.description?.substring(0, 500) || "",
            url: video.videoId
              ? `https://youtube.com/watch?v=${video.videoId}`
              : undefined,
            relevance: 0.7,
            sourceType: "youtube" as SearchSourceType,
          }),
        );
    } catch {
      return [];
    }
  }

  private async searchISAP(query: string): Promise<CascadeSearchResult[]> {
    try {
      const service = new ISAPApiService();
      const acts = await service.searchByTitle(query, undefined, 10);

      if (!acts || acts.length === 0) return [];

      return acts.map(
        (act: {
          title?: string;
          publisher?: string;
          status?: string;
          url?: string;
        }) => ({
          title: act.title || "Akt prawny",
          content: `${act.publisher || ""} - ${act.status || ""}`.trim(),
          url: act.url,
          relevance: 0.8,
          sourceType: "isap" as SearchSourceType,
          credibility: 95,
        }),
      );
    } catch {
      return [];
    }
  }

  private async searchGUS(query: string): Promise<CascadeSearchResult[]> {
    try {
      const service = new GUSApiService();

      // Spróbuj znaleźć gminę w query
      const unit = await service.findGmina(query);
      if (unit) {
        const stats = await service.getGminaStats(unit.id);
        return [
          {
            title: `Statystyki: ${unit.name}`,
            content: JSON.stringify(stats).substring(0, 500),
            relevance: 0.85,
            sourceType: "gus",
            credibility: 95,
            metadata: { unitId: unit.id, unitName: unit.name },
          },
        ];
      }

      return [];
    } catch {
      return [];
    }
  }

  private async searchWebVerified(
    query: string,
  ): Promise<CascadeSearchResult[]> {
    try {
      const result = await semanticWebSearch(this.userId, {
        query,
        maxResults: 10,
        minCredibility: 50,
        requireCrossReference: true,
      });

      if (!result.success || !result.results) return [];

      return result.results.slice(0, 8).map((r) => ({
        title: r.title,
        content: r.snippet?.substring(0, 500) || "",
        url: r.url,
        relevance: r.credibility.overall / 100,
        sourceType: "web_verified" as SearchSourceType,
        credibility: r.credibility.overall,
        metadata: {
          domainTrust: r.credibility.domainTrust,
        },
      }));
    } catch {
      return [];
    }
  }

  private async searchDeepResearch(
    query: string,
  ): Promise<CascadeSearchResult[]> {
    try {
      const service = new DeepResearchService(this.userId);
      const result = await service.research({
        query,
        researchType: "general",
        depth: "standard",
        maxResults: 10,
      });

      if (!result?.results) return [];

      return result.results
        .slice(0, 5)
        .map(
          (r: {
            title?: string;
            content?: string;
            url?: string;
            relevance?: number;
          }) => ({
            title: r.title || "Wynik wyszukiwania",
            content: r.content?.substring(0, 500) || "",
            url: r.url,
            relevance: r.relevance || 0.5,
            sourceType: "deep_research" as SearchSourceType,
          }),
        );
    } catch {
      return [];
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private groupByPriority(
    sources: SearchSourceConfig[],
  ): SearchSourceConfig[][] {
    const groups: Map<number, SearchSourceConfig[]> = new Map();

    for (const source of sources) {
      const existing = groups.get(source.priority) || [];
      existing.push(source);
      groups.set(source.priority, existing);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([, sources]) => sources);
  }

  private deduplicateResults(
    results: CascadeSearchResult[],
  ): CascadeSearchResult[] {
    const seen = new Set<string>();
    return results.filter((r) => {
      const key = r.url || r.title.toLowerCase().substring(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      const id = globalThis.setTimeout(
        () => reject(new Error(`Timeout after ${ms}ms`)),
        ms,
      );
      // Cleanup not needed for rejection
      void id;
    });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export async function cascadeSearch(
  userId: string,
  query: string,
  options?: {
    exhaustive?: boolean;
    maxResults?: number;
    sessionNumber?: number;
    enabledSources?: SearchSourceType[];
  },
): Promise<SearchCascadeResponse> {
  const service = new SearchCascadeService(userId);
  return service.search(query, options);
}

export { DEFAULT_CASCADE_CONFIG };
