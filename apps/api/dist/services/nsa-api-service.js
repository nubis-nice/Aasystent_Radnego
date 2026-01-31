/**
 * NSA/WSA API Service
 * Obsługa Centralnej Bazy Orzeczeń Sądów Administracyjnych (CBOSA)
 * URL: https://orzeczenia.nsa.gov.pl
 *
 * UWAGA: CBOSA nie ma publicznego REST API - używamy web scrapingu
 */
// Kody sądów administracyjnych
export const NSA_COURTS = {
    NSA: "Naczelny Sąd Administracyjny",
    Bi: "WSA w Białymstoku",
    Bd: "WSA w Bydgoszczy",
    Gd: "WSA w Gdańsku",
    Gl: "WSA w Gliwicach",
    Go: "WSA w Gorzowie Wlkp.",
    Ki: "WSA w Kielcach",
    Kr: "WSA w Krakowie",
    Lu: "WSA w Lublinie",
    Łd: "WSA w Łodzi",
    Ol: "WSA w Olsztynie",
    Op: "WSA w Opolu",
    Po: "WSA w Poznaniu",
    Rz: "WSA w Rzeszowie",
    Sz: "WSA w Szczecinie",
    Wa: "WSA w Warszawie",
    Wr: "WSA w Wrocławiu",
};
// Symbole spraw administracyjnych
export const NSA_CASE_SYMBOLS = {
    "6010": "Miejscowy plan zagospodarowania przestrzennego",
    "6012": "Prawo budowlane",
    "6014": "Ochrona środowiska",
    "6110": "Sprawy o odszkodowanie",
    "6112": "Podatek dochodowy od osób prawnych",
    "6113": "Podatek dochodowy od osób fizycznych",
    "6114": "Podatek od towarów i usług (VAT)",
    "6117": "Podatek od nieruchomości",
    "6320": "Zatrudnienie i bezrobocie",
    "6329": "Pomoc społeczna",
};
export class NSAApiService {
    baseUrl = "https://orzeczenia.nsa.gov.pl";
    searchUrl = `${this.baseUrl}/cbo/find`;
    cacheEnabled = true;
    cacheTTL = 3600000; // 1 godzina
    cache = new Map();
    constructor() { }
    /**
     * Wyszukaj orzeczenia w CBOSA
     * UWAGA: Używa web scrapingu - może wymagać aktualizacji przy zmianach strony
     */
    async searchJudgments(params) {
        const cacheKey = `search:${JSON.stringify(params)}`;
        if (this.cacheEnabled) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.data;
            }
        }
        const formData = this.buildFormData(params);
        console.log(`[NSA API] Search request with params:`, params);
        try {
            const response = await fetch(this.searchUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Accept: "text/html,application/xhtml+xml",
                    "User-Agent": "AAsystent-Radnego/1.0 (Legal Research Tool)",
                },
                body: formData,
            });
            if (!response.ok) {
                throw new Error(`NSA search failed: ${response.status} ${response.statusText}`);
            }
            const html = await response.text();
            const result = this.parseSearchResults(html, params.limit || 20, params.offset || 0);
            if (this.cacheEnabled) {
                this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            }
            return result;
        }
        catch (error) {
            console.error("[NSA API] Search error:", error);
            throw error;
        }
    }
    /**
     * Pobierz szczegóły orzeczenia
     */
    async getJudgmentDetails(id) {
        const cacheKey = `judgment:${id}`;
        if (this.cacheEnabled) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.data;
            }
        }
        try {
            const url = `${this.baseUrl}/doc/${id}`;
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
            const judgment = this.parseJudgmentDetails(html, id);
            if (this.cacheEnabled && judgment) {
                this.cache.set(cacheKey, { data: judgment, timestamp: Date.now() });
            }
            return judgment;
        }
        catch (error) {
            console.error(`[NSA API] Error fetching judgment ${id}:`, error);
            return null;
        }
    }
    /**
     * Wyszukaj orzeczenia dotyczące samorządu
     */
    async searchLocalGovernmentJudgments(topic, limit = 20) {
        const samorządKeywords = [
            "gmina",
            "rada gminy",
            "wójt",
            "burmistrz",
            "uchwała",
            "miejscowy plan",
            "podatek od nieruchomości",
        ];
        const query = topic
            ? `${topic} ${samorządKeywords.slice(0, 2).join(" ")}`
            : samorządKeywords.join(" ");
        const result = await this.searchJudgments({
            query,
            isFinal: true,
            limit,
        });
        return result.items;
    }
    /**
     * Wyszukaj orzeczenia po sygnaturze
     */
    async searchBySignature(signature) {
        const result = await this.searchJudgments({
            signature,
            limit: 10,
        });
        return result.items;
    }
    /**
     * Pobierz listę dostępnych sądów
     */
    getCourts() {
        return Object.entries(NSA_COURTS).map(([code, name]) => ({ code, name }));
    }
    /**
     * Pobierz listę symboli spraw
     */
    getCaseSymbols() {
        return Object.entries(NSA_CASE_SYMBOLS).map(([code, name]) => ({
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
    // Metody prywatne - parsowanie HTML
    // =========================================================================
    buildFormData(params) {
        const data = {};
        if (params.query)
            data["p1_wszystkie"] = params.query;
        if (params.signature)
            data["p2_sygnatura"] = params.signature;
        if (params.court)
            data["p5_sad"] = params.court;
        if (params.judgmentType)
            data["p6_rodzaj"] = params.judgmentType;
        if (params.caseSymbol)
            data["p7_symbole"] = params.caseSymbol;
        if (params.dateFrom)
            data["p8_data_orzeczenia_od"] = params.dateFrom;
        if (params.dateTo)
            data["p8_data_orzeczenia_do"] = params.dateTo;
        if (params.judge)
            data["p9_sedziowie"] = params.judge;
        if (params.withThesis)
            data["p13_z_tezami"] = "1";
        if (params.withJustification)
            data["p14_z_uzasadnieniem"] = "1";
        if (params.isFinal)
            data["p11_s_prawomocne"] = "1";
        // Pagination
        data["p_start"] = String(params.offset || 0);
        data["p_limit"] = String(params.limit || 20);
        return new URLSearchParams(data).toString();
    }
    parseSearchResults(html, limit, offset) {
        const items = [];
        let totalCount = 0;
        // Parsuj liczbę wyników
        const countMatch = html.match(/Znaleziono[:\s]+(\d+)/i);
        if (countMatch) {
            totalCount = parseInt(countMatch[1], 10);
        }
        // Parsuj wyniki (regex dla podstawowej struktury CBOSA)
        const rowRegex = /<tr[^>]*class="[^"]*orzeczenie[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
        const signatureRegex = /<a[^>]*href="[^"]*\/doc\/([^"]+)"[^>]*>([^<]+)<\/a>/i;
        const dateRegex = /(\d{4}-\d{2}-\d{2})/;
        const courtRegex = /(?:WSA|NSA)[^<]*/i;
        let match;
        while ((match = rowRegex.exec(html)) !== null && items.length < limit) {
            const row = match[1];
            const sigMatch = row.match(signatureRegex);
            const dateMatch = row.match(dateRegex);
            const courtMatch = row.match(courtRegex);
            if (sigMatch) {
                const id = sigMatch[1];
                const signature = sigMatch[2].trim();
                items.push({
                    id,
                    signature,
                    court: courtMatch ? courtMatch[0].trim() : "Nieznany",
                    courtCode: this.extractCourtCode(signature),
                    judgmentDate: dateMatch ? dateMatch[1] : "",
                    judgmentType: this.extractJudgmentType(row),
                    caseSymbol: this.extractCaseSymbol(row),
                    hasJustification: row.includes("uzasadnienie") || row.includes("Uzasadnienie"),
                    isFinal: row.includes("prawomocne") || row.includes("Prawomocne"),
                    url: `${this.baseUrl}/doc/${id}`,
                });
            }
        }
        return {
            count: items.length,
            totalCount,
            offset,
            items,
        };
    }
    parseJudgmentDetails(html, id) {
        // Ekstrakcja podstawowych danych z HTML orzeczenia
        const signatureMatch = html.match(/Sygnatura[:\s]+([^<]+)/i);
        const dateMatch = html.match(/Data orzeczenia[:\s]+(\d{4}-\d{2}-\d{2})/i);
        const courtMatch = html.match(/(Naczelny Sąd Administracyjny|Wojewódzki Sąd Administracyjny[^<]*)/i);
        const typeMatch = html.match(/(Wyrok|Postanowienie|Uchwała)/i);
        const thesisMatch = html.match(/Teza[:\s]+([\s\S]*?)(?=<\/div>|<\/p>)/i);
        if (!signatureMatch)
            return null;
        const signature = signatureMatch[1].trim();
        return {
            id,
            signature,
            court: courtMatch ? courtMatch[1].trim() : "Nieznany",
            courtCode: this.extractCourtCode(signature),
            judgmentDate: dateMatch ? dateMatch[1] : "",
            judgmentType: typeMatch ? typeMatch[1] : "Nieznany",
            caseSymbol: this.extractCaseSymbol(html),
            thesis: thesisMatch ? thesisMatch[1].trim().substring(0, 500) : undefined,
            hasJustification: html.includes("UZASADNIENIE") || html.includes("Uzasadnienie"),
            isFinal: html.includes("prawomocn"),
            url: `${this.baseUrl}/doc/${id}`,
        };
    }
    extractCourtCode(signature) {
        // Format sygnatury: "II SA/Wa 1234/23" -> "Wa"
        const match = signature.match(/\/([A-Za-zł]+)\s/);
        return match ? match[1] : "";
    }
    extractJudgmentType(html) {
        if (html.includes("Wyrok"))
            return "Wyrok";
        if (html.includes("Postanowienie"))
            return "Postanowienie";
        if (html.includes("Uchwała"))
            return "Uchwała";
        return "Inne";
    }
    extractCaseSymbol(html) {
        const match = html.match(/Symbol[:\s]+(\d{4})/i);
        return match ? match[1] : "";
    }
}
//# sourceMappingURL=nsa-api-service.js.map