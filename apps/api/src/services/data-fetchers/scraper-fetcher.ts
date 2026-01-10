/**
 * Scraper Fetcher - web scraping dla źródeł bez API
 * Agent AI "Winsdurf" - scraping BIP, dzienników urzędowych, etc.
 */

/* eslint-disable no-undef */
declare const fetch: typeof globalThis.fetch;
declare const URL: typeof globalThis.URL;
declare const AbortSignal: typeof globalThis.AbortSignal;

import { BaseDataFetcher } from "./base-fetcher.js";
import * as cheerio from "cheerio";
import type {
  DataSourceConfig,
  FetchedDocument,
  ScraperConfig,
} from "@shared/types/data-sources-api";

// Domyślna konfiguracja scrapera
const DEFAULT_SCRAPER_CONFIG: ScraperConfig = {
  maxPages: 20,
  maxDepth: 2,
  delayMs: 1000,
  selectors: {
    title: "h1, h2, .title, .entry-title, .post-title",
    content:
      "article, .content, .entry-content, main, #content, .post-content, body",
    documentList: "article, .post, .news-item, .item, li",
    links: "a[href]",
    date: ".date, time, .post-date, .entry-date",
    pdfLinks: 'a[href$=".pdf"]',
  },
  urlPatterns: {
    include: ["aktualnosci", "news", "dokumenty", "uchwaly", "informacje"],
    exclude: ["login", "wp-admin", "feed", "rss", "admin"],
  },
};

export class ScraperDataFetcher extends BaseDataFetcher {
  private scraperConfig: ScraperConfig;
  private visitedUrls: Set<string> = new Set();
  private fetchedDocuments: FetchedDocument[] = [];
  private baseUrl: string;

  constructor(config: DataSourceConfig) {
    super(config);

    // Użyj domyślnej konfiguracji jeśli brak scraperConfig
    if (!config.scraperConfig) {
      console.log(
        `[Scraper] No scraperConfig found, using defaults for ${config.name}`
      );
      this.scraperConfig = DEFAULT_SCRAPER_CONFIG;
    } else {
      // Merge z domyślną konfiguracją
      this.scraperConfig = {
        ...DEFAULT_SCRAPER_CONFIG,
        ...config.scraperConfig,
        selectors: {
          ...DEFAULT_SCRAPER_CONFIG.selectors,
          ...config.scraperConfig.selectors,
        },
      };
    }

    this.baseUrl = this.extractBaseUrl(config);
    console.log(
      `[Scraper] Initialized for ${config.name}, baseUrl: ${this.baseUrl}`
    );
  }

