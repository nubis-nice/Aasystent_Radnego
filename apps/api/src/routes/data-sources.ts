import { FastifyInstance } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { intelligentScrapeDataSource } from "../services/intelligent-scraper.js";
import { semanticDocumentSearch } from "../services/semantic-document-discovery.js";
import {
  ScrapingQueueManager,
  calculateSourcePriority,
} from "../services/scraping-queue.js";
import OpenAI from "openai";

/* eslint-disable no-undef */
declare const Buffer: typeof globalThis.Buffer;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function dataSourcesRoutes(fastify: FastifyInstance) {
  // GET /api/data-sources - Lista źródeł danych użytkownika
  fastify.get("/data-sources", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { data: sources, error } = await supabase
        .from("data_sources")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        request.log.error("Error fetching data sources:", error);
        return reply
          .status(500)
          .send({ error: "Failed to fetch data sources" });
      }

      // Dla każdego źródła pobierz liczniki
      const sourcesWithCounts = await Promise.all(
        (sources || []).map(async (source) => {
          const { count: scrapedCount } = await supabase
            .from("scraped_content")
            .select("*", { count: "exact", head: true })
            .eq("source_id", source.id);

          // Dla YouTube pokaż liczbę scraped_content, dla innych processed_documents
          let docsCount = 0;
          if (
            source.type === "youtube" ||
            source.url?.includes("youtube.com")
          ) {
            docsCount = scrapedCount || 0;
          } else {
            // Licz dokumenty przez source_url (zawiera URL źródła)
            const baseUrlPattern = `${source.url}%`;
            const { count } = await supabase
              .from("processed_documents")
              .select("*", { count: "exact", head: true })
              .eq("user_id", userId)
              .like("source_url", baseUrlPattern);
            docsCount = count || 0;
          }

          const { data: lastLog } = await supabase
            .from("scraping_logs")
            .select("status, created_at")
            .eq("source_id", source.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          return {
            id: source.id,
            user_id: source.user_id,
            name: source.name,
            source_type: source.type,
            base_url: source.url,
            is_active: source.scraping_enabled,
            schedule_cron: source.scraping_frequency,
            scrape_config: source.scraping_config,
            last_scraped_at: source.last_scraped_at,
            created_at: source.created_at,
            updated_at: source.updated_at,
            scraped_count: scrapedCount || 0,
            documents_count: docsCount || 0,
            last_scrape: lastLog || null,
          };
        })
      );

      return reply.send({ sources: sourcesWithCounts });
    } catch (error) {
      request.log.error("Data sources error:", error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // GET /api/data-sources/:id - Szczegóły źródła
  fastify.get<{ Params: { id: string } }>(
    "/data-sources/:id",
    async (request, reply) => {
      try {
        const userId = request.headers["x-user-id"] as string;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { id } = request.params;

        const { data: source, error } = await supabase
          .from("data_sources")
          .select("*")
          .eq("id", id)
          .eq("user_id", userId)
          .single();

        if (error || !source) {
          return reply.status(404).send({ error: "Source not found" });
        }

        // Pobierz logi scrapingu
        const { data: logs } = await supabase
          .from("scraping_logs")
          .select("*")
          .eq("source_id", id)
          .order("created_at", { ascending: false })
          .limit(10);

        return reply.send({ source, logs: logs || [] });
      } catch (error) {
        request.log.error("Data source details error:", error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/data-sources - Dodaj nowe źródło
  fastify.post<{
    Body: {
      name: string;
      source_type: string;
      base_url: string;
      scrape_config?: object;
      schedule_cron?: string;
    };
  }>("/data-sources", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { name, source_type, base_url, scrape_config, schedule_cron } =
        request.body;

      if (!name || !source_type || !base_url) {
        return reply.status(400).send({
          error: "Missing required fields: name, source_type, base_url",
        });
      }

      const { data: source, error } = await supabase
        .from("data_sources")
        .insert({
          user_id: userId,
          name,
          type: source_type,
          url: base_url,
          scraping_config: scrape_config || {},
          scraping_frequency: schedule_cron || "daily",
          scraping_enabled: true,
        })
        .select()
        .single();

      if (error) {
        request.log.error(
          { error: error.message, code: error.code, details: error.details },
          "Error creating data source"
        );
        return reply
          .status(500)
          .send({ error: `Failed to create data source: ${error.message}` });
      }

      return reply.status(201).send({ source });
    } catch (error) {
      request.log.error("Create data source error:", error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // PATCH /api/data-sources/:id - Aktualizuj źródło
  fastify.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      base_url?: string;
      source_type?: string;
      scrape_config?: object;
      schedule_cron?: string;
      is_active?: boolean;
    };
  }>("/data-sources/:id", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const {
        name,
        base_url,
        source_type,
        scrape_config,
        schedule_cron,
        is_active,
      } = request.body;

      // Sprawdź czy źródło należy do użytkownika
      const { data: existing } = await supabase
        .from("data_sources")
        .select("id")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (!existing) {
        return reply.status(404).send({ error: "Source not found" });
      }

      // Mapuj nazwy kolumn z frontendu na nazwy w bazie danych
      const dbUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (name !== undefined) dbUpdates.name = name;
      if (base_url !== undefined) dbUpdates.url = base_url;
      if (source_type !== undefined) dbUpdates.type = source_type;
      if (scrape_config !== undefined)
        dbUpdates.scraping_config = scrape_config;
      if (schedule_cron !== undefined) {
        // Mapuj cron expression na wartość z constraint CHECK
        const cronToFrequency: Record<string, string> = {
          "0 * * * *": "hourly",
          "0 6 * * *": "daily",
          "0 6 * * 0": "weekly",
          "0 6 1 * *": "monthly",
        };
        dbUpdates.scraping_frequency =
          cronToFrequency[schedule_cron] || "daily";
      }
      if (is_active !== undefined) dbUpdates.scraping_enabled = is_active;

      const { data: source, error } = await supabase
        .from("data_sources")
        .update(dbUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        request.log.error("Error updating data source:", JSON.stringify(error));
        return reply
          .status(500)
          .send({ error: `Failed to update: ${error.message}` });
      }

      return reply.send({ source });
    } catch (error) {
      request.log.error("Update data source error:", error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // DELETE /api/data-sources/:id - Usuń źródło
  fastify.delete<{ Params: { id: string } }>(
    "/data-sources/:id",
    async (request, reply) => {
      try {
        const userId = request.headers["x-user-id"] as string;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { id } = request.params;

        // Sprawdź czy źródło należy do użytkownika
        const { data: existing } = await supabase
          .from("data_sources")
          .select("id")
          .eq("id", id)
          .eq("user_id", userId)
          .single();

        if (!existing) {
          return reply.status(404).send({ error: "Source not found" });
        }

        const { error } = await supabase
          .from("data_sources")
          .delete()
          .eq("id", id);

        if (error) {
          request.log.error("Error deleting data source:", error);
          return reply
            .status(500)
            .send({ error: "Failed to delete data source" });
        }

        return reply.status(204).send();
      } catch (error) {
        request.log.error("Delete data source error:", error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/data-sources/:id/scrape - Uruchom scraping teraz
  fastify.post<{
    Params: { id: string };
    Body: { maxDocumentAgeDays?: number };
  }>("/data-sources/:id/scrape", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const { maxDocumentAgeDays } =
        (request.body as { maxDocumentAgeDays?: number }) || {};

      // Sprawdź czy źródło należy do użytkownika
      const { data: source } = await supabase
        .from("data_sources")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (!source) {
        return reply.status(404).send({ error: "Source not found" });
      }

      // Oblicz datę graniczną dla dokumentów
      let minDocumentDate: Date | undefined;
      if (maxDocumentAgeDays && maxDocumentAgeDays > 0) {
        minDocumentDate = new Date();
        minDocumentDate.setDate(minDocumentDate.getDate() - maxDocumentAgeDays);
        request.log.info(
          { maxDocumentAgeDays, minDocumentDate },
          "Filtering documents by age"
        );
      }

      // Oblicz priorytet źródła
      const priority = calculateSourcePriority({
        type: source.type,
        metadata: source.metadata,
        last_scraped_at: source.last_scraped_at,
      });

      // Dodaj do kolejki scrapingu
      const queueManager = ScrapingQueueManager.getInstance();
      const jobId = await queueManager.enqueue(id, userId, {
        priority,
        config: {
          councilLocation: source.metadata?.councilLocation || "Drawno",
          enableLLMAnalysis: true,
          incrementalMode: true,
        },
      });

      request.log.info(
        { sourceId: id, jobId, priority, maxDocumentAgeDays },
        "Scraping job enqueued"
      );

      // Natychmiast zwróć odpowiedź - scraping w kolejce
      return reply.send({
        message: "Scraping job enqueued",
        source_id: id,
        job_id: jobId,
        priority,
        status: "queued",
        async: true,
      });
    } catch (error) {
      request.log.error("Trigger scraping error:", error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // GET /api/data-sources/queue/stats - Statystyki kolejki scrapingu
  fastify.get("/data-sources/queue/stats", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const queueManager = ScrapingQueueManager.getInstance();
      const stats = queueManager.getStats();

      return reply.send({
        queue: stats,
        config: queueManager.getParallelConfig(),
      });
    } catch (error) {
      request.log.error("Queue stats error:", error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // GET /api/data-sources/queue/job/:jobId - Status zadania scrapingu
  fastify.get<{
    Params: { jobId: string };
  }>("/data-sources/queue/job/:jobId", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { jobId } = request.params;
      const queueManager = ScrapingQueueManager.getInstance();
      const job = queueManager.getJobStatus(jobId);

      if (!job) {
        return reply.status(404).send({ error: "Job not found" });
      }

      // Sprawdź czy zadanie należy do użytkownika
      if (job.userId !== userId) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      return reply.send({ job });
    } catch (error) {
      request.log.error("Job status error:", error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // POST /api/data-sources/:id/semantic-search - Semantic search w źródle danych
  fastify.post<{
    Params: { id: string };
    Body: {
      query: string;
      maxResults?: number;
      minRelevance?: number;
      deepCrawl?: boolean;
      extractPDFs?: boolean;
      enableIntelligentScraping?: boolean;
      minResultsBeforeScraping?: number;
    };
  }>("/data-sources/:id/semantic-search", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { id } = request.params;
      const {
        query,
        maxResults,
        minRelevance,
        deepCrawl,
        extractPDFs,
        enableIntelligentScraping,
        minResultsBeforeScraping,
      } = request.body;

      if (!query || query.trim().length === 0) {
        return reply.status(400).send({ error: "Query is required" });
      }

      // Sprawdź czy źródło należy do użytkownika
      const { data: source } = await supabase
        .from("data_sources")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (!source) {
        return reply.status(404).send({ error: "Source not found" });
      }

      request.log.info(
        { sourceId: id, query, enableIntelligentScraping },
        "Starting semantic document search"
      );

      const result = await semanticDocumentSearch(userId, {
        query,
        sourceId: id,
        maxResults: maxResults || 20,
        minRelevance: minRelevance || 0.3,
        deepCrawl: deepCrawl || false,
        extractPDFs: extractPDFs || false,
        enableIntelligentScraping: enableIntelligentScraping ?? true, // Domyślnie włączone
        minResultsBeforeScraping: minResultsBeforeScraping || 3,
      });

      request.log.info(
        {
          sourceId: id,
          success: result.success,
          totalFound: result.totalFound,
          newDocumentsProcessed: result.newDocumentsProcessed,
        },
        "Semantic search completed"
      );

      return reply.send(result);
    } catch (error) {
      request.log.error("Semantic search error:", String(error));
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // POST /api/data-sources/semantic-search - Semantic search we wszystkich źródłach
  fastify.post<{
    Body: {
      query: string;
      maxResults?: number;
      minRelevance?: number;
      deepCrawl?: boolean;
      extractPDFs?: boolean;
    };
  }>("/data-sources/semantic-search", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { query, maxResults, minRelevance, deepCrawl, extractPDFs } =
        request.body;

      if (!query || query.trim().length === 0) {
        return reply.status(400).send({ error: "Query is required" });
      }

      request.log.info({ query }, "Starting global semantic document search");

      const result = await semanticDocumentSearch(userId, {
        query,
        maxResults: maxResults || 20,
        minRelevance: minRelevance || 0.3,
        deepCrawl: deepCrawl || false,
        extractPDFs: extractPDFs || false,
      });

      request.log.info(
        {
          success: result.success,
          totalFound: result.totalFound,
          newDocumentsProcessed: result.newDocumentsProcessed,
        },
        "Global semantic search completed"
      );

      return reply.send(result);
    } catch (error) {
      request.log.error("Global semantic search error:", String(error));
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // GET /api/data-sources/documents - Lista dokumentów ze wszystkich źródeł
  fastify.get("/data-sources/documents", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const query = request.query as {
        search?: string;
        type?: string;
        source_id?: string;
        limit?: string;
        offset?: string;
      };

      let dbQuery = supabase
        .from("processed_documents")
        .select("*", { count: "exact" })
        .eq("user_id", userId);

      if (query.search) {
        dbQuery = dbQuery.or(
          `title.ilike.%${query.search}%,content.ilike.%${query.search}%`
        );
      }

      if (query.type) {
        dbQuery = dbQuery.eq("document_type", query.type);
      }

      if (query.source_id) {
        dbQuery = dbQuery.eq("scraped_content.source_id", query.source_id);
      }

      const limit = parseInt(query.limit || "20");
      const offset = parseInt(query.offset || "0");

      dbQuery = dbQuery
        .order("processed_at", { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: documents, error, count } = await dbQuery;

      if (error) {
        request.log.error("Error fetching documents:", error);
        return reply.status(500).send({ error: "Failed to fetch documents" });
      }

      return reply.send({
        documents: documents || [],
        total: count || 0,
        limit,
        offset,
      });
    } catch (error) {
      request.log.error("Documents list error:", error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // GET /api/data-sources/stats - Statystyki źródeł danych
  fastify.get("/data-sources/stats", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Liczba źródeł
      const { count: totalSources } = await supabase
        .from("data_sources")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      const { count: activeSources } = await supabase
        .from("data_sources")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("scraping_enabled", true);

      // Liczba dokumentów
      const { count: totalDocuments } = await supabase
        .from("processed_documents")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      // Dokumenty według typu
      const { data: docsByType } = await supabase
        .from("processed_documents")
        .select("document_type")
        .eq("user_id", userId);

      const typeStats = (docsByType || []).reduce(
        (acc: Record<string, number>, doc: any) => {
          acc[doc.document_type] = (acc[doc.document_type] || 0) + 1;
          return acc;
        },
        {}
      );

      // Pobierz źródła użytkownika z datą ostatniego scrapingu
      const { data: userSources } = await supabase
        .from("data_sources")
        .select("id, last_scraped_at")
        .eq("user_id", userId)
        .order("last_scraped_at", { ascending: false, nullsFirst: false });

      const sourceIds = (userSources || []).map((s) => s.id);

      // Ostatni scraping - pobierz z last_scraped_at źródeł
      let lastScrapeDate: string | null = null;
      let errorsCount = 0;

      // Znajdź najnowszą datę scrapingu ze źródeł
      const lastScrapedSource = (userSources || []).find(
        (s) => s.last_scraped_at
      );
      lastScrapeDate = lastScrapedSource?.last_scraped_at || null;

      if (sourceIds.length > 0) {
        // Błędy w ostatnich 24h
        const yesterday = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString();
        const { count } = await supabase
          .from("scraping_logs")
          .select("*", { count: "exact", head: true })
          .in("source_id", sourceIds)
          .eq("status", "error")
          .gte("created_at", yesterday);

        errorsCount = count || 0;
      }

      return reply.send({
        sources: {
          total: totalSources || 0,
          active: activeSources || 0,
        },
        documents: {
          total: totalDocuments || 0,
          byType: typeStats,
        },
        lastScrape: lastScrapeDate,
        errorsLast24h: errorsCount,
      });
    } catch (error) {
      request.log.error("Stats error:", error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // POST /api/data-sources/seed-test-data - Wypełnij bazę danymi testowymi
  fastify.post("/data-sources/seed-test-data", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const testDocuments = [
        {
          title: "Uchwała Nr XLII/123/2025 w sprawie budżetu Gminy na rok 2026",
          content:
            "UCHWAŁA NR XLII/123/2025 RADY MIEJSKIEJ z dnia 15 grudnia 2025 r. w sprawie uchwalenia budżetu Gminy na rok 2026. Ustala się dochody budżetu gminy w wysokości 45.678.900 zł. Ustala się wydatki budżetu gminy w wysokości 48.123.400 zł. Główne inwestycje: Budowa drogi gminnej - 2.500.000 zł, Termomodernizacja szkoły - 1.800.000 zł, Rozbudowa sieci wodociągowej - 1.200.000 zł.",
          document_type: "resolution",
          keywords: ["budżet", "gmina", "dochody", "wydatki", "inwestycje"],
          publish_date: "2025-12-15",
        },
        {
          title:
            "Uchwała Nr XLI/118/2025 w sprawie stawek podatku od nieruchomości",
          content:
            "UCHWAŁA NR XLI/118/2025 RADY MIEJSKIEJ z dnia 28 listopada 2025 r. w sprawie określenia wysokości stawek podatku od nieruchomości. Stawki: od gruntów związanych z działalnością gospodarczą - 1,16 zł za 1 m², od budynków mieszkalnych - 1,06 zł za 1 m², od budynków związanych z działalnością gospodarczą - 30,50 zł za 1 m².",
          document_type: "resolution",
          keywords: ["podatek", "nieruchomości", "stawki", "gmina"],
          publish_date: "2025-11-28",
        },
        {
          title: "Protokół Nr XLI/2025 z sesji Rady Miejskiej",
          content:
            "PROTOKÓŁ NR XLI/2025 z XLI sesji Rady Miejskiej odbytej w dniu 28 listopada 2025 r. Obecni radni: 15 na 15. Porządek obrad: Sprawozdanie Burmistrza, Podjęcie uchwały w sprawie podatków, Interpelacje radnych. Burmistrz przedstawił sprawozdanie z działalności. Radny Wiśniewski zgłosił wniosek o obniżenie stawki dla działalności gospodarczej. Głosowanie: za - 12, przeciw - 2, wstrzymało się - 1.",
          document_type: "protocol",
          keywords: ["sesja", "rada", "protokół", "głosowanie"],
          publish_date: "2025-11-28",
        },
        {
          title: "Ogłoszenie o naborze wniosków do programu Czyste Powietrze",
          content:
            "OGŁOSZENIE: Burmistrz informuje o możliwości składania wniosków do programu Czyste Powietrze 2025/2026. Beneficjenci: osoby fizyczne będące właścicielami budynków mieszkalnych jednorodzinnych. Dofinansowanie: wymiana źródła ciepła na pompę ciepła - do 45.000 zł, termomodernizacja - do 33.000 zł, instalacja fotowoltaiczna - do 6.000 zł. Wnioski przyjmowane w Urzędzie Miejskim, pok. 12.",
          document_type: "announcement",
          keywords: ["czyste powietrze", "dofinansowanie", "termomodernizacja"],
          publish_date: "2025-12-01",
        },
        {
          title: "Plan zagospodarowania przestrzennego - obszar centrum miasta",
          content:
            "OBWIESZCZENIE o przystąpieniu do sporządzenia miejscowego planu zagospodarowania przestrzennego dla obszaru centrum miasta. Zakres: zabudowa mieszkaniowa wielorodzinna do 4 kondygnacji, usługi handlowe i gastronomiczne, przestrzenie publiczne i zieleń miejska. Konsultacje społeczne: wnioski można składać w terminie 21 dni od daty obwieszczenia.",
          document_type: "legal_act",
          keywords: [
            "plan zagospodarowania",
            "centrum",
            "zabudowa",
            "konsultacje",
          ],
          publish_date: "2025-11-15",
        },
      ];

      // Pobierz konfigurację OpenAI z bazy danych (api_configurations)
      const { data: apiConfig } = await supabase
        .from("api_configurations")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", "openai")
        .eq("is_active", true)
        .eq("is_default", true)
        .single();

      let openai: OpenAI | null = null;
      if (apiConfig) {
        const openaiApiKey = Buffer.from(
          apiConfig.api_key_encrypted,
          "base64"
        ).toString("utf-8");
        openai = new OpenAI({
          apiKey: openaiApiKey,
          baseURL: apiConfig.base_url || undefined,
        });
        request.log.info("Using OpenAI API key from database");
      } else {
        request.log.warn("No OpenAI API key found in database for user");
      }

      let created = 0;
      for (const doc of testDocuments) {
        const { data: existing } = await supabase
          .from("processed_documents")
          .select("id")
          .eq("user_id", userId)
          .eq("title", doc.title)
          .maybeSingle();

        // Usuń istniejący dokument bez embeddingu lub stwórz nowy
        if (existing) {
          // Usuń stary dokument (prawdopodobnie bez embeddingu)
          await supabase
            .from("processed_documents")
            .delete()
            .eq("id", existing.id);
        }

        // Generuj embedding dla dokumentu
        let embedding = null;
        if (openai) {
          try {
            const embeddingResponse = await openai.embeddings.create({
              model: "text-embedding-3-small",
              input: `${doc.title}\n\n${doc.content}`,
            });
            embedding = embeddingResponse.data[0]?.embedding ?? null;
          } catch (e) {
            request.log.warn("Failed to generate embedding:", e);
          }
        }

        const { error } = await supabase.from("processed_documents").insert({
          user_id: userId,
          document_type: doc.document_type,
          title: doc.title,
          content: doc.content,
          summary: doc.content.substring(0, 200) + "...",
          keywords: doc.keywords,
          publish_date: doc.publish_date,
          embedding: embedding,
          processed_at: new Date().toISOString(),
        });

        if (!error) created++;
      }

      return reply.send({
        success: true,
        message: `Utworzono ${created} dokumentów testowych`,
        documentsCreated: created,
      });
    } catch (error) {
      request.log.error("Seed test data error:", error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
}
