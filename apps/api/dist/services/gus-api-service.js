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
        const data = (await response.json());
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
     * Znajdź gminę po nazwie (używa API search)
     */
    async findGmina(name) {
        try {
            // Użyj endpointu wyszukiwania zamiast pobierania wszystkich gmin
            const result = await this.request("/units/search", { name, level: 6 });
            if (result.results && result.results.length > 0) {
                // Preferuj dokładne dopasowanie lub gminę miejsko-wiejską
                const exact = result.results.find((g) => g.name.toLowerCase() === name.toLowerCase());
                return exact || result.results[0];
            }
            return null;
        }
        catch (error) {
            console.error("[GUS] findGmina error:", error);
            return null;
        }
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
     * Używa unit-parent-id do pobrania danych dla gminy i jej podjednostek
     */
    async getDataByUnit(unitId, variableIds, params) {
        const allData = [];
        // Pobierz parent-id (powiat) z unit-id gminy
        // Format: 023216402033 -> parent: 023216402000
        const parentId = unitId.slice(0, 9) + "000";
        // Pobierz dane dla każdej zmiennej
        for (const varId of variableIds) {
            try {
                const result = await this.request(`/data/by-variable/${varId}`, {
                    "unit-parent-id": parentId,
                    "page-size": 100,
                    ...(params?.year && { year: params.year }),
                });
                // Filtruj wyniki dla konkretnej jednostki
                console.log(`[GUS] Variable ${varId}: got ${result.results?.length || 0} results`);
                if (result.results && result.results.length > 0) {
                    // Debug: pokaż wszystkie ID
                    const ids = result.results.map((u) => u.id).join(", ");
                    console.log(`[GUS] Variable ${varId}: unit IDs = ${ids.substring(0, 100)}...`);
                    for (const unit of result.results) {
                        // Dopasuj dokładnie
                        if (unit.id === unitId && unit.values) {
                            console.log(`[GUS] Variable ${varId}: MATCH found for ${unitId}, values: ${unit.values.length}`);
                            // Weź tylko najnowszy rok jeśli nie podano konkretnego
                            const values = params?.year
                                ? unit.values.filter((v) => v.year === params.year)
                                : [unit.values.sort((a, b) => b.year - a.year)[0]].filter(Boolean);
                            for (const val of values) {
                                allData.push({
                                    id: parseInt(unit.id) || 0,
                                    variableId: parseInt(varId),
                                    val: val.val,
                                    year: val.year,
                                });
                            }
                        }
                    }
                }
            }
            catch (err) {
                console.warn(`[GUS] Failed to fetch variable ${varId}:`, err);
            }
        }
        return allData;
    }
    /**
     * Pobierz kluczowe statystyki dla gminy
     */
    async getGminaStats(gminaId, year) {
        try {
            // Kluczowe zmienne dla gmin - dane demograficzne i budżetowe
            // ID zmiennych z GUS BDL API (sprawdzone 27.01.2026)
            // Źródło: https://bdl.stat.gov.pl/api/v1/variables?subject-id=P1873
            const keyVariableIds = [
                "72305", // Dochody budżetu gminy
                "72395", // Wydatki budżetu gminy
                "60", // Urodzenia żywe (P1873)
                "65", // Zgony ogółem (P1873)
                "68", // Przyrost naturalny (P1873)
                "450540", // Urodzenia żywe na 1000 ludności (P3428)
                "450541", // Zgony na 1000 ludności (P3428)
                "450551", // Przyrost naturalny na 1000 ludności (P3428)
            ];
            const data = await this.getDataByUnit(gminaId, keyVariableIds, { year });
            console.log(`[GUS] getGminaStats: fetched ${data.length} data points for ${gminaId}`);
            // Pobierz info o jednostce przez search (getUnits bez parametrów nie zwraca gmin)
            const searchResult = await this.request("/units/search", { name: gminaId.slice(0, 6), level: 6 });
            const unit = searchResult.results?.find((u) => u.id === gminaId);
            if (!unit) {
                console.warn(`[GUS] Unit ${gminaId} not found in search results`);
                // Fallback - utwórz podstawowe info
                if (data.length > 0) {
                    const stats = {
                        unitId: gminaId,
                        unitName: "Nieznana jednostka",
                        level: 6,
                        variables: data.map((d) => ({
                            id: String(d.variableId),
                            name: `Zmienna ${d.variableId}`,
                            value: d.val,
                            year: d.year,
                            unit: "",
                        })),
                    };
                    return stats;
                }
                return null;
            }
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