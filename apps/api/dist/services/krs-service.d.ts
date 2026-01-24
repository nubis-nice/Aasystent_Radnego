interface KrsEntity {
    krsNumber: string;
    name: string;
    nip?: string;
    regon?: string;
    legalForm: string;
    registrationDate?: string;
    address: {
        street?: string;
        buildingNumber?: string;
        apartmentNumber?: string;
        postalCode?: string;
        city?: string;
        voivodeship?: string;
        country: string;
    };
    status: "active" | "liquidation" | "deleted" | "unknown";
    capital?: {
        amount: number;
        currency: string;
    };
    pkd?: string[];
    representatives?: KrsRepresentative[];
}
interface KrsRepresentative {
    firstName: string;
    lastName: string;
    function: string;
    pesel?: string;
}
interface KrsSearchResult {
    entities: KrsEntity[];
    totalCount: number;
    page: number;
    pageSize: number;
}
interface SearchOptions {
    name?: string;
    krs?: string;
    nip?: string;
    regon?: string;
    page?: number;
    limit?: number;
}
export declare class KrsService {
    private client;
    private cache;
    private cacheTTL;
    private readonly BASE_URL;
    private readonly ALT_URL;
    constructor();
    private getCached;
    private setCache;
    getByKrs(krsNumber: string): Promise<KrsEntity | null>;
    private getByKrsAlternative;
    getByNip(nip: string): Promise<KrsEntity | null>;
    getByRegon(regon: string): Promise<KrsEntity | null>;
    search(options: SearchOptions): Promise<KrsSearchResult>;
    getRepresentatives(krsNumber: string): Promise<KrsRepresentative[]>;
    getPkdCodes(krsNumber: string): Promise<string[]>;
    private parseKrsResponse;
    private parseAltResponse;
    private parseStatus;
    private parsePkd;
    private parseRepresentatives;
    getStatusLabel(status: KrsEntity["status"]): string;
}
export {};
//# sourceMappingURL=krs-service.d.ts.map