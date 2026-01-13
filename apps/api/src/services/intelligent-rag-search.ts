/**
 * Intelligent RAG Search Service
 *
 * Zaawansowane wyszukiwanie dokumentów z:
 * 1. Przetwarzaniem zapytań (normalizacja, konwersja numerów)
 * 2. Wieloetapowym wyszukiwaniem (semantic + keyword + fuzzy)
 * 3. Kojarzeniem powiązanych dokumentów
 * 4. Rankingiem i filtrowaniem wyników
 */

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { getEmbeddingsClient, getLLMClient, getAIConfig } from "../ai/index.js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// TYPES
// ============================================================================

export interface SearchQuery {
  query: string;
  sessionNumber?: number;
  documentType?: string;
  dateFrom?: string;
  dateTo?: string;
  maxResults?: number;
  includeRelated?: boolean;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  documentType: string;
  publishDate?: string;
  sourceUrl?: string;
  similarity: number;
  matchType: "semantic" | "keyword" | "fuzzy" | "related";
  relatedDocuments?: RelatedDocument[];
}

export interface RelatedDocument {
  id: string;
  title: string;
  documentType: string;
  relationshipType: string;
  similarity: number;
}

export interface IntelligentSearchResult {
  success: boolean;
  query: {
    original: string;
    normalized: string;
    extractedEntities: ExtractedEntity[];
  };
  results: SearchResult[];
  totalFound: number;
  searchStats: {
    semanticMatches: number;
    keywordMatches: number;
    fuzzyMatches: number;
    relatedMatches: number;
    processingTimeMs: number;
  };
  debug?: DebugInfo;
}

export interface ExtractedEntity {
  type: "session" | "resolution" | "druk" | "date" | "topic";
  value: string;
  normalized: string;
}

export interface DebugInfo {
  embeddingGenerated: boolean;
  documentsInDb: number;
  documentsWithEmbedding: number;
  queryVariants: string[];
  thresholdUsed: number;
}

// ============================================================================
// UTILS: Normalizacja zapytań
// ============================================================================

const ROMAN_VALUES: Record<string, number> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
};

function romanToArabic(roman: string): number {
  const upper = roman.toUpperCase();
  let result = 0;
  let prevValue = 0;

  for (let i = upper.length - 1; i >= 0; i--) {
    const char = upper[i];
    const currentValue = char ? ROMAN_VALUES[char] || 0 : 0;
    if (currentValue < prevValue) {
      result -= currentValue;
    } else {
      result += currentValue;
    }
    prevValue = currentValue;
  }

  return result;
}

function arabicToRoman(num: number): string {
  const romanNumerals: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];

  let result = "";
  for (const [value, numeral] of romanNumerals) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result;
}

// ============================================================================
// INTELLIGENT RAG SEARCH CLASS
// ============================================================================

export class IntelligentRAGSearch {
  private userId: string;
  private embeddingsClient: OpenAI | null = null;
  private llmClient: OpenAI | null = null;
  private embeddingModel: string = "text-embedding-3-small";
  private llmModel: string = "gpt-4o-mini";

  constructor(userId: string) {
    this.userId = userId;
  }

  private async initialize(): Promise<void> {
    if (this.embeddingsClient) return;

    try {
      this.embeddingsClient = await getEmbeddingsClient(this.userId);
      this.llmClient = await getLLMClient(this.userId);

      const embConfig = await getAIConfig(this.userId, "embeddings");
      const llmConfig = await getAIConfig(this.userId, "llm");
      this.embeddingModel = embConfig.modelName;
      this.llmModel = llmConfig.modelName;

      console.log(
        `[IntelligentRAG] Initialized with model: ${this.embeddingModel}`
      );
    } catch (error) {
      console.error("[IntelligentRAG] Initialization error:", error);
    }
  }

  // ============================================================================
  // MAIN SEARCH METHOD
  // ============================================================================

