import { createClient } from "@supabase/supabase-js";
import { scrapeDataSourceV2 } from "../services/scraper-v2.js";
import OpenAI from "openai";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export async function dataSourcesRoutes(fastify) {
    // GET /api/data-sources - Lista źródeł danych użytkownika
    fastify.get("/data-sources", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
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
            const sourcesWithCounts = await Promise.all((sources || []).map(async (source) => {
                const { count: scrapedCount } = await supabase
                    .from("scraped_content")
                    .select("*", { count: "exact", head: true })
                    .eq("source_id", source.id);
                // Pobierz IDs scraped_content dla tego źródła
                const { data: scrapedIds } = await supabase
                    .from("scraped_content")
                    .select("id")
                    .eq("source_id", source.id);
                let docsCount = 0;
                if (scrapedIds && scrapedIds.length > 0) {
                    const ids = scrapedIds.map((s) => s.id);
                    const { count } = await supabase
                        .from("processed_documents")
                        .select("*", { count: "exact", head: true })
                        .in("scraped_content_id", ids);
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
            }));
            return reply.send({ sources: sourcesWithCounts });
        }
        catch (error) {
            request.log.error("Data sources error:", error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // GET /api/data-sources/:id - Szczegóły źródła
    fastify.get("/data-sources/:id", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
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
        }
        catch (error) {
            request.log.error("Data source details error:", error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // POST /api/data-sources - Dodaj nowe źródło
    fastify.post("/data-sources", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const { name, source_type, base_url, scrape_config, schedule_cron } = request.body;
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
                request.log.error({ error: error.message, code: error.code, details: error.details }, "Error creating data source");
                return reply
                    .status(500)
                    .send({ error: `Failed to create data source: ${error.message}` });
            }
            return reply.status(201).send({ source });
        }
        catch (error) {
            request.log.error("Create data source error:", error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // PATCH /api/data-sources/:id - Aktualizuj źródło
    fastify.patch("/data-sources/:id", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const { id } = request.params;
            const { name, base_url, scrape_config, schedule_cron, is_active } = request.body;
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
            const dbUpdates = {
                updated_at: new Date().toISOString(),
            };
            if (name !== undefined)
                dbUpdates.name = name;
            if (base_url !== undefined)
                dbUpdates.url = base_url;
            if (scrape_config !== undefined)
                dbUpdates.scraping_config = scrape_config;
            if (schedule_cron !== undefined)
                dbUpdates.scraping_frequency = schedule_cron;
            if (is_active !== undefined)
                dbUpdates.scraping_enabled = is_active;
            const { data: source, error } = await supabase
                .from("data_sources")
                .update(dbUpdates)
                .eq("id", id)
                .select()
                .single();
            if (error) {
                request.log.error("Error updating data source:", error);
                return reply
                    .status(500)
                    .send({ error: "Failed to update data source" });
            }
            return reply.send({ source });
        }
        catch (error) {
            request.log.error("Update data source error:", error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // DELETE /api/data-sources/:id - Usuń źródło
    fastify.delete("/data-sources/:id", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
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
        }
        catch (error) {
            request.log.error("Delete data source error:", error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // POST /api/data-sources/:id/scrape - Uruchom scraping teraz
    fastify.post("/data-sources/:id/scrape", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const { id } = request.params;
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
            // Uruchom scraping synchronicznie (w przyszłości przez BullMQ)
            request.log.info({ sourceId: id }, "Starting scraping v2");
            const result = await scrapeDataSourceV2(id, userId);
            request.log.info({
                sourceId: id,
                success: result.success,
                pagesScraped: result.pagesScraped,
                documentsProcessed: result.documentsProcessed,
            }, "Scraping completed");
            return reply.send({
                message: result.success ? "Scraping completed" : "Scraping failed",
                source_id: id,
                status: result.success ? "success" : "error",
                pages_scraped: result.pagesScraped,
                documents_found: result.documentsFound,
                documents_processed: result.documentsProcessed,
                errors: result.errors,
            });
        }
        catch (error) {
            request.log.error("Trigger scraping error:", error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // GET /api/data-sources/documents - Lista dokumentów ze wszystkich źródeł
    fastify.get("/data-sources/documents", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const query = request.query;
            let dbQuery = supabase
                .from("processed_documents")
                .select("*", { count: "exact" })
                .eq("user_id", userId);
            if (query.search) {
                dbQuery = dbQuery.or(`title.ilike.%${query.search}%,content.ilike.%${query.search}%`);
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
        }
        catch (error) {
            request.log.error("Documents list error:", error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // GET /api/data-sources/stats - Statystyki źródeł danych
    fastify.get("/data-sources/stats", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
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
            const typeStats = (docsByType || []).reduce((acc, doc) => {
                acc[doc.document_type] = (acc[doc.document_type] || 0) + 1;
                return acc;
            }, {});
            // Pobierz IDs źródeł użytkownika
            const { data: userSources } = await supabase
                .from("data_sources")
                .select("id")
                .eq("user_id", userId);
            const sourceIds = (userSources || []).map((s) => s.id);
            // Ostatni scraping
            let lastScrapeDate = null;
            let errorsCount = 0;
            if (sourceIds.length > 0) {
                const { data: lastLog } = await supabase
                    .from("scraping_logs")
                    .select("created_at")
                    .in("source_id", sourceIds)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .single();
                lastScrapeDate = lastLog?.created_at || null;
                // Błędy w ostatnich 24h
                const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
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
        }
        catch (error) {
            request.log.error("Stats error:", error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // POST /api/data-sources/seed-test-data - Wypełnij bazę danymi testowymi
    fastify.post("/data-sources/seed-test-data", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const testDocuments = [
                {
                    title: "Uchwała Nr XLII/123/2025 w sprawie budżetu Gminy na rok 2026",
                    content: "UCHWAŁA NR XLII/123/2025 RADY MIEJSKIEJ z dnia 15 grudnia 2025 r. w sprawie uchwalenia budżetu Gminy na rok 2026. Ustala się dochody budżetu gminy w wysokości 45.678.900 zł. Ustala się wydatki budżetu gminy w wysokości 48.123.400 zł. Główne inwestycje: Budowa drogi gminnej - 2.500.000 zł, Termomodernizacja szkoły - 1.800.000 zł, Rozbudowa sieci wodociągowej - 1.200.000 zł.",
                    document_type: "resolution",
                    keywords: ["budżet", "gmina", "dochody", "wydatki", "inwestycje"],
                    publish_date: "2025-12-15",
                },
                {
                    title: "Uchwała Nr XLI/118/2025 w sprawie stawek podatku od nieruchomości",
                    content: "UCHWAŁA NR XLI/118/2025 RADY MIEJSKIEJ z dnia 28 listopada 2025 r. w sprawie określenia wysokości stawek podatku od nieruchomości. Stawki: od gruntów związanych z działalnością gospodarczą - 1,16 zł za 1 m², od budynków mieszkalnych - 1,06 zł za 1 m², od budynków związanych z działalnością gospodarczą - 30,50 zł za 1 m².",
                    document_type: "resolution",
                    keywords: ["podatek", "nieruchomości", "stawki", "gmina"],
                    publish_date: "2025-11-28",
                },
                {
                    title: "Protokół Nr XLI/2025 z sesji Rady Miejskiej",
                    content: "PROTOKÓŁ NR XLI/2025 z XLI sesji Rady Miejskiej odbytej w dniu 28 listopada 2025 r. Obecni radni: 15 na 15. Porządek obrad: Sprawozdanie Burmistrza, Podjęcie uchwały w sprawie podatków, Interpelacje radnych. Burmistrz przedstawił sprawozdanie z działalności. Radny Wiśniewski zgłosił wniosek o obniżenie stawki dla działalności gospodarczej. Głosowanie: za - 12, przeciw - 2, wstrzymało się - 1.",
                    document_type: "protocol",
                    keywords: ["sesja", "rada", "protokół", "głosowanie"],
                    publish_date: "2025-11-28",
                },
                {
                    title: "Ogłoszenie o naborze wniosków do programu Czyste Powietrze",
                    content: "OGŁOSZENIE: Burmistrz informuje o możliwości składania wniosków do programu Czyste Powietrze 2025/2026. Beneficjenci: osoby fizyczne będące właścicielami budynków mieszkalnych jednorodzinnych. Dofinansowanie: wymiana źródła ciepła na pompę ciepła - do 45.000 zł, termomodernizacja - do 33.000 zł, instalacja fotowoltaiczna - do 6.000 zł. Wnioski przyjmowane w Urzędzie Miejskim, pok. 12.",
                    document_type: "announcement",
                    keywords: ["czyste powietrze", "dofinansowanie", "termomodernizacja"],
                    publish_date: "2025-12-01",
                },
                {
                    title: "Plan zagospodarowania przestrzennego - obszar centrum miasta",
                    content: "OBWIESZCZENIE o przystąpieniu do sporządzenia miejscowego planu zagospodarowania przestrzennego dla obszaru centrum miasta. Zakres: zabudowa mieszkaniowa wielorodzinna do 4 kondygnacji, usługi handlowe i gastronomiczne, przestrzenie publiczne i zieleń miejska. Konsultacje społeczne: wnioski można składać w terminie 21 dni od daty obwieszczenia.",
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
            // Inicjalizuj OpenAI do generowania embeddingów
            const openaiApiKey = process.env.OPENAI_API_KEY;
            let openai = null;
            if (openaiApiKey && openaiApiKey !== "your_openai_api_key") {
                openai = new OpenAI({ apiKey: openaiApiKey });
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
                        embedding = embeddingResponse.data[0].embedding;
                    }
                    catch (e) {
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
                if (!error)
                    created++;
            }
            return reply.send({
                success: true,
                message: `Utworzono ${created} dokumentów testowych`,
                documentsCreated: created,
            });
        }
        catch (error) {
            request.log.error("Seed test data error:", error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
}
//# sourceMappingURL=data-sources.js.map