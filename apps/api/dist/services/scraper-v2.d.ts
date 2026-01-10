/**
 * Web Scraper Service v2
 * Zaawansowany scraper z Cheerio, link crawling i obsługą różnych typów stron
 */
export interface ScrapingConfig {
    maxPages: number;
    maxDepth: number;
    delayMs: number;
    selectors: {
        documentList?: string;
        title?: string;
        content?: string;
        links?: string;
        date?: string;
        pdfLinks?: string;
    };
    urlPatterns?: {
        include?: string[];
        exclude?: string[];
    };
}
export interface ScrapedPage {
    url: string;
    title: string;
    content: string;
    links: string[];
    pdfLinks: string[];
    publishDate?: string;
    metadata: Record<string, unknown>;
}
export interface ScrapeResult {
    success: boolean;
    pagesScraped: number;
    documentsFound: number;
    documentsProcessed: number;
    errors: string[];
}
export declare class WebScraper {
    private config;
    private baseUrl;
    private visitedUrls;
    private scrapedPages;
    private errors;
    constructor(baseUrl: string, sourceType: string, customConfig?: Partial<ScrapingConfig>);
    private normalizeUrl;
    private isValidUrl;
    private shouldPrioritize;
    private fetchPage;
    private parsePage;
    private cleanText;
    private parseDate;
    private delay;
    crawl(): Promise<ScrapedPage[]>;
    getErrors(): string[];
}
export declare function scrapeDataSourceV2(sourceId: string, userId: string): Promise<ScrapeResult>;
declare function classifyDocument(title: string, content: string): string;
declare function extractKeywords(title: string, content: string): string[];
declare function generateHash(content: string): string;
export { generateHash, classifyDocument, extractKeywords };
//# sourceMappingURL=scraper-v2.d.ts.map