  async search(query: SearchQuery): Promise<IntelligentSearchResult> {
    const startTime = Date.now();
    await this.initialize();

    const result: IntelligentSearchResult = {
      success: false,
      query: {
        original: query.query,
        normalized: "",
        extractedEntities: [],
      },
      results: [],
      totalFound: 0,
      searchStats: {
        semanticMatches: 0,
        keywordMatches: 0,
        fuzzyMatches: 0,
        relatedMatches: 0,
        processingTimeMs: 0,
      },
    };

    try {
      // PHASE 1: Ekstrakcja i normalizacja zapytania
      const { normalized, entities, variants } = await this.normalizeQuery(
        query.query
      );
      result.query.normalized = normalized;
      result.query.extractedEntities = entities;

      console.log(
        `[IntelligentRAG] Query: "${query.query}" → Normalized: "${normalized}"`
      );
      console.log(`[IntelligentRAG] Entities:`, entities);
      console.log(`[IntelligentRAG] Variants:`, variants);

      // Debug info
      const debugInfo = await this.getDebugInfo(variants);
      result.debug = debugInfo;

      // PHASE 2: Wyszukiwanie semantyczne (główne)
      const semanticResults = await this.semanticSearch(normalized, query);
      result.searchStats.semanticMatches = semanticResults.length;

      // PHASE 3: Wyszukiwanie po wariantach zapytania
      for (const variant of variants) {
        if (variant !== normalized) {
          const variantResults = await this.semanticSearch(variant, query);
          // Dodaj tylko unikalne wyniki
          for (const vr of variantResults) {
            if (!semanticResults.find((sr) => sr.id === vr.id)) {
              semanticResults.push({ ...vr, matchType: "fuzzy" });
              result.searchStats.fuzzyMatches++;
            }
          }
        }
      }

      // PHASE 4: Wyszukiwanie po słowach kluczowych (fallback)
      if (semanticResults.length < 5) {
        const keywordResults = await this.keywordSearch(query.query, query);
        for (const kr of keywordResults) {
          if (!semanticResults.find((sr) => sr.id === kr.id)) {
            semanticResults.push(kr);
            result.searchStats.keywordMatches++;
          }
        }
      }

      // PHASE 5: Kojarzenie powiązanych dokumentów
      if (query.includeRelated !== false && semanticResults.length > 0) {
        const topResults = semanticResults.slice(0, 5);
        for (const doc of topResults) {
          const related = await this.findRelatedDocuments(doc.id);
          doc.relatedDocuments = related;
          result.searchStats.relatedMatches += related.length;
        }
      }

      // PHASE 6: Sortowanie i limit
      result.results = semanticResults
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, query.maxResults || 30);

      result.totalFound = result.results.length;
      result.success = true;
    } catch (error) {
      console.error("[IntelligentRAG] Search error:", error);
    }

    result.searchStats.processingTimeMs = Date.now() - startTime;
    console.log(
      `[IntelligentRAG] Completed in ${result.searchStats.processingTimeMs}ms, found ${result.totalFound} docs`
    );

