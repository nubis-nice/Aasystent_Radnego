/**
 * Geoportal Service - Integracja z Geoportal.gov.pl
 * Dostęp do danych przestrzennych: działki, MPZP, granice administracyjne
 */

import axios, { AxiosInstance } from "axios";
import { XMLParser } from "fast-xml-parser";

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
  coordinates?: { lat: number; lon: number };
  municipality?: string;
  radius?: number;
}

const GEOPORTAL_SERVICES = {
  ULDK: "https://uldk.gugik.gov.pl",
  PRG: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries",
  BDOT: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/BDOT/WFS/Topographic",
  EMUiA: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/EMUiA/WFS/Addresses",
  MPZP: "https://integracja.gugik.gov.pl/cgi-bin/KraijsowaBazaMPZP",
  ORTHOPHOTO:
    "https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution",
};

export class GeoportalService {
  private httpClient: AxiosInstance;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTTL = 3600000; // 1 hour

  constructor() {
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        "User-Agent": "AsystentRadnego/1.0",
        Accept: "application/json, application/xml, text/xml",
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

  /**
   * Wyszukiwanie działki po identyfikatorze (ULDK API)
   */
  async getParcelById(parcelId: string): Promise<ParcelInfo | null> {
    const cacheKey = `parcel:${parcelId}`;
    const cached = this.getCached<ParcelInfo>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.httpClient.get(
        `${GEOPORTAL_SERVICES.ULDK}/`,
        {
          params: {
            request: "GetParcelById",
            id: parcelId,
            result: "teryt,voivodeship,county,commune,region,parcel,geom_wkt",
          },
        },
      );

      if (response.data && response.data !== "-1") {
        const parts = response.data.split("|");
        const parcel: ParcelInfo = {
          id: parcelId,
          voivodeship: parts[1] || "",
          county: parts[2] || "",
          municipality: parts[3] || "",
          precinct: parts[4] || "",
          parcelNumber: parts[5] || "",
        };
        this.setCache(cacheKey, parcel);
        return parcel;
      }
      return null;
    } catch (error) {
      console.error("[GeoportalService] Error fetching parcel:", error);
      return null;
    }
  }

