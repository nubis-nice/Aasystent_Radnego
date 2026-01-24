interface CeidgEntry {
    id: string;
    nip: string;
    regon?: string;
    name: string;
    firstName?: string;
    lastName?: string;
    tradeName?: string;
    status: "active" | "suspended" | "terminated" | "unknown";
    registrationDate?: string;
    terminationDate?: string;
    suspensionDate?: string;
    resumptionDate?: string;
    mainAddress: {
        street?: string;
        buildingNumber?: string;
        apartmentNumber?: string;
        postalCode?: string;
        city?: string;
        municipality?: string;
        county?: string;
        voivodeship?: string;
        country: string;
    };
    correspondenceAddress?: {
        street?: string;
        buildingNumber?: string;
        apartmentNumber?: string;
        postalCode?: string;
        city?: string;
    };
    pkd: CeidgPkd[];
    email?: string;
    phone?: string;
    website?: string;
}
interface CeidgPkd {
    code: string;
    description?: string;
    isMain: boolean;
}
interface SearchOptions {
    nip?: string;
    regon?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    pkd?: string;
    page?: number;
    limit?: number;
}
interface SearchResult {
    entries: CeidgEntry[];
    totalCount: number;
    page: number;
    pageSize: number;
}
export declare class CeidgService {
    private client;
    private cache;
    private cacheTTL;
    private apiKey?;
    private readonly BASE_URL;
    constructor(apiKey?: string);
    private getCached;
    private setCache;
    getByNip(nip: string): Promise<CeidgEntry | null>;
    getByRegon(regon: string): Promise<CeidgEntry | null>;
    search(options: SearchOptions): Promise<SearchResult>;
    getByCity(city: string, page?: number, limit?: number): Promise<SearchResult>;
    getByPkd(pkdCode: string, page?: number, limit?: number): Promise<SearchResult>;
    checkStatus(nip: string): Promise<{
        isActive: boolean;
        status: CeidgEntry["status"];
        details?: string;
    }>;
    private getStatusDetails;
    private parseEntry;
    private parseStatus;
    getStatusLabel(status: CeidgEntry["status"]): string;
}
export {};
//# sourceMappingURL=ceidg-service.d.ts.map