    return result;
  }

  // ============================================================================
  // PHASE 1: Normalizacja zapytania
  // ============================================================================

  private async normalizeQuery(query: string): Promise<{
    normalized: string;
    entities: ExtractedEntity[];
    variants: string[];
  }> {
    const entities: ExtractedEntity[] = [];
    let normalized = query;
    const variants: string[] = [query];

    // Wykryj i znormalizuj numery sesji (rzymskie → arabskie)
    const sessionPatterns = [
      /sesj[iaęy]\s+(?:nr\.?\s*)?([IVXLC]+)/gi,
      /sesj[iaęy]\s+(?:nr\.?\s*)?(\d+)/gi,
      /(?:nr\.?\s*)([IVXLC]+)\s+sesj/gi,
      /([IVXLC]+)\s+sesj[iaęy]/gi,
    ];

    for (const pattern of sessionPatterns) {
      const matches = query.matchAll(pattern);
      for (const match of matches) {
        const value = match[1];
        if (!value) continue;

        let arabicNum: number;
        let romanNum: string;

        if (/^[IVXLC]+$/i.test(value)) {
          arabicNum = romanToArabic(value);
          romanNum = value.toUpperCase();

          // Walidacja - sesje rzadko przekraczają 200
          if (arabicNum > 0 && arabicNum <= 200) {
            entities.push({
              type: "session",
              value: value,
              normalized: arabicNum.toString(),
            });

            // Dodaj warianty z obiema formami numeru
            const arabicVariant = normalized.replace(
              new RegExp(value, "gi"),
              arabicNum.toString()
            );
            if (!variants.includes(arabicVariant)) {
              variants.push(arabicVariant);
            }
          }
        } else {
          arabicNum = parseInt(value, 10);
          romanNum = arabicToRoman(arabicNum);

          if (arabicNum > 0 && arabicNum <= 200) {
            entities.push({
              type: "session",
              value: value,
              normalized: arabicNum.toString(),
            });

            // Dodaj wariant z numerem rzymskim
            const romanVariant = normalized.replace(
              new RegExp(value, "g"),
              romanNum
            );
            if (!variants.includes(romanVariant)) {
              variants.push(romanVariant);
            }
          }
        }
      }
    }

    // Wykryj uchwały
    const resolutionPattern =
      /uchwa[łl][yaęi]?\s+(?:nr\.?\s*)?([IVXLC\d]+(?:\/\d+)?)/gi;
    const resolutionMatches = query.matchAll(resolutionPattern);
    for (const match of resolutionMatches) {
      if (match[1]) {
        entities.push({
          type: "resolution",
          value: match[1],
          normalized: match[1],
        });
      }
    }

    // Wykryj druki
    const drukPattern = /druk(?:u|iem|owi)?\s+(?:nr\.?\s*)?(\d+(?:[a-z])?)/gi;
    const drukMatches = query.matchAll(drukPattern);
    for (const match of drukMatches) {
      if (match[1]) {
        entities.push({
          type: "druk",
          value: match[1],
          normalized: match[1],
        });
      }
    }

    // Normalizuj zapytanie - zamień numery rzymskie na arabskie w kontekście sesji
    normalized = query;
    for (const entity of entities) {
      if (entity.type === "session" && /^[IVXLC]+$/i.test(entity.value)) {
        // Zamień numer rzymski na arabski dla lepszego matchingu
        normalized = normalized.replace(
          new RegExp(`\\b${entity.value}\\b`, "gi"),
          entity.normalized
        );
      }
    }

    // Dodaj wariant bez polskich znaków
    const withoutDiacritics = this.removeDiacritics(normalized);
    if (
      withoutDiacritics !== normalized &&
      !variants.includes(withoutDiacritics)
    ) {
      variants.push(withoutDiacritics);
    }

    return { normalized, entities, variants };
  }

  private removeDiacritics(str: string): string {
    const diacriticsMap: Record<string, string> = {
      ą: "a",
      ć: "c",
      ę: "e",
      ł: "l",
      ń: "n",
      ó: "o",
      ś: "s",
      ź: "z",
      ż: "z",
      Ą: "A",
      Ć: "C",
      Ę: "E",
      Ł: "L",
      Ń: "N",
      Ó: "O",
      Ś: "S",
      Ź: "Z",
      Ż: "Z",
    };
    return str.replace(
      /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g,
      (char) => diacriticsMap[char] || char
    );
  }

  // ============================================================================
  // PHASE 2: Wyszukiwanie semantyczne
  // ============================================================================

  private async semanticSearch(
    query: string,
    options: SearchQuery
  ): Promise<SearchResult[]> {
    if (!this.embeddingsClient) {
      console.log(
        "[IntelligentRAG] No embeddings client, falling back to keyword search"
      );
      return [];
    }

    try {
      const embeddingResponse = await this.embeddingsClient.embeddings.create({
        model: this.embeddingModel,
        input: query,
      });

      const queryEmbedding = embeddingResponse.data[0]?.embedding;
      if (!queryEmbedding) {
        console.error("[IntelligentRAG] Failed to generate embedding");
        return [];
      }

      const { data: documents, error } = await supabase.rpc(
        "search_processed_documents",
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.2, // Niski próg dla szerszego pokrycia
          match_count: options.maxResults || 50,
          filter_user_id: this.userId,
          filter_types: options.documentType ? [options.documentType] : null,
        }
      );

      if (error) {
        console.error("[IntelligentRAG] Semantic search error:", error);
        return [];
      }

      return (documents || []).map((doc: any) =>
        this.transformDocument(doc, "semantic")
      );
    } catch (error) {
      console.error("[IntelligentRAG] Semantic search error:", error);
      return [];
    }
  }

  // ============================================================================
  // PHASE 4: Wyszukiwanie po słowach kluczowych
  // ============================================================================

  private async keywordSearch(
    query: string,
    options: SearchQuery
  ): Promise<SearchResult[]> {
    try {
      // Wyodrębnij słowa kluczowe
      const keywords = query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 5);

      if (keywords.length === 0) return [];

      // Full-text search z tsquery
      const tsquery = keywords.join(" | ");

      let queryBuilder = supabase
        .from("processed_documents")
        .select("id, title, content, document_type, publish_date, source_url")
        .eq("user_id", this.userId)
        .textSearch("content", tsquery, { type: "websearch" })
        .limit(options.maxResults || 20);

      if (options.documentType) {
        queryBuilder = queryBuilder.eq("document_type", options.documentType);
      }

      const { data: documents, error } = await queryBuilder;

      if (error) {
        console.error("[IntelligentRAG] Keyword search error:", error);
        return [];
      }

      return (documents || []).map((doc: any) => ({
        id: doc.id,
        title: doc.title || "Bez tytułu",
        content: doc.content || "",
        excerpt: this.createExcerpt(doc.content || "", query),
        documentType: doc.document_type || "unknown",
        publishDate: doc.publish_date,
        sourceUrl: doc.source_url,
        similarity: 0.5, // Stała wartość dla keyword search
        matchType: "keyword" as const,
      }));
    } catch (error) {
      console.error("[IntelligentRAG] Keyword search error:", error);
      return [];
    }
  }

  // ============================================================================
  // PHASE 5: Kojarzenie powiązanych dokumentów
  // ============================================================================

  private async findRelatedDocuments(
    documentId: string
  ): Promise<RelatedDocument[]> {
    try {
      // Szukaj w document_graph
      const { data: relations } = await supabase
        .from("document_graph")
        .select(
          `
          relationship_type,
          target_document:target_document_id (
            id, title, document_type
          )
        `
        )
        .eq("source_document_id", documentId)
        .limit(5);

      if (!relations || relations.length === 0) {
        // Fallback: szukaj dokumentów z podobnym tytułem/sesją
        return this.findSimilarDocuments(documentId);
      }

      return relations
        .filter((r: any) => r.target_document)
        .map((r: any) => ({
          id: r.target_document.id,
          title: r.target_document.title,
          documentType: r.target_document.document_type,
          relationshipType: r.relationship_type,
          similarity: 0.8,
        }));
    } catch (error) {
      console.error("[IntelligentRAG] Find related error:", error);
      return [];
    }
  }

  private async findSimilarDocuments(
    documentId: string
  ): Promise<RelatedDocument[]> {
    try {
      // Pobierz dokument źródłowy
      const { data: sourceDoc } = await supabase
        .from("processed_documents")
        .select("title, document_type, embedding")
        .eq("id", documentId)
        .single();

      if (!sourceDoc || !sourceDoc.embedding) return [];

      // Szukaj podobnych dokumentów po embeddingu
      const { data: similar } = await supabase.rpc(
        "search_processed_documents",
        {
          query_embedding: sourceDoc.embedding,
          match_threshold: 0.7,
          match_count: 6,
          filter_user_id: this.userId,
          filter_types: null,
        }
      );

      if (!similar) return [];

      return similar
        .filter((doc: any) => doc.id !== documentId)
        .slice(0, 5)
        .map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          documentType: doc.document_type,
          relationshipType: "similar_content",
          similarity: doc.similarity,
        }));
    } catch (error) {
      console.error("[IntelligentRAG] Find similar error:", error);
      return [];
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private transformDocument(
    doc: any,
    matchType: "semantic" | "keyword" | "fuzzy"
  ): SearchResult {
    return {
      id: doc.id,
      title: doc.title || "Bez tytułu",
      content: doc.content || "",
      excerpt: this.createExcerpt(doc.content || ""),
      documentType: doc.document_type || "unknown",
      publishDate: doc.publish_date,
      sourceUrl: doc.source_url,
      similarity: doc.similarity || 0,
      matchType,
    };
  }

  private createExcerpt(content: string, highlightQuery?: string): string {
    if (!content) return "";

    let excerpt = content.substring(0, 300);

    // Jeśli jest zapytanie, spróbuj znaleźć fragment z tym zapytaniem
    if (highlightQuery) {
      const queryLower = highlightQuery.toLowerCase();
      const contentLower = content.toLowerCase();
      const index = contentLower.indexOf(queryLower);

      if (index !== -1) {
        const start = Math.max(0, index - 100);
        const end = Math.min(content.length, index + queryLower.length + 200);
        excerpt =
          (start > 0 ? "..." : "") +
          content.substring(start, end) +
          (end < content.length ? "..." : "");
      }
    }

    return excerpt.trim();
  }

  private async getDebugInfo(queryVariants: string[]): Promise<DebugInfo> {
    const { count: totalDocs } = await supabase
      .from("processed_documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", this.userId);

    const { count: docsWithEmbedding } = await supabase
      .from("processed_documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", this.userId)
      .not("embedding", "is", null);

    return {
      embeddingGenerated: !!this.embeddingsClient,
      documentsInDb: totalDocs || 0,
      documentsWithEmbedding: docsWithEmbedding || 0,
      queryVariants,
      thresholdUsed: 0.2,
    };
  }

  // ============================================================================
  // TEST METHOD
  // ============================================================================

  async runDiagnostics(testQuery: string): Promise<{
    query: string;
    dbStats: {
      totalDocuments: number;
      documentsWithEmbedding: number;
      documentTypes: Record<string, number>;
    };
    searchResults: IntelligentSearchResult;
    recommendations: string[];
  }> {
    await this.initialize();

    // Statystyki bazy
    const { count: totalDocs } = await supabase
      .from("processed_documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", this.userId);

    const { count: docsWithEmbedding } = await supabase
      .from("processed_documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", this.userId)
      .not("embedding", "is", null);

    // Typy dokumentów
    const { data: typeStats } = await supabase
      .from("processed_documents")
      .select("document_type")
      .eq("user_id", this.userId);

    const documentTypes: Record<string, number> = {};
    (typeStats || []).forEach((doc: any) => {
      const type = doc.document_type || "unknown";
      documentTypes[type] = (documentTypes[type] || 0) + 1;
    });

    // Uruchom wyszukiwanie
    const searchResults = await this.search({
      query: testQuery,
      includeRelated: true,
      maxResults: 20,
    });

    // Generuj rekomendacje
    const recommendations: string[] = [];

    if ((docsWithEmbedding || 0) < (totalDocs || 0)) {
      recommendations.push(
        `${
          (totalDocs || 0) - (docsWithEmbedding || 0)
        } dokumentów nie ma embeddingów - uruchom regenerację`
      );
    }

    if (searchResults.totalFound === 0) {
      recommendations.push(
        "Brak wyników - sprawdź czy zapytanie zawiera właściwe słowa kluczowe"
      );
      recommendations.push(
        "Spróbuj użyć numerów arabskich zamiast rzymskich (np. '23' zamiast 'XXIII')"
      );
    }

    if (
      searchResults.searchStats.semanticMatches === 0 &&
      searchResults.searchStats.keywordMatches > 0
    ) {
      recommendations.push(
        "Wyszukiwanie semantyczne nie zwróciło wyników - sprawdź model embeddingów"
      );
    }

    return {
      query: testQuery,
      dbStats: {
        totalDocuments: totalDocs || 0,
        documentsWithEmbedding: docsWithEmbedding || 0,
        documentTypes,
      },
      searchResults,
      recommendations,
    };
  }
}
