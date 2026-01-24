/**
 * GUS API Service
 * Obsługa Bank Danych Lokalnych (BDL) API
 * Dokumentacja: https://api.stat.gov.pl/Home/BdlApi
 */
export interface GUSUnit {
    id: string;
    name: string;
    level: number;
    parentId?: string;
}
export interface GUSVariable {
    id: string;
    subjectId: string;
    n1: string;
    n2?: string;
    n3?: string;
    measureUnitId: number;
    measureUnitName: string;
}
export interface GUSDataPoint {
    id: number;
    variableId: number;
    year: number;
    val: number;
    attrId?: number;
}
export interface GUSSubject {
    id: string;
    name: string;
    hasChildren: boolean;
    children?: GUSSubject[];
}
export interface GUSStats {
    unitId: string;
    unitName: string;
    level: number;
    variables: {
        id: string;
        name: string;
        value: number;
        year: number;
        unit: string;
    }[];
}
export declare class GUSApiService {
    private baseUrl;
    private apiKey;
    private cacheEnabled;
    private cacheTTL;
    private cache;
    constructor(apiKey?: string);
    /**
     * Ustaw klucz API
     */
    setApiKey(apiKey: string): void;
    /**
     * Wyślij request do GUS API
     */
    private request;
    /**
     * Pobierz listę jednostek terytorialnych
     */
    getUnits(params?: {
        parentId?: string;
        level?: number;
        year?: number;
    }): Promise<GUSUnit[]>;
    /**
     * Znajdź gminę po nazwie
     */
    findGmina(name: string): Promise<GUSUnit | null>;
    /**
     * Pobierz listę zmiennych (wskaźników)
     */
    getVariables(params?: {
        subjectId?: string;
        year?: number;
        level?: number;
    }): Promise<GUSVariable[]>;
    /**
     * Pobierz tematy (subjects)
     */
    getSubjects(parentId?: string): Promise<GUSSubject[]>;
    /**
     * Pobierz dane dla jednej zmiennej i wielu jednostek
     */
    getDataByVariable(variableId: string, unitIds: string[], params?: {
        year?: number;
    }): Promise<GUSDataPoint[]>;
    /**
     * Pobierz dane dla jednej jednostki i wielu zmiennych
     */
    getDataByUnit(unitId: string, variableIds: string[], params?: {
        year?: number;
    }): Promise<GUSDataPoint[]>;
    /**
     * Pobierz kluczowe statystyki dla gminy
     */
    getGminaStats(gminaId: string, year?: number): Promise<GUSStats | null>;
    /**
     * Porównaj wskaźniki wielu gmin
     */
    compareGminy(gminaIds: string[], variableIds: string[], year?: number): Promise<{
        variables: GUSVariable[];
        data: Record<string, GUSDataPoint[]>;
    }>;
    /**
     * Wyczyść cache
     */
    clearCache(): void;
    /**
     * Wyłącz/włącz cache
     */
    setCacheEnabled(enabled: boolean): void;
}
export declare const gusApiService: GUSApiService;
//# sourceMappingURL=gus-api-service.d.ts.map