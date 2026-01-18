import axios, { AxiosInstance } from "axios";

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

export class TerytService {
  private client: AxiosInstance;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTTL = 86400000; // 24h - dane TERYT rzadko się zmieniają

  // API GUS TERYT (publiczne)
  private readonly BASE_URL = "https://api-teryt.stat.gov.pl/api";

  // Alternatywne źródło - dane otwarte
  private readonly OPEN_DATA_URL = "https://danepubliczne.gov.pl/api/3/action";

  constructor() {
    this.client = axios.create({
      timeout: 15000,
      headers: {
        Accept: "application/json",
        "User-Agent": "AsystentRadnego/1.0",
      },
    });
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async getVoivodeships(): Promise<TerytUnit[]> {
    const cacheKey = "voivodeships";
    const cached = this.getCached<TerytUnit[]>(cacheKey);
    if (cached) return cached;

    try {
      // Lista województw z API TERYT
      const response = await this.client.get(
        `${this.BASE_URL}/terc/wojewodztwa`
      );

      const units: TerytUnit[] = response.data.map(
        (item: Record<string, unknown>) => ({
          id: String(item.WOJ),
          name: String(item.NAZWA),
          type: "voivodeship" as const,
          code: String(item.WOJ).padStart(2, "0"),
        })
      );

      this.setCache(cacheKey, units);
      return units;
    } catch (error) {
      console.error("Error fetching voivodeships:", error);
      return this.getVoivodeshipsStatic();
    }
  }

  private getVoivodeshipsStatic(): TerytUnit[] {
    return [
      { id: "02", name: "DOLNOŚLĄSKIE", type: "voivodeship", code: "02" },
      { id: "04", name: "KUJAWSKO-POMORSKIE", type: "voivodeship", code: "04" },
      { id: "06", name: "LUBELSKIE", type: "voivodeship", code: "06" },
      { id: "08", name: "LUBUSKIE", type: "voivodeship", code: "08" },
      { id: "10", name: "ŁÓDZKIE", type: "voivodeship", code: "10" },
      { id: "12", name: "MAŁOPOLSKIE", type: "voivodeship", code: "12" },
      { id: "14", name: "MAZOWIECKIE", type: "voivodeship", code: "14" },
      { id: "16", name: "OPOLSKIE", type: "voivodeship", code: "16" },
      { id: "18", name: "PODKARPACKIE", type: "voivodeship", code: "18" },
      { id: "20", name: "PODLASKIE", type: "voivodeship", code: "20" },
      { id: "22", name: "POMORSKIE", type: "voivodeship", code: "22" },
      { id: "24", name: "ŚLĄSKIE", type: "voivodeship", code: "24" },
      { id: "26", name: "ŚWIĘTOKRZYSKIE", type: "voivodeship", code: "26" },
      {
        id: "28",
        name: "WARMIŃSKO-MAZURSKIE",
        type: "voivodeship",
        code: "28",
      },
      { id: "30", name: "WIELKOPOLSKIE", type: "voivodeship", code: "30" },
      { id: "32", name: "ZACHODNIOPOMORSKIE", type: "voivodeship", code: "32" },
    ];
  }

  async getCounties(voivodeshipId: string): Promise<TerytUnit[]> {
    const cacheKey = `counties_${voivodeshipId}`;
    const cached = this.getCached<TerytUnit[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(
        `${this.BASE_URL}/terc/powiaty/${voivodeshipId}`
      );

      const units: TerytUnit[] = response.data.map(
        (item: Record<string, unknown>) => ({
          id: `${voivodeshipId}${String(item.POW).padStart(2, "0")}`,
          name: String(item.NAZWA),
          type: "county" as const,
          parentId: voivodeshipId,
          code: `${voivodeshipId}${String(item.POW).padStart(2, "0")}`,
        })
      );

      this.setCache(cacheKey, units);
      return units;
    } catch (error) {
      console.error("Error fetching counties:", error);
      return [];
    }
  }

  async getMunicipalities(countyId: string): Promise<TerytUnit[]> {
    const cacheKey = `municipalities_${countyId}`;
    const cached = this.getCached<TerytUnit[]>(cacheKey);
    if (cached) return cached;

    try {
      const voivodeshipId = countyId.substring(0, 2);
      const powId = countyId.substring(2, 4);

      const response = await this.client.get(
        `${this.BASE_URL}/terc/gminy/${voivodeshipId}/${powId}`
      );

      const units: TerytUnit[] = response.data.map(
        (item: Record<string, unknown>) => ({
          id: `${countyId}${String(item.GMI).padStart(2, "0")}${item.RODZ}`,
          name: String(item.NAZWA),
          type: this.getMunicipalityType(String(item.RODZ)),
          parentId: countyId,
          code: `${countyId}${String(item.GMI).padStart(2, "0")}${item.RODZ}`,
        })
      );

      this.setCache(cacheKey, units);
      return units;
    } catch (error) {
      console.error("Error fetching municipalities:", error);
      return [];
    }
  }

  private getMunicipalityType(rodz: string): TerytUnit["type"] {
    switch (rodz) {
      case "1":
        return "city";
      case "2":
        return "village";
      case "3":
        return "municipality";
      default:
        return "municipality";
    }
  }

  async searchUnits(query: string, limit = 20): Promise<TerytUnit[]> {
    const cacheKey = `search_units_${query}_${limit}`;
    const cached = this.getCached<TerytUnit[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(
        `${this.BASE_URL}/terc/szukaj/${encodeURIComponent(query)}`,
        { params: { limit } }
      );

      const units: TerytUnit[] = response.data.map(
        (item: Record<string, unknown>) => ({
          id: String(item.ID),
          name: String(item.NAZWA),
          type: this.inferUnitType(String(item.ID)),
          code: String(item.ID),
        })
      );

      this.setCache(cacheKey, units);
      return units;
    } catch (error) {
      console.error("Error searching units:", error);
      // Fallback - szukaj w statycznych województwach
      const voivodeships = this.getVoivodeshipsStatic();
      return voivodeships.filter((v) =>
        v.name.toLowerCase().includes(query.toLowerCase())
      );
    }
  }

  private inferUnitType(id: string): TerytUnit["type"] {
    if (id.length === 2) return "voivodeship";
    if (id.length === 4) return "county";
    return "municipality";
  }

  async getStreets(municipalityId: string): Promise<TerytStreet[]> {
    const cacheKey = `streets_${municipalityId}`;
    const cached = this.getCached<TerytStreet[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(
        `${this.BASE_URL}/simc/ulice/${municipalityId}`
      );

      const streets: TerytStreet[] = response.data.map(
        (item: Record<string, unknown>) => ({
          id: String(item.SYM_UL),
          name: String(item.NAZWA_1),
          prefix: item.CECHA ? String(item.CECHA) : undefined,
          municipalityId,
          municipalityName: String(item.NAZWA_MIEJSC || ""),
        })
      );

      this.setCache(cacheKey, streets);
      return streets;
    } catch (error) {
      console.error("Error fetching streets:", error);
      return [];
    }
  }

  async searchStreets(
    query: string,
    municipalityId?: string
  ): Promise<TerytStreet[]> {
    const cacheKey = `search_streets_${query}_${municipalityId || "all"}`;
    const cached = this.getCached<TerytStreet[]>(cacheKey);
    if (cached) return cached;

    try {
      const params: Record<string, string> = { nazwa: query };
      if (municipalityId) params.sym = municipalityId;

      const response = await this.client.get(
        `${this.BASE_URL}/simc/ulice/szukaj`,
        { params }
      );

      const streets: TerytStreet[] = response.data.map(
        (item: Record<string, unknown>) => ({
          id: String(item.SYM_UL),
          name: String(item.NAZWA_1),
          prefix: item.CECHA ? String(item.CECHA) : undefined,
          municipalityId: String(item.SYM),
          municipalityName: String(item.NAZWA_MIEJSC || ""),
        })
      );

      this.setCache(cacheKey, streets);
      return streets;
    } catch (error) {
      console.error("Error searching streets:", error);
      return [];
    }
  }

  async getUnitByCode(code: string): Promise<TerytUnit | null> {
    const cacheKey = `unit_${code}`;
    const cached = this.getCached<TerytUnit>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(
        `${this.BASE_URL}/terc/jednostka/${code}`
      );

      if (!response.data) return null;

      const unit: TerytUnit = {
        id: String(response.data.ID || code),
        name: String(response.data.NAZWA),
        type: this.inferUnitType(code),
        code,
        parentId:
          code.length > 2 ? code.substring(0, code.length - 2) : undefined,
      };

      this.setCache(cacheKey, unit);
      return unit;
    } catch (error) {
      console.error("Error fetching unit by code:", error);
      return null;
    }
  }

  async getUnitHierarchy(code: string): Promise<TerytUnit[]> {
    const hierarchy: TerytUnit[] = [];
    let currentCode = code;

    while (currentCode.length >= 2) {
      const unit = await this.getUnitByCode(currentCode);
      if (unit) {
        hierarchy.unshift(unit);
      }
      currentCode = currentCode.substring(0, currentCode.length - 2);
    }

    return hierarchy;
  }

  async search(options: SearchOptions): Promise<{
    units: TerytUnit[];
    streets: TerytStreet[];
  }> {
    const { query, type, limit = 20 } = options;

    const results = {
      units: [] as TerytUnit[],
      streets: [] as TerytStreet[],
    };

    if (!type || type === "unit") {
      results.units = await this.searchUnits(query, limit);
    }

    if (!type || type === "street") {
      results.streets = await this.searchStreets(query);
    }

    return results;
  }

  getUnitTypeLabel(type: TerytUnit["type"]): string {
    const labels: Record<TerytUnit["type"], string> = {
      voivodeship: "Województwo",
      county: "Powiat",
      municipality: "Gmina",
      city: "Miasto",
      village: "Wieś",
    };
    return labels[type] || type;
  }
}
