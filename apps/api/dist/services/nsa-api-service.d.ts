/**
 * NSA/WSA API Service
 * Obsługa Centralnej Bazy Orzeczeń Sądów Administracyjnych (CBOSA)
 * URL: https://orzeczenia.nsa.gov.pl
 *
 * UWAGA: CBOSA nie ma publicznego REST API - używamy web scrapingu
 */
export interface NSAJudgment {
    id: string;
    signature: string;
    court: string;
    courtCode: string;
    judgmentDate: string;
    judgmentType: string;
    caseSymbol: string;
    legalBasis?: string[];
    keywords?: string[];
    thesis?: string;
    hasJustification: boolean;
    isFinal: boolean;
    url: string;
}
export interface NSASearchParams {
    query?: string;
    signature?: string;
    court?: string;
    judgmentType?: string;
    caseSymbol?: string;
    dateFrom?: string;
    dateTo?: string;
    judge?: string;
    withThesis?: boolean;
    withJustification?: boolean;
    isFinal?: boolean;
    limit?: number;
    offset?: number;
}
export interface NSASearchResult {
    count: number;
    totalCount: number;
    offset: number;
    items: NSAJudgment[];
}
export declare const NSA_COURTS: Record<string, string>;
export declare const NSA_CASE_SYMBOLS: Record<string, string>;
export declare class NSAApiService {
    private baseUrl;
    private searchUrl;
    private cacheEnabled;
    private cacheTTL;
    private cache;
    constructor();
    /**
     * Wyszukaj orzeczenia w CBOSA
     * UWAGA: Używa web scrapingu - może wymagać aktualizacji przy zmianach strony
     */
    searchJudgments(params: NSASearchParams): Promise<NSASearchResult>;
    /**
     * Pobierz szczegóły orzeczenia
     */
    getJudgmentDetails(id: string): Promise<NSAJudgment | null>;
    /**
     * Wyszukaj orzeczenia dotyczące samorządu
     */
    searchLocalGovernmentJudgments(topic?: string, limit?: number): Promise<NSAJudgment[]>;
    /**
     * Wyszukaj orzeczenia po sygnaturze
     */
    searchBySignature(signature: string): Promise<NSAJudgment[]>;
    /**
     * Pobierz listę dostępnych sądów
     */
    getCourts(): Array<{
        code: string;
        name: string;
    }>;
    /**
     * Pobierz listę symboli spraw
     */
    getCaseSymbols(): Array<{
        code: string;
        name: string;
    }>;
    /**
     * Wyczyść cache
     */
    clearCache(): void;
    private buildFormData;
    private parseSearchResults;
    private parseJudgmentDetails;
    private extractCourtCode;
    private extractJudgmentType;
    private extractCaseSymbol;
}
//# sourceMappingURL=nsa-api-service.d.ts.map