  private extractBaseUrl(config: DataSourceConfig): string {
    // 1. Najpierw sprawdź główny URL źródła (z tabeli data_sources)
    if (config.url) {
      console.log(`[Scraper] Using source URL: ${config.url}`);
      return this.normalizeUrl(config.url);
    }

    // 2. Sprawdź apiConfig.baseUrl
    if (config.apiConfig?.baseUrl) {
      console.log(
        `[Scraper] Using apiConfig.baseUrl: ${config.apiConfig.baseUrl}`
      );
      return this.normalizeUrl(config.apiConfig.baseUrl);
    }

    // 3. Fallback - użyj pierwszego URL z urlPatterns.include
    if (config.scraperConfig?.urlPatterns?.include?.[0]) {
      const url = `https://${config.scraperConfig.urlPatterns.include[0]}`;
      console.log(`[Scraper] Using urlPatterns: ${url}`);
      return this.normalizeUrl(url);
    }

    console.error(
      `[Scraper] Cannot determine base URL for source: ${config.name}`
    );
    throw new Error(`Cannot determine base URL for scraper: ${config.name}`);
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return url;
    }
  }

  async fetch(): Promise<FetchedDocument[]> {
    console.log(`[Scraper] Starting crawl for ${this.config.name}`);

    await this.crawl();

    console.log(`[Scraper] Crawled ${this.fetchedDocuments.length} documents`);

    return this.fetchedDocuments;
  }

  private async crawl(): Promise<void> {
    const queue: Array<{ url: string; depth: number }> = [
      { url: this.baseUrl, depth: 0 },
    ];

    const priorityQueue: Array<{ url: string; depth: number }> = [];

    console.log(
      `[Scraper] Config: maxPages=${this.scraperConfig.maxPages}, maxDepth=${this.scraperConfig.maxDepth}, delayMs=${this.scraperConfig.delayMs}`
    );
    console.log(
      `[Scraper] Selectors:`,
      JSON.stringify(this.scraperConfig.selectors)
    );

    while (
      (queue.length > 0 || priorityQueue.length > 0) &&
      this.fetchedDocuments.length < this.scraperConfig.maxPages
    ) {
      const current = priorityQueue.shift() || queue.shift();
      if (!current) break;

      const { url, depth } = current;

      if (this.visitedUrls.has(url)) continue;
      if (depth > this.scraperConfig.maxDepth) continue;

      this.visitedUrls.add(url);

      console.log(
        `[Scraper] Crawling (${this.fetchedDocuments.length + 1}/${
          this.scraperConfig.maxPages
        }) depth=${depth}: ${url}`
      );

      const html = await this.fetchPage(url);
      if (!html) {
        console.log(`[Scraper] Failed to fetch HTML for ${url}`);
        continue;
      }

      console.log(`[Scraper] Fetched HTML: ${html.length} bytes`);

      const page = this.parsePage(html, url);

      console.log(
        `[Scraper] Parsed: title="${page.title?.substring(
          0,
          50
        )}...", content=${page.content.length} chars, links=${
          (page.rawData?.links as string[])?.length || 0
        }`
      );

      if (page.content.length > 100) {
        this.fetchedDocuments.push(page);
        console.log(`[Scraper] Document added (content > 100 chars)`);
      } else {
        console.log(
          `[Scraper] Skipped: content too short (${page.content.length} < 100)`
        );
      }

      for (const link of (page.rawData?.links as string[]) || []) {
        if (!this.visitedUrls.has(link)) {
          if (this.shouldPrioritize(link)) {
            priorityQueue.push({ url: link, depth: depth + 1 });
          } else {
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }

      await this.delay(this.scraperConfig.delayMs);
    }

    console.log(
      `[Scraper] Crawl finished. Queue: ${queue.length}, Priority: ${priorityQueue.length}, Visited: ${this.visitedUrls.size}`
    );
  }

  private async fetchPage(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        this.logError(`HTTP ${response.status} for ${url}`);
        return null;
      }

      const contentType = response.headers.get("content-type") || "";
      if (
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml")
      ) {
        return null;
      }

      return await response.text();
    } catch (error) {
      this.logError(`Fetch error for ${url}`, error);
      return null;
    }
  }

  private parsePage(html: string, url: string): FetchedDocument {
    const $ = cheerio.load(html);

    $(
      "script, style, nav, footer, header, .menu, .sidebar, .navigation, .cookie-notice, .popup"
    ).remove();

    let title = "";
    if (this.scraperConfig.selectors.title) {
      title = $(this.scraperConfig.selectors.title).first().text().trim();
    }
    if (!title) {
      title = $("title").text().trim();
    }

    let content = "";
    if (this.scraperConfig.selectors.content) {
      const contentElements = $(this.scraperConfig.selectors.content);
      contentElements.each((_, el) => {
        content += $(el).text().trim() + "\n\n";
      });
    }
    if (!content) {
      content = $("body").text().trim();
    }

    content = this.cleanText(content);

    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        try {
          const absoluteUrl = new URL(href, url).href;
          if (this.isValidUrl(absoluteUrl) && !links.includes(absoluteUrl)) {
            links.push(absoluteUrl);
          }
        } catch {
          // Invalid URL
        }
      }
    });

    const pdfLinks: string[] = [];
    $('a[href$=".pdf"], a[href*="pdf"]').each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        try {
          const absoluteUrl = new URL(href, url).href;
          if (!pdfLinks.includes(absoluteUrl)) {
            pdfLinks.push(absoluteUrl);
          }
        } catch {
          // Invalid URL
        }
      }
    });

    let publishDate: string | undefined;
    if (this.scraperConfig.selectors.date) {
      const dateText = $(this.scraperConfig.selectors.date)
        .first()
        .text()
        .trim();
      publishDate = this.parseDate(dateText);
    }

    return {
      sourceId: this.config.id,
      sourceType: this.config.sourceType,
      fetchMethod: "scraping",
      title,
      content,
      contentType: "html",
      url,
      publishDate,
      contentHash: this.generateContentHash(content),
      fetchedAt: new Date().toISOString(),
      rawData: {
        links,
        pdfLinks,
        contentLength: content.length,
        linksCount: links.length,
        pdfCount: pdfLinks.length,
      },
    };
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n\n")
      .trim()
      .substring(0, 50000);
  }

  private parseDate(dateText: string): string | undefined {
    if (!dateText) return undefined;

    const patterns = [
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
      /(\d{4})-(\d{2})-(\d{2})/,
    ];

    for (const pattern of patterns) {
      const match = dateText.match(pattern);
      if (match) {
        try {
          const date = new Date(dateText);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split("T")[0];
          }
        } catch {
          // Continue
        }
      }
    }

    return undefined;
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url, this.baseUrl);

      if (!parsed.href.startsWith(this.baseUrl)) {
        return false;
      }

      if (this.scraperConfig.urlPatterns?.exclude) {
        for (const pattern of this.scraperConfig.urlPatterns.exclude) {
          if (parsed.href.toLowerCase().includes(pattern.toLowerCase())) {
            return false;
          }
        }
      }

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
    } catch {
      return false;
    }
  }

  private shouldPrioritize(url: string): boolean {
    if (!this.scraperConfig.urlPatterns?.include) return false;

    const lowerUrl = url.toLowerCase();
    return this.scraperConfig.urlPatterns.include.some((pattern) =>
      lowerUrl.includes(pattern.toLowerCase())
    );
  }
}
