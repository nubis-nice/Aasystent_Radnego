import axios, { AxiosInstance } from "axios";

interface ProtectedArea {
  id: string;
  name: string;
  type: ProtectedAreaType;
  code?: string;
  area?: number; // hectares
  establishedDate?: string;
  voivodeship?: string;
  municipalities?: string[];
  description?: string;
  legalBasis?: string;
  geometry?: unknown;
}

type ProtectedAreaType =
  | "national_park"
  | "nature_reserve"
  | "landscape_park"
  | "protected_landscape_area"
  | "natura2000_bird"
  | "natura2000_habitat"
  | "ecological_corridor"
  | "nature_monument"
  | "documentation_site"
  | "other";

interface Natura2000Site {
  code: string;
  name: string;
  type: "PLB" | "PLH" | "PLC"; // Birds, Habitats, Combined
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

export class GdosService {
  private client: AxiosInstance;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTTL = 86400000; // 24h - dane środowiskowe rzadko się zmieniają

  // Geoserwer GDOŚ (WFS)
  private readonly WFS_URL = "https://sdi.gdos.gov.pl/wfs";

  // API danych przestrzennych GDOŚ
  private readonly API_URL = "https://geoserwis.gdos.gov.pl/mapy";

  // Dane Natura 2000
  private readonly NATURA_URL = "https://natura2000.gdos.gov.pl/datafiles";

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        Accept: "application/json, application/xml",
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

  async getProtectedAreasAtLocation(
    lat: number,
    lon: number
  ): Promise<ProtectedArea[]> {
    const cacheKey = `protected_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    const cached = this.getCached<ProtectedArea[]>(cacheKey);
    if (cached) return cached;

    try {
      // WFS GetFeature z filtrem przestrzennym
      const response = await this.client.get(this.WFS_URL, {
        params: {
          service: "WFS",
          version: "2.0.0",
          request: "GetFeature",
          typeName: "gdos:FormaOchronyPrzyrody",
          outputFormat: "application/json",
          srsName: "EPSG:4326",
          cql_filter: `INTERSECTS(geom, POINT(${lon} ${lat}))`,
        },
      });

      const areas = this.parseWfsResponse(response.data);
      this.setCache(cacheKey, areas);
      return areas;
    } catch (error) {
      console.error("Error fetching protected areas:", error);
      return [];
    }
  }

  async getNatura2000AtLocation(
    lat: number,
    lon: number
  ): Promise<Natura2000Site[]> {
    const cacheKey = `natura2000_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    const cached = this.getCached<Natura2000Site[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(this.WFS_URL, {
        params: {
          service: "WFS",
          version: "2.0.0",
          request: "GetFeature",
          typeName: "gdos:Natura2000",
          outputFormat: "application/json",
          srsName: "EPSG:4326",
          cql_filter: `INTERSECTS(geom, POINT(${lon} ${lat}))`,
        },
      });

      const sites = this.parseNatura2000Response(response.data);
      this.setCache(cacheKey, sites);
      return sites;
    } catch (error) {
      console.error("Error fetching Natura 2000 sites:", error);
      return [];
    }
  }

  async getEnvironmentalDataAtLocation(
    lat: number,
    lon: number
  ): Promise<EnvironmentalData> {
    const [protectedAreas, natura2000Sites] = await Promise.all([
      this.getProtectedAreasAtLocation(lat, lon),
      this.getNatura2000AtLocation(lat, lon),
    ]);

    const restrictions = this.determineRestrictions(
      protectedAreas,
      natura2000Sites
    );

    return {
      location: { lat, lon },
      protectedAreas,
      natura2000Sites,
      restrictions,
      isInProtectedArea:
        protectedAreas.length > 0 || natura2000Sites.length > 0,
    };
  }

  async searchProtectedAreas(options: SearchOptions): Promise<ProtectedArea[]> {
    const { name, type, voivodeship, municipality, limit = 50 } = options;
    const cacheKey = `search_areas_${JSON.stringify(options)}`;
    const cached = this.getCached<ProtectedArea[]>(cacheKey);
    if (cached) return cached;

    try {
      const filters: string[] = [];

      if (name) {
        filters.push(`nazwa LIKE '%${name}%'`);
      }
      if (type) {
        const typeName = this.getPolishTypeName(type);
        filters.push(`typ = '${typeName}'`);
      }
      if (voivodeship) {
        filters.push(`wojewodztwo = '${voivodeship}'`);
      }
      if (municipality) {
        filters.push(`gmina LIKE '%${municipality}%'`);
      }

      const response = await this.client.get(this.WFS_URL, {
        params: {
          service: "WFS",
          version: "2.0.0",
          request: "GetFeature",
          typeName: "gdos:FormaOchronyPrzyrody",
          outputFormat: "application/json",
          srsName: "EPSG:4326",
          count: limit,
          ...(filters.length > 0 && { cql_filter: filters.join(" AND ") }),
        },
      });

      const areas = this.parseWfsResponse(response.data);
      this.setCache(cacheKey, areas);
      return areas;
    } catch (error) {
      console.error("Error searching protected areas:", error);
      return [];
    }
  }

