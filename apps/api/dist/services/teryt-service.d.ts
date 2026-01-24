interface TerytUnit {
    id: string;
    name: string;
    type: "voivodeship" | "county" | "municipality" | "city" | "village";
    parentId?: string;
    code: string;
    population?: number;
}
interface TerytStreet {
    id: string;
    name: string;
    prefix?: string;
    municipalityId: string;
    municipalityName: string;
}
interface SearchOptions {
    query: string;
    type?: "unit" | "street" | "address";
    limit?: number;
}
export declare class TerytService {
    private client;
    private cache;
    private cacheTTL;
    private readonly BASE_URL;
    private readonly OPEN_DATA_URL;
    constructor();
    private getCached;
    private setCache;
    getVoivodeships(): Promise<TerytUnit[]>;
    private getVoivodeshipsStatic;
    getCounties(voivodeshipId: string): Promise<TerytUnit[]>;
    getMunicipalities(countyId: string): Promise<TerytUnit[]>;
    private getMunicipalityType;
    searchUnits(query: string, limit?: number): Promise<TerytUnit[]>;
    private inferUnitType;
    getStreets(municipalityId: string): Promise<TerytStreet[]>;
    searchStreets(query: string, municipalityId?: string): Promise<TerytStreet[]>;
    getUnitByCode(code: string): Promise<TerytUnit | null>;
    getUnitHierarchy(code: string): Promise<TerytUnit[]>;
    search(options: SearchOptions): Promise<{
        units: TerytUnit[];
        streets: TerytStreet[];
    }>;
    getUnitTypeLabel(type: TerytUnit["type"]): string;
}
export {};
//# sourceMappingURL=teryt-service.d.ts.map