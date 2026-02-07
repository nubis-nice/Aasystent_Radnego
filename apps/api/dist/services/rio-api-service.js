/**
 * RIO API Service
 * Obsługa Regionalnych Izb Obrachunkowych - uchwały, rozstrzygnięcia nadzorcze
 *
 * RIO to 16 izb regionalnych, każda z własnym BIP.
 * Serwis agreguje dane z różnych źródeł RIO.
 */
// Lista Regionalnych Izb Obrachunkowych
export const RIO_CHAMBERS = {
    bialystok: {
        name: "RIO w Białymstoku",
        url: "https://bip.bialystok.rio.gov.pl",
        province: "podlaskie",
    },
    bydgoszcz: {
        name: "RIO w Bydgoszczy",
        url: "https://bip.bydgoszcz.rio.gov.pl",
        province: "kujawsko-pomorskie",
    },
    gdansk: {
        name: "RIO w Gdańsku",
        url: "https://bip.gdansk.rio.gov.pl",
        province: "pomorskie",
    },
    gorzow: {
        name: "RIO w Gorzowie Wlkp.",
        url: "https://bip.gorzow.rio.gov.pl",
        province: "lubuskie",
    },
    katowice: {
        name: "RIO w Katowicach",
        url: "https://bip.katowice.rio.gov.pl",
        province: "śląskie",
    },
    kielce: {
        name: "RIO w Kielcach",
        url: "https://bip.kielce.rio.gov.pl",
        province: "świętokrzyskie",
    },
    krakow: {
        name: "RIO w Krakowie",
        url: "https://bip.krakow.rio.gov.pl",
        province: "małopolskie",
    },
    lodz: {
        name: "RIO w Łodzi",
        url: "https://bip.lodz.rio.gov.pl",
        province: "łódzkie",
    },
    lublin: {
        name: "RIO w Lublinie",
        url: "https://bip.lublin.rio.gov.pl",
        province: "lubelskie",
    },
    olsztyn: {
        name: "RIO w Olsztynie",
        url: "https://bip.olsztyn.rio.gov.pl",
        province: "warmińsko-mazurskie",
    },
    opole: {
        name: "RIO w Opolu",
        url: "https://bip.opole.rio.gov.pl",
        province: "opolskie",
    },
    poznan: {
        name: "RIO w Poznaniu",
        url: "https://bip.poznan.rio.gov.pl",
        province: "wielkopolskie",
    },
    rzeszow: {
        name: "RIO w Rzeszowie",
        url: "https://bip.rzeszow.rio.gov.pl",
        province: "podkarpackie",
    },
    szczecin: {
        name: "RIO w Szczecinie",
        url: "https://bip.szczecin.rio.gov.pl",
        province: "zachodniopomorskie",
    },
    warszawa: {
        name: "RIO w Warszawie",
        url: "https://bip.warszawa.rio.gov.pl",
        province: "mazowieckie",
    },
    wroclaw: {
        name: "RIO we Wrocławiu",
        url: "https://bip.wroclaw.rio.gov.pl",
        province: "dolnośląskie",
    },
};
// Typy rozstrzygnięć RIO
export const RIO_DECISION_TYPES = {
    uchwala: "Uchwała Kolegium RIO",
    rozstrzygniecie: "Rozstrzygnięcie nadzorcze",
    opinia: "Opinia RIO",
    stanowisko: "Stanowisko/Wyjaśnienie",
};
export class RIOApiService {
    cacheEnabled = true;
    cacheTTL = 3600000; // 1 godzina
    cache = new Map();
    constructor() { }
    /**
     * Wyszukaj decyzje RIO
     * UWAGA: Używa web scrapingu BIP RIO
     */
    async searchDecisions(params) {
        const cacheKey = `search:${JSON.stringify(params)}`;
        if (this.cacheEnabled) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.data;
            }
        }
        console.log(`[RIO API] Search request with params:`, params);
        try {
            let items = [];
            // Jeśli podano konkretne RIO, szukaj tylko tam
            if (params.rio && RIO_CHAMBERS[params.rio]) {
                items = await this.searchInChamber(params.rio, params);
            }
            else {
                // W przeciwnym razie szukaj we wszystkich (lub pierwszych kilku)
                const chambers = Object.keys(RIO_CHAMBERS).slice(0, 4); // Limit dla wydajności
                for (const chamber of chambers) {
                    const chamberItems = await this.searchInChamber(chamber, params);
                    items.push(...chamberItems);
                    if (items.length >= (params.limit || 20))
                        break;
                }
            }
            // Sortuj po dacie (najnowsze pierwsze)
            items.sort((a, b) => new Date(b.decisionDate).getTime() -
                new Date(a.decisionDate).getTime());
            // Paginacja
            const offset = params.offset || 0;
            const limit = params.limit || 20;
            const paginatedItems = items.slice(offset, offset + limit);
            const result = {
                count: paginatedItems.length,
                totalCount: items.length,
                offset,
                items: paginatedItems,
            };
            if (this.cacheEnabled) {
                this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            }
            return result;
        }
        catch (error) {
            console.error("[RIO API] Search error:", error);
            throw error;
        }
    }
    /**
     * Pobierz szczegóły decyzji
     */
    async getDecisionDetails(id) {
        const cacheKey = `decision:${id}`;
        if (this.cacheEnabled) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.data;
            }
        }
        // ID format: "rio_code:decision_id"
        const [rioCode, decisionId] = id.split(":");
        if (!rioCode || !decisionId || !RIO_CHAMBERS[rioCode]) {
            return null;
        }
        try {
            const chamber = RIO_CHAMBERS[rioCode];
            const url = `${chamber.url}/decyzja/${decisionId}`;
            const response = await fetch(url, {
                headers: {
                    Accept: "text/html",
                    "User-Agent": "AAsystent-Radnego/1.0 (Legal Research Tool)",
                },
            });
            if (!response.ok) {
                return null;
            }
            const html = await response.text();
            const decision = this.parseDecisionDetails(html, id, rioCode);
            if (this.cacheEnabled && decision) {
                this.cache.set(cacheKey, { data: decision, timestamp: Date.now() });
            }
            return decision;
        }
        catch (error) {
            console.error(`[RIO API] Error fetching decision ${id}:`, error);
            return null;
        }
    }
    /**
     * Wyszukaj rozstrzygnięcia nadzorcze dla gminy
     */
    async searchByMunicipality(municipality, limit = 20) {
        const result = await this.searchDecisions({
            municipality,
            decisionType: "rozstrzygniecie",
            limit,
        });
        return result.items;
    }
    /**
     * Wyszukaj uchwały budżetowe
     */
    async searchBudgetDecisions(rio, limit = 20) {
        const result = await this.searchDecisions({
            rio,
            query: "budżet wieloletnia prognoza finansowa",
            limit,
        });
        return result.items;
    }
    /**
     * Pobierz listę RIO
     */
    getChambers() {
        return Object.entries(RIO_CHAMBERS).map(([code, info]) => ({
            code,
            ...info,
        }));
    }
    /**
     * Pobierz typy decyzji
     */
    getDecisionTypes() {
        return Object.entries(RIO_DECISION_TYPES).map(([code, name]) => ({
            code,
            name,
        }));
    }
    /**
     * Wyczyść cache
     */
    clearCache() {
        this.cache.clear();
    }
    // =========================================================================
    // Metody prywatne - scraping BIP RIO
    // =========================================================================
    async searchInChamber(rioCode, params) {
        const chamber = RIO_CHAMBERS[rioCode];
        if (!chamber)
            return [];
        try {
            // Buduj URL wyszukiwania (struktura zależy od konkretnego BIP RIO)
            const searchPath = params.decisionType === "rozstrzygniecie"
                ? "/rozstrzygniecia-nadzorcze"
                : "/uchwaly-kolegium";
            const url = new URL(`${chamber.url}${searchPath}`);
            if (params.query) {
                url.searchParams.set("q", params.query);
            }
            if (params.dateFrom) {
                url.searchParams.set("od", params.dateFrom);
            }
            if (params.dateTo) {
                url.searchParams.set("do", params.dateTo);
            }
            console.log(`[RIO API] Fetching from ${url.toString()}`);
            const response = await fetch(url.toString(), {
                headers: {
                    Accept: "text/html",
                    "User-Agent": "AAsystent-Radnego/1.0 (Legal Research Tool)",
                },
            });
            if (!response.ok) {
                console.warn(`[RIO API] Failed to fetch from ${rioCode}: ${response.status}`);
                return [];
            }
            const html = await response.text();
            return this.parseDecisionList(html, rioCode, params.limit || 20);
        }
        catch (error) {
            console.error(`[RIO API] Error fetching from ${rioCode}:`, error);
            return [];
        }
    }
    parseDecisionList(html, rioCode, limit) {
        const items = [];
        const chamber = RIO_CHAMBERS[rioCode];
        if (!chamber)
            return items;
        // Regex do parsowania listy decyzji (dostosuj do struktury BIP)
        const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i;
        const dateRegex = /(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})/;
        let match;
        while ((match = rowRegex.exec(html)) !== null && items.length < limit) {
            const row = match[1];
            const linkMatch = row.match(linkRegex);
            const dateMatch = row.match(dateRegex);
            if (linkMatch) {
                const href = linkMatch[1];
                const title = linkMatch[2].trim();
                // Wygeneruj ID
                const idMatch = href.match(/\/(\d+)/);
                const decisionId = idMatch ? idMatch[1] : `${Date.now()}`;
                items.push({
                    id: `${rioCode}:${decisionId}`,
                    rio: chamber.name,
                    rioCode,
                    decisionNumber: this.extractDecisionNumber(title),
                    decisionDate: dateMatch ? this.normalizeDate(dateMatch[1]) : "",
                    decisionType: this.detectDecisionType(title),
                    subject: title,
                    sourceUrl: href.startsWith("http") ? href : `${chamber.url}${href}`,
                });
            }
        }
        return items;
    }
    parseDecisionDetails(html, id, rioCode) {
        const chamber = RIO_CHAMBERS[rioCode];
        if (!chamber)
            return null;
        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
            html.match(/<title>([^<]+)<\/title>/i);
        const dateMatch = html.match(/Data[:\s]+(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})/i);
        const numberMatch = html.match(/Numer[:\s]+([^<\n]+)/i);
        const pdfMatch = html.match(/href="([^"]+\.pdf)"/i);
        if (!titleMatch)
            return null;
        return {
            id,
            rio: chamber.name,
            rioCode,
            decisionNumber: numberMatch ? numberMatch[1].trim() : "",
            decisionDate: dateMatch ? this.normalizeDate(dateMatch[1]) : "",
            decisionType: this.detectDecisionType(titleMatch[1]),
            subject: titleMatch[1].trim(),
            pdfUrl: pdfMatch
                ? pdfMatch[1].startsWith("http")
                    ? pdfMatch[1]
                    : `${chamber.url}${pdfMatch[1]}`
                : undefined,
            sourceUrl: `${chamber.url}/decyzja/${id.split(":")[1]}`,
        };
    }
    extractDecisionNumber(title) {
        const match = title.match(/(?:Nr|Numer|Uchwała|Rozstrzygnięcie)[:\s]*([^\s,]+)/i);
        return match ? match[1] : "";
    }
    detectDecisionType(text) {
        const lower = text.toLowerCase();
        if (lower.includes("rozstrzygnięci") || lower.includes("nadzorcz"))
            return "rozstrzygniecie";
        if (lower.includes("opini"))
            return "opinia";
        if (lower.includes("stanowisk") || lower.includes("wyjaśnieni"))
            return "stanowisko";
        return "uchwala";
    }
    normalizeDate(date) {
        // Konwertuj DD.MM.YYYY na YYYY-MM-DD
        if (date.includes(".")) {
            const parts = date.split(".");
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        return date;
    }
}
//# sourceMappingURL=rio-api-service.js.map