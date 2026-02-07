/**
 * Narzędzie GUS Statistics
 * Pobiera dane demograficzne z Bank Danych Lokalnych GUS
 */
import { GUSApiService } from "../services/gus-api-service.js";
import { getGUSApiKey } from "../services/api-key-resolver.js";
export const gusStatisticsTool = {
    name: "gus_statistics",
    description: "Pobiera statystyki demograficzne z GUS BDL (Bank Danych Lokalnych) - ludność, urodzenia, zgony, przyrost naturalny dla podanej gminy lub województwa",
    category: "public_data",
    parameters: {
        type: "object",
        properties: {
            unit_name: {
                type: "string",
                description: "Nazwa gminy lub województwa, np. 'Drawno', 'mazowieckie', 'Warszawa'",
            },
            data_type: {
                type: "string",
                description: "Typ danych do pobrania: population (ludność), births (urodzenia), deaths (zgony), all (wszystkie)",
                enum: ["population", "births", "deaths", "all"],
            },
            year: {
                type: "integer",
                description: "Rok dla którego pobrać dane (opcjonalnie, domyślnie najnowszy dostępny)",
            },
        },
        required: ["unit_name"],
    },
    execute: async (args, context) => {
        const startTime = Date.now();
        const unitName = args.unit_name;
        const dataType = args.data_type || "all";
        const year = args.year;
        console.log(`[GUS Tool] Executing: unit=${unitName}, type=${dataType}, year=${year || "latest"}`);
        try {
            // Pobierz klucz API z bazy
            const apiKey = await getGUSApiKey(context.userId);
            const gusService = new GUSApiService(apiKey || undefined);
            // Znajdź jednostkę terytorialną
            let unit = await gusService.findGmina(unitName);
            // Fallback: spróbuj województwo
            if (!unit) {
                const voivodeships = await gusService.getUnits({ level: 2 });
                unit =
                    voivodeships.find((u) => u.name.toLowerCase().includes(unitName.toLowerCase())) || null;
            }
            if (!unit) {
                return {
                    success: false,
                    error: `Nie znaleziono jednostki "${unitName}" w bazie GUS BDL. Sprawdź pisownię nazwy gminy lub województwa.`,
                    metadata: {
                        source: "GUS Bank Danych Lokalnych",
                        executionTimeMs: Date.now() - startTime,
                    },
                };
            }
            // Pobierz statystyki
            const stats = await gusService.getGminaStats(unit.id, year);
            // Sprawdź czy udało się pobrać dane
            if (!stats || !stats.variables || stats.variables.length === 0) {
                return {
                    success: false,
                    error: `Nie udało się pobrać danych dla "${unit.name}" (ID: ${unit.id}). GUS BDL może nie mieć danych dla tej jednostki.`,
                    metadata: {
                        source: "GUS Bank Danych Lokalnych",
                        executionTimeMs: Date.now() - startTime,
                    },
                };
            }
            // Filtruj dane według typu - używamy ID zmiennych GUS
            // 60 = Urodzenia żywe, 65 = Zgony, 68 = Przyrost naturalny
            // 450540 = Urodzenia/1000, 450541 = Zgony/1000, 450551 = Przyrost/1000
            let filteredVariables = stats.variables;
            if (dataType !== "all") {
                const typeFilterIds = {
                    population: [], // brak dedykowanej zmiennej ludności w obecnym zestawie
                    births: ["60", "450540"],
                    deaths: ["65", "450541"],
                };
                const filterIds = typeFilterIds[dataType] || [];
                if (filterIds.length > 0) {
                    filteredVariables = stats.variables.filter((v) => filterIds.includes(v.id));
                }
            }
            // Mapuj ID na czytelne nazwy
            const variableNames = {
                "60": "Urodzenia żywe",
                "65": "Zgony ogółem",
                "68": "Przyrost naturalny",
                "450540": "Urodzenia żywe na 1000 ludności",
                "450541": "Zgony na 1000 ludności",
                "450551": "Przyrost naturalny na 1000 ludności",
                "72305": "Dochody budżetu gminy",
                "72395": "Wydatki budżetu gminy",
            };
            // Zastąp nazwy zmiennych czytelnymi
            filteredVariables = filteredVariables.map((v) => ({
                ...v,
                name: variableNames[v.id] || v.name,
            }));
            return {
                success: true,
                data: {
                    unit: {
                        id: unit.id,
                        name: unit.name,
                        level: unit.level,
                        levelName: getLevelName(unit.level),
                    },
                    statistics: filteredVariables.map((v) => ({
                        name: v.name,
                        value: v.value,
                        year: v.year,
                        unit: v.unit,
                    })),
                    dataType,
                    totalVariables: stats.variables.length,
                    filteredVariables: filteredVariables.length,
                },
                metadata: {
                    source: "GUS Bank Danych Lokalnych (bdl.stat.gov.pl)",
                    executionTimeMs: Date.now() - startTime,
                    cached: false,
                },
            };
        }
        catch (error) {
            console.error("[GUS Tool] Error:", error);
            return {
                success: false,
                error: `Błąd podczas pobierania danych z GUS: ${error instanceof Error ? error.message : String(error)}`,
                metadata: {
                    source: "GUS Bank Danych Lokalnych",
                    executionTimeMs: Date.now() - startTime,
                },
            };
        }
    },
};
function getLevelName(level) {
    const names = {
        1: "Polska",
        2: "województwo",
        3: "region",
        4: "podregion",
        5: "powiat",
        6: "gmina",
    };
    return names[level] || `poziom ${level}`;
}
//# sourceMappingURL=gus-statistics.js.map