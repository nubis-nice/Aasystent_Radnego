/**
 * Web Scraper Service v2
 * Zaawansowany scraper z Cheerio, link crawling i obsługą różnych typów stron
 */
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import { autoImportToCalendar } from "./calendar-auto-import.js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
// ============================================================================
// DEFAULT CONFIGS PER SOURCE TYPE
// ============================================================================
const DEFAULT_CONFIGS = {
    bip: {
        maxPages: 50,
        maxDepth: 3,
        delayMs: 1000,
        selectors: {
            documentList: ".dokument, .document, table.dokumenty tr, .lista-dokumentow li, .news-item",
            title: "h1, h2, .title, .tytul, .document-title",
            content: ".tresc, .content, .main-content, article, .document-content, #content",
            links: "a[href]",
            pdfLinks: 'a[href$=".pdf"], a[href*="pdf"]',
            date: ".data, .date, time, .publish-date",
        },
        urlPatterns: {
            include: [
                "uchwaly",
                "protokoly",
                "zarzadzenia",
                "ogloszenia",
                "obwieszczenia",
                "dokumenty",
            ],
            exclude: ["login", "logowanie", "rss", "feed", "wp-admin", "admin"],
        },
    },
    municipality: {
        maxPages: 30,
        maxDepth: 2,
        delayMs: 500,
        selectors: {
            documentList: ".news-item, article, .post, .aktualnosc, .event",
            title: "h1, h2, .entry-title, .post-title, .news-title",
            content: ".entry-content, .post-content, .news-content, article, .content",
            links: "a[href]",
            date: ".post-date, .entry-date, time, .date",
        },
        urlPatterns: {
            include: [
                "aktualnosci",
                "news",
                "ogloszenia",
                "wydarzenia",
                "informacje",
            ],
            exclude: ["wp-admin", "feed", "login", "rss"],
        },
    },
    legal: {
        maxPages: 20,
        maxDepth: 2,
        delayMs: 2000,
        selectors: {
            documentList: ".act-item, .dokument, .document-row, tr.akt",
            title: ".act-title, h1, .tytul-aktu",
            content: ".act-content, .tresc-aktu, .content",
            pdfLinks: 'a[href$=".pdf"], a.pdf-link',
        },
    },
    councilor: {
        maxPages: 30,
        maxDepth: 2,
        delayMs: 1000,
        selectors: {
            documentList: "article, .news, .post",
            title: "h1, h2",
            content: ".content, article, .entry-content",
        },
    },
    statistics: {
        maxPages: 10,
        maxDepth: 1,
        delayMs: 2000,
        selectors: {
            documentList: ".data-table, table, .statystyka",
            title: "h1, h2, caption",
            content: "table, .data, .content",
        },
    },
    custom: {
        maxPages: 20,
        maxDepth: 2,
        delayMs: 1000,
        selectors: {
            documentList: "article, .item, .post, li",
            title: "h1, h2, h3",
            content: ".content, article, main, #content",
            links: "a[href]",
        },
    },
};
// ============================================================================
// MAIN SCRAPER CLASS
// ============================================================================
export class WebScraper {
    config;
    baseUrl;
    visitedUrls = new Set();
    scrapedPages = [];
    errors = [];
    constructor(baseUrl, sourceType, customConfig) {
        this.baseUrl = this.normalizeUrl(baseUrl);
        const defaultConfig = DEFAULT_CONFIGS[sourceType] || DEFAULT_CONFIGS["custom"];
        this.config = {
            maxPages: customConfig?.maxPages ?? defaultConfig.maxPages,
            maxDepth: customConfig?.maxDepth ?? defaultConfig.maxDepth,
            delayMs: customConfig?.delayMs ?? defaultConfig.delayMs,
            selectors: { ...defaultConfig.selectors, ...customConfig?.selectors },
            urlPatterns: customConfig?.urlPatterns ?? defaultConfig.urlPatterns,
        };
    }
    normalizeUrl(url) {
        try {
            const parsed = new URL(url);
            return `${parsed.protocol}//${parsed.host}`;
        }
        catch {
            return url;
        }
    }
    isValidUrl(url) {
        try {
            const parsed = new URL(url, this.baseUrl);
            // Musi być z tej samej domeny
            if (!parsed.href.startsWith(this.baseUrl)) {
                return false;
            }
            // Sprawdź exclude patterns
            if (this.config.urlPatterns?.exclude) {
                for (const pattern of this.config.urlPatterns.exclude) {
                    if (parsed.href.toLowerCase().includes(pattern.toLowerCase())) {
                        return false;
                    }
                }
            }
            // Pomiń pliki binarne (oprócz PDF)
            const skipExtensions = [
                ".jpg",
                ".jpeg",
                ".png",
                ".gif",
                ".css",
                ".js",
                ".ico",
                ".svg",
                ".woff",
                ".woff2",
            ];
            for (const ext of skipExtensions) {
                if (parsed.pathname.toLowerCase().endsWith(ext)) {
                    return false;
                }
            }
            return true;
        }
        catch {
            return false;
        }
    }
    shouldPrioritize(url) {
        if (!this.config.urlPatterns?.include)
            return false;
        const lowerUrl = url.toLowerCase();
        return this.config.urlPatterns.include.some((pattern) => lowerUrl.includes(pattern.toLowerCase()));
    }
    async fetchPage(url) {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
                },
                signal: AbortSignal.timeout(30000),
            });
            if (!response.ok) {
                this.errors.push(`HTTP ${response.status} for ${url}`);
                return null;
            }
            const contentType = response.headers.get("content-type") || "";
            if (!contentType.includes("text/html") &&
                !contentType.includes("application/xhtml")) {
                return null;
            }
            return await response.text();
        }
        catch (error) {
            this.errors.push(`Fetch error for ${url}: ${error instanceof Error ? error.message : "Unknown"}`);
            return null;
        }
    }
    parsePage(html, url) {
        const $ = cheerio.load(html);
        // Usuń niepotrzebne elementy
        $("script, style, nav, footer, header, .menu, .sidebar, .navigation, .cookie-notice, .popup").remove();
        // Wyciągnij tytuł
        let title = "";
        if (this.config.selectors.title) {
            title = $(this.config.selectors.title).first().text().trim();
        }
        if (!title) {
            title = $("title").text().trim();
        }
        // Wyciągnij treść
        let content = "";
        if (this.config.selectors.content) {
            const contentElements = $(this.config.selectors.content);
            contentElements.each((_, el) => {
                content += $(el).text().trim() + "\n\n";
            });
        }
        if (!content) {
            content = $("body").text().trim();
        }
        // Oczyść treść
        content = this.cleanText(content);
        // Wyciągnij linki
        const links = [];
        $("a[href]").each((_, el) => {
            const href = $(el).attr("href");
            if (href) {
                try {
                    const absoluteUrl = new URL(href, url).href;
                    if (this.isValidUrl(absoluteUrl) && !links.includes(absoluteUrl)) {
                        links.push(absoluteUrl);
                    }
                }
                catch {
                    // Invalid URL, skip
                }
            }
        });
        // Wyciągnij linki do PDF
        const pdfLinks = [];
        $('a[href$=".pdf"], a[href*="pdf"]').each((_, el) => {
            const href = $(el).attr("href");
            if (href) {
                try {
                    const absoluteUrl = new URL(href, url).href;
                    if (!pdfLinks.includes(absoluteUrl)) {
                        pdfLinks.push(absoluteUrl);
                    }
                }
                catch {
                    // Invalid URL, skip
                }
            }
        });
        // Wyciągnij datę
        let publishDate;
        if (this.config.selectors.date) {
            const dateText = $(this.config.selectors.date).first().text().trim();
            publishDate = this.parseDate(dateText);
        }
        return {
            url,
            title,
            content,
            links,
            pdfLinks,
            publishDate,
            metadata: {
                scrapedAt: new Date().toISOString(),
                contentLength: content.length,
                linksCount: links.length,
                pdfCount: pdfLinks.length,
            },
        };
    }
    cleanText(text) {
        return text
            .replace(/\s+/g, " ")
            .replace(/\n\s*\n/g, "\n\n")
            .trim()
            .substring(0, 50000);
    }
    parseDate(dateText) {
        if (!dateText)
            return undefined;
        // Polskie formaty dat
        const patterns = [
            /(\d{1,2})\.(\d{1,2})\.(\d{4})/, // DD.MM.YYYY
            /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
            /(\d{1,2})\s+(styczeń|luty|marzec|kwiecień|maj|czerwiec|lipiec|sierpień|wrzesień|październik|listopad|grudzień)\s+(\d{4})/i,
        ];
        for (const pattern of patterns) {
            const match = dateText.match(pattern);
            if (match) {
                try {
                    // Spróbuj sparsować
                    const date = new Date(dateText);
                    if (!isNaN(date.getTime())) {
                        return date.toISOString().split("T")[0];
                    }
                }
                catch {
                    // Continue to next pattern
                }
            }
        }
        return undefined;
    }
    async delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async crawl() {
        const queue = [
            { url: this.baseUrl, depth: 0 },
        ];
        // Priorytetyzuj URL-e zawierające ważne słowa kluczowe
        const priorityQueue = [];
        while ((queue.length > 0 || priorityQueue.length > 0) &&
            this.scrapedPages.length < this.config.maxPages) {
            // Najpierw priorytetowe URL-e
            const current = priorityQueue.shift() || queue.shift();
            if (!current)
                break;
            const { url, depth } = current;
            if (this.visitedUrls.has(url))
                continue;
            if (depth > this.config.maxDepth)
                continue;
            this.visitedUrls.add(url);
            console.log(`[Scraper] Crawling (${this.scrapedPages.length + 1}/${this.config.maxPages}): ${url}`);
            const html = await this.fetchPage(url);
            if (!html)
                continue;
            const page = this.parsePage(html, url);
            // Zapisz tylko strony z treścią
            if (page.content.length > 100) {
                this.scrapedPages.push(page);
            }
            // Dodaj nowe linki do kolejki
            for (const link of page.links) {
                if (!this.visitedUrls.has(link)) {
                    if (this.shouldPrioritize(link)) {
                        priorityQueue.push({ url: link, depth: depth + 1 });
                    }
                    else {
                        queue.push({ url: link, depth: depth + 1 });
                    }
                }
            }
            // Opóźnienie między requestami
            await this.delay(this.config.delayMs);
        }
        return this.scrapedPages;
    }
    getErrors() {
        return this.errors;
    }
}
// ============================================================================
// MAIN SCRAPE FUNCTION
// ============================================================================
export async function scrapeDataSourceV2(sourceId, userId) {
    const result = {
        success: false,
        pagesScraped: 0,
        documentsFound: 0,
        documentsProcessed: 0,
        errors: [],
    };
    const startTime = Date.now();
    try {
        // Pobierz źródło danych
        const { data: source, error: sourceError } = await supabase
            .from("data_sources")
            .select("*")
            .eq("id", sourceId)
            .eq("user_id", userId)
            .single();
        if (sourceError || !source) {
            result.errors.push("Źródło danych nie znalezione");
            return result;
        }
        console.log(`[Scraper] Starting scrape for source: ${source.name} (${source.type})`);
        // Zapisz log rozpoczęcia
        const { data: logEntry } = await supabase
            .from("scraping_logs")
            .insert({
            source_id: sourceId,
            status: "running",
            items_scraped: 0,
            items_processed: 0,
        })
            .select()
            .single();
        const logId = logEntry?.id;
        // Parsuj custom config jeśli istnieje
        let customConfig;
        if (source.scraping_config && typeof source.scraping_config === "object") {
            customConfig = source.scraping_config;
        }
        // Uruchom scraper
        const scraper = new WebScraper(source.url, source.type, customConfig);
        const pages = await scraper.crawl();
        result.pagesScraped = pages.length;
        result.errors.push(...scraper.getErrors());
        console.log(`[Scraper] Crawled ${pages.length} pages`);
        // Zapisz surowe dane i przetwórz
        let skippedDuplicate = 0;
        let insertErrors = 0;
        for (const page of pages) {
            const contentHash = generateHash(page.content);
            // Sprawdź czy już istnieje (deduplikacja)
            const { data: existing } = await supabase
                .from("scraped_content")
                .select("id")
                .eq("source_id", sourceId)
                .eq("content_hash", contentHash)
                .maybeSingle();
            if (!existing) {
                const { data: inserted, error: insertError } = await supabase
                    .from("scraped_content")
                    .insert({
                    source_id: sourceId,
                    url: page.url,
                    title: page.title,
                    content_type: "html",
                    raw_content: page.content,
                    content_hash: contentHash,
                    metadata: page.metadata,
                })
                    .select()
                    .single();
                if (insertError) {
                    console.log(`[Scraper] Insert error for ${page.url}:`, insertError.message);
                    insertErrors++;
                }
                else if (inserted) {
                    result.documentsFound++;
                }
            }
            else {
                skippedDuplicate++;
            }
        }
        console.log(`[Scraper] Saved: ${result.documentsFound}, Duplicates skipped: ${skippedDuplicate}, Errors: ${insertErrors}`);
        // Przetwórz dokumenty (generuj embeddingi)
        console.log(`[Scraper] About to call processScrapedContentV2 with sourceId: ${sourceId}, userId: ${userId}`);
        try {
            const processedCount = await processScrapedContentV2(sourceId, userId);
            result.documentsProcessed = processedCount;
            console.log(`[Scraper] processScrapedContentV2 returned: ${processedCount}`);
        }
        catch (error) {
            console.error(`[Scraper] Error in processScrapedContentV2:`, error);
            result.errors.push(`Processing error: ${error instanceof Error ? error.message : "Unknown"}`);
        }
        // Zaktualizuj źródło
        await supabase
            .from("data_sources")
            .update({
            last_scraped_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq("id", sourceId);
        // Zaktualizuj log
        const durationMs = Date.now() - startTime;
        if (logId) {
            await supabase
                .from("scraping_logs")
                .update({
                status: result.errors.length > 0 ? "partial" : "success",
                items_scraped: result.pagesScraped,
                items_processed: result.documentsProcessed,
                duration_ms: durationMs,
                error_message: result.errors.length > 0
                    ? result.errors.slice(0, 5).join("; ")
                    : null,
            })
                .eq("id", logId);
        }
        result.success = true;
        console.log(`[Scraper] Completed in ${durationMs}ms. Pages: ${result.pagesScraped}, Documents: ${result.documentsFound}, Processed: ${result.documentsProcessed}`);
    }
    catch (error) {
        result.errors.push(error instanceof Error ? error.message : "Unknown error");
        await supabase.from("scraping_logs").insert({
            source_id: sourceId,
            status: "error",
            error_message: result.errors.join("; "),
            items_scraped: result.pagesScraped,
            items_processed: result.documentsProcessed,
        });
    }
    return result;
}
// ============================================================================
// INTELLIGENCE FILTER - AI-based relevance check
// ============================================================================
async function checkDocumentRelevance(openai, title, content, url) {
    // Szybkie filtrowanie na podstawie wzorców URL - odrzuć znane nieistotne strony
    const irrelevantPatterns = [
        /howyoutubeworks/i,
        /privacy.*policy/i,
        /terms.*service/i,
        /cookie.*policy/i,
        /business.*model/i,
        /creator.*economy/i,
        /zarobki.*twórców/i,
        /help\.youtube/i,
        /support\.google/i,
        /developers\.google/i,
        /policies\.google/i,
    ];
    for (const pattern of irrelevantPatterns) {
        if (pattern.test(url) || pattern.test(title)) {
            return false;
        }
    }
    // Szybkie filtrowanie - jeśli tytuł zawiera słowa kluczowe samorządowe, akceptuj
    const relevantKeywords = [
        "sesja",
        "rada",
        "gmina",
        "uchwała",
        "protokół",
        "burmistrz",
        "wójt",
        "radny",
        "budżet",
        "obwieszczenie",
        "zarządzenie",
        "bip",
        "urząd",
        "powiat",
    ];
    const lowerTitle = title.toLowerCase();
    for (const keyword of relevantKeywords) {
        if (lowerTitle.includes(keyword)) {
            return true;
        }
    }
    // Dla niejasnych przypadków - użyj AI do oceny relevancji
    try {
        const prompt = `Oceń czy poniższy dokument jest istotny dla systemu wspomagającego pracę radnego gminy/powiatu w Polsce.

TYTUŁ: ${title}
URL: ${url}
TREŚĆ (fragment): ${content.substring(0, 1000)}

Odpowiedz TYLKO jednym słowem: TAK lub NIE

Dokument jest istotny jeśli dotyczy:
- Samorządu lokalnego (gmina, powiat, miasto)
- Sesji rady, uchwał, protokołów
- Prawa lokalnego, budżetu, inwestycji
- Działalności radnych, komisji
- Spraw mieszkańców gminy

Dokument NIE jest istotny jeśli dotyczy:
- Dokumentów technicznych platform (YouTube, Google, itp.)
- Polityki prywatności, regulaminów serwisów
- Treści niezwiązanych z samorządem`;
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 10,
            temperature: 0,
        });
        const answer = response.choices[0]?.message?.content?.trim().toUpperCase();
        return answer === "TAK";
    }
    catch (error) {
        console.warn("[Scraper] AI relevance check failed, accepting document:", error);
        return true; // W przypadku błędu, akceptuj dokument
    }
}
// ============================================================================
// DOCUMENT PROCESSING
// ============================================================================
async function processScrapedContentV2(sourceId, userId) {
    console.log("[Scraper] Starting processScrapedContentV2 for source:", sourceId, "user:", userId);
    let processedCount = 0;
    const { data: unprocessedContent } = await supabase
        .from("scraped_content")
        .select("*")
        .eq("source_id", sourceId)
        .order("scraped_at", { ascending: false })
        .limit(1000);
    console.log("[Scraper] Found scraped content items:", unprocessedContent?.length || 0);
    if (!unprocessedContent || unprocessedContent.length === 0) {
        console.log("[Scraper] No unprocessed content found, returning 0");
        return 0;
    }
    // Pobierz konfigurację OpenAI z bazy danych (api_configurations)
    console.log("[Scraper] Looking for API config for user:", userId);
    const { data: apiConfig, error: apiError } = await supabase
        .from("api_configurations")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", "openai")
        .eq("is_active", true)
        .eq("is_default", true)
        .single();
    if (apiError) {
        console.log("[Scraper] API key query error:", apiError.message);
    }
    console.log("[Scraper] API config found:", apiConfig ? "yes" : "no");
    let openaiApiKey = undefined;
    let openaiBaseUrl = undefined;
    let embeddingModel = "text-embedding-3-small"; // domyślny model
    if (apiConfig) {
        openaiApiKey = Buffer.from(apiConfig.api_key_encrypted, "base64").toString("utf-8");
        openaiBaseUrl = apiConfig.base_url || undefined;
        // Użyj modelu embeddings z konfiguracji jeśli określony
        if (apiConfig.embedding_model) {
            embeddingModel = apiConfig.embedding_model;
        }
        console.log("[Scraper] Using API key from database, embedding model:", embeddingModel);
    }
    else {
        console.log("[Scraper] No API config in DB, skipping AI processing");
        return 0;
    }
    if (!openaiApiKey) {
        console.warn("[Scraper] No API key configured, skipping AI processing");
        return 0;
    }
    const openai = new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseUrl });
    for (const content of unprocessedContent) {
        try {
            // Sprawdź czy już przetworzony
            const { data: existing } = await supabase
                .from("processed_documents")
                .select("id")
                .eq("scraped_content_id", content.id)
                .maybeSingle();
            if (existing)
                continue;
            // Pomiń zbyt krótkie treści
            if (!content.raw_content || content.raw_content.length < 100)
                continue;
            // INTELLIGENCE FILTER: Sprawdź relevancję dokumentu przed przetwarzaniem
            const isRelevant = await checkDocumentRelevance(openai, content.title || "", content.raw_content, content.url || "");
            if (!isRelevant) {
                console.log(`[Scraper] Pomijam nieistotny dokument: ${content.title?.substring(0, 50)}...`);
                continue;
            }
            // Określ typ dokumentu
            const documentType = classifyDocument(content.title || "", content.raw_content);
            // Generuj embedding
            let embedding = null;
            try {
                const embeddingResponse = await openai.embeddings.create({
                    model: embeddingModel,
                    input: `${content.title || ""}\n\n${content.raw_content.substring(0, 5000)}`,
                });
                embedding = embeddingResponse.data[0]?.embedding ?? null;
            }
            catch (e) {
                console.warn("[Scraper] Embedding generation failed:", e);
                continue; // Bez embeddingu nie ma sensu zapisywać
            }
            // Wyciągnij słowa kluczowe
            const keywords = extractKeywords(content.title || "", content.raw_content);
            // Zapisz przetworzony dokument
            const { data: insertedDoc, error } = await supabase
                .from("processed_documents")
                .insert({
                scraped_content_id: content.id,
                user_id: userId,
                document_type: documentType,
                title: content.title || "Bez tytułu",
                content: content.raw_content,
                summary: content.raw_content.substring(0, 300) + "...",
                keywords,
                source_url: content.url,
                embedding,
                processed_at: new Date().toISOString(),
            })
                .select("id, user_id, title, document_type, content, session_number, normalized_publish_date, source_url")
                .single();
            if (!error && insertedDoc) {
                processedCount++;
                // Auto-import do kalendarza dla dokumentów sesji/komisji
                try {
                    await autoImportToCalendar(insertedDoc);
                }
                catch (calendarError) {
                    console.error("[Scraper] Calendar auto-import failed:", calendarError);
                }
            }
        }
        catch (error) {
            console.error("[Scraper] Error processing content:", error);
        }
    }
    return processedCount;
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function classifyDocument(title, content) {
    const lowerTitle = title.toLowerCase();
    const lowerContent = content.toLowerCase().substring(0, 2000);
    if (lowerTitle.includes("uchwał") || lowerContent.includes("uchwała nr")) {
        return "resolution";
    }
    if (lowerTitle.includes("protokół") || lowerContent.includes("protokół z")) {
        return "protocol";
    }
    if (lowerTitle.includes("ogłoszeni") || lowerTitle.includes("obwieszczeni")) {
        return "announcement";
    }
    if (lowerTitle.includes("zarządzeni") ||
        lowerContent.includes("zarządzenie nr")) {
        return "ordinance";
    }
    if (lowerTitle.includes("ustaw") || lowerTitle.includes("rozporządz")) {
        return "legal_act";
    }
    if (lowerTitle.includes("aktualnoś") ||
        lowerTitle.includes("news") ||
        lowerTitle.includes("informacj")) {
        return "news";
    }
    if (lowerTitle.includes("budżet") || lowerContent.includes("budżet")) {
        return "budget";
    }
    return "article";
}
function extractKeywords(title, content) {
    const text = `${title} ${content}`.toLowerCase();
    const keywords = [];
    const importantWords = [
        "uchwała",
        "budżet",
        "sesja",
        "rada",
        "gmina",
        "miasto",
        "wójt",
        "burmistrz",
        "prezydent",
        "podatek",
        "opłata",
        "inwestycja",
        "projekt",
        "dotacja",
        "fundusz",
        "plan",
        "zagospodarowanie",
        "przestrzenne",
        "ochrona",
        "środowisko",
        "droga",
        "szkoła",
        "przedszkole",
        "wodociąg",
        "kanalizacja",
        "oświetlenie",
        "remont",
        "przetarg",
        "konkurs",
        "nabór",
        "wybory",
        "referendum",
        "konsultacje",
    ];
    for (const word of importantWords) {
        if (text.includes(word)) {
            keywords.push(word);
        }
    }
    return [...new Set(keywords)].slice(0, 15);
}
function generateHash(content) {
    let hash = 0;
    const str = content || "";
    for (let i = 0; i < Math.min(str.length, 10000); i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
}
export { generateHash, classifyDocument, extractKeywords };
//# sourceMappingURL=scraper-v2.js.map