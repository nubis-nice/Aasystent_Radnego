/**
 * Web Scraper Service
 * Pobiera dane ze źródeł zewnętrznych (BIP, strony gmin, portale)
 */
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
/**
 * Główna funkcja scrapująca źródło danych
 */
export async function scrapeDataSource(sourceId, userId) {
    const result = {
        success: false,
        itemsScraped: 0,
        itemsProcessed: 0,
        errors: [],
    };
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
        // Scrapuj w zależności od typu źródła
        let scrapedItems = [];
        switch (source.type) {
            case "bip":
                scrapedItems = await scrapeBIP(source.url);
                break;
            case "municipality":
                scrapedItems = await scrapeMunicipality(source.url);
                break;
            case "legal":
                scrapedItems = await scrapeLegalPortal(source.url);
                break;
            case "councilor":
                scrapedItems = await scrapeCouncilorPortal(source.url);
                break;
            case "statistics":
                scrapedItems = await scrapeStatistics(source.url);
                break;
            default:
                scrapedItems = await scrapeGeneric(source.url);
        }
        result.itemsScraped = scrapedItems.length;
        // Zapisz surowe dane
        for (const item of scrapedItems) {
            const contentHash = generateHash(item.content);
            // Sprawdź czy już istnieje (deduplikacja)
            const { data: existing } = await supabase
                .from("scraped_content")
                .select("id")
                .eq("source_id", sourceId)
                .eq("content_hash", contentHash)
                .single();
            if (!existing) {
                await supabase.from("scraped_content").insert({
                    source_id: sourceId,
                    url: item.url,
                    title: item.title,
                    content_type: item.contentType,
                    raw_content: item.content,
                    content_hash: contentHash,
                    metadata: item.metadata || {},
                });
            }
        }
        // Przetwórz dokumenty
        const processedCount = await processScrapedContent(sourceId, userId);
        result.itemsProcessed = processedCount;
        // Zaktualizuj źródło
        await supabase
            .from("data_sources")
            .update({
            last_scraped_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq("id", sourceId);
        // Zaktualizuj log
        if (logId) {
            await supabase
                .from("scraping_logs")
                .update({
                status: "success",
                items_scraped: result.itemsScraped,
                items_processed: result.itemsProcessed,
                completed_at: new Date().toISOString(),
            })
                .eq("id", logId);
        }
        result.success = true;
    }
    catch (error) {
        result.errors.push(error instanceof Error ? error.message : "Unknown error");
        // Zapisz błąd w logach
        await supabase.from("scraping_logs").insert({
            source_id: sourceId,
            status: "error",
            error_message: result.errors.join("; "),
            items_scraped: result.itemsScraped,
            items_processed: result.itemsProcessed,
        });
    }
    return result;
}
/**
 * Scrapowanie BIP (Biuletyn Informacji Publicznej)
 */
async function scrapeBIP(baseUrl) {
    const items = [];
    try {
        // Symulacja scrapowania - w produkcji użyłbyś cheerio/puppeteer
        const response = await fetch(baseUrl);
        const html = await response.text();
        // Parsuj HTML i wyciągnij dokumenty
        // To jest uproszczona wersja - w produkcji trzeba by sparsować DOM
        items.push({
            url: baseUrl,
            title: `BIP - Strona główna`,
            content: extractTextFromHtml(html),
            contentType: "html",
            metadata: { source: "bip" },
        });
    }
    catch (error) {
        console.error("BIP scraping error:", error);
    }
    return items;
}
/**
 * Scrapowanie strony gminy
 */
async function scrapeMunicipality(baseUrl) {
    const items = [];
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();
        items.push({
            url: baseUrl,
            title: `Strona Gminy`,
            content: extractTextFromHtml(html),
            contentType: "html",
            metadata: { source: "municipality" },
        });
    }
    catch (error) {
        console.error("Municipality scraping error:", error);
    }
    return items;
}
/**
 * Scrapowanie portalu prawnego
 */
async function scrapeLegalPortal(baseUrl) {
    const items = [];
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();
        items.push({
            url: baseUrl,
            title: `Portal Prawny`,
            content: extractTextFromHtml(html),
            contentType: "html",
            metadata: { source: "legal" },
        });
    }
    catch (error) {
        console.error("Legal portal scraping error:", error);
    }
    return items;
}
/**
 * Scrapowanie portalu dla radnych
 */
async function scrapeCouncilorPortal(baseUrl) {
    const items = [];
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();
        items.push({
            url: baseUrl,
            title: `Portal Samorządowy`,
            content: extractTextFromHtml(html),
            contentType: "html",
            metadata: { source: "councilor" },
        });
    }
    catch (error) {
        console.error("Councilor portal scraping error:", error);
    }
    return items;
}
/**
 * Scrapowanie statystyk
 */
async function scrapeStatistics(baseUrl) {
    const items = [];
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();
        items.push({
            url: baseUrl,
            title: `Dane Statystyczne`,
            content: extractTextFromHtml(html),
            contentType: "html",
            metadata: { source: "statistics" },
        });
    }
    catch (error) {
        console.error("Statistics scraping error:", error);
    }
    return items;
}
/**
 * Scrapowanie ogólne
 */
