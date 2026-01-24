/**
 * ISAP API Service
 * Obsługa ELI API Sejmu RP - akty prawne (Dziennik Ustaw, Monitor Polski)
 * Dokumentacja: https://api.sejm.gov.pl/eli_pl.html
 */
export class ISAPApiService {
    baseUrl = "https://api.sejm.gov.pl/eli";
    cacheEnabled = true;
    cacheTTL = 3600000;
    cache = new Map();
    constructor() { }
    async request(endpoint, params = {}) {
        const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
        if (this.cacheEnabled) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.data;
            }
        }
        const url = new URL(`${this.baseUrl}${endpoint}`);
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null && value !== "") {
                if (Array.isArray(value)) {
                    url.searchParams.set(key, value.join(","));
                }
                else {
                    url.searchParams.set(key, String(value));
                }
            }
        }
        console.log(`[ISAP API] Request: ${url.toString()}`);
        const response = await fetch(url.toString(), {
            headers: { Accept: "application/json" },
        });
        if (!response.ok) {
            throw new Error(`ISAP API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (this.cacheEnabled) {
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
        }
        return data;
    }
    async getPublishers() {
        const result = await this.request("/acts");
        return result.map((p) => ({ code: p.id, name: p.name }));
    }
    async getActsByYear(publisher, year) {
        return this.request(`/acts/${publisher}/${year}`);
    }
    async searchActs(params) {
        const queryParams = {};
        if (params.publisher)
            queryParams.publisher = params.publisher;
        if (params.year)
            queryParams.year = params.year;
        if (params.title)
            queryParams.title = params.title;
        if (params.type)
            queryParams.type = params.type;
        if (params.keyword && params.keyword.length > 0)
            queryParams.keyword = params.keyword;
        if (params.dateFrom)
            queryParams.dateFrom = params.dateFrom;
        if (params.dateTo)
            queryParams.dateTo = params.dateTo;
        if (params.inForce)
            queryParams.inForce = "1";
        if (params.limit)
            queryParams.limit = params.limit;
        if (params.offset)
            queryParams.offset = params.offset;
        if (params.sortBy)
            queryParams.sortBy = params.sortBy;
        if (params.sortDir)
            queryParams.sortDir = params.sortDir;
        return this.request("/acts/search", queryParams);
    }
    async getActDetails(publisher, year, position) {
        return this.request(`/acts/${publisher}/${year}/${position}`);
    }
    async getActByELI(eli) {
        return this.request(`/acts/${eli}`);
    }
    async getActTextHTML(publisher, year, position) {
        const url = `${this.baseUrl}/acts/${publisher}/${year}/${position}/text.html`;
        const response = await fetch(url, { headers: { Accept: "text/html" } });
        if (!response.ok)
            throw new Error(`Failed to fetch act text: ${response.status}`);
        return response.text();
    }
    getActPDFUrl(publisher, year, position) {
        return `${this.baseUrl}/acts/${publisher}/${year}/${position}/text.pdf`;
    }
    async searchInForceActs(keywords, publisher, limit = 20) {
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
    async searchByTitle(titleFragment, publisher, limit = 20) {
        const result = await this.searchActs({
            publisher,
            title: titleFragment,
            limit,
            sortBy: "promulgation",
            sortDir: "desc",
        });
        return result.items;
    }
    async getLatestActs(publisher, limit = 20) {
        const currentYear = new Date().getFullYear();
        const result = await this.getActsByYear(publisher, currentYear);
        return result.items
            .sort((a, b) => new Date(b.promulgation).getTime() -
            new Date(a.promulgation).getTime())
            .slice(0, limit);
    }
    async getActTypes() {
        const result = await this.request("/acts/types");
        return result.map((t) => t.name);
    }
    async getKeywords() {
        const result = await this.request("/acts/keywords");
        return result.map((k) => k.name);
    }
    async getStatuses() {
        const result = await this.request("/acts/statuses");
        return result.map((s) => s.name);
    }
    async searchLocalGovernmentActs(topic, limit = 30) {
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
    clearCache() {
        this.cache.clear();
    }
}
//# sourceMappingURL=isap-api-service.js.map