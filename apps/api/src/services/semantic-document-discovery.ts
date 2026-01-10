/**
 * Semantic Document Discovery Service
 * Inteligentne wyszukiwanie dokumentów w źródłach danych podobne do Exa AI
 *
 * Funkcje:
 * 1. Semantic search w zapisanych źródłach (embeddingi)
 * 2. Auto-discovery powiązanych dokumentów
 * 3. Deep extraction z OCR
 * 4. Relevance scoring z LLM
 */

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import * as cheerio from "cheerio";
import crypto from "crypto";
import { DocumentProcessor } from "./document-processor.js";

/* eslint-disable no-undef */
declare const fetch: typeof globalThis.fetch;
declare const URL: typeof globalThis.URL;
declare const AbortSignal: typeof globalThis.AbortSignal;

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// TYPES
// ============================================================================

export interface SemanticSearchQuery {
  query: string;
  sourceId?: string; // Opcjonalnie ograniczenie do jednego źródła
  maxResults?: number;
  minRelevance?: number; // 0-1
  includeContent?: boolean;
  deepCrawl?: boolean; // Czy crawlować znalezione linki
  extractPDFs?: boolean; // Czy pobierać i OCR-ować PDFy
}

export interface DiscoveredDocument {
  id: string;
  url: string;
  title: string;
  content: string;
  excerpt: string;
  relevanceScore: number;
  source: {
    id: string;
    name: string;
    type: string;
  };
  metadata: {
    contentType: string;
    publishDate?: string;
    extractedDates: string[];
    extractedEntities: string[];
    pdfLinks: string[];
    wordCount: number;
  };
  llmAnalysis?: {
    summary: string;
    keyTopics: string[];
    isRelevant: boolean;
    recommendedAction: string;
  };
}

export interface SemanticSearchResult {
  success: boolean;
  query: string;
  totalFound: number;
  documents: DiscoveredDocument[];
  newDocumentsProcessed: number;
  errors: string[];
  processingTimeMs: number;
}

// ============================================================================
// SEMANTIC DOCUMENT DISCOVERY CLASS
// ============================================================================

export class SemanticDocumentDiscovery {
  private userId: string;
  private openai: OpenAI | null = null;
  private errors: string[] = [];

  constructor(userId: string) {
    this.userId = userId;
  }

