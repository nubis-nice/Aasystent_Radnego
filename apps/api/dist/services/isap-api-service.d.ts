/**
 * ISAP API Service
 * Obsługa ELI API Sejmu RP - akty prawne (Dziennik Ustaw, Monitor Polski)
 * Dokumentacja: https://api.sejm.gov.pl/eli_pl.html
 */
export interface ISAPAct {
    ELI: string;
    address: string;
    publisher: string;
    year: number;
    pos: number;
    title: string;
    displayAddress: string;
    promulgation: string;
    announcementDate: string;
    textPDF: boolean;
    textHTML: boolean;
    changeDate: string;
    type: string;
    status: string;
    entryIntoForce?: string;
    expirationDate?: string;
    inForce?: string;
    keywords?: string[];
    releasedBy?: string[];
    references?: Record<string, Array<{
        id: string;
        art?: string;
    }>>;
}
export interface ISAPSearchParams {
    publisher?: "DU" | "MP";
    year?: number;
    title?: string;
    type?: string;
    keyword?: string[];
    dateFrom?: string;
    dateTo?: string;
    inForce?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
}
export interface ISAPSearchResult {
    count: number;
    totalCount: number;
    offset: number;
    items: ISAPAct[];
}
export interface ISAPActDetails extends ISAPAct {
    texts?: Array<{
        fileName: string;
        type: "H" | "O" | "I";
    }>;
    directives?: string[];
    authorizedBody?: string[];
    obligated?: string[];
}
export declare class ISAPApiService {
    private baseUrl;
    private cacheEnabled;
    private cacheTTL;
    private cache;
    constructor();
    private request;
    getPublishers(): Promise<Array<{
        code: string;
        name: string;
    }>>;
    getActsByYear(publisher: "DU" | "MP", year: number): Promise<ISAPSearchResult>;
    searchActs(params: ISAPSearchParams): Promise<ISAPSearchResult>;
    getActDetails(publisher: "DU" | "MP", year: number, position: number): Promise<ISAPActDetails>;
    getActByELI(eli: string): Promise<ISAPActDetails>;
    getActTextHTML(publisher: "DU" | "MP", year: number, position: number): Promise<string>;
    getActPDFUrl(publisher: "DU" | "MP", year: number, position: number): string;
    searchInForceActs(keywords: string[], publisher?: "DU" | "MP", limit?: number): Promise<ISAPAct[]>;
    searchByTitle(titleFragment: string, publisher?: "DU" | "MP", limit?: number): Promise<ISAPAct[]>;
    getLatestActs(publisher: "DU" | "MP", limit?: number): Promise<ISAPAct[]>;
    getActTypes(): Promise<string[]>;
    getKeywords(): Promise<string[]>;
    getStatuses(): Promise<string[]>;
    searchLocalGovernmentActs(topic?: string, limit?: number): Promise<ISAPAct[]>;
    clearCache(): void;
}
//# sourceMappingURL=isap-api-service.d.ts.map