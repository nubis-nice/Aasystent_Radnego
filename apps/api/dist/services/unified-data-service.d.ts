/**
 * Unified Data Service - orkiestrator dla wszystkich źródeł danych
 * Agent AI "Winsdurf" - centralne zarządzanie pobieraniem danych z API i scrapingu
 */
import type { DataFetchResult } from "@aasystent-radnego/shared";
export declare class UnifiedDataService {
    private sourceId;
    private userId;
    constructor(sourceId: string, userId: string);
    fetchAndProcess(): Promise<DataFetchResult>;
    private loadSourceConfig;
    private createFetcher;
    private saveDocuments;
    private processDocuments;
    private classifyDocument;
    private extractKeywords;
    private updateSourceStatus;
    private logFetchStart;
    private logFetchComplete;
    private logFetchError;
    /**
     * Process PDF attachments found during scraping
     * Downloads PDFs, extracts text using DocumentProcessor, and adds to RAG
     */
    private processPDFAttachments;
    private createErrorResult;
}
//# sourceMappingURL=unified-data-service.d.ts.map