  private async initializeOpenAI(): Promise<void> {
    if (this.openai) return;

    const { data: apiConfig } = await supabase
      .from("api_configurations")
      .select("*")
      .eq("user_id", this.userId)
      .eq("is_default", true)
      .eq("is_active", true)
      .single();

    if (apiConfig) {
      // Obsługa obu formatów szyfrowania
      let decodedApiKey: string;
      if (
        apiConfig.encryption_iv &&
        apiConfig.encryption_iv.trim().length > 0
      ) {
        // Nowy format AES - na razie fallback do base64
        decodedApiKey = Buffer.from(
          apiConfig.api_key_encrypted,
          "base64"
        ).toString("utf-8");
      } else {
        decodedApiKey = Buffer.from(
          apiConfig.api_key_encrypted,
          "base64"
        ).toString("utf-8");
      }

      // Obsługa encodeURIComponent z frontendu
      try {
        decodedApiKey = decodeURIComponent(decodedApiKey);
      } catch {
        // Jeśli nie jest URI encoded, użyj bezpośrednio
      }

      this.openai = new OpenAI({
        apiKey: decodedApiKey,
        baseURL: apiConfig.base_url || undefined,
      });
    } else if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  // ============================================================================
  // MAIN SEARCH METHOD
  // ============================================================================

  async search(query: SemanticSearchQuery): Promise<SemanticSearchResult> {
    const startTime = Date.now();
    const result: SemanticSearchResult = {
      success: false,
      query: query.query,
      totalFound: 0,
      documents: [],
      newDocumentsProcessed: 0,
      errors: [],
      processingTimeMs: 0,
    };

    try {
      await this.initializeOpenAI();

      console.log(`[SemanticDiscovery] Searching: "${query.query}"`);

      // PHASE 1: Semantic search w istniejących dokumentach RAG
      const ragResults = await this.searchRAGDocuments(query);
      console.log(
        `[SemanticDiscovery] Found ${ragResults.length} RAG documents`
      );

      // PHASE 2: Search w scraped_content (surowe dane)
      const scrapedResults = await this.searchScrapedContent(query);
      console.log(
        `[SemanticDiscovery] Found ${scrapedResults.length} scraped documents`
      );

      // PHASE 3: Merge i deduplikacja
      const mergedResults = this.mergeAndDeduplicate([
        ...ragResults,
        ...scrapedResults,
      ]);

      // PHASE 4: LLM Relevance scoring
      const scoredResults = await this.scoreRelevance(
        mergedResults,
        query.query
      );

      // PHASE 5: Deep crawl jeśli włączony
      if (query.deepCrawl && scoredResults.length > 0) {
        const crawledDocs = await this.deepCrawlDocuments(scoredResults, query);
        result.newDocumentsProcessed = crawledDocs;
      }

      // PHASE 6: Extract PDFs jeśli włączony
      if (query.extractPDFs) {
        const pdfCount = await this.extractPDFDocuments(scoredResults);
        result.newDocumentsProcessed += pdfCount;
      }

      // Filtruj po minRelevance
      const minRelevance = query.minRelevance ?? 0.3;
      result.documents = scoredResults
        .filter((doc) => doc.relevanceScore >= minRelevance)
        .slice(0, query.maxResults || 20);

      result.totalFound = result.documents.length;
      result.success = true;
      result.errors = this.errors;
    } catch (error) {
      result.errors.push(
        `Search error: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }

    result.processingTimeMs = Date.now() - startTime;
    console.log(
      `[SemanticDiscovery] Completed in ${result.processingTimeMs}ms, found ${result.totalFound} documents`
    );

    return result;
  }

  // ============================================================================
  // PHASE 1: RAG SEMANTIC SEARCH
  // ============================================================================

  private async searchRAGDocuments(
    query: SemanticSearchQuery
  ): Promise<DiscoveredDocument[]> {
    if (!this.openai) return [];

    try {
      // Generuj embedding dla zapytania
      const embeddingResponse = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query.query,
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Semantic search w processed_documents
      const { data: documents, error } = await supabase.rpc(
        "match_documents_semantic",
        {
          query_embedding: queryEmbedding,
          match_threshold: query.minRelevance || 0.3,
          match_count: query.maxResults || 50,
          p_user_id: this.userId,
        }
      );

      if (error) {
        // Fallback do prostego wyszukiwania jeśli RPC nie istnieje
        console.log(
          "[SemanticDiscovery] RPC not available, using fallback search"
        );
        return this.fallbackRAGSearch(query);
      }

      return (documents || []).map((doc: any) =>
        this.transformRAGDocument(doc)
      );
    } catch (error) {
      console.error("[SemanticDiscovery] RAG search error:", error);
      return this.fallbackRAGSearch(query);
    }
  }

  private async fallbackRAGSearch(
    query: SemanticSearchQuery
  ): Promise<DiscoveredDocument[]> {
    // Prosty fulltext search jako fallback
    const { data: documents } = await supabase
      .from("processed_documents")
      .select("*, data_sources!inner(id, name, type)")
      .eq("user_id", this.userId)
      .textSearch("content", query.query.split(" ").join(" | "))
      .limit(query.maxResults || 20);

    return (documents || []).map((doc: any) => this.transformRAGDocument(doc));
  }

  private transformRAGDocument(doc: any): DiscoveredDocument {
    return {
      id: doc.id,
      url: doc.source_url || "",
      title: doc.title || "Bez tytułu",
      content: doc.content || "",
      excerpt: this.createExcerpt(doc.content || ""),
      relevanceScore: doc.similarity || 0.5,
      source: {
        id: doc.data_sources?.id || doc.source_id || "",
        name: doc.data_sources?.name || "Nieznane źródło",
        type: doc.data_sources?.type || "unknown",
      },
      metadata: {
        contentType: doc.document_type || "document",
        publishDate: doc.publish_date,
        extractedDates: [],
        extractedEntities: [],
        pdfLinks: [],
        wordCount: (doc.content || "").split(/\s+/).length,
      },
    };
  }

  // ============================================================================
  // PHASE 2: SCRAPED CONTENT SEARCH
  // ============================================================================

  private async searchScrapedContent(
    query: SemanticSearchQuery
  ): Promise<DiscoveredDocument[]> {
    let dbQuery = supabase
      .from("scraped_content")
      .select("*, data_sources!inner(id, name, type, user_id)")
      .eq("data_sources.user_id", this.userId);

    if (query.sourceId) {
      dbQuery = dbQuery.eq("source_id", query.sourceId);
    }

    // Fulltext search w raw_content
    dbQuery = dbQuery.textSearch(
      "raw_content",
      query.query.split(" ").join(" | ")
    );

    const { data: documents, error } = await dbQuery.limit(
      query.maxResults || 30
    );

    if (error) {
      console.error("[SemanticDiscovery] Scraped content search error:", error);
      return [];
    }

    return (documents || []).map((doc: any) =>
      this.transformScrapedDocument(doc)
    );
  }

  private transformScrapedDocument(doc: any): DiscoveredDocument {
    return {
      id: doc.id,
      url: doc.url || "",
      title: doc.title || "Bez tytułu",
      content: doc.raw_content || "",
      excerpt: this.createExcerpt(doc.raw_content || ""),
      relevanceScore: 0.5, // Będzie zaktualizowane przez LLM scoring
      source: {
        id: doc.data_sources?.id || doc.source_id || "",
        name: doc.data_sources?.name || "Nieznane źródło",
        type: doc.data_sources?.type || "unknown",
      },
      metadata: {
        contentType: doc.content_type || "html",
        publishDate: doc.metadata?.publishDate,
        extractedDates: [],
        extractedEntities: [],
        pdfLinks: doc.metadata?.pdfLinks || [],
        wordCount: (doc.raw_content || "").split(/\s+/).length,
      },
    };
  }

  // ============================================================================
  // PHASE 3: MERGE & DEDUPLICATE
  // ============================================================================

  private mergeAndDeduplicate(
    documents: DiscoveredDocument[]
  ): DiscoveredDocument[] {
    const seen = new Map<string, DiscoveredDocument>();

    for (const doc of documents) {
      const key = doc.url || doc.id;
      const existing = seen.get(key);

      if (!existing || doc.relevanceScore > existing.relevanceScore) {
        seen.set(key, doc);
      }
    }

    return Array.from(seen.values());
  }

  // ============================================================================
  // PHASE 4: LLM RELEVANCE SCORING
  // ============================================================================

  private async scoreRelevance(
    documents: DiscoveredDocument[],
    query: string
  ): Promise<DiscoveredDocument[]> {
    if (!this.openai || documents.length === 0) {
      return documents;
    }

    // Batch scoring dla efektywności
    const batchSize = 5;
    const scoredDocs: DiscoveredDocument[] = [];

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);

      try {
        const scoredBatch = await this.scoreBatch(batch, query);
        scoredDocs.push(...scoredBatch);
      } catch (error) {
        console.error("[SemanticDiscovery] Scoring error:", error);
        // Dodaj bez scoringu
        scoredDocs.push(...batch);
      }
    }

    // Sortuj po relevanceScore
    return scoredDocs.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private async scoreBatch(
    documents: DiscoveredDocument[],
    query: string
  ): Promise<DiscoveredDocument[]> {
    if (!this.openai) return documents;

    const docsForScoring = documents.map((doc, idx) => ({
      idx,
      title: doc.title,
      excerpt: doc.excerpt.slice(0, 500),
    }));

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Oceń trafność dokumentów dla zapytania. Odpowiedz w JSON:
{
  "scores": [
    {"idx": 0, "relevance": 0.0-1.0, "summary": "krótkie podsumowanie", "topics": ["temat1"]},
    ...
  ]
}`,
          },
          {
            role: "user",
            content: `Zapytanie: "${query}"\n\nDokumenty:\n${JSON.stringify(
              docsForScoring,
              null,
              2
            )}`,
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
        max_completion_tokens: 1000,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");

      if (result.scores) {
        for (const score of result.scores) {
          const doc = documents[score.idx];
          if (doc) {
            doc.relevanceScore = score.relevance || doc.relevanceScore;
            doc.llmAnalysis = {
              summary: score.summary || "",
              keyTopics: score.topics || [],
              isRelevant: score.relevance > 0.5,
              recommendedAction:
                score.relevance > 0.7
                  ? "priority"
                  : score.relevance > 0.3
                  ? "include"
                  : "skip",
            };
          }
        }
      }
    } catch (error) {
      console.error("[SemanticDiscovery] Batch scoring error:", error);
    }

    return documents;
  }

  // ============================================================================
  // PHASE 5: DEEP CRAWL
  // ============================================================================

  private async deepCrawlDocuments(
    documents: DiscoveredDocument[],
    query: SemanticSearchQuery
  ): Promise<number> {
    let newDocsCount = 0;

    // Crawl tylko top 5 najbardziej trafnych dokumentów
    const topDocs = documents.slice(0, 5);

    for (const doc of topDocs) {
      if (!doc.url) continue;

      try {
        const links = await this.extractLinksFromPage(doc.url);
        const relevantLinks = await this.filterRelevantLinks(
          links,
          query.query
        );

        for (const link of relevantLinks.slice(0, 3)) {
          const crawled = await this.crawlAndSave(link, doc.source.id);
          if (crawled) newDocsCount++;
        }
      } catch (error) {
        this.errors.push(`Deep crawl error for ${doc.url}: ${error}`);
      }
    }

    return newDocsCount;
  }

  private async extractLinksFromPage(url: string): Promise<string[]> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AasystentRadnego/1.0)",
        },
      });

      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      const links: string[] = [];

      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;

        try {
          const absoluteUrl = new URL(href, url).href;
          if (absoluteUrl.startsWith("http") && !links.includes(absoluteUrl)) {
            links.push(absoluteUrl);
          }
        } catch {
          // Ignoruj nieprawidłowe URLe
        }
      });

      return links;
    } catch (error) {
      return [];
    }
  }

  private async filterRelevantLinks(
    links: string[],
    query: string
  ): Promise<string[]> {
    // Proste filtrowanie po słowach kluczowych
    const keywords = query.toLowerCase().split(/\s+/);

    return links
      .filter((link) => {
        const linkLower = link.toLowerCase();
        return (
          keywords.some((kw) => linkLower.includes(kw)) ||
          linkLower.includes("uchwala") ||
          linkLower.includes("protokol") ||
          linkLower.includes("sesja") ||
          linkLower.includes(".pdf")
        );
      })
      .slice(0, 10);
  }

  private async crawlAndSave(url: string, sourceId: string): Promise<boolean> {
    try {
      // Sprawdź czy już istnieje
      const { data: existing } = await supabase
        .from("scraped_content")
        .select("id")
        .eq("url", url)
        .eq("source_id", sourceId)
        .maybeSingle();

      if (existing) return false;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AasystentRadnego/1.0)",
        },
      });

      if (!response.ok) return false;

      const contentType = response.headers.get("content-type") || "";
      let content = "";
      let type: "html" | "pdf" | "text" = "html";

      if (contentType.includes("pdf")) {
        // PDF - zapisz URL do późniejszego przetworzenia
        type = "pdf";
        content = `[PDF Document: ${url}]`;
      } else {
        const html = await response.text();
        const $ = cheerio.load(html);
        $("script, style, nav, header, footer").remove();
        content = $("body").text().replace(/\s+/g, " ").trim();

        const title = $("title").text().trim() || url;

        // Zapisz do bazy
        await supabase.from("scraped_content").insert({
          source_id: sourceId,
          url,
          title,
          content_type: type,
          raw_content: content.slice(0, 100000),
          content_hash: crypto.createHash("md5").update(content).digest("hex"),
          metadata: { discoveredBy: "semantic-search" },
        });

        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // PHASE 6: PDF EXTRACTION
  // ============================================================================

  private async extractPDFDocuments(
    documents: DiscoveredDocument[]
  ): Promise<number> {
    let processedCount = 0;

    for (const doc of documents) {
      const pdfLinks = doc.metadata.pdfLinks || [];

      for (const pdfUrl of pdfLinks.slice(0, 3)) {
        try {
          const processed = await this.processPDF(pdfUrl, doc.source.id);
          if (processed) processedCount++;
        } catch (error) {
          this.errors.push(`PDF processing error: ${pdfUrl}`);
        }
      }
    }

    return processedCount;
  }

  private async processPDF(url: string, sourceId: string): Promise<boolean> {
    try {
      // Sprawdź czy już przetworzony
      const { data: existing } = await supabase
        .from("scraped_content")
        .select("id")
        .eq("url", url)
        .maybeSingle();

      if (existing) return false;

      // Użyj DocumentProcessor do OCR
      const processor = new DocumentProcessor();
      await processor.initializeWithUserConfig(this.userId);

      // Pobierz PDF
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) return false;

      const buffer = await response.arrayBuffer();
      const result = await processor.processFile(
        Buffer.from(buffer),
        url.split("/").pop() || "document.pdf",
        "application/pdf"
      );

      if (result.success && result.text) {
        // Zapisz do scraped_content
        await supabase.from("scraped_content").insert({
          source_id: sourceId,
          url,
          title: result.metadata?.fileName || url,
          content_type: "pdf",
          raw_content: result.text.slice(0, 100000),
          content_hash: crypto
            .createHash("md5")
            .update(result.text)
            .digest("hex"),
          metadata: {
            ...result.metadata,
            processedBy: "semantic-discovery-ocr",
          },
        });

        return true;
      }

      return false;
    } catch {
      console.error("[SemanticDiscovery] PDF processing error for:", url);
      return false;
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private createExcerpt(content: string, maxLength: number = 300): string {
    const cleaned = content.replace(/\s+/g, " ").trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.slice(0, maxLength - 3) + "...";
  }
}

// ============================================================================
// EXPORTED FUNCTION
// ============================================================================

export async function semanticDocumentSearch(
  userId: string,
  query: SemanticSearchQuery
): Promise<SemanticSearchResult> {
  const discovery = new SemanticDocumentDiscovery(userId);
  return discovery.search(query);
}
