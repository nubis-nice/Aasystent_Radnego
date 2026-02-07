/**
 * RIO API Service
 * Obsługa Regionalnych Izb Obrachunkowych - uchwały, rozstrzygnięcia nadzorcze
 *
 * RIO to 16 izb regionalnych, każda z własnym BIP.
 * Serwis agreguje dane z różnych źródeł RIO.
 */
export interface RIODecision {
    id: string;
    rio: string;
    rioCode: string;
    decisionNumber: string;
    decisionDate: string;
    decisionType: "uchwala" | "rozstrzygniecie" | "opinia" | "stanowisko";
    subject: string;
    municipality?: string;
    legalBasis?: string[];
    summary?: string;
    pdfUrl?: string;
    sourceUrl: string;
}
export interface RIOSearchParams {
    rio?: string;
    decisionType?: "uchwala" | "rozstrzygniecie" | "opinia" | "stanowisko";
    municipality?: string;
    query?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
}
export interface RIOSearchResult {
    count: number;
    totalCount: number;
    offset: number;
    items: RIODecision[];
}
export declare const RIO_CHAMBERS: Record<string, {
    name: string;
    url: string;
    province: string;
}>;
export declare const RIO_DECISION_TYPES: Record<string, string>;
export declare class RIOApiService {
    private cacheEnabled;
    private cacheTTL;
    private cache;
    constructor();
    /**
     * Wyszukaj decyzje RIO
     * UWAGA: Używa web scrapingu BIP RIO
     */
    searchDecisions(params: RIOSearchParams): Promise<RIOSearchResult>;
    /**
     * Pobierz szczegóły decyzji
     */
    getDecisionDetails(id: string): Promise<RIODecision | null>;
    /**
     * Wyszukaj rozstrzygnięcia nadzorcze dla gminy
     */
    searchByMunicipality(municipality: string, limit?: number): Promise<RIODecision[]>;
    /**
     * Wyszukaj uchwały budżetowe
     */
    searchBudgetDecisions(rio?: string, limit?: number): Promise<RIODecision[]>;
    /**
     * Pobierz listę RIO
     */
    getChambers(): Array<{
        code: string;
        name: string;
        province: string;
        url: string;
    }>;
    /**
     * Pobierz typy decyzji
     */
    getDecisionTypes(): Array<{
        code: string;
        name: string;
    }>;
    /**
     * Wyczyść cache
     */
    clearCache(): void;
    private searchInChamber;
    private parseDecisionList;
    private parseDecisionDetails;
    private extractDecisionNumber;
    private detectDecisionType;
    private normalizeDate;
}
//# sourceMappingURL=rio-api-service.d.ts.map