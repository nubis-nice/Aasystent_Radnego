/**
 * Unified Data Service - orkiestrator dla wszystkich źródeł danych
 * Agent AI "Winsdurf" - centralne zarządzanie pobieraniem danych z API i scrapingu
 */

/* eslint-disable no-undef */
declare const Buffer: typeof globalThis.Buffer;
declare const fetch: typeof globalThis.fetch;

import { createClient } from "@supabase/supabase-js";
import { ApiDataFetcher } from "./data-fetchers/api-fetcher.js";
import { ScraperDataFetcher } from "./data-fetchers/scraper-fetcher.js";
import { DocumentProcessor } from "./document-processor.js";
import OpenAI from "openai";
import { autoImportToCalendar } from "./calendar-auto-import.js";
import type {
  DataSourceConfig,
  FetchedDocument,
  DataFetchResult,
} from "@aasystent-radnego/shared";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class UnifiedDataService {
  private sourceId: string;
  private userId: string;

  constructor(sourceId: string, userId: string) {
    this.sourceId = sourceId;
    this.userId = userId;
  }

  async fetchAndProcess(): Promise<DataFetchResult> {
    const startTime = Date.now();

    console.log(
      `[UnifiedDataService] ========================================`
    );
    console.log(
      `[UnifiedDataService] Starting fetch for sourceId: ${this.sourceId}`
    );
    console.log(`[UnifiedDataService] User: ${this.userId}`);

    try {
      const config = await this.loadSourceConfig();
      if (!config) {
        console.error(
          `[UnifiedDataService] ERROR: Source configuration not found!`
        );
        return this.createErrorResult(
          "Source configuration not found",
          startTime
        );
      }

      console.log(`[UnifiedDataService] Source: ${config.name}`);
      console.log(`[UnifiedDataService] Type: ${config.sourceType}`);
      console.log(`[UnifiedDataService] Fetch method: ${config.fetchMethod}`);
      console.log(`[UnifiedDataService] Has apiConfig: ${!!config.apiConfig}`);
      console.log(
        `[UnifiedDataService] Has scraperConfig: ${!!config.scraperConfig}`
      );

      await this.logFetchStart();

      console.log(`[UnifiedDataService] Creating fetcher...`);
      const fetcher = this.createFetcher(config);

      console.log(`[UnifiedDataService] Fetching documents...`);
      const documents = await fetcher.fetch();
      console.log(`[UnifiedDataService] Fetched ${documents.length} documents`);

      if (documents.length === 0) {
        console.warn(`[UnifiedDataService] WARNING: No documents fetched!`);
        console.warn(
          `[UnifiedDataService] Check if apiConfig/scraperConfig is properly configured`
        );
      }

      console.log(`[UnifiedDataService] Saving documents...`);
      await this.saveDocuments(documents);

      console.log(
        `[UnifiedDataService] Processing documents (generating embeddings)...`
      );
      const processedCount = await this.processDocuments(documents);
      console.log(`[UnifiedDataService] Processed ${processedCount} documents`);

      // Process PDF attachments found in scraped pages
      console.log(`[UnifiedDataService] Processing PDF attachments...`);
      const pdfCount = await this.processPDFAttachments(documents);
      console.log(`[UnifiedDataService] Processed ${pdfCount} PDF files`);

      await this.updateSourceStatus(true);
      await this.logFetchComplete(documents.length, processedCount);

      const duration = Date.now() - startTime;
      console.log(`[UnifiedDataService] SUCCESS! Duration: ${duration}ms`);
      console.log(
        `[UnifiedDataService] Items fetched: ${documents.length}, processed: ${processedCount}`
      );
      console.log(
        `[UnifiedDataService] ========================================`
      );

      return {
        sourceId: this.sourceId,
        success: true,
        fetchMethod: config.fetchMethod,
        itemsFetched: documents.length,
        itemsProcessed: processedCount,
        errors: [],
        warnings: [],
        duration,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[UnifiedDataService] ERROR: ${errorMsg}`);
      console.error(`[UnifiedDataService] Stack:`, error);
      await this.updateSourceStatus(false, errorMsg);
      await this.logFetchError(errorMsg);

      return this.createErrorResult(errorMsg, startTime);
    }
  }

  private async loadSourceConfig(): Promise<DataSourceConfig | null> {
    const { data: source } = await supabase
      .from("data_sources")
      .select("*")
      .eq("id", this.sourceId)
      .eq("user_id", this.userId)
      .single();

    if (!source) return null;

    return {
      id: source.id,
      userId: source.user_id,
      name: source.name,
      description: source.description,
      url: source.url, // URL źródła z bazy danych
      sourceType: source.type,
      fetchMethod: source.fetch_method || "scraping",
      apiConfig: source.api_config,
      scraperConfig: source.scraping_config,
      schedule: {
        enabled: source.scraping_enabled,
        frequency: source.scraping_frequency,
        cronExpression: source.cron_expression,
        nextRunAt: source.next_scrape_at,
      },
      processing: {
        enableEmbeddings: source.enable_embeddings ?? true,
        enableClassification: source.enable_classification ?? true,
        enableKeywordExtraction: source.enable_keyword_extraction ?? true,
        enableSummarization: source.enable_summarization ?? false,
      },
      metadata: {
        category: source.category || "other",
        tags: source.tags || [],
        priority: source.priority || "normal",
        jurisdiction: source.jurisdiction,
        legalScope: source.legal_scope,
      },
      isActive: source.scraping_enabled,
      lastFetchedAt: source.last_scraped_at,
      createdAt: source.created_at,
      updatedAt: source.updated_at,
    };
  }

  private createFetcher(config: DataSourceConfig) {
    switch (config.fetchMethod) {
      case "api":
        return new ApiDataFetcher(config);
      case "scraping":
        return new ScraperDataFetcher(config);
      case "hybrid":
        return new ScraperDataFetcher(config);
      default:
        throw new Error(`Unsupported fetch method: ${config.fetchMethod}`);
    }
  }

  private async saveDocuments(documents: FetchedDocument[]): Promise<number> {
    let savedCount = 0;

    for (const doc of documents) {
      const { data: existing } = await supabase
        .from("scraped_content")
        .select("id")
        .eq("source_id", this.sourceId)
        .eq("content_hash", doc.contentHash)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase.from("scraped_content").insert({
          source_id: this.sourceId,
          url: doc.url,
          title: doc.title,
          content_type: doc.contentType,
          raw_content: doc.content,
          content_hash: doc.contentHash,
          metadata: {
            ...doc.rawData,
            publishDate: doc.publishDate,
            author: doc.author,
            documentNumber: doc.documentNumber,
            legalClassification: doc.legalClassification,
          },
        });

        if (!error) savedCount++;
      }
    }

    return savedCount;
  }

  private async processDocuments(
    documents: FetchedDocument[]
  ): Promise<number> {
    let processedCount = 0;

    const { data: apiConfig } = await supabase
      .from("api_configurations")
      .select("*")
      .eq("user_id", this.userId)
      .eq("provider", "openai")
      .eq("is_active", true)
      .eq("is_default", true)
      .single();

    if (!apiConfig) {
      console.warn(
        "[UnifiedDataService] No OpenAI API config found, skipping processing"
      );
      return 0;
    }

    const openaiApiKey = Buffer.from(
      apiConfig.api_key_encrypted,
      "base64"
    ).toString("utf-8");
    const openai = new OpenAI({
      apiKey: openaiApiKey,
      baseURL: apiConfig.base_url || undefined,
    });

    const embeddingModel =
      apiConfig.embedding_model || "text-embedding-3-small";

    for (const doc of documents) {
      try {
        const { data: existing } = await supabase
          .from("processed_documents")
          .select("id")
          .eq("source_url", doc.url)
          .maybeSingle();

        if (existing) continue;

        if (!doc.content || doc.content.length < 100) continue;

        const documentType = this.classifyDocument(doc.title, doc.content);

        let embedding = null;
        try {
          const embeddingResponse = await openai.embeddings.create({
            model: embeddingModel,
            input: `${doc.title}\n\n${doc.content.substring(0, 5000)}`,
          });
          embedding = embeddingResponse.data[0]?.embedding ?? null;
        } catch (e) {
          console.warn("[UnifiedDataService] Embedding generation failed:", e);
          continue;
        }

        const keywords = this.extractKeywords(doc.title, doc.content);

        const { data: insertedDoc, error } = await supabase
          .from("processed_documents")
          .insert({
            user_id: this.userId,
            document_type: documentType,
            title: doc.title,
            content: doc.content,
            summary: doc.content.substring(0, 300) + "...",
            keywords,
            source_url: doc.url,
            publish_date: doc.publishDate,
            embedding,
            processed_at: new Date().toISOString(),
            metadata: {
              sourceType: doc.sourceType,
              fetchMethod: doc.fetchMethod,
              legalClassification: doc.legalClassification,
            },
          })
          .select(
            "id, user_id, title, document_type, content, session_number, normalized_publish_date, source_url"
          )
          .single();

        if (!error && insertedDoc) {
          processedCount++;

          // Auto-import do kalendarza
          try {
            await autoImportToCalendar(insertedDoc);
          } catch (calendarError) {
            console.error(
              "[UnifiedDataService] Calendar auto-import failed:",
              calendarError
            );
          }
        }
      } catch (error) {
        console.error("[UnifiedDataService] Error processing document:", error);
      }
    }

    return processedCount;
  }

  private classifyDocument(title: string, content: string): string {
    const lowerTitle = title.toLowerCase();
    const lowerContent = content.toLowerCase().substring(0, 2000);

    if (lowerTitle.includes("uchwał") || lowerContent.includes("uchwała nr")) {
      return "resolution";
    }
    if (
      lowerTitle.includes("protokół") ||
      lowerContent.includes("protokół z")
    ) {
      return "protocol";
    }
    if (
      lowerTitle.includes("ogłoszeni") ||
      lowerTitle.includes("obwieszczeni")
    ) {
      return "announcement";
    }
    if (
      lowerTitle.includes("zarządzeni") ||
      lowerContent.includes("zarządzenie nr")
    ) {
      return "ordinance";
    }
    if (lowerTitle.includes("ustaw") || lowerTitle.includes("rozporządz")) {
      return "legal_act";
    }
    if (lowerTitle.includes("wyrok") || lowerTitle.includes("postanowieni")) {
      return "judgment";
    }
    if (lowerTitle.includes("budżet") || lowerContent.includes("budżet")) {
      return "budget";
    }

    return "article";
  }

  private extractKeywords(title: string, content: string): string[] {
    const text = `${title} ${content}`.toLowerCase();
    const keywords: string[] = [];

    const importantWords = [
      "uchwała",
      "budżet",
      "sesja",
      "rada",
      "gmina",
      "miasto",
      "podatek",
      "opłata",
      "inwestycja",
      "dotacja",
      "fundusz",
      "plan",
      "zagospodarowanie",
      "ochrona",
      "środowisko",
      "droga",
      "szkoła",
      "wodociąg",
      "kanalizacja",
      "przetarg",
      "konkurs",
      "wybory",
      "referendum",
      "ustawa",
      "rozporządzenie",
      "wyrok",
      "orzeczenie",
    ];

    for (const word of importantWords) {
      if (text.includes(word)) {
        keywords.push(word);
      }
    }

    return [...new Set(keywords)].slice(0, 15);
  }

  private async updateSourceStatus(
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      last_scraped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (success) {
      updates.last_success_at = new Date().toISOString();
      updates.last_error_at = null;
      updates.last_error_message = null;
    } else {
      updates.last_error_at = new Date().toISOString();
      updates.last_error_message = errorMessage;
    }

    await supabase.from("data_sources").update(updates).eq("id", this.sourceId);
  }

  private async logFetchStart(): Promise<void> {
    await supabase.from("scraping_logs").insert({
      source_id: this.sourceId,
      status: "running",
      items_scraped: 0,
      items_processed: 0,
    });
  }

  private async logFetchComplete(
    fetched: number,
    processed: number
  ): Promise<void> {
    await supabase.from("scraping_logs").insert({
      source_id: this.sourceId,
      status: "success",
      items_scraped: fetched,
      items_processed: processed,
    });
  }

  private async logFetchError(errorMessage: string): Promise<void> {
    await supabase.from("scraping_logs").insert({
      source_id: this.sourceId,
      status: "error",
      error_message: errorMessage,
      items_scraped: 0,
      items_processed: 0,
    });
  }

  /**
   * Process PDF attachments found during scraping
   * Downloads PDFs, extracts text using DocumentProcessor, and adds to RAG
   */
  private async processPDFAttachments(
    documents: FetchedDocument[]
  ): Promise<number> {
    let processedPdfCount = 0;

    // Extract all PDF links from scraped documents
    const pdfLinks: string[] = [];
    for (const doc of documents) {
      const docPdfLinks = (doc.rawData?.pdfLinks as string[]) || [];
      pdfLinks.push(...docPdfLinks);
    }

    if (pdfLinks.length === 0) {
      console.log("[UnifiedDataService] No PDF links found in scraped pages");
      return 0;
    }

    console.log(
      `[UnifiedDataService] Found ${pdfLinks.length} PDF links to process`
    );

    // Initialize DocumentProcessor
    const processor = new DocumentProcessor();
    try {
      await processor.initializeWithUserConfig(this.userId);
    } catch (error) {
      console.error(
        "[UnifiedDataService] Failed to initialize DocumentProcessor:",
        error
      );
      return 0;
    }

    // Process each PDF (limit to avoid overwhelming)
    const maxPdfsToProcess = 10;
    const pdfsToProcess = pdfLinks.slice(0, maxPdfsToProcess);

    for (const pdfUrl of pdfsToProcess) {
      try {
        console.log(`[UnifiedDataService] Downloading PDF: ${pdfUrl}`);

        // Download PDF
        const response = await fetch(pdfUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!response.ok) {
          console.warn(
            `[UnifiedDataService] Failed to download PDF: ${response.status}`
          );
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const pdfBuffer = Buffer.from(arrayBuffer);

        // Extract filename from URL
        const urlParts = pdfUrl.split("/");
        const fileName = urlParts[urlParts.length - 1] || "document.pdf";

        console.log(
          `[UnifiedDataService] Processing PDF: ${fileName} (${pdfBuffer.length} bytes)`
        );

        // Process PDF to extract text
        const result = await processor.processFile(
          pdfBuffer,
          fileName,
          "application/pdf"
        );

        if (!result.success || !result.text || result.text.length < 100) {
          console.warn(
            `[UnifiedDataService] PDF processing failed or text too short: ${fileName}`
          );
          continue;
        }

        console.log(
          `[UnifiedDataService] Extracted ${result.text.length} chars from ${fileName}`
        );

        // Save to RAG
        const saveResult = await processor.saveToRAG(
          this.userId,
          result.text,
          fileName.replace(".pdf", ""),
          fileName,
          "pdf_attachment"
        );

        if (saveResult.success) {
          processedPdfCount++;
          console.log(
            `[UnifiedDataService] Saved PDF to RAG: ${fileName} (ID: ${saveResult.documentId})`
          );
        }
      } catch (error) {
        console.error(
          `[UnifiedDataService] Error processing PDF ${pdfUrl}:`,
          error
        );
      }
    }

    return processedPdfCount;
  }

  private createErrorResult(
    errorMessage: string,
    startTime: number
  ): DataFetchResult {
    return {
      sourceId: this.sourceId,
      success: false,
      fetchMethod: "scraping",
      itemsFetched: 0,
      itemsProcessed: 0,
      errors: [errorMessage],
      warnings: [],
      duration: Date.now() - startTime,
    };
  }
}
