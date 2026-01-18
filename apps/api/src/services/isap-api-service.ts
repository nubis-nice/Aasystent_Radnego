/**
 * ISAP API Service
 * Obsługa ELI API Sejmu RP - akty prawne (Dziennik Ustaw, Monitor Polski)
 * Dokumentacja: https://api.sejm.gov.pl/eli_pl.html
 */

/* eslint-disable no-undef */

export interface ISAPAct {
  ELI: string;
  address: string;
  publisher: string;
  year: number;
  pos: number;
  title: string;
  displayAddress: string;
  promulgation: string;
  announcementDate: string;
  textPDF: boolean;
  textHTML: boolean;
  changeDate: string;
  type: string;
  status: string;
  entryIntoForce?: string;
  expirationDate?: string;
  inForce?: string;
  keywords?: string[];
  releasedBy?: string[];
  references?: Record<string, Array<{ id: string; art?: string }>>;
}

export interface ISAPSearchParams {
  publisher?: "DU" | "MP";
  year?: number;
  title?: string;
  type?: string;
  keyword?: string[];
  dateFrom?: string;
  dateTo?: string;
  inForce?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface ISAPSearchResult {
  count: number;
  totalCount: number;
  offset: number;
  items: ISAPAct[];
}

export interface ISAPActDetails extends ISAPAct {
  texts?: Array<{
    fileName: string;
    type: "H" | "O" | "I";
  }>;
  directives?: string[];
  authorizedBody?: string[];
  obligated?: string[];
}

export class ISAPApiService {
  private baseUrl = "https://api.sejm.gov.pl/eli";
  private cacheEnabled = true;
  private cacheTTL = 3600000;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();

  constructor() {}

  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | boolean | string[]> = {}
  ): Promise<T> {
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;

    if (this.cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data as T;
      }
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        if (Array.isArray(value)) {
          url.searchParams.set(key, value.join(","));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    console.log(`[ISAP API] Request: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `ISAP API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (this.cacheEnabled) {
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data as T;
  }

  async getPublishers(): Promise<Array<{ code: string; name: string }>> {
    const result = await this.request<Array<{ id: string; name: string }>>(
      "/acts"
    );
    return result.map((p) => ({ code: p.id, name: p.name }));
  }

  async getActsByYear(
    publisher: "DU" | "MP",
    year: number
  ): Promise<ISAPSearchResult> {
    return this.request<ISAPSearchResult>(`/acts/${publisher}/${year}`);
  }

  async searchActs(params: ISAPSearchParams): Promise<ISAPSearchResult> {
    const queryParams: Record<string, string | number | boolean | string[]> =
      {};

    if (params.publisher) queryParams.publisher = params.publisher;
    if (params.year) queryParams.year = params.year;
    if (params.title) queryParams.title = params.title;
    if (params.type) queryParams.type = params.type;
    if (params.keyword && params.keyword.length > 0)
      queryParams.keyword = params.keyword;
    if (params.dateFrom) queryParams.dateFrom = params.dateFrom;
    if (params.dateTo) queryParams.dateTo = params.dateTo;
    if (params.inForce) queryParams.inForce = "1";
    if (params.limit) queryParams.limit = params.limit;
    if (params.offset) queryParams.offset = params.offset;
    if (params.sortBy) queryParams.sortBy = params.sortBy;
    if (params.sortDir) queryParams.sortDir = params.sortDir;

    return this.request<ISAPSearchResult>("/acts/search", queryParams);
  }

  async getActDetails(
    publisher: "DU" | "MP",
    year: number,
    position: number
  ): Promise<ISAPActDetails> {
    return this.request<ISAPActDetails>(
      `/acts/${publisher}/${year}/${position}`
    );
  }

  async getActByELI(eli: string): Promise<ISAPActDetails> {
    return this.request<ISAPActDetails>(`/acts/${eli}`);
  }

  async getActTextHTML(
    publisher: "DU" | "MP",
    year: number,
    position: number
  ): Promise<string> {
    const url = `${this.baseUrl}/acts/${publisher}/${year}/${position}/text.html`;
    const response = await fetch(url, { headers: { Accept: "text/html" } });
    if (!response.ok)
      throw new Error(`Failed to fetch act text: ${response.status}`);
    return response.text();
  }

  getActPDFUrl(publisher: "DU" | "MP", year: number, position: number): string {
    return `${this.baseUrl}/acts/${publisher}/${year}/${position}/text.pdf`;
  }

  async searchInForceActs(
    keywords: string[],
    publisher?: "DU" | "MP",
    limit: number = 20
  ): Promise<ISAPAct[]> {
    const result = await this.searchActs({
      publisher,
      keyword: keywords,
      inForce: true,
      limit,
      sortBy: "promulgation",
      sortDir: "desc",
    });
    return result.items;
  }

  async searchByTitle(
    titleFragment: string,
    publisher?: "DU" | "MP",
    limit: number = 20
  ): Promise<ISAPAct[]> {
    const result = await this.searchActs({
      publisher,
      title: titleFragment,
      limit,
      sortBy: "promulgation",
      sortDir: "desc",
    });
    return result.items;
  }

  async getLatestActs(
    publisher: "DU" | "MP",
    limit: number = 20
  ): Promise<ISAPAct[]> {
    const currentYear = new Date().getFullYear();
    const result = await this.getActsByYear(publisher, currentYear);
    return result.items
      .sort(
        (a, b) =>
          new Date(b.promulgation).getTime() -
          new Date(a.promulgation).getTime()
      )
      .slice(0, limit);
  }

  async getActTypes(): Promise<string[]> {
    const result = await this.request<Array<{ name: string }>>("/acts/types");
    return result.map((t) => t.name);
  }

  async getKeywords(): Promise<string[]> {
    const result = await this.request<Array<{ name: string }>>(
      "/acts/keywords"
    );
    return result.map((k) => k.name);
  }

  async getStatuses(): Promise<string[]> {
    const result = await this.request<Array<{ name: string }>>(
      "/acts/statuses"
    );
    return result.map((s) => s.name);
  }

  async searchLocalGovernmentActs(
    topic?: string,
    limit: number = 30
  ): Promise<ISAPAct[]> {
    const samorządKeywords = [
      "samorząd",
      "gmina",
      "powiat",
      "województwo",
      "rada gminy",
      "wójt",
      "burmistrz",
      "prezydent miasta",
    ];
    const searchKeywords = topic
      ? [topic, ...samorządKeywords.slice(0, 3)]
      : samorządKeywords;
    const result = await this.searchActs({
      keyword: searchKeywords,
      inForce: true,
      limit,
      sortBy: "promulgation",
      sortDir: "desc",
    });
    return result.items;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
