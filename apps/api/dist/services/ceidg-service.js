import axios from "axios";
export class CeidgService {
    client;
    cache = new Map();
    cacheTTL = 3600000; // 1h
    apiKey;
    // API CEIDG (dane.biznes.gov.pl)
    BASE_URL = "https://dane.biznes.gov.pl/api/ceidg/v2";
    constructor(apiKey) {
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
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        return null;
    }
    setCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }
    async getByNip(nip) {
        const normalizedNip = nip.replace(/\D/g, "");
        const cacheKey = `ceidg_nip_${normalizedNip}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
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
        }
        catch (error) {
            console.error("Error fetching CEIDG by NIP:", error);
            return null;
        }
    }
    async getByRegon(regon) {
        const normalizedRegon = regon.replace(/\D/g, "");
        const cacheKey = `ceidg_regon_${normalizedRegon}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
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
        }
        catch (error) {
            console.error("Error fetching CEIDG by REGON:", error);
            return null;
        }
    }
    async search(options) {
        const { nip, regon, name, firstName, lastName, city, pkd, page = 1, limit = 20, } = options;
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
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const params = {
                strona: page,
                limit,
            };
            if (name)
                params.nazwa = name;
            if (firstName)
                params.imie = firstName;
            if (lastName)
                params.nazwisko = lastName;
            if (city)
                params.miejscowosc = city;
            if (pkd)
                params.pkd = pkd;
            const response = await this.client.get(`${this.BASE_URL}/firmy`, {
                params,
            });
            const result = {
                entries: (response.data.firmy || []).map((item) => this.parseEntry(item)),
                totalCount: response.data.dataCount || 0,
                page,
                pageSize: limit,
            };
            this.setCache(cacheKey, result);
            return result;
        }
        catch (error) {
            console.error("Error searching CEIDG:", error);
            return {
                entries: [],
                totalCount: 0,
                page,
                pageSize: limit,
            };
        }
    }
    async getByCity(city, page = 1, limit = 20) {
        return this.search({ city, page, limit });
    }
    async getByPkd(pkdCode, page = 1, limit = 20) {
        return this.search({ pkd: pkdCode, page, limit });
    }
    async checkStatus(nip) {
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
    getStatusDetails(entry) {
        switch (entry.status) {
            case "active":
                return `Działalność aktywna od ${entry.registrationDate || "nieznana data"}`;
            case "suspended":
                return `Działalność zawieszona od ${entry.suspensionDate || "nieznana data"}`;
            case "terminated":
                return `Działalność zakończona ${entry.terminationDate || "nieznana data"}`;
            default:
                return "Status nieznany";
        }
    }
    parseEntry(data) {
        const adres = data.adresDzialalnosci || {};
        const adresKoresp = data.adresKorespondencyjny || {};
        const wlasciciel = data.wlasciciel || {};
        const pkdList = data.pkd || [];
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
    parseStatus(status) {
        const statusLower = status.toLowerCase();
        if (statusLower.includes("aktywn") || statusLower.includes("active"))
            return "active";
        if (statusLower.includes("zawieszon") || statusLower.includes("suspend"))
            return "suspended";
        if (statusLower.includes("zakończ") || statusLower.includes("terminat"))
            return "terminated";
        return "unknown";
    }
    getStatusLabel(status) {
        const labels = {
            active: "Aktywna",
            suspended: "Zawieszona",
            terminated: "Zakończona",
            unknown: "Nieznany",
        };
        return labels[status];
    }
}
//# sourceMappingURL=ceidg-service.js.map