async function scrapeGeneric(baseUrl) {
    const items = [];
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();
        items.push({
            url: baseUrl,
            title: `Strona`,
            content: extractTextFromHtml(html),
            contentType: "html",
            metadata: { source: "generic" },
        });
    }
    catch (error) {
        console.error("Generic scraping error:", error);
    }
    return items;
}
/**
 * Przetwarzanie pobranych treści - ekstrakcja, summaryzacja, embedding
 */
async function processScrapedContent(sourceId, userId) {
    let processedCount = 0;
    // Pobierz nieprzetworzone treści
    const { data: unprocessedContent } = await supabase
        .from("scraped_content")
        .select("*")
        .eq("source_id", sourceId)
        .order("scraped_at", { ascending: false })
        .limit(50);
    if (!unprocessedContent || unprocessedContent.length === 0) {
        return 0;
    }
    // Pobierz konfigurację AI z bazy danych
    const { data: apiConfig } = await supabase
        .from("api_configurations")
        .select("*")
        .eq("is_active", true)
        .eq("is_default", true)
        .single();
    if (!apiConfig) {
        console.warn("[Scraper] No AI configuration found, skipping AI processing");
        return 0;
    }
    const openaiApiKey = Buffer.from(apiConfig.api_key_encrypted, "base64").toString("utf-8");
    const openaiBaseUrl = apiConfig.base_url || undefined;
    const openai = new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseUrl });
    for (const content of unprocessedContent) {
        try {
            // Sprawdź czy już przetworzony
            const { data: existing } = await supabase
                .from("processed_documents")
                .select("id")
                .eq("scraped_content_id", content.id)
                .single();
            if (existing)
                continue;
            // Określ typ dokumentu
            const documentType = classifyDocument(content.title, content.raw_content);
            // Generuj streszczenie (opcjonalnie - może być kosztowne)
            let summary = null;
            if (content.raw_content && content.raw_content.length > 500) {
                try {
                    const summaryResponse = await openai.chat.completions.create({
                        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                        messages: [
                            {
                                role: "system",
                                content: "Jesteś asystentem tworzącym zwięzłe streszczenia dokumentów samorządowych. Odpowiadaj tylko streszczeniem, bez wstępów.",
                            },
                            {
                                role: "user",
                                content: `Streść ten dokument w 2-3 zdaniach:\n\n${content.raw_content.substring(0, 3000)}`,
                            },
                        ],
                        temperature: 0,
                        max_completion_tokens: 200,
                    });
                    summary = summaryResponse.choices[0]?.message?.content || null;
                }
                catch (e) {
                    console.warn("Summary generation failed:", e);
                }
            }
            // Generuj embedding
            let embedding = null;
            try {
                const embeddingResponse = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: `${content.title}\n\n${content.raw_content?.substring(0, 5000) || ""}`,
                });
                embedding = embeddingResponse.data[0].embedding;
            }
            catch (e) {
                console.warn("Embedding generation failed:", e);
            }
            // Wyciągnij słowa kluczowe
            const keywords = extractKeywords(content.title, content.raw_content);
            // Zapisz przetworzony dokument
            await supabase.from("processed_documents").insert({
                scraped_content_id: content.id,
                user_id: userId,
                document_type: documentType,
                title: content.title || "Bez tytułu",
                content: content.raw_content || "",
                summary,
                keywords,
                source_url: content.url,
                embedding,
                processed_at: new Date().toISOString(),
            });
            processedCount++;
        }
        catch (error) {
            console.error("Error processing content:", error);
        }
    }
    return processedCount;
}
/**
 * Klasyfikacja typu dokumentu
 */
function classifyDocument(title, content) {
    const lowerTitle = (title || "").toLowerCase();
    const lowerContent = (content || "").toLowerCase().substring(0, 1000);
    if (lowerTitle.includes("uchwał") || lowerContent.includes("uchwała nr")) {
        return "resolution";
    }
    if (lowerTitle.includes("protokół") || lowerContent.includes("protokół z")) {
        return "protocol";
    }
    if (lowerTitle.includes("ogłoszeni") || lowerTitle.includes("obwieszczeni")) {
        return "announcement";
    }
    if (lowerTitle.includes("ustaw") || lowerTitle.includes("rozporządz")) {
        return "legal_act";
    }
    if (lowerTitle.includes("aktualnoś") || lowerTitle.includes("news")) {
        return "news";
    }
    return "article";
}
/**
 * Wyciągnij słowa kluczowe z tekstu
 */
function extractKeywords(title, content) {
    const text = `${title || ""} ${content || ""}`.toLowerCase();
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
    ];
    for (const word of importantWords) {
        if (text.includes(word)) {
            keywords.push(word);
        }
    }
    return keywords.slice(0, 10);
}
/**
 * Generuj hash treści do deduplikacji
 */
function generateHash(content) {
    let hash = 0;
    const str = content || "";
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}
/**
 * Wyciągnij tekst z HTML (uproszczona wersja)
 */
function extractTextFromHtml(html) {
    // Usuń tagi HTML
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    text = text.replace(/<[^>]+>/g, " ");
    text = text.replace(/\s+/g, " ");
    text = text.trim();
    return text.substring(0, 50000); // Limit do 50k znaków
}
//# sourceMappingURL=scraper.js.map