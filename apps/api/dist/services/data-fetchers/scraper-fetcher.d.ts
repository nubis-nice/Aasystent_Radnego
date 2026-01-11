/**
 * Scraper Fetcher - web scraping dla źródeł bez API
 * Agent AI "Winsdurf" - scraping BIP, dzienników urzędowych, etc.
 */
import { BaseDataFetcher } from "./base-fetcher.js";
import type { DataSourceConfig, FetchedDocument } from "@shared/types/data-sources-api";
export declare class ScraperDataFetcher extends BaseDataFetcher {
    private scraperConfig;
    private visitedUrls;
    private fetchedDocuments;
    private baseUrl;
    constructor(config: DataSourceConfig);
    private extractBaseUrl;
    private normalizeUrl;
    fetch(): Promise<FetchedDocument[]>;
    private crawl;
    private fetchPage;
    private parsePage;
    private cleanText;
    private parseDate;
    private isValidUrl;
    private shouldPrioritize;
}
//# sourceMappingURL=scraper-fetcher.d.ts.map