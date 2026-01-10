/**
 * Typy dla systemu źródeł danych (scraping)
 */
export type DataSourceType = "municipality" | "bip" | "legal" | "councilor" | "statistics" | "national_park" | "hospital" | "school" | "cultural" | "environmental" | "transport" | "emergency" | "custom";
export type ScrapingFrequency = "hourly" | "daily" | "weekly" | "monthly" | "manual";
export type ContentType = "html" | "pdf" | "json" | "xml" | "text";
export type DocumentType = "resolution" | "protocol" | "news" | "legal_act" | "announcement" | "article";
export type ScrapingStatus = "success" | "error" | "partial" | "skipped";
export interface ScrapingConfig {
    selectors?: {
        [key: string]: string;
    };
    pagination?: {
        enabled: boolean;
        selector?: string;
        maxPages?: number;
    };
    download_pdfs?: boolean;
    search_params?: {
        [key: string]: any;
    };
    api_endpoint?: string;
    requires_auth?: boolean;
    headers?: {
        [key: string]: string;
    };
    rate_limit?: {
        requests_per_second: number;
        delay_ms: number;
    };
}
export interface DataSource {
    id: string;
    user_id: string;
    name: string;
    type: DataSourceType;
    url: string;
    scraping_enabled: boolean;
    scraping_frequency: ScrapingFrequency;
    last_scraped_at: string | null;
    next_scrape_at: string | null;
    scraping_config: ScrapingConfig;
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
}
export interface ScrapedContent {
    id: string;
    source_id: string;
    url: string;
    title: string | null;
    content_type: ContentType;
    raw_content: string;
    content_hash: string;
    scraped_at: string;
    metadata: Record<string, any>;
}
export interface ProcessedDocument {
    id: string;
    scraped_content_id: string | null;
    user_id: string;
    document_type: DocumentType;
    title: string;
    content: string;
    summary: string | null;
    keywords: string[];
    publish_date: string | null;
    source_url: string | null;
    metadata: Record<string, any>;
    processed_at: string;
}
export interface ScrapingLog {
    id: string;
    source_id: string;
    status: ScrapingStatus;
    items_scraped: number;
    items_processed: number;
    error_message: string | null;
    duration_ms: number;
    created_at: string;
}
export interface CreateDataSourceRequest {
    name: string;
    type: DataSourceType;
    url: string;
    scraping_enabled?: boolean;
    scraping_frequency?: ScrapingFrequency;
    scraping_config?: ScrapingConfig;
    metadata?: Record<string, any>;
}
export interface UpdateDataSourceRequest {
    name?: string;
    url?: string;
    scraping_enabled?: boolean;
    scraping_frequency?: ScrapingFrequency;
    scraping_config?: ScrapingConfig;
    metadata?: Record<string, any>;
}
export interface TriggerScrapingRequest {
    source_id: string;
    force?: boolean;
}
export interface SearchDocumentsRequest {
    query: string;
    document_types?: DocumentType[];
    date_from?: string;
    date_to?: string;
    limit?: number;
}
export interface SearchDocumentsResponse {
    documents: Array<ProcessedDocument & {
        similarity: number;
    }>;
    total: number;
}
export interface DataSourceStats {
    total_sources: number;
    active_sources: number;
    total_documents: number;
    documents_by_type: Record<DocumentType, number>;
    last_scrape_time: string | null;
    next_scrape_time: string | null;
    scraping_errors_last_24h: number;
}
export interface PredefinedSource {
    name: string;
    type: DataSourceType;
    url: string;
    description: string;
    scraping_frequency: ScrapingFrequency;
    scraping_config: ScrapingConfig;
    icon?: string;
    category: string;
}
export declare const PREDEFINED_SOURCES: PredefinedSource[];
export declare function getSourceTypeLabel(type: DataSourceType): string;
export declare function getDocumentTypeLabel(type: DocumentType): string;
export declare function getFrequencyLabel(frequency: ScrapingFrequency): string;
export declare function getStatusColor(status: ScrapingStatus): string;
//# sourceMappingURL=data-sources.d.ts.map