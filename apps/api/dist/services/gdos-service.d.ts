interface ProtectedArea {
    id: string;
    name: string;
    type: ProtectedAreaType;
    code?: string;
    area?: number;
    establishedDate?: string;
    voivodeship?: string;
    municipalities?: string[];
    description?: string;
    legalBasis?: string;
    geometry?: unknown;
}
type ProtectedAreaType = "national_park" | "nature_reserve" | "landscape_park" | "protected_landscape_area" | "natura2000_bird" | "natura2000_habitat" | "ecological_corridor" | "nature_monument" | "documentation_site" | "other";
interface Natura2000Site {
    code: string;
    name: string;
    type: "PLB" | "PLH" | "PLC";
    area: number;
    biogeographicRegion?: string;
    voivodeships: string[];
    habitats?: string[];
    species?: string[];
    protectionStatus?: string;
}
interface EnvironmentalData {
    location: {
        lat: number;
        lon: number;
    };
    protectedAreas: ProtectedArea[];
    natura2000Sites: Natura2000Site[];
    restrictions?: string[];
    isInProtectedArea: boolean;
}
interface SearchOptions {
    name?: string;
    type?: ProtectedAreaType;
    voivodeship?: string;
    municipality?: string;
    limit?: number;
}
export declare class GdosService {
    private client;
    private cache;
    private cacheTTL;
    private readonly WFS_URL;
    private readonly API_URL;
    private readonly NATURA_URL;
    constructor();
    private getCached;
    private setCache;
    getProtectedAreasAtLocation(lat: number, lon: number): Promise<ProtectedArea[]>;
    getNatura2000AtLocation(lat: number, lon: number): Promise<Natura2000Site[]>;
    getEnvironmentalDataAtLocation(lat: number, lon: number): Promise<EnvironmentalData>;
    searchProtectedAreas(options: SearchOptions): Promise<ProtectedArea[]>;
    getNatura2000SiteByCode(code: string): Promise<Natura2000Site | null>;
    searchNatura2000(name: string, limit?: number): Promise<Natura2000Site[]>;
    getProtectedAreaById(id: string): Promise<ProtectedArea | null>;
    private parseWfsResponse;
    private parseNatura2000Response;
    private parseAreaType;
    private parseNatura2000Type;
    private getPolishTypeName;
    private determineRestrictions;
    getAreaTypeLabel(type: ProtectedAreaType): string;
    getNatura2000TypeLabel(type: "PLB" | "PLH" | "PLC"): string;
}
export {};
//# sourceMappingURL=gdos-service.d.ts.map