  async getNatura2000SiteByCode(code: string): Promise<Natura2000Site | null> {
    const cacheKey = `natura2000_code_${code}`;
    const cached = this.getCached<Natura2000Site>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(this.WFS_URL, {
        params: {
          service: "WFS",
          version: "2.0.0",
          request: "GetFeature",
          typeName: "gdos:Natura2000",
          outputFormat: "application/json",
          srsName: "EPSG:4326",
          cql_filter: `kod = '${code}'`,
        },
      });

      const sites = this.parseNatura2000Response(response.data);
      const site = sites[0] || null;

      if (site) {
        this.setCache(cacheKey, site);
      }
      return site;
    } catch (error) {
      console.error("Error fetching Natura 2000 site:", error);
      return null;
    }
  }

  async searchNatura2000(name: string, limit = 50): Promise<Natura2000Site[]> {
    const cacheKey = `search_natura_${name}_${limit}`;
    const cached = this.getCached<Natura2000Site[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(this.WFS_URL, {
        params: {
          service: "WFS",
          version: "2.0.0",
          request: "GetFeature",
          typeName: "gdos:Natura2000",
          outputFormat: "application/json",
          srsName: "EPSG:4326",
          count: limit,
          cql_filter: `nazwa LIKE '%${name}%'`,
        },
      });

      const sites = this.parseNatura2000Response(response.data);
      this.setCache(cacheKey, sites);
      return sites;
    } catch (error) {
      console.error("Error searching Natura 2000:", error);
      return [];
    }
  }

