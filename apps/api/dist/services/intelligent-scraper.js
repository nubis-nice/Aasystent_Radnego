/**
 * Intelligent Scraper Service
 * Zaawansowany scraper z analizą LLM, pełnym mapowaniem strony i inkrementalnym scrapingiem
 */
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import crypto from "crypto";
import { DocumentProcessor } from "./document-processor.js";
import { getLLMClient, getEmbeddingsClient, getAIConfig } from "../ai/index.js";
import { YouTubeSessionService } from "./youtube-session-service.js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
// ============================================================================
// DEFAULT CONFIG
// ============================================================================
const DEFAULT_CONFIG = {
    maxPages: 100,
    maxDepth: 5,
    delayMs: 2000, // Zwiększone z 800ms aby uniknąć rate limit
    enableLLMAnalysis: true,
    councilLocation: "Drawno",
    focusAreas: [
        "sesje rady",
        "kalendarz posiedzeń",
        "materiały dla radnych",
        "uchwały",
        "protokoły",
        "porządek obrad",
        "projekty uchwał",
        "interpelacje",
        "zapytania radnych",
    ],
    incrementalMode: true,
};
// ============================================================================
// INTELLIGENT SCRAPER CLASS
// ============================================================================
export class IntelligentScraper {
    config;
    baseUrl;
    visitedUrls = new Set();
    siteMap = new Map();
    errors = [];
    llmClient = null;
    embeddingsClient = null;
    llmModel = "gpt-4o-mini";
    userId;
    sourceId;
    constructor(baseUrl, userId, sourceId, customConfig) {
        this.baseUrl = this.normalizeUrl(baseUrl);
        this.userId = userId;
        this.sourceId = sourceId;
        this.config = { ...DEFAULT_CONFIG, ...customConfig };
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
    /**
     * Initialize AI clients via AIClientFactory
     */
    async initializeOpenAI() {
        try {
            this.llmClient = await getLLMClient(this.userId);
            this.embeddingsClient = await getEmbeddingsClient(this.userId);
            const llmConfig = await getAIConfig(this.userId, "llm");
            this.llmModel = llmConfig.modelName;
            console.log(`[IntelligentScraper] Initialized AI clients: provider=${llmConfig.provider}, model=${this.llmModel}`);
        }
        catch (error) {
            console.warn("[IntelligentScraper] Failed to initialize AI clients:", error);
            // Fallback do zmiennych środowiskowych jest obsługiwany przez AIClientFactory
        }
    }
    // ============================================================================
    // PHASE 1: FULL SITE MAP GENERATION
    // ============================================================================
    async generateSiteMap() {
        console.log(`[IntelligentScraper] Generating site map for: ${this.baseUrl}`);
        const queue = [
            { url: this.baseUrl, depth: 0 },
        ];
        while (queue.length > 0 && this.siteMap.size < this.config.maxPages) {
            const { url, depth } = queue.shift();
            if (this.visitedUrls.has(url) || depth > this.config.maxDepth) {
                continue;
            }
            this.visitedUrls.add(url);
            try {
                const html = await this.fetchPage(url);
                if (!html)
                    continue;
                const $ = cheerio.load(html);
                const title = $("title").text().trim() || $("h1").first().text().trim() || url;
                const links = this.extractLinks($, url);
                const contentType = this.classifyPageType($, url, title);
                const priority = this.calculatePriority(url, title, contentType);
                const node = {
                    url,
                    title,
                    depth,
                    children: links,
                    contentType,
                    priority,
                    contentHash: this.generateContentHash($.text()),
                };
                this.siteMap.set(url, node);
                // Dodaj linki do kolejki z priorytetem
                const prioritizedLinks = links
                    .filter((link) => !this.visitedUrls.has(link))
                    .map((link) => ({
                    url: link,
                    depth: depth + 1,
                    priority: this.calculateUrlPriority(link),
                }))
                    .sort((a, b) => b.priority - a.priority);
                for (const link of prioritizedLinks) {
                    queue.push({ url: link.url, depth: link.depth });
                }
                await this.delay(this.config.delayMs);
            }
            catch (error) {
                this.errors.push(`Site map error for ${url}: ${error instanceof Error ? error.message : "Unknown"}`);
            }
        }
        console.log(`[IntelligentScraper] Site map generated: ${this.siteMap.size} pages`);
        return Array.from(this.siteMap.values());
    }
    extractLinks($, currentUrl) {
        const links = [];
        $("a[href]").each((_, el) => {
            const href = $(el).attr("href");
            if (!href)
                return;
            try {
                const absoluteUrl = new URL(href, currentUrl).href;
                // Tylko linki z tej samej domeny
                if (!absoluteUrl.startsWith(this.baseUrl))
                    return;
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
                    ".mp3",
                    ".mp4",
                ];
                if (skipExtensions.some((ext) => absoluteUrl.toLowerCase().endsWith(ext)))
                    return;
                // Pomiń anchory i query strings dla unikalności
                const cleanUrl = absoluteUrl.split("#")[0].split("?")[0];
                if (!links.includes(cleanUrl)) {
                    links.push(cleanUrl);
                }
            }
            catch {
                // Ignoruj nieprawidłowe URLe
            }
        });
        return links;
    }
    classifyPageType($, url, title) {
        const urlLower = url.toLowerCase();
        const titleLower = title.toLowerCase();
        const bodyText = $("body").text().toLowerCase();
        // Kalendarz
        if (urlLower.includes("kalendarz") ||
            titleLower.includes("kalendarz") ||
            urlLower.includes("harmonogram") ||
            titleLower.includes("harmonogram")) {
            return "calendar";
        }
        // Sesje
        if (urlLower.includes("sesj") ||
            titleLower.includes("sesj") ||
            urlLower.includes("posiedzeni") ||
            titleLower.includes("posiedzeni")) {
            return "session";
        }
        // Materiały dla radnych
        if (urlLower.includes("material") ||
            titleLower.includes("material") ||
            urlLower.includes("radny") ||
            titleLower.includes("radny") ||
            bodyText.includes("materiały dla radnych") ||
            bodyText.includes("projekty uchwał")) {
            return "materials";
        }
        // Dokumenty
        if (urlLower.includes("dokument") ||
            urlLower.includes("uchwal") ||
            urlLower.includes("protokol") ||
            urlLower.includes("zarzadzeni") ||
            $('a[href$=".pdf"]').length > 0) {
            return "document";
        }
        return "page";
    }
    calculatePriority(url, title, contentType) {
        let priority = 50;
        // Priorytet bazowy na typie
        const typePriorities = {
            calendar: 90,
            session: 85,
            materials: 80,
            document: 70,
            page: 40,
            unknown: 30,
        };
        priority = typePriorities[contentType];
        // Bonus za słowa kluczowe
        const urlLower = url.toLowerCase();
        const titleLower = title.toLowerCase();
        for (const focus of this.config.focusAreas) {
            if (urlLower.includes(focus.toLowerCase()) ||
                titleLower.includes(focus.toLowerCase())) {
                priority += 10;
            }
        }
        // Bonus za lokalizację
        if (urlLower.includes(this.config.councilLocation.toLowerCase()) ||
            titleLower.includes(this.config.councilLocation.toLowerCase())) {
            priority += 15;
        }
        return Math.min(priority, 100);
    }
    calculateUrlPriority(url) {
        const urlLower = url.toLowerCase();
        let priority = 0;
        // Słowa kluczowe zwiększające priorytet
        const highPriorityKeywords = [
            "sesj",
            "posiedzeni",
            "kalendarz",
            "material",
            "radny",
            "uchwal",
            "protokol",
            "porządek",
            "projekt",
            "interpelacj",
        ];
        for (const keyword of highPriorityKeywords) {
            if (urlLower.includes(keyword)) {
                priority += 20;
            }
        }
        // Lokalizacja
        if (urlLower.includes(this.config.councilLocation.toLowerCase())) {
            priority += 30;
        }
        return priority;
    }
    generateContentHash(content) {
        return crypto
            .createHash("md5")
            .update(content.slice(0, 10000))
            .digest("hex");
    }
    // ============================================================================
    // PHASE 2: LLM CONTENT ANALYSIS
    // ============================================================================
    async analyzeContentWithLLM(url, title, content) {
        if (!this.config.enableLLMAnalysis || !this.llmClient) {
            return null;
        }
        try {
            const truncatedContent = content.slice(0, 8000);
            const response = await this.llmClient.chat.completions.create({
                model: this.llmModel,
                messages: [
                    {
                        role: "system",
                        content: `Jesteś asystentem analizującym treści ze stron internetowych rad miejskich i gminnych.
Twoim zadaniem jest ocena przydatności treści dla radnego z ${this.config.councilLocation}.

Obszary zainteresowania radnego:
${this.config.focusAreas.map((f) => `- ${f}`).join("\n")}

Odpowiedz w formacie JSON:
{
  "relevanceScore": 0-100,
  "contentType": "sesja|kalendarz|materiały|uchwała|protokół|interpelacja|inne",
  "summary": "krótkie podsumowanie max 200 znaków",
  "keyTopics": ["temat1", "temat2"],
  "isRelevantForCouncilor": true/false,
  "extractedDates": ["2024-01-15", "2024-02-20"],
  "extractedEntities": ["nazwa komisji", "nazwisko radnego"],
  "recommendedAction": "scrape|skip|priority"
}`,
                    },
                    {
                        role: "user",
                        content: `URL: ${url}\nTytuł: ${title}\n\nTreść:\n${truncatedContent}`,
                    },
                ],
                temperature: 0.3,
                response_format: { type: "json_object" },
            });
            const result = JSON.parse(response.choices[0]?.message?.content || "{}");
            return result;
        }
        catch (error) {
            console.error(`[IntelligentScraper] LLM analysis error for ${url}:`, error);
            return null;
        }
    }
    // ============================================================================
    // PHASE 3: INCREMENTAL SCRAPING
    // ============================================================================
    async checkIfContentChanged(url, newHash) {
        const { data: existing } = await supabase
            .from("scraped_content")
            .select("content_hash")
            .eq("url", url)
            .eq("source_id", this.sourceId)
            .order("scraped_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!existing) {
            return true; // Nowa treść
        }
        return existing.content_hash !== newHash;
    }
    // ============================================================================
    // YOUTUBE CHANNEL SCRAPING
    // ============================================================================
    async scrapeYouTubeChannel(result, startTime) {
        try {
            console.log(`[IntelligentScraper] Scraping YouTube channel: ${this.baseUrl}`);
            const youtubeService = new YouTubeSessionService();
            await youtubeService.initializeWithUserConfig(this.userId);
            const channelUrl = this.baseUrl
                .replace("/streams", "")
                .replace("/videos", "");
            // Użyj searchWithContext z nazwą gminy
            const searchResult = await youtubeService.searchWithContext(`${this.config.councilLocation} sesja rady`, { title: channelUrl });
            if (!searchResult.success || searchResult.sessions.length === 0) {
                console.log("[IntelligentScraper] No YouTube sessions found");
                result.success = true;
                result.processingTimeMs = Date.now() - startTime;
                return result;
            }
            console.log(`[IntelligentScraper] Found ${searchResult.sessions.length} YouTube sessions`);
            // Zapisz każde wideo jako dokument z analizą tytułu
            for (const video of searchResult.sessions) {
                try {
                    result.documentsFound++;
                    // Sprawdź czy już istnieje
                    const { data: existing } = await supabase
                        .from("scraped_content")
                        .select("id")
                        .eq("source_id", this.sourceId)
                        .eq("url", video.url)
                        .maybeSingle();
                    if (existing) {
                        result.skippedDocuments++;
                        continue;
                    }
                    // Analizuj tytuł wideo i wyodrębnij numer sesji
                    const titleAnalysis = await youtubeService.analyzeVideoTitle(video.title);
                    console.log(`[IntelligentScraper] Video "${video.title}" → Session ${titleAnalysis.sessionNumber} (confidence: ${titleAnalysis.confidence}%)`);
                    // Zapisz do scraped_content z metadanymi
                    const { error: insertError } = await supabase
                        .from("scraped_content")
                        .insert({
                        source_id: this.sourceId,
                        url: video.url,
                        title: video.title,
                        content: `Nagranie sesji rady: ${video.title}\n\nOpublikowano: ${video.publishedAt || "brak daty"}\nCzas trwania: ${video.duration || "nieznany"}\n\nLink: ${video.url}`,
                        content_type: "youtube_video",
                        scraped_at: new Date().toISOString(),
                        metadata: {
                            videoId: video.id,
                            thumbnailUrl: video.thumbnailUrl,
                            duration: video.duration,
                            publishedAt: video.publishedAt,
                            // Nowe metadane dla transkrypcji
                            sessionNumber: titleAnalysis.sessionNumber,
                            sessionNumberConfidence: titleAnalysis.confidence,
                            sessionAnalysisReasoning: titleAnalysis.reasoning,
                            youtubeTranscriptionAvailable: true,
                            transcriptionStatus: "pending",
                        },
                    });
                    if (!insertError) {
                        result.documentsProcessed++;
                        result.newDocuments++;
                    }
                }
                catch (err) {
                    console.error(`[IntelligentScraper] Error saving YouTube video:`, err);
                }
            }
            result.success = true;
            result.pagesAnalyzed = 1;
        }
        catch (error) {
            result.errors.push(`YouTube scraping error: ${error instanceof Error ? error.message : "Unknown"}`);
        }
        result.processingTimeMs = Date.now() - startTime;
        return result;
    }
    // ============================================================================
    // PHASE 4: FULL INTELLIGENT SCRAPE
    // ============================================================================
    async scrape() {
        const startTime = Date.now();
        const result = {
            success: false,
            siteMap: [],
            pagesAnalyzed: 0,
            documentsFound: 0,
            documentsProcessed: 0,
            newDocuments: 0,
            skippedDocuments: 0,
            llmAnalyses: 0,
            errors: [],
            processingTimeMs: 0,
        };
        try {
            // Sprawdź czy to źródło YouTube - użyj dedykowanego scrapera
            if (this.baseUrl.includes("youtube.com") ||
                this.baseUrl.includes("youtu.be")) {
                console.log("[IntelligentScraper] Detected YouTube source, using YouTubeSessionService...");
                return await this.scrapeYouTubeChannel(result, startTime);
            }
            // Inicjalizacja OpenAI
            await this.initializeOpenAI();
            // PHASE 1: Generowanie mapy strony
            console.log("[IntelligentScraper] Phase 1: Generating site map...");
            result.siteMap = await this.generateSiteMap();
            // PHASE 2: Sortowanie po priorytecie i filtrowanie
            const prioritizedPages = result.siteMap
                .filter((node) => node.priority >= 50 || node.contentType !== "page")
                .sort((a, b) => b.priority - a.priority);
            console.log(`[IntelligentScraper] Phase 2: Analyzing ${prioritizedPages.length} priority pages...`);
            // PHASE 3: Analiza i scraping - RÓWNOLEGLE
            const maxParallel = this.config.maxPagesParallel || 1; // Domyślnie sekwencyjnie
            console.log(`[IntelligentScraper] Phase 3: Processing with parallelism=${maxParallel}`);
            // Przetwarzaj strony w partiach (batch processing)
            for (let i = 0; i < prioritizedPages.length; i += maxParallel) {
                const batch = prioritizedPages.slice(i, i + maxParallel);
                // Przetwórz partię równolegle
                await Promise.all(batch.map(async (node) => {
                    try {
                        result.pagesAnalyzed++;
                        // Sprawdź czy treść się zmieniła (incremental mode)
                        if (this.config.incrementalMode && node.contentHash) {
                            const hasChanged = await this.checkIfContentChanged(node.url, node.contentHash);
                            if (!hasChanged) {
                                result.skippedDocuments++;
                                return;
                            }
                        }
                        // Pobierz pełną treść
                        const html = await this.fetchPage(node.url);
                        if (!html)
                            return;
                        const $ = cheerio.load(html);
                        const content = this.extractMainContent($);
                        const pdfLinks = this.extractPdfLinks($, node.url);
                        // Analiza LLM
                        let llmAnalysis = null;
                        if (this.config.enableLLMAnalysis && content.length > 200) {
                            llmAnalysis = await this.analyzeContentWithLLM(node.url, node.title, content);
                            if (llmAnalysis) {
                                result.llmAnalyses++;
                                // Pomiń treści nieistotne dla radnego
                                if (llmAnalysis.recommendedAction === "skip" &&
                                    llmAnalysis.relevanceScore < 30) {
                                    result.skippedDocuments++;
                                    return;
                                }
                            }
                        }
                        // Zapisz do bazy
                        result.documentsFound++;
                        const savedDoc = await this.saveScrapedContent(node, content, pdfLinks, llmAnalysis);
                        if (savedDoc) {
                            result.documentsProcessed++;
                            result.newDocuments++;
                        }
                    }
                    catch (error) {
                        result.errors.push(`Error processing ${node.url}: ${error instanceof Error ? error.message : "Unknown"}`);
                    }
                }));
                // Delay między partiami (nie między pojedynczymi stronami)
                if (i + maxParallel < prioritizedPages.length) {
                    await this.delay(this.config.delayMs);
                }
            }
            // PHASE 4: Przetwarzanie na embeddingi
            console.log("[IntelligentScraper] Phase 4: Generating embeddings...");
            await this.processToRAG();
            // PHASE 5: Przetwarzanie załączników PDF (z OCR dla skanów)
            console.log("[IntelligentScraper] Phase 5: Processing PDF attachments with OCR...");
            const pdfProcessed = await this.processPDFAttachments();
            console.log(`[IntelligentScraper] Processed ${pdfProcessed} PDF attachments`);
            result.success = true;
            result.errors = [...this.errors, ...result.errors];
        }
        catch (error) {
            result.errors.push(`Fatal error: ${error instanceof Error ? error.message : "Unknown"}`);
        }
        result.processingTimeMs = Date.now() - startTime;
        console.log(`[IntelligentScraper] Completed in ${result.processingTimeMs}ms`);
        return result;
    }
    extractMainContent($) {
        // Usuń niepotrzebne elementy
        $("script, style, nav, header, footer, .menu, .sidebar, .advertisement").remove();
        // Priorytetowe selektory dla treści
        const contentSelectors = [
            "main",
            "article",
            ".content",
            ".main-content",
            "#content",
            ".entry-content",
            ".post-content",
            ".tresc",
            ".document-content",
        ];
        for (const selector of contentSelectors) {
            const content = $(selector).text().trim();
            if (content && content.length > 100) {
                return this.cleanText(content);
            }
        }
        // Fallback do body
        return this.cleanText($("body").text());
    }
    cleanText(text) {
        return text
            .replace(/\s+/g, " ")
            .replace(/\n\s*\n/g, "\n")
            .trim()
            .slice(0, 50000);
    }
    extractPdfLinks($, baseUrl) {
        const pdfLinks = [];
        $('a[href$=".pdf"], a[href*="pdf"]').each((_, el) => {
            const href = $(el).attr("href");
            if (!href)
                return;
            try {
                const absoluteUrl = new URL(href, baseUrl).href;
                if (!pdfLinks.includes(absoluteUrl)) {
                    pdfLinks.push(absoluteUrl);
                }
            }
            catch {
                // Ignoruj nieprawidłowe URLe
            }
        });
        return pdfLinks;
    }
    async saveScrapedContent(node, content, pdfLinks, llmAnalysis) {
        try {
            const { error } = await supabase.from("scraped_content").upsert({
                source_id: this.sourceId,
                url: node.url,
                title: node.title,
                raw_content: content,
                content_hash: node.contentHash,
                pdf_links: pdfLinks,
                metadata: {
                    contentType: node.contentType,
                    priority: node.priority,
                    depth: node.depth,
                    llmAnalysis: llmAnalysis
                        ? {
                            relevanceScore: llmAnalysis.relevanceScore,
                            contentType: llmAnalysis.contentType,
                            summary: llmAnalysis.summary,
                            keyTopics: llmAnalysis.keyTopics,
                            isRelevantForCouncilor: llmAnalysis.isRelevantForCouncilor,
                            extractedDates: llmAnalysis.extractedDates,
                            extractedEntities: llmAnalysis.extractedEntities,
                        }
                        : null,
                },
                scraped_at: new Date().toISOString(),
            }, {
                onConflict: "source_id,url",
            });
            if (error) {
                console.error(`[IntelligentScraper] Save error for ${node.url}:`, error);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error(`[IntelligentScraper] Save exception for ${node.url}:`, error);
            return false;
        }
    }
    async processToRAG() {
        let processedCount = 0;
        // Pobierz nieprzetworzone treści
        const { data: unprocessedContent } = await supabase
            .from("scraped_content")
            .select("*")
            .eq("source_id", this.sourceId)
            .order("scraped_at", { ascending: false })
            .limit(1000);
        console.log(`[IntelligentScraper] ${unprocessedContent?.length || 0} documents to process for RAG`);
        if (!unprocessedContent || unprocessedContent.length === 0) {
            return 0;
        }
        // Użyj klienta embeddings z AIClientFactory
        if (!this.embeddingsClient) {
            await this.initializeOpenAI();
        }
        if (!this.embeddingsClient) {
            console.warn("[IntelligentScraper] No embeddings client available, skipping embeddings");
            return 0;
        }
        const embConfig = await getAIConfig(this.userId, "embeddings");
        const embeddingModel = embConfig.modelName;
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
                // Określ typ dokumentu
                const documentType = this.classifyDocumentType(content.title || "", content.raw_content);
                // Generuj embedding
                let embedding = null;
                try {
                    const embeddingResponse = await this.embeddingsClient.embeddings.create({
                        model: embeddingModel,
                        input: `${content.title || ""}\n\n${content.raw_content.substring(0, 5000)}`,
                    });
                    embedding = embeddingResponse.data[0]?.embedding ?? null;
                }
                catch (e) {
                    console.warn("[IntelligentScraper] Embedding generation failed:", e);
                    continue;
                }
                // Wyciągnij słowa kluczowe
                const keywords = this.extractKeywords(content.title || "", content.raw_content);
                // Użyj podsumowania z LLM jeśli dostępne
                const llmAnalysis = content.metadata?.llmAnalysis;
                const summary = llmAnalysis?.summary || content.raw_content.substring(0, 300) + "...";
                // Zapisz przetworzony dokument
                const { error } = await supabase.from("processed_documents").insert({
                    scraped_content_id: content.id,
                    user_id: this.userId,
                    document_type: documentType,
                    title: content.title || "Bez tytułu",
                    content: content.raw_content,
                    summary,
                    keywords,
                    source_url: content.url,
                    embedding,
                    metadata: {
                        llmAnalysis,
                        pdfLinks: content.pdf_links,
                    },
                    processed_at: new Date().toISOString(),
                });
                if (!error) {
                    processedCount++;
                    console.log(`[IntelligentScraper] Processed: ${content.title || content.url}`);
                }
            }
            catch (error) {
                console.error("[IntelligentScraper] Error processing content:", error);
            }
        }
        console.log(`[IntelligentScraper] Processed ${processedCount} documents to RAG`);
        return processedCount;
    }
    classifyDocumentType(title, content) {
        const lowerTitle = title.toLowerCase();
        const lowerContent = content.toLowerCase().substring(0, 2000);
        if (lowerTitle.includes("uchwał") || lowerContent.includes("uchwała nr"))
            return "resolution";
        if (lowerTitle.includes("protokół") || lowerContent.includes("protokół z"))
            return "protocol";
        if (lowerTitle.includes("ogłoszeni") || lowerTitle.includes("obwieszczeni"))
            return "announcement";
        if (lowerTitle.includes("zarządzeni") ||
            lowerContent.includes("zarządzenie nr"))
            return "ordinance";
        if (lowerTitle.includes("ustaw") || lowerTitle.includes("rozporządz"))
            return "legal_act";
        if (lowerTitle.includes("sesj") || lowerContent.includes("sesja rady"))
            return "session";
        if (lowerTitle.includes("kalendarz") || lowerContent.includes("kalendarz"))
            return "calendar";
        if (lowerTitle.includes("budżet") || lowerContent.includes("budżet"))
            return "budget";
        if (lowerTitle.includes("aktualnoś") || lowerTitle.includes("informacj"))
            return "news";
        return "article";
    }
    extractKeywords(title, content) {
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
            "kalendarz",
            "posiedzenie",
        ];
        for (const word of importantWords) {
            if (text.includes(word)) {
                keywords.push(word);
            }
        }
        return [...new Set(keywords)].slice(0, 15);
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
                return null;
            }
            return await response.text();
        }
        catch (error) {
            this.errors.push(`Fetch error for ${url}: ${error instanceof Error ? error.message : "Unknown"}`);
            return null;
        }
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Przetwarza załączniki PDF znalezione podczas scrapingu
     * Automatycznie wykrywa skany bez warstwy tekstowej i używa OCR (GPT-4 Vision)
     */
    async processPDFAttachments() {
        let processedCount = 0;
        // Pobierz wszystkie PDF linki ze scraped_content dla tego źródła
        const { data: scrapedContent } = await supabase
            .from("scraped_content")
            .select("id, url, pdf_links")
            .eq("source_id", this.sourceId)
            .not("pdf_links", "is", null);
        if (!scrapedContent || scrapedContent.length === 0) {
            console.log("[IntelligentScraper] No PDF links found in scraped content");
            return 0;
        }
        // Zbierz wszystkie unikalne linki PDF
        const allPdfLinks = [];
        for (const content of scrapedContent) {
            const pdfLinks = content.pdf_links || [];
            for (const link of pdfLinks) {
                if (!allPdfLinks.includes(link)) {
                    allPdfLinks.push(link);
                }
            }
        }
        console.log(`[IntelligentScraper] Found ${allPdfLinks.length} unique PDF links to process`);
        if (allPdfLinks.length === 0)
            return 0;
        // Inicjalizuj DocumentProcessor
        const processor = new DocumentProcessor();
        try {
            await processor.initializeWithUserConfig(this.userId);
        }
        catch (error) {
            console.error("[IntelligentScraper] Failed to initialize DocumentProcessor:", error);
            return 0;
        }
        // Limit PDF-ów do przetworzenia (unikaj przeciążenia)
        const maxPdfsToProcess = 20;
        const pdfsToProcess = allPdfLinks.slice(0, maxPdfsToProcess);
        for (const pdfUrl of pdfsToProcess) {
            try {
                // Sprawdź czy PDF już został przetworzony
                const { data: existingDoc } = await supabase
                    .from("processed_documents")
                    .select("id")
                    .eq("source_url", pdfUrl)
                    .maybeSingle();
                if (existingDoc) {
                    console.log(`[IntelligentScraper] PDF already processed: ${pdfUrl}`);
                    continue;
                }
                console.log(`[IntelligentScraper] Downloading PDF: ${pdfUrl}`);
                // Pobierz PDF
                const response = await fetch(pdfUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    },
                    signal: AbortSignal.timeout(60000),
                });
                if (!response.ok) {
                    console.warn(`[IntelligentScraper] Failed to download PDF: ${response.status}`);
                    continue;
                }
                const arrayBuffer = await response.arrayBuffer();
                const pdfBuffer = Buffer.from(arrayBuffer);
                // Wyciągnij nazwę pliku z URL
                const urlParts = pdfUrl.split("/");
                const fileName = decodeURIComponent(urlParts[urlParts.length - 1] || "document.pdf");
                console.log(`[IntelligentScraper] Processing PDF: ${fileName} (${pdfBuffer.length} bytes)`);
                // Przetwórz PDF - DocumentProcessor automatycznie wykryje czy to skan i użyje OCR
                const result = await processor.processFile(pdfBuffer, fileName, "application/pdf");
                if (!result.success) {
                    console.warn(`[IntelligentScraper] PDF processing failed: ${fileName} - ${result.error}`);
                    continue;
                }
                if (!result.text || result.text.length < 50) {
                    console.warn(`[IntelligentScraper] PDF text too short: ${fileName}`);
                    continue;
                }
                console.log(`[IntelligentScraper] Extracted ${result.text.length} chars from ${fileName} ` +
                    `(method: ${result.metadata.processingMethod})`);
                // Zapisz do RAG
                const saveResult = await processor.saveToRAG(this.userId, result.text, fileName.replace(".pdf", "").replace(/_/g, " "), fileName, "pdf_attachment");
                if (saveResult.success) {
                    processedCount++;
                    console.log(`[IntelligentScraper] Saved PDF to RAG: ${fileName} ` +
                        `(ID: ${saveResult.documentId}, OCR: ${result.metadata.processingMethod === "ocr"})`);
                }
                // Krótkie opóźnienie między PDF-ami
                await this.delay(500);
            }
            catch (error) {
                console.error(`[IntelligentScraper] Error processing PDF ${pdfUrl}:`, error);
            }
        }
        return processedCount;
    }
}
// ============================================================================
// EXPORT MAIN FUNCTION
// ============================================================================
export async function intelligentScrapeDataSource(sourceId, userId, customConfig) {
    console.log(`[IntelligentScraper] Starting intelligent scrape for source: ${sourceId}`);
    // Pobierz konfigurację źródła
    const { data: source, error } = await supabase
        .from("data_sources")
        .select("*")
        .eq("id", sourceId)
        .single();
    if (error || !source) {
        return {
            success: false,
            siteMap: [],
            pagesAnalyzed: 0,
            documentsFound: 0,
            documentsProcessed: 0,
            newDocuments: 0,
            skippedDocuments: 0,
            llmAnalyses: 0,
            errors: [`Source not found: ${sourceId}`],
            processingTimeMs: 0,
        };
    }
    // Stwórz log scrapingu
    const { data: log } = await supabase
        .from("scraping_logs")
        .insert({
        source_id: sourceId,
        status: "running",
        started_at: new Date().toISOString(),
    })
        .select("id")
        .single();
    // Uruchom inteligentny scraping
    const scraper = new IntelligentScraper(source.url, userId, sourceId, {
        ...customConfig,
        councilLocation: source.metadata?.councilLocation ||
            customConfig?.councilLocation ||
            "Drawno",
    });
    const result = await scraper.scrape();
    // Zaktualizuj log
    if (log?.id) {
        await supabase
            .from("scraping_logs")
            .update({
            status: result.success ? "success" : "error",
            items_scraped: result.pagesAnalyzed,
            items_processed: result.documentsProcessed,
            duration_ms: result.processingTimeMs,
            error_message: result.errors.length > 0
                ? result.errors.slice(0, 5).join("; ")
                : null,
            metadata: {
                siteMapSize: result.siteMap.length,
                newDocuments: result.newDocuments,
                skippedDocuments: result.skippedDocuments,
                llmAnalyses: result.llmAnalyses,
            },
        })
            .eq("id", log.id);
    }
    // Zaktualizuj źródło
    await supabase
        .from("data_sources")
        .update({
        last_scraped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    })
        .eq("id", sourceId);
    return result;
}
/**
 * Przetwarza linki z wyników DeepResearch do RAG
 * Pobiera treść z zatwierdzonych przez AI linków i zapisuje do bazy dokumentów
 */
