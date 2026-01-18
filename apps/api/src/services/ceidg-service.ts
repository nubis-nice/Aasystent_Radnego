import axios, { AxiosInstance } from "axios";

interface CeidgEntry {
  id: string;
  nip: string;
  regon?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  tradeName?: string;
  status: "active" | "suspended" | "terminated" | "unknown";
  registrationDate?: string;
  terminationDate?: string;
  suspensionDate?: string;
  resumptionDate?: string;
  mainAddress: {
    street?: string;
    buildingNumber?: string;
    apartmentNumber?: string;
    postalCode?: string;
    city?: string;
    municipality?: string;
    county?: string;
    voivodeship?: string;
    country: string;
  };
  correspondenceAddress?: {
    street?: string;
    buildingNumber?: string;
    apartmentNumber?: string;
    postalCode?: string;
    city?: string;
  };
  pkd: CeidgPkd[];
  email?: string;
  phone?: string;
  website?: string;
}

interface CeidgPkd {
  code: string;
  description?: string;
  isMain: boolean;
}

interface SearchOptions {
  nip?: string;
  regon?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  pkd?: string;
  page?: number;
  limit?: number;
}

interface SearchResult {
  entries: CeidgEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export class CeidgService {
  private client: AxiosInstance;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTTL = 3600000; // 1h
  private apiKey?: string;

  // API CEIDG (dane.biznes.gov.pl)
  private readonly BASE_URL = "https://dane.biznes.gov.pl/api/ceidg/v2";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CEIDG_API_KEY;

    this.client = axios.create({
      timeout: 20000,
      headers: {
        Accept: "application/json",
        "User-Agent": "AsystentRadnego/1.0",
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
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

  async getByNip(nip: string): Promise<CeidgEntry | null> {
    const normalizedNip = nip.replace(/\D/g, "");
    const cacheKey = `ceidg_nip_${normalizedNip}`;
    const cached = this.getCached<CeidgEntry>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(`${this.BASE_URL}/firmy`, {
        params: { nip: normalizedNip },
      });

      if (response.data.firmy && response.data.firmy.length > 0) {
        const entry = this.parseEntry(response.data.firmy[0]);
        this.setCache(cacheKey, entry);
        return entry;
      }
      return null;
    } catch (error) {
      console.error("Error fetching CEIDG by NIP:", error);
      return null;
    }
  }

  async getByRegon(regon: string): Promise<CeidgEntry | null> {
    const normalizedRegon = regon.replace(/\D/g, "");
    const cacheKey = `ceidg_regon_${normalizedRegon}`;
    const cached = this.getCached<CeidgEntry>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(`${this.BASE_URL}/firmy`, {
        params: { regon: normalizedRegon },
      });

      if (response.data.firmy && response.data.firmy.length > 0) {
        const entry = this.parseEntry(response.data.firmy[0]);
        this.setCache(cacheKey, entry);
        return entry;
      }
      return null;
    } catch (error) {
      console.error("Error fetching CEIDG by REGON:", error);
      return null;
    }
  }

  async search(options: SearchOptions): Promise<SearchResult> {
    const {
      nip,
      regon,
      name,
      firstName,
      lastName,
      city,
      pkd,
      page = 1,
      limit = 20,
    } = options;

    // Konkretne wyszukiwanie
    if (nip) {
      const entry = await this.getByNip(nip);
      return {
        entries: entry ? [entry] : [],
        totalCount: entry ? 1 : 0,
        page: 1,
        pageSize: limit,
      };
    }

    if (regon) {
      const entry = await this.getByRegon(regon);
      return {
        entries: entry ? [entry] : [],
        totalCount: entry ? 1 : 0,
        page: 1,
        pageSize: limit,
      };
    }

    // Wyszukiwanie z parametrami
    const cacheKey = `ceidg_search_${JSON.stringify(options)}`;
    const cached = this.getCached<SearchResult>(cacheKey);
    if (cached) return cached;

    try {
      const params: Record<string, string | number> = {
        strona: page,
        limit,
      };

      if (name) params.nazwa = name;
      if (firstName) params.imie = firstName;
      if (lastName) params.nazwisko = lastName;
      if (city) params.miejscowosc = city;
      if (pkd) params.pkd = pkd;

      const response = await this.client.get(`${this.BASE_URL}/firmy`, {
        params,
      });

      const result: SearchResult = {
        entries: (response.data.firmy || []).map(
          (item: Record<string, unknown>) => this.parseEntry(item)
        ),
        totalCount: response.data.dataCount || 0,
        page,
        pageSize: limit,
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error("Error searching CEIDG:", error);
      return {
        entries: [],
        totalCount: 0,
        page,
        pageSize: limit,
      };
    }
  }

  async getByCity(city: string, page = 1, limit = 20): Promise<SearchResult> {
    return this.search({ city, page, limit });
  }

  async getByPkd(pkdCode: string, page = 1, limit = 20): Promise<SearchResult> {
    return this.search({ pkd: pkdCode, page, limit });
  }

  async checkStatus(nip: string): Promise<{
    isActive: boolean;
    status: CeidgEntry["status"];
    details?: string;
  }> {
    const entry = await this.getByNip(nip);

    if (!entry) {
      return {
        isActive: false,
        status: "unknown",
        details: "Nie znaleziono wpisu w CEIDG",
      };
    }

    return {
      isActive: entry.status === "active",
      status: entry.status,
      details: this.getStatusDetails(entry),
    };
  }

  private getStatusDetails(entry: CeidgEntry): string {
    switch (entry.status) {
      case "active":
        return `Działalność aktywna od ${
          entry.registrationDate || "nieznana data"
        }`;
      case "suspended":
        return `Działalność zawieszona od ${
          entry.suspensionDate || "nieznana data"
        }`;
      case "terminated":
        return `Działalność zakończona ${
          entry.terminationDate || "nieznana data"
        }`;
      default:
        return "Status nieznany";
    }
  }

  private parseEntry(data: Record<string, unknown>): CeidgEntry {
    const adres = (data.adresDzialalnosci as Record<string, unknown>) || {};
    const adresKoresp =
      (data.adresKorespondencyjny as Record<string, unknown>) || {};
    const wlasciciel = (data.wlasciciel as Record<string, unknown>) || {};
    const pkdList = (data.pkd as Record<string, unknown>[]) || [];

    return {
      id: String(data.id || data.nip || ""),
      nip: String(data.nip || ""),
      regon: data.regon ? String(data.regon) : undefined,
      name: String(data.nazwa || ""),
      firstName: wlasciciel.imie ? String(wlasciciel.imie) : undefined,
      lastName: wlasciciel.nazwisko ? String(wlasciciel.nazwisko) : undefined,
      tradeName: data.nazwaSkrocona ? String(data.nazwaSkrocona) : undefined,
      status: this.parseStatus(String(data.status || "")),
      registrationDate: data.dataRozpoczeciaDzialalnosci
        ? String(data.dataRozpoczeciaDzialalnosci)
        : undefined,
      terminationDate: data.dataZakonczeniaDzialalnosci
        ? String(data.dataZakonczeniaDzialalnosci)
        : undefined,
      suspensionDate: data.dataZawieszeniaDzialalnosci
        ? String(data.dataZawieszeniaDzialalnosci)
        : undefined,
      resumptionDate: data.dataWznowieniaDzialalnosci
        ? String(data.dataWznowieniaDzialalnosci)
        : undefined,
      mainAddress: {
        street: adres.ulica ? String(adres.ulica) : undefined,
        buildingNumber: adres.budynek ? String(adres.budynek) : undefined,
        apartmentNumber: adres.lokal ? String(adres.lokal) : undefined,
        postalCode: adres.kodPocztowy ? String(adres.kodPocztowy) : undefined,
        city: adres.miejscowosc ? String(adres.miejscowosc) : undefined,
        municipality: adres.gmina ? String(adres.gmina) : undefined,
        county: adres.powiat ? String(adres.powiat) : undefined,
        voivodeship: adres.wojewodztwo ? String(adres.wojewodztwo) : undefined,
        country: String(adres.kraj || "POLSKA"),
      },
      correspondenceAddress: adresKoresp.miejscowosc
        ? {
            street: adresKoresp.ulica ? String(adresKoresp.ulica) : undefined,
            buildingNumber: adresKoresp.budynek
              ? String(adresKoresp.budynek)
              : undefined,
            apartmentNumber: adresKoresp.lokal
              ? String(adresKoresp.lokal)
              : undefined,
            postalCode: adresKoresp.kodPocztowy
              ? String(adresKoresp.kodPocztowy)
              : undefined,
            city: String(adresKoresp.miejscowosc),
          }
        : undefined,
      pkd: pkdList.map((p) => ({
        code: String(p.kod || ""),
        description: p.opis ? String(p.opis) : undefined,
        isMain: Boolean(p.przewazajace),
      })),
      email: data.email ? String(data.email) : undefined,
      phone: data.telefon ? String(data.telefon) : undefined,
      website: data.www ? String(data.www) : undefined,
    };
  }

  private parseStatus(status: string): CeidgEntry["status"] {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("aktywn") || statusLower.includes("active"))
      return "active";
    if (statusLower.includes("zawieszon") || statusLower.includes("suspend"))
      return "suspended";
    if (statusLower.includes("zakończ") || statusLower.includes("terminat"))
      return "terminated";
    return "unknown";
  }

  getStatusLabel(status: CeidgEntry["status"]): string {
    const labels: Record<CeidgEntry["status"], string> = {
      active: "Aktywna",
      suspended: "Zawieszona",
      terminated: "Zakończona",
      unknown: "Nieznany",
    };
    return labels[status];
  }
}
