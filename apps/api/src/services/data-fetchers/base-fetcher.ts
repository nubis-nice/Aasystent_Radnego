/**
 * Bazowa klasa dla wszystkich fetchers (API + scraping)
 * Agent AI "Winsdurf" - uniwersalny system pobierania danych
 */

/* eslint-disable no-undef */
declare const setTimeout: typeof globalThis.setTimeout;

import type {
  DataSourceConfig,
  FetchedDocument,
  DataFetchResult,
} from "@shared/types/data-sources-api";

export abstract class BaseDataFetcher {
  protected config: DataSourceConfig;
  protected errors: string[] = [];
  protected warnings: string[] = [];
  protected startTime: number = 0;

  constructor(config: DataSourceConfig) {
    this.config = config;
  }

  abstract fetch(): Promise<FetchedDocument[]>;

  protected logError(message: string, error?: unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.errors.push(`${message}: ${errorMsg}`);
    console.error(`[${this.config.sourceType}] ${message}`, error);
  }

  protected logWarning(message: string): void {
    this.warnings.push(message);
    console.warn(`[${this.config.sourceType}] ${message}`);
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected generateContentHash(content: string): string {
    let hash = 0;
    const str = content || "";
    for (let i = 0; i < Math.min(str.length, 10000); i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
  }

  async execute(): Promise<DataFetchResult> {
    this.startTime = Date.now();
    this.errors = [];
    this.warnings = [];

    try {
      const documents = await this.fetch();

      return {
        sourceId: this.config.id,
        success: this.errors.length === 0,
        fetchMethod: this.config.fetchMethod,
        itemsFetched: documents.length,
        itemsProcessed: 0,
        errors: this.errors,
        warnings: this.warnings,
        duration: Date.now() - this.startTime,
      };
    } catch (error) {
      this.logError("Fatal error during fetch", error);
      return {
        sourceId: this.config.id,
        success: false,
        fetchMethod: this.config.fetchMethod,
        itemsFetched: 0,
        itemsProcessed: 0,
        errors: this.errors,
        warnings: this.warnings,
        duration: Date.now() - this.startTime,
      };
    }
  }
}
