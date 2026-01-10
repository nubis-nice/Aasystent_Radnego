/**
 * Web Scraper Service
 * Pobiera dane ze źródeł zewnętrznych (BIP, strony gmin, portale)
 */
export interface ScrapedItem {
    url: string;
    title: string;
    content: string;
    contentType: "html" | "pdf" | "json" | "xml" | "text";
    publishDate?: string;
    metadata?: Record<string, unknown>;
}
export interface ScrapeResult {
    success: boolean;
    itemsScraped: number;
    itemsProcessed: number;
    errors: string[];
}
/**
 * Główna funkcja scrapująca źródło danych
 */
export declare function scrapeDataSource(sourceId: string, userId: string): Promise<ScrapeResult>;
//# sourceMappingURL=scraper.d.ts.map