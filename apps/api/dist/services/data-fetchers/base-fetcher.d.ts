/**
 * Bazowa klasa dla wszystkich fetchers (API + scraping)
 * Agent AI "Winsdurf" - uniwersalny system pobierania danych
 */
import type { DataSourceConfig, FetchedDocument, DataFetchResult } from "@aasystent-radnego/shared";
export declare abstract class BaseDataFetcher {
    protected config: DataSourceConfig;
    protected errors: string[];
    protected warnings: string[];
    protected startTime: number;
    constructor(config: DataSourceConfig);
    abstract fetch(): Promise<FetchedDocument[]>;
    protected logError(message: string, error?: unknown): void;
    protected logWarning(message: string): void;
    protected delay(ms: number): Promise<void>;
    protected generateContentHash(content: string): string;
    execute(): Promise<DataFetchResult>;
}
//# sourceMappingURL=base-fetcher.d.ts.map