  /**
   * Wyszukiwanie działki po współrzędnych
   */
  async getParcelByCoordinates(
    lat: number,
    lon: number,
  ): Promise<ParcelInfo | null> {
    const cacheKey = `parcel:coords:${lat}:${lon}`;
    const cached = this.getCached<ParcelInfo>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.httpClient.get(
        `${GEOPORTAL_SERVICES.ULDK}/`,
        {
          params: {
            request: "GetParcelByXY",
            xy: `${lon},${lat}`,
            result: "teryt,voivodeship,county,commune,region,parcel,geom_wkt",
          },
        },
      );

      if (response.data && response.data !== "-1") {
        const parts = response.data.split("|");
        const parcel: ParcelInfo = {
          id: parts[0] || "",
          voivodeship: parts[1] || "",
          county: parts[2] || "",
          municipality: parts[3] || "",
          precinct: parts[4] || "",
          parcelNumber: parts[5] || "",
        };
        this.setCache(cacheKey, parcel);
        return parcel;
      }
      return null;
    } catch (error) {
      console.error(
        "[GeoportalService] Error fetching parcel by coordinates:",
        error,
      );
      return null;
    }
  }

  /**
   * Wyszukiwanie adresów (EMUiA)
   */
  async searchAddress(
    query: string,
    limit: number = 10,
  ): Promise<AddressPoint[]> {
    const cacheKey = `address:${query}:${limit}`;
    const cached = this.getCached<AddressPoint[]>(cacheKey);
    if (cached) return cached;

    try {
      // Użycie GUGIK geocoder API
      const response = await this.httpClient.get(
        "https://services.gugik.gov.pl/uug/",
        {
          params: {
            request: "GetAddress",
            address: query,
          },
        },
      );

      const results: AddressPoint[] = [];
      if (response.data?.results) {
        for (const item of response.data.results.slice(0, limit)) {
          results.push({
            id: item.id || `addr_${results.length}`,
            street: item.street,
            houseNumber: item.number,
            postalCode: item.postcode,
            city: item.city || item.locality,
            voivodeship: item.voivodeship,
            coordinates: {
              lat: parseFloat(item.y),
              lon: parseFloat(item.x),
            },
          });
        }
      }

      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error("[GeoportalService] Error searching address:", error);
      return [];
    }
  }

  /**
   * Pobieranie granic jednostki administracyjnej (PRG WFS)
   */
  async getAdministrativeUnit(
    code: string,
  ): Promise<AdministrativeUnit | null> {
    const cacheKey = `admin:${code}`;
    const cached = this.getCached<AdministrativeUnit>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.httpClient.get(GEOPORTAL_SERVICES.PRG, {
        params: {
          SERVICE: "WFS",
          VERSION: "2.0.0",
          REQUEST: "GetFeature",
          TYPENAMES: "ms:A03_Granice_gmin",
          CQL_FILTER: `JPT_KOD_JE='${code}'`,
          OUTPUTFORMAT: "application/gml+xml; version=3.2",
        },
      });

      const features = this.parseGmlFeatures(response.data);
      if (features.length > 0) {
        const feature = features[0];
        const unit: AdministrativeUnit = {
          id: feature.id,
          name: feature.name || "",
          type: this.getUnitType(code),
          code: code,
          geometry: feature.geometry,
        };
        this.setCache(cacheKey, unit);
        return unit;
      }
      return null;
    } catch (error) {
      console.error(
        "[GeoportalService] Error fetching administrative unit:",
        error,
      );
      return null;
    }
  }

  /**
   * Wyszukiwanie gmin po nazwie
   */
  async searchMunicipalities(name: string): Promise<AdministrativeUnit[]> {
    console.log(
      `[GeoportalService] searchMunicipalities called with: "${name}"`,
    );
    const cacheKey = `municipalities:${name}`;
    const cached = this.getCached<AdministrativeUnit[]>(cacheKey);
    if (cached) {
      console.log(`[GeoportalService] Returning cached result for: "${name}"`);
      return cached;
    }

    try {
      console.log(`[GeoportalService] Fetching from PRG WFS...`);
      const response = await this.httpClient.get(GEOPORTAL_SERVICES.PRG, {
        params: {
          SERVICE: "WFS",
          VERSION: "2.0.0",
          REQUEST: "GetFeature",
          TYPENAMES: "ms:A03_Granice_gmin",
          CQL_FILTER: `JPT_NAZWA_ LIKE '%${name}%'`,
          OUTPUTFORMAT: "application/gml+xml; version=3.2",
          COUNT: 20,
        },
      });

      console.log(
        `[GeoportalService] PRG response received, data length: ${typeof response.data === "string" ? response.data.length : "not string"}`,
      );
      const units: AdministrativeUnit[] = [];
      const features = this.parseGmlFeatures(response.data);
      console.log(
        `[GeoportalService] Parsed ${features.length} features from GML`,
      );
      for (const feature of features) {
        units.push({
          id: feature.id,
          name: feature.name || "",
          type: "municipality",
          code: feature.code || "",
        });
      }

      this.setCache(cacheKey, units);
      return units;
    } catch (error) {
      console.error(
        "[GeoportalService] Error searching municipalities:",
        error,
      );
      return [];
    }
  }

  /**
   * Informacje o MPZP dla lokalizacji
   */
  async getSpatialPlanInfo(lat: number, lon: number): Promise<SpatialPlan[]> {
    const cacheKey = `mpzp:${lat}:${lon}`;
    const cached = this.getCached<SpatialPlan[]>(cacheKey);
    if (cached) return cached;

    try {
      // Najpierw znajdź działkę
      const parcel = await this.getParcelByCoordinates(lat, lon);
      if (!parcel) return [];

      // Mock - w rzeczywistości należałoby odpytać serwis MPZP
      const plans: SpatialPlan[] = [
        {
          id: `mpzp_${parcel.municipality}_1`,
          name: `Miejscowy plan zagospodarowania przestrzennego - ${parcel.municipality}`,
          type: "mpzp",
          municipality: parcel.municipality,
          status: "obowiązujący",
          adoptionDate: "2020-01-15",
        },
      ];

      this.setCache(cacheKey, plans);
      return plans;
    } catch (error) {
      console.error("[GeoportalService] Error fetching spatial plan:", error);
      return [];
    }
  }

  /**
   * Uniwersalne wyszukiwanie danych przestrzennych
   */
  async search(params: GeoportalSearchParams): Promise<{
    parcels: ParcelInfo[];
    addresses: AddressPoint[];
    units: AdministrativeUnit[];
  }> {
    const results = {
      parcels: [] as ParcelInfo[],
      addresses: [] as AddressPoint[],
      units: [] as AdministrativeUnit[],
    };

    try {
      // Wyszukaj po ID działki
      if (params.parcelId) {
        const parcel = await this.getParcelById(params.parcelId);
        if (parcel) results.parcels.push(parcel);
      }

      // Wyszukaj po współrzędnych
      if (params.coordinates) {
        const parcel = await this.getParcelByCoordinates(
          params.coordinates.lat,
          params.coordinates.lon,
        );
        if (parcel) results.parcels.push(parcel);
      }

      // Wyszukaj adresy
      if (params.address || params.query) {
        results.addresses = await this.searchAddress(
          params.address || params.query || "",
          10,
        );
      }

      // Wyszukaj gminy
      if (params.municipality || params.query) {
        results.units = await this.searchMunicipalities(
          params.municipality || params.query || "",
        );
      }
    } catch (error) {
      console.error("[GeoportalService] Search error:", error);
    }

    return results;
  }

  /**
   * Pobranie URL do mapy ortofoto dla lokalizacji
   */
  getOrthophotoUrl(lat: number, lon: number, zoom: number = 15): string {
    return `https://mapy.geoportal.gov.pl/imap/Imgp_2.html?centerX=${lon}&centerY=${lat}&scale=${zoom}`;
  }

  /**
   * Pobranie linku do Geoportalu dla działki
   */
  getGeoportalLink(parcelId: string): string {
    return `https://mapy.geoportal.gov.pl/imap/Imgp_2.html?identifyParcel=${parcelId}`;
  }

  private getUnitType(code: string): AdministrativeUnit["type"] {
    if (code.length === 2) return "voivodeship";
    if (code.length === 4) return "county";
    if (code.length === 7) return "municipality";
    return "city";
  }

  /**
   * Parsowanie odpowiedzi GML z WFS
   */
  private parseGmlFeatures(
    gmlData: string,
  ): Array<{ id: string; name: string; code: string; geometry?: unknown }> {
    try {
      console.log(
        `[GeoportalService] parseGmlFeatures called, input length: ${gmlData?.length || 0}`,
      );
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        removeNSPrefix: true,
      });
      const parsed = parser.parse(gmlData);
      console.log(
        `[GeoportalService] XML parsed, keys: ${Object.keys(parsed).join(", ")}`,
      );

      const features: Array<{
        id: string;
        name: string;
        code: string;
        geometry?: unknown;
      }> = [];

      // Nawigacja do featureMember/featureMembers
      const featureCollection = parsed.FeatureCollection || parsed;
      let members =
        featureCollection.featureMember ||
        featureCollection.member ||
        featureCollection.featureMembers;

      if (!members) {
        console.warn("[GeoportalService] No features found in GML response");
        return [];
      }

      // Normalizuj do tablicy
      if (!Array.isArray(members)) {
        members = [members];
      }

      for (const member of members) {
        // Szukaj A03_Granice_gmin wewnątrz member
        const feature = member.A03_Granice_gmin || member;
        if (feature) {
          features.push({
            id: feature["@_id"] || feature.id || "",
            name: feature.JPT_NAZWA_ || feature.jpt_nazwa_ || "",
            code: feature.JPT_KOD_JE || feature.jpt_kod_je || "",
            geometry: feature.msGeometry || feature.geometry || undefined,
          });
        }
      }

      return features;
    } catch (error) {
      console.error("[GeoportalService] Error parsing GML:", error);
      return [];
    }
  }
}