  async getProtectedAreaById(id: string): Promise<ProtectedArea | null> {
    const cacheKey = `area_${id}`;
    const cached = this.getCached<ProtectedArea>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(this.WFS_URL, {
        params: {
          service: "WFS",
          version: "2.0.0",
          request: "GetFeature",
          typeName: "gdos:FormaOchronyPrzyrody",
          outputFormat: "application/json",
          featureID: id,
        },
      });

      const areas = this.parseWfsResponse(response.data);
      const area = areas[0] || null;

      if (area) {
        this.setCache(cacheKey, area);
      }
      return area;
    } catch (error) {
      console.error("Error fetching protected area:", error);
      return null;
    }
  }

  private parseWfsResponse(data: unknown): ProtectedArea[] {
    const geoJson = data as {
      features?: Array<{
        id?: string;
        properties?: Record<string, unknown>;
        geometry?: unknown;
      }>;
    };
    if (!geoJson.features) return [];

    return geoJson.features.map((feature) => ({
      id: String(feature.id || ""),
      name: String(feature.properties?.nazwa || feature.properties?.name || ""),
      type: this.parseAreaType(
        String(feature.properties?.typ || feature.properties?.type || "")
      ),
      code: feature.properties?.kod
        ? String(feature.properties.kod)
        : undefined,
      area: feature.properties?.powierzchnia
        ? Number(feature.properties.powierzchnia)
        : undefined,
      establishedDate: feature.properties?.data_utworzenia
        ? String(feature.properties.data_utworzenia)
        : undefined,
      voivodeship: feature.properties?.wojewodztwo
        ? String(feature.properties.wojewodztwo)
        : undefined,
      municipalities: feature.properties?.gminy
        ? String(feature.properties.gminy)
            .split(",")
            .map((g) => g.trim())
        : undefined,
      description: feature.properties?.opis
        ? String(feature.properties.opis)
        : undefined,
      legalBasis: feature.properties?.podstawa_prawna
        ? String(feature.properties.podstawa_prawna)
        : undefined,
      geometry: feature.geometry,
    }));
  }

  private parseNatura2000Response(data: unknown): Natura2000Site[] {
    const geoJson = data as {
      features?: Array<{ properties?: Record<string, unknown> }>;
    };
    if (!geoJson.features) return [];

    return geoJson.features.map((feature) => {
      const code = String(
        feature.properties?.kod || feature.properties?.code || ""
      );
      return {
        code,
        name: String(
          feature.properties?.nazwa || feature.properties?.name || ""
        ),
        type: this.parseNatura2000Type(code),
        area: Number(
          feature.properties?.powierzchnia || feature.properties?.area || 0
        ),
        biogeographicRegion: feature.properties?.region_biogeograficzny
          ? String(feature.properties.region_biogeograficzny)
          : undefined,
        voivodeships: feature.properties?.wojewodztwa
          ? String(feature.properties.wojewodztwa)
              .split(",")
              .map((w) => w.trim())
          : [],
        habitats: feature.properties?.siedliska
          ? String(feature.properties.siedliska)
              .split(",")
              .map((h) => h.trim())
          : undefined,
        species: feature.properties?.gatunki
          ? String(feature.properties.gatunki)
              .split(",")
              .map((s) => s.trim())
          : undefined,
        protectionStatus: feature.properties?.status_ochrony
          ? String(feature.properties.status_ochrony)
          : undefined,
      };
    });
  }

  private parseAreaType(type: string): ProtectedAreaType {
    const typeLower = type.toLowerCase();
    if (typeLower.includes("park narodowy")) return "national_park";
    if (typeLower.includes("rezerwat")) return "nature_reserve";
    if (typeLower.includes("park krajobrazowy")) return "landscape_park";
    if (typeLower.includes("obszar chronionego krajobrazu"))
      return "protected_landscape_area";
    if (typeLower.includes("korytarz ekologiczny"))
      return "ecological_corridor";
    if (typeLower.includes("pomnik przyrody")) return "nature_monument";
    if (typeLower.includes("stanowisko dokumentacyjne"))
      return "documentation_site";
    if (typeLower.includes("ptasi") || typeLower.includes("plb"))
      return "natura2000_bird";
    if (typeLower.includes("siedlisk") || typeLower.includes("plh"))
      return "natura2000_habitat";
    return "other";
  }

  private parseNatura2000Type(code: string): "PLB" | "PLH" | "PLC" {
    if (code.startsWith("PLB")) return "PLB";
    if (code.startsWith("PLH")) return "PLH";
    return "PLC";
  }

  private getPolishTypeName(type: ProtectedAreaType): string {
    const names: Record<ProtectedAreaType, string> = {
      national_park: "park narodowy",
      nature_reserve: "rezerwat przyrody",
      landscape_park: "park krajobrazowy",
      protected_landscape_area: "obszar chronionego krajobrazu",
      natura2000_bird: "obszar specjalnej ochrony ptaków",
      natura2000_habitat: "specjalny obszar ochrony siedlisk",
      ecological_corridor: "korytarz ekologiczny",
      nature_monument: "pomnik przyrody",
      documentation_site: "stanowisko dokumentacyjne",
      other: "inna forma ochrony",
    };
    return names[type];
  }

  private determineRestrictions(
    areas: ProtectedArea[],
    natura2000: Natura2000Site[]
  ): string[] {
    const restrictions: string[] = [];

    for (const area of areas) {
      switch (area.type) {
        case "national_park":
          restrictions.push("Zakaz budowy - park narodowy");
          restrictions.push(
            "Wymagana zgoda dyrektora parku na wszelkie działania"
          );
          break;
        case "nature_reserve":
          restrictions.push("Zakaz budowy - rezerwat przyrody");
          restrictions.push("Wymagana zgoda RDOŚ");
          break;
        case "landscape_park":
          restrictions.push("Ograniczenia budowlane - park krajobrazowy");
          restrictions.push("Wymagana opinia zespołu parku");
          break;
        case "protected_landscape_area":
          restrictions.push(
            "Ograniczenia budowlane - obszar chronionego krajobrazu"
          );
          break;
      }
    }

    if (natura2000.length > 0) {
      restrictions.push("Wymagana ocena oddziaływania na obszar Natura 2000");
      restrictions.push("Konieczność uzyskania decyzji środowiskowej");
    }

    return [...new Set(restrictions)]; // Usuń duplikaty
  }

  getAreaTypeLabel(type: ProtectedAreaType): string {
    const labels: Record<ProtectedAreaType, string> = {
      national_park: "Park Narodowy",
      nature_reserve: "Rezerwat Przyrody",
      landscape_park: "Park Krajobrazowy",
      protected_landscape_area: "Obszar Chronionego Krajobrazu",
      natura2000_bird: "Natura 2000 - Obszar Ptasi",
      natura2000_habitat: "Natura 2000 - Siedliska",
      ecological_corridor: "Korytarz Ekologiczny",
      nature_monument: "Pomnik Przyrody",
      documentation_site: "Stanowisko Dokumentacyjne",
      other: "Inna Forma Ochrony",
    };
    return labels[type];
  }

  getNatura2000TypeLabel(type: "PLB" | "PLH" | "PLC"): string {
    const labels: Record<"PLB" | "PLH" | "PLC", string> = {
      PLB: "Obszar Specjalnej Ochrony Ptaków",
      PLH: "Specjalny Obszar Ochrony Siedlisk",
      PLC: "Obszar Mający Znaczenie dla Wspólnoty",
    };
    return labels[type];
  }
}
