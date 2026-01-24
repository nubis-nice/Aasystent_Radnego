/**
 * GUS API Service
 * Obsługa Bank Danych Lokalnych (BDL) API
 * Dokumentacja: https://api.stat.gov.pl/Home/BdlApi
 */
export class GUSApiService {
    baseUrl = "https://bdl.stat.gov.pl/api/v1";
    apiKey = null;
    cacheEnabled = true;
    cacheTTL = 86400000; // 24h w ms
    cache = new Map();
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.GUS_API_KEY || null;
    }
    /**
     * Ustaw klucz API
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Wyślij request do GUS API
     */
    async request(endpoint, params = {}) {
        const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
        // Sprawdź cache
        if (this.cacheEnabled) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.data;
            }
        }
        // Buduj URL
        const url = new URL(`${this.baseUrl}${endpoint}`);
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, String(value));
        });
        // Headers
        const headers = {
            Accept: "application/json",
        };
        if (this.apiKey) {
            headers["X-ClientId"] = this.apiKey;
        }
        const response = await fetch(url.toString(), { headers });
        if (!response.ok) {
            throw new Error(`GUS API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        // Zapisz do cache
        if (this.cacheEnabled) {
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
        }
        return data;
    }
    /**
     * Pobierz listę jednostek terytorialnych
     */
    async getUnits(params) {
        const result = await this.request("/units", {
            ...(params?.parentId && { "parent-id": params.parentId }),
            ...(params?.level && { level: params.level }),
            ...(params?.year && { year: params.year }),
        });
        return result.results || [];
    }
    /**
     * Znajdź gminę po nazwie
     */
    async findGmina(name) {
        const gminy = await this.getUnits({ level: 6 }); // Poziom 6 = gminy
        const found = gminy.find((g) => g.name.toLowerCase().includes(name.toLowerCase()));
        return found || null;
    }
    /**
     * Pobierz listę zmiennych (wskaźników)
     */
    async getVariables(params) {
        const result = await this.request("/variables", {
            ...(params?.subjectId && { "subject-id": params.subjectId }),
            ...(params?.year && { year: params.year }),
            ...(params?.level && { level: params.level }),
        });
        return result.results || [];
    }
    /**
     * Pobierz tematy (subjects)
     */
    async getSubjects(parentId) {
        const result = await this.request("/subjects", {
            ...(parentId && { "parent-id": parentId }),
        });
        return result.results || [];
    }
    /**
     * Pobierz dane dla jednej zmiennej i wielu jednostek
     */
    async getDataByVariable(variableId, unitIds, params) {
        const result = await this.request(`/data/by-variable/${variableId}`, {
            "unit-id": unitIds.join(","),
            ...(params?.year && { year: params.year }),
        });
        return result.results || [];
    }
    /**
     * Pobierz dane dla jednej jednostki i wielu zmiennych
     */
    async getDataByUnit(unitId, variableIds, params) {
        const result = await this.request(`/data/by-unit/${unitId}`, {
            "var-id": variableIds.join(","),
            ...(params?.year && { year: params.year }),
        });
        return result.results || [];
    }
    /**
     * Pobierz kluczowe statystyki dla gminy
     */
    async getGminaStats(gminaId, year) {
        try {
            // Kluczowe zmienne dla gmin (przykładowe ID - do dostosowania)
            const keyVariableIds = [
                "60559", // Ludność
                "72305", // Dochody budżetu gminy
                "72395", // Wydatki budżetu gminy
                "461668", // Bezrobotni zarejestrowani
            ];
            const data = await this.getDataByUnit(gminaId, keyVariableIds, { year });
            // Pobierz info o jednostce
            const units = await this.getUnits();
            const unit = units.find((u) => u.id === gminaId);
            if (!unit)
                return null;
            // Pobierz info o zmiennych
            const variables = await this.getVariables();
            const stats = {
                unitId: gminaId,
                unitName: unit.name,
                level: unit.level,
                variables: data.map((d) => {
                    const variable = variables.find((v) => v.id === String(d.variableId));
                    return {
                        id: String(d.variableId),
                        name: variable?.n1 || "Nieznana zmienna",
                        value: d.val,
                        year: d.year,
                        unit: variable?.measureUnitName || "",
                    };
                }),
            };
            return stats;
        }
        catch (error) {
            console.error("Error fetching gmina stats:", error);
            return null;
        }
    }
    /**
     * Porównaj wskaźniki wielu gmin
     */
    async compareGminy(gminaIds, variableIds, year) {
        const variablesData = await Promise.all(variableIds.map((varId) => this.getDataByVariable(varId, gminaIds, { year })));
        const variables = await this.getVariables();
        const selectedVars = variables.filter((v) => variableIds.includes(v.id));
        const dataByGmina = {};
        gminaIds.forEach((gminaId) => {
            dataByGmina[gminaId] = variablesData.flatMap((varData) => varData.filter((d) => String(d.id) === gminaId));
        });
        return {
            variables: selectedVars,
            data: dataByGmina,
        };
    }
    /**
     * Wyczyść cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Wyłącz/włącz cache
     */
    setCacheEnabled(enabled) {
        this.cacheEnabled = enabled;
    }
}
// Singleton instance
export const gusApiService = new GUSApiService();
//# sourceMappingURL=gus-api-service.js.map