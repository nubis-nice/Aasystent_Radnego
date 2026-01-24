import axios from "axios";
export class KrsService {
    client;
    cache = new Map();
    cacheTTL = 3600000; // 1h
    // API KRS (dane.gov.pl)
    BASE_URL = "https://api-krs.ms.gov.pl/api/krs";
    // Alternatywne API (rejestr.io)
    ALT_URL = "https://rejestr.io/api/v2";
    constructor() {
        this.client = axios.create({
            timeout: 20000,
            headers: {
                Accept: "application/json",
                "User-Agent": "AsystentRadnego/1.0",
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
    async getByKrs(krsNumber) {
        const normalizedKrs = krsNumber.replace(/\D/g, "").padStart(10, "0");
        const cacheKey = `krs_${normalizedKrs}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.client.get(`${this.BASE_URL}/OdsijeczJednostki/${normalizedKrs}`);
            const entity = this.parseKrsResponse(response.data);
            if (entity) {
                this.setCache(cacheKey, entity);
            }
            return entity;
        }
        catch (error) {
            console.error("Error fetching KRS entity:", error);
            return this.getByKrsAlternative(normalizedKrs);
        }
    }
    async getByKrsAlternative(krsNumber) {
        try {
            const response = await this.client.get(`${this.ALT_URL}/krs/${krsNumber}`);
            return this.parseAltResponse(response.data);
        }
        catch (error) {
            console.error("Error fetching from alternative API:", error);
            return null;
        }
    }
    async getByNip(nip) {
        const normalizedNip = nip.replace(/\D/g, "");
        const cacheKey = `nip_${normalizedNip}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.client.get(`${this.BASE_URL}/OdpisAktualny/nip/${normalizedNip}`);
            const entity = this.parseKrsResponse(response.data);
            if (entity) {
                this.setCache(cacheKey, entity);
            }
            return entity;
        }
        catch (error) {
            console.error("Error fetching by NIP:", error);
            return null;
        }
    }
    async getByRegon(regon) {
        const normalizedRegon = regon.replace(/\D/g, "");
        const cacheKey = `regon_${normalizedRegon}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.client.get(`${this.BASE_URL}/OdpisAktualny/regon/${normalizedRegon}`);
            const entity = this.parseKrsResponse(response.data);
            if (entity) {
                this.setCache(cacheKey, entity);
            }
            return entity;
        }
        catch (error) {
            console.error("Error fetching by REGON:", error);
            return null;
        }
    }
    async search(options) {
        const { name, krs, nip, regon, page = 1, limit = 20 } = options;
        const cacheKey = `search_${JSON.stringify(options)}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
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
                const result = {
                    entities: (response.data.items || [])
                        .map((item) => this.parseKrsResponse(item))
                        .filter(Boolean),
                    totalCount: response.data.totalCount || 0,
                    page,
                    pageSize: limit,
                };
                this.setCache(cacheKey, result);
                return result;
            }
            catch (error) {
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
    async getRepresentatives(krsNumber) {
        const entity = await this.getByKrs(krsNumber);
        return entity?.representatives || [];
    }
    async getPkdCodes(krsNumber) {
        const entity = await this.getByKrs(krsNumber);
        return entity?.pkd || [];
    }
    parseKrsResponse(data) {
        if (!data)
            return null;
        try {
            const odpis = data.odpis || data;
            const dane = odpis.dane || odpis;
            const dzial1 = dane.dzial1 || {};
            const dzial2 = dane.dzial2 || {};
            const danePodmiotu = dzial1.danePodmiotu || {};
            const siedziba = dzial1.siedzibaIAdres || {};
            const kapital = dzial1.kapital || {};
            const organReprezentacji = dzial2.organReprezentacji || {};
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
                pkd: this.parsePkd(dzial1.przedmiotDzialalnosci || []),
                representatives: this.parseRepresentatives(organReprezentacji),
            };
        }
        catch (error) {
            console.error("Error parsing KRS response:", error);
            return null;
        }
    }
    parseAltResponse(data) {
        if (!data)
            return null;
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
        }
        catch (error) {
            console.error("Error parsing alternative response:", error);
            return null;
        }
    }
    parseStatus(status) {
        const statusLower = status.toLowerCase();
        if (statusLower.includes("aktywn") || statusLower.includes("active"))
            return "active";
        if (statusLower.includes("likwidac"))
            return "liquidation";
        if (statusLower.includes("wykreśl") || statusLower.includes("deleted"))
            return "deleted";
        return "unknown";
    }
    parsePkd(przedmiot) {
        if (!Array.isArray(przedmiot))
            return [];
        return przedmiot
            .map((p) => String(p.kodPKD || p.kod || ""))
            .filter(Boolean);
    }
    parseRepresentatives(organ) {
        const sklad = organ.sklad || [];
        if (!Array.isArray(sklad))
            return [];
        return sklad.map((osoba) => ({
            firstName: String(osoba.imie || osoba.imiona || ""),
            lastName: String(osoba.nazwisko || ""),
            function: String(osoba.funkcja || ""),
            pesel: osoba.pesel ? String(osoba.pesel) : undefined,
        }));
    }
    getStatusLabel(status) {
        const labels = {
            active: "Aktywny",
            liquidation: "W likwidacji",
            deleted: "Wykreślony",
            unknown: "Nieznany",
        };
        return labels[status];
    }
}
//# sourceMappingURL=krs-service.js.map