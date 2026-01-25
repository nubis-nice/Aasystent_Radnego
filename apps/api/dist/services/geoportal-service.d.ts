/**
 * Geoportal Service - Integracja z Geoportal.gov.pl
 * Dostęp do danych przestrzennych: działki, MPZP, granice administracyjne
 */
export interface ParcelInfo {
    id: string;
    voivodeship: string;
    county: string;
    municipality: string;
    precinct: string;
    parcelNumber: string;
    area?: number;
    geometry?: unknown;
}
export interface AddressPoint {
    id: string;
    street?: string;
    houseNumber?: string;
    postalCode?: string;
    city: string;
    voivodeship: string;
    coordinates: {
        lat: number;
        lon: number;
    };
}
export interface AdministrativeUnit {
    id: string;
    name: string;
    type: "voivodeship" | "county" | "municipality" | "city";
    code: string;
    parentId?: string;
    geometry?: unknown;
}
export interface SpatialPlan {
    id: string;
    name: string;
    type: "mpzp" | "studium" | "decyzja_wz";
    municipality: string;
    status: string;
    adoptionDate?: string;
    documentUrl?: string;
}
export interface GeoportalSearchParams {
    query?: string;
    parcelId?: string;
    address?: string;
    coordinates?: {
        lat: number;
        lon: number;
    };
    municipality?: string;
    radius?: number;
}
export declare class GeoportalService {
    private httpClient;
    private cache;
    private cacheTTL;
    constructor();
    private getCached;
    private setCache;
    /**
     * Wyszukiwanie działki po identyfikatorze (ULDK API)
     */
    getParcelById(parcelId: string): Promise<ParcelInfo | null>;
    /**
     * Wyszukiwanie działki po współrzędnych
     */
    getParcelByCoordinates(lat: number, lon: number): Promise<ParcelInfo | null>;
    /**
     * Wyszukiwanie adresów (EMUiA)
     */
    searchAddress(query: string, limit?: number): Promise<AddressPoint[]>;
    /**
     * Pobieranie granic jednostki administracyjnej (PRG WFS)
     */
    getAdministrativeUnit(code: string): Promise<AdministrativeUnit | null>;
    /**
     * Wyszukiwanie gmin po nazwie
     */
    searchMunicipalities(name: string): Promise<AdministrativeUnit[]>;
    /**
     * Informacje o MPZP dla lokalizacji
     */
    getSpatialPlanInfo(lat: number, lon: number): Promise<SpatialPlan[]>;
    /**
     * Uniwersalne wyszukiwanie danych przestrzennych
     */
    search(params: GeoportalSearchParams): Promise<{
        parcels: ParcelInfo[];
        addresses: AddressPoint[];
        units: AdministrativeUnit[];
    }>;
    /**
     * Pobranie URL do mapy ortofoto dla lokalizacji
     */
    getOrthophotoUrl(lat: number, lon: number, zoom?: number): string;
    /**
     * Pobranie linku do Geoportalu dla działki
     */
    getGeoportalLink(parcelId: string): string;
    private getUnitType;
    /**
     * Parsowanie odpowiedzi GML z WFS
     */
    private parseGmlFeatures;
}
//# sourceMappingURL=geoportal-service.d.ts.map