export async function processDeepResearchLinks(userId, links, options) {
    const minScore = options?.minRelevanceScore || 0.5;
    const maxLinks = options?.maxLinks || 20;
    const errors = [];
    let processed = 0;
    let saved = 0;
    const filteredLinks = links
        .filter((l) => l.relevanceScore >= minScore)
        .slice(0, maxLinks);
    console.log(`[DeepResearchLinks] Processing ${filteredLinks.length} links (min score: ${minScore})`);
    const processor = new DocumentProcessor();
    await processor.initializeWithUserConfig(userId);
    for (const link of filteredLinks) {
        try {
            console.log(`[DeepResearchLinks] Fetching: ${link.title} (score: ${link.relevanceScore})`);
            const response = await fetch(link.url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    Accept: "text/html,application/pdf,*/*",
                },
                signal: AbortSignal.timeout(30000),
            });
            if (!response.ok) {
                errors.push(`HTTP ${response.status}: ${link.url}`);
                continue;
            }
            const contentType = response.headers.get("content-type") || "";
            const buffer = Buffer.from(await response.arrayBuffer());
            processed++;
            let text = "";
            let fileName = link.title || "document";
            if (contentType.includes("pdf")) {
                fileName += ".pdf";
                const result = await processor.processFile(buffer, fileName, contentType, buffer.length);
                if (result.success) {
                    text = result.text;
                }
                else {
                    errors.push(`PDF processing failed: ${link.url}`);
                    continue;
                }
            }
            else if (contentType.includes("html")) {
                const html = buffer.toString("utf-8");
                text = html
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
            }
            else {
                text = buffer.toString("utf-8");
            }
            if (text.length < 100) {
                errors.push(`Content too short (${text.length} chars): ${link.url}`);
                continue;
            }
            const saveResult = await processor.saveToRAG(text, {
                title: link.title,
                documentType: "research",
                sourceUrl: link.url,
            }, userId);
            if (saveResult.success) {
                saved++;
                console.log(`[DeepResearchLinks] Saved: ${link.title} (${text.length} chars)`);
            }
            else {
                errors.push(`Save failed: ${link.url}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        catch (error) {
            errors.push(`Error: ${link.url} - ${error instanceof Error ? error.message : "Unknown"}`);
        }
    }
    console.log(`[DeepResearchLinks] Completed: processed=${processed}, saved=${saved}, errors=${errors.length}`);
    return {
        success: errors.length < processed / 2,
        processed,
        saved,
        errors: errors.slice(0, 10),
    };
}
//# sourceMappingURL=intelligent-scraper.js.map