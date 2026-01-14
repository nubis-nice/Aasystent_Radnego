/**
 * API Fetcher - uniwersalny klient API dla zewnętrznych źródeł
 * Agent AI "Winsdurf" - pobieranie danych z API (ISAP, WSA/NSA, RIO, etc.)
 */
import { BaseDataFetcher } from "./base-fetcher.js";
import type { DataSourceConfig, FetchedDocument } from "@aasystent-radnego/shared";
export declare class ApiDataFetcher extends BaseDataFetcher {
    private apiConfig;
    private fetchedDocuments;
    constructor(config: DataSourceConfig);
    fetch(): Promise<FetchedDocument[]>;
    private authenticate;
    private authenticateOAuth2;
    private fetchData;
    private buildUrl;
    private buildHeaders;
    private processResponse;
    private processItem;
    private extractDataFromPath;
}
//# sourceMappingURL=api-fetcher.d.ts.map