import axios, { AxiosInstance } from "axios";

interface KrsEntity {
  krsNumber: string;
  name: string;
  nip?: string;
  regon?: string;
  legalForm: string;
  registrationDate?: string;
  address: {
    street?: string;
    buildingNumber?: string;
    apartmentNumber?: string;
    postalCode?: string;
    city?: string;
    voivodeship?: string;
    country: string;
  };
  status: "active" | "liquidation" | "deleted" | "unknown";
  capital?: {
    amount: number;
    currency: string;
  };
  pkd?: string[];
  representatives?: KrsRepresentative[];
}

interface KrsRepresentative {
  firstName: string;
  lastName: string;
  function: string;
  pesel?: string;
}

interface KrsSearchResult {
  entities: KrsEntity[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface SearchOptions {
  name?: string;
  krs?: string;
  nip?: string;
  regon?: string;
  page?: number;
  limit?: number;
}

export class KrsService {
  private client: AxiosInstance;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTTL = 3600000; // 1h

  // API KRS (dane.gov.pl)
  private readonly BASE_URL = "https://api-krs.ms.gov.pl/api/krs";

  // Alternatywne API (rejestr.io)
  private readonly ALT_URL = "https://rejestr.io/api/v2";

  constructor() {
    this.client = axios.create({
      timeout: 20000,
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

  async getByKrs(krsNumber: string): Promise<KrsEntity | null> {
    const normalizedKrs = krsNumber.replace(/\D/g, "").padStart(10, "0");
    const cacheKey = `krs_${normalizedKrs}`;
    const cached = this.getCached<KrsEntity>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(
        `${this.BASE_URL}/OdsijeczJednostki/${normalizedKrs}`
      );

      const entity = this.parseKrsResponse(response.data);
      if (entity) {
        this.setCache(cacheKey, entity);
      }
      return entity;
    } catch (error) {
      console.error("Error fetching KRS entity:", error);
      return this.getByKrsAlternative(normalizedKrs);
    }
  }

  private async getByKrsAlternative(
    krsNumber: string
  ): Promise<KrsEntity | null> {
    try {
      const response = await this.client.get(
        `${this.ALT_URL}/krs/${krsNumber}`
      );
      return this.parseAltResponse(response.data);
    } catch (error) {
      console.error("Error fetching from alternative API:", error);
      return null;
    }
  }

  async getByNip(nip: string): Promise<KrsEntity | null> {
    const normalizedNip = nip.replace(/\D/g, "");
    const cacheKey = `nip_${normalizedNip}`;
    const cached = this.getCached<KrsEntity>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(
        `${this.BASE_URL}/OdpisAktualny/nip/${normalizedNip}`
      );

      const entity = this.parseKrsResponse(response.data);
      if (entity) {
        this.setCache(cacheKey, entity);
      }
      return entity;
    } catch (error) {
      console.error("Error fetching by NIP:", error);
      return null;
    }
  }

  async getByRegon(regon: string): Promise<KrsEntity | null> {
    const normalizedRegon = regon.replace(/\D/g, "");
    const cacheKey = `regon_${normalizedRegon}`;
    const cached = this.getCached<KrsEntity>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(
        `${this.BASE_URL}/OdpisAktualny/regon/${normalizedRegon}`
      );

      const entity = this.parseKrsResponse(response.data);
      if (entity) {
        this.setCache(cacheKey, entity);
      }
      return entity;
    } catch (error) {
      console.error("Error fetching by REGON:", error);
      return null;
    }
  }

  async search(options: SearchOptions): Promise<KrsSearchResult> {
    const { name, krs, nip, regon, page = 1, limit = 20 } = options;
    const cacheKey = `search_${JSON.stringify(options)}`;
    const cached = this.getCached<KrsSearchResult>(cacheKey);
    if (cached) return cached;

    // Jeśli podano konkretny identyfikator
    if (krs) {
      const entity = await this.getByKrs(krs);
      return {
        entities: entity ? [entity] : [],
        totalCount: entity ? 1 : 0,
        page: 1,
        pageSize: limit,
      };
    }

    if (nip) {
      const entity = await this.getByNip(nip);
      return {
        entities: entity ? [entity] : [],
        totalCount: entity ? 1 : 0,
        page: 1,
        pageSize: limit,
      };
    }

    if (regon) {
      const entity = await this.getByRegon(regon);
      return {
        entities: entity ? [entity] : [],
        totalCount: entity ? 1 : 0,
        page: 1,
        pageSize: limit,
      };
    }

    // Wyszukiwanie po nazwie
    if (name) {
      try {
        const response = await this.client.get(`${this.BASE_URL}/Wyszukaj`, {
          params: {
            nazwa: name,
            strona: page,
            iloscNaStronie: limit,
          },
        });

        const result: KrsSearchResult = {
          entities: (response.data.items || [])
            .map((item: Record<string, unknown>) => this.parseKrsResponse(item))
            .filter(Boolean) as KrsEntity[],
          totalCount: response.data.totalCount || 0,
          page,
          pageSize: limit,
        };

        this.setCache(cacheKey, result);
        return result;
      } catch (error) {
        console.error("Error searching KRS:", error);
      }
    }

    return {
      entities: [],
      totalCount: 0,
      page,
      pageSize: limit,
    };
  }

  async getRepresentatives(krsNumber: string): Promise<KrsRepresentative[]> {
    const entity = await this.getByKrs(krsNumber);
    return entity?.representatives || [];
  }

  async getPkdCodes(krsNumber: string): Promise<string[]> {
    const entity = await this.getByKrs(krsNumber);
    return entity?.pkd || [];
  }

  private parseKrsResponse(data: Record<string, unknown>): KrsEntity | null {
    if (!data) return null;

    try {
      const odpis = (data.odpis as Record<string, unknown>) || data;
      const dane = (odpis.dane as Record<string, unknown>) || odpis;
      const dzial1 = (dane.dzial1 as Record<string, unknown>) || {};
      const dzial2 = (dane.dzial2 as Record<string, unknown>) || {};

      const danePodmiotu =
        (dzial1.danePodmiotu as Record<string, unknown>) || {};
      const siedziba = (dzial1.siedzibaIAdres as Record<string, unknown>) || {};
      const kapital = (dzial1.kapital as Record<string, unknown>) || {};
      const organReprezentacji =
        (dzial2.organReprezentacji as Record<string, unknown>) || {};

      return {
        krsNumber: String(danePodmiotu.numerKRS || data.numerKRS || ""),
        name: String(danePodmiotu.nazwa || data.nazwa || ""),
        nip: danePodmiotu.nip ? String(danePodmiotu.nip) : undefined,
        regon: danePodmiotu.regon ? String(danePodmiotu.regon) : undefined,
        legalForm: String(danePodmiotu.formaPrawna || ""),
        registrationDate: danePodmiotu.dataWpisuDoRejestruPrzedsiebiorstw
          ? String(danePodmiotu.dataWpisuDoRejestruPrzedsiebiorstw)
          : undefined,
        address: {
          street: siedziba.ulica ? String(siedziba.ulica) : undefined,
          buildingNumber: siedziba.nrDomu ? String(siedziba.nrDomu) : undefined,
          apartmentNumber: siedziba.nrLokalu
            ? String(siedziba.nrLokalu)
            : undefined,
          postalCode: siedziba.kodPocztowy
            ? String(siedziba.kodPocztowy)
            : undefined,
          city: siedziba.miejscowosc ? String(siedziba.miejscowosc) : undefined,
          voivodeship: siedziba.wojewodztwo
            ? String(siedziba.wojewodztwo)
            : undefined,
          country: String(siedziba.kraj || "POLSKA"),
        },
        status: this.parseStatus(String(data.statusPodmiotu || "")),
        capital: kapital.wysokoscKapitaluZakladowego
          ? {
              amount: parseFloat(String(kapital.wysokoscKapitaluZakladowego)),
              currency: String(kapital.walutaKapitaluZakladowego || "PLN"),
            }
          : undefined,
        pkd: this.parsePkd(
          (dzial1.przedmiotDzialalnosci as Record<string, unknown>[]) || []
        ),
        representatives: this.parseRepresentatives(organReprezentacji),
      };
    } catch (error) {
      console.error("Error parsing KRS response:", error);
      return null;
    }
  }

  private parseAltResponse(data: Record<string, unknown>): KrsEntity | null {
    if (!data) return null;

    try {
      return {
        krsNumber: String(data.krs || ""),
        name: String(data.name || ""),
        nip: data.nip ? String(data.nip) : undefined,
        regon: data.regon ? String(data.regon) : undefined,
        legalForm: String(data.legalForm || ""),
        address: {
          street: data.street ? String(data.street) : undefined,
          city: data.city ? String(data.city) : undefined,
          postalCode: data.postalCode ? String(data.postalCode) : undefined,
          country: "POLSKA",
        },
        status: this.parseStatus(String(data.status || "")),
      };
    } catch (error) {
      console.error("Error parsing alternative response:", error);
      return null;
    }
  }

  private parseStatus(status: string): KrsEntity["status"] {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("aktywn") || statusLower.includes("active"))
      return "active";
    if (statusLower.includes("likwidac")) return "liquidation";
    if (statusLower.includes("wykreśl") || statusLower.includes("deleted"))
      return "deleted";
    return "unknown";
  }

  private parsePkd(przedmiot: Record<string, unknown>[]): string[] {
    if (!Array.isArray(przedmiot)) return [];
    return przedmiot
      .map((p) => String(p.kodPKD || p.kod || ""))
      .filter(Boolean);
  }

  private parseRepresentatives(
    organ: Record<string, unknown>
  ): KrsRepresentative[] {
    const sklad = (organ.sklad as Record<string, unknown>[]) || [];
    if (!Array.isArray(sklad)) return [];

    return sklad.map((osoba) => ({
      firstName: String(osoba.imie || osoba.imiona || ""),
      lastName: String(osoba.nazwisko || ""),
      function: String(osoba.funkcja || ""),
      pesel: osoba.pesel ? String(osoba.pesel) : undefined,
    }));
  }

  getStatusLabel(status: KrsEntity["status"]): string {
    const labels: Record<KrsEntity["status"], string> = {
      active: "Aktywny",
      liquidation: "W likwidacji",
      deleted: "Wykreślony",
      unknown: "Nieznany",
    };
    return labels[status];
  }
}
