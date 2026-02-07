/**
 * GUS API Service
 * Obsługa Bank Danych Lokalnych (BDL) API
 * Dokumentacja: https://api.stat.gov.pl/Home/BdlApi
 */

/* eslint-disable no-undef */

export interface GUSUnit {
  id: string;
  name: string;
  level: number;
  parentId?: string;
}

export interface GUSVariable {
  id: string;
  subjectId: string;
  n1: string; // Nazwa zmiennej
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

export class GUSApiService {
  private baseUrl = "https://bdl.stat.gov.pl/api/v1";
  private apiKey: string | null = null;
  private cacheEnabled = true;
  private cacheTTL = 86400000; // 24h w ms
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GUS_API_KEY || null;
  }

  /**
   * Ustaw klucz API
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Wyślij request do GUS API
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string | number> = {},
  ): Promise<T> {
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;

    // Sprawdź cache
    if (this.cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data as T;
      }
    }

    // Buduj URL
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    // Headers
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers["X-ClientId"] = this.apiKey;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      throw new Error(
        `GUS API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as T;

    // Zapisz do cache
    if (this.cacheEnabled) {
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  }

  /**
   * Pobierz listę jednostek terytorialnych
   */
  async getUnits(params?: {
    parentId?: string;
    level?: number;
    year?: number;
  }): Promise<GUSUnit[]> {
    const result = await this.request<{ results: GUSUnit[] }>("/units", {
      ...(params?.parentId && { "parent-id": params.parentId }),
      ...(params?.level && { level: params.level }),
      ...(params?.year && { year: params.year }),
    });

    return result.results || [];
  }

  /**
   * Znajdź gminę po nazwie (używa API search)
   */
  async findGmina(name: string): Promise<GUSUnit | null> {
    try {
      // Użyj endpointu wyszukiwania zamiast pobierania wszystkich gmin
      const result = await this.request<{ results: GUSUnit[] }>(
        "/units/search",
        { name, level: 6 },
      );

      if (result.results && result.results.length > 0) {
        // Preferuj dokładne dopasowanie lub gminę miejsko-wiejską
        const exact = result.results.find(
          (g) => g.name.toLowerCase() === name.toLowerCase(),
        );
        return exact || result.results[0];
      }

      return null;
    } catch (error) {
      console.error("[GUS] findGmina error:", error);
      return null;
    }
  }

  /**
   * Pobierz listę zmiennych (wskaźników)
   */
  async getVariables(params?: {
    subjectId?: string;
    year?: number;
    level?: number;
  }): Promise<GUSVariable[]> {
    const result = await this.request<{ results: GUSVariable[] }>(
      "/variables",
      {
        ...(params?.subjectId && { "subject-id": params.subjectId }),
        ...(params?.year && { year: params.year }),
        ...(params?.level && { level: params.level }),
      },
    );

    return result.results || [];
  }

  /**
   * Pobierz tematy (subjects)
   */
  async getSubjects(parentId?: string): Promise<GUSSubject[]> {
    const result = await this.request<{ results: GUSSubject[] }>("/subjects", {
      ...(parentId && { "parent-id": parentId }),
    });

    return result.results || [];
  }

  /**
   * Pobierz dane dla jednej zmiennej i wielu jednostek
   */
  async getDataByVariable(
    variableId: string,
    unitIds: string[],
    params?: { year?: number },
  ): Promise<GUSDataPoint[]> {
    const result = await this.request<{ results: GUSDataPoint[] }>(
      `/data/by-variable/${variableId}`,
      {
        "unit-id": unitIds.join(","),
        ...(params?.year && { year: params.year }),
      },
    );

    return result.results || [];
  }

  /**
   * Pobierz dane dla jednej jednostki i wielu zmiennych
   * Używa unit-parent-id do pobrania danych dla gminy i jej podjednostek
   */
  async getDataByUnit(
    unitId: string,
    variableIds: string[],
    params?: { year?: number },
  ): Promise<GUSDataPoint[]> {
    const allData: GUSDataPoint[] = [];

    // Pobierz parent-id (powiat) z unit-id gminy
    // Format: 023216402033 -> parent: 023216402000
    const parentId = unitId.slice(0, 9) + "000";

    // Pobierz dane dla każdej zmiennej
    for (const varId of variableIds) {
      try {
        const result = await this.request<{
          results: Array<{
            id: string;
            name: string;
            values: Array<{ year: number; val: number }>;
          }>;
        }>(`/data/by-variable/${varId}`, {
          "unit-parent-id": parentId,
          "page-size": 100,
          ...(params?.year && { year: params.year }),
        });

        // Filtruj wyniki dla konkretnej jednostki
        console.log(
          `[GUS] Variable ${varId}: got ${result.results?.length || 0} results`,
        );
        if (result.results && result.results.length > 0) {
          // Debug: pokaż wszystkie ID
          const ids = result.results.map((u) => u.id).join(", ");
          console.log(
            `[GUS] Variable ${varId}: unit IDs = ${ids.substring(0, 100)}...`,
          );

          for (const unit of result.results) {
            // Dopasuj dokładnie
            if (unit.id === unitId && unit.values) {
              console.log(
                `[GUS] Variable ${varId}: MATCH found for ${unitId}, values: ${unit.values.length}`,
              );
              // Weź tylko najnowszy rok jeśli nie podano konkretnego
              const values = params?.year
                ? unit.values.filter((v) => v.year === params.year)
                : [unit.values.sort((a, b) => b.year - a.year)[0]].filter(
                    Boolean,
                  );

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
      } catch (err) {
        console.warn(`[GUS] Failed to fetch variable ${varId}:`, err);
      }
    }

    return allData;
  }

  /**
   * Pobierz kluczowe statystyki dla gminy
   */
  async getGminaStats(
    gminaId: string,
    year?: number,
  ): Promise<GUSStats | null> {
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

      console.log(
        `[GUS] getGminaStats: fetched ${data.length} data points for ${gminaId}`,
      );

      // Pobierz info o jednostce przez search (getUnits bez parametrów nie zwraca gmin)
      const searchResult = await this.request<{ results: GUSUnit[] }>(
        "/units/search",
        { name: gminaId.slice(0, 6), level: 6 },
      );
      const unit = searchResult.results?.find((u) => u.id === gminaId);

      if (!unit) {
        console.warn(`[GUS] Unit ${gminaId} not found in search results`);
        // Fallback - utwórz podstawowe info
        if (data.length > 0) {
          const stats: GUSStats = {
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

      const stats: GUSStats = {
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
    } catch (error) {
      console.error("Error fetching gmina stats:", error);
      return null;
    }
  }

  /**
   * Porównaj wskaźniki wielu gmin
   */
  async compareGminy(
    gminaIds: string[],
    variableIds: string[],
    year?: number,
  ): Promise<{
    variables: GUSVariable[];
    data: Record<string, GUSDataPoint[]>;
  }> {
    const variablesData = await Promise.all(
      variableIds.map((varId) =>
        this.getDataByVariable(varId, gminaIds, { year }),
      ),
    );

    const variables = await this.getVariables();
    const selectedVars = variables.filter((v) => variableIds.includes(v.id));

    const dataByGmina: Record<string, GUSDataPoint[]> = {};
    gminaIds.forEach((gminaId) => {
      dataByGmina[gminaId] = variablesData.flatMap((varData) =>
        varData.filter((d) => String(d.id) === gminaId),
      );
    });

    return {
      variables: selectedVars,
      data: dataByGmina,
    };
  }

  /**
   * Wyczyść cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Wyłącz/włącz cache
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
  }
}

// Singleton instance
export const gusApiService = new GUSApiService();
