import axios from "axios";
export class TerytService {
    client;
    cache = new Map();
    cacheTTL = 86400000; // 24h - dane TERYT rzadko się zmieniają
    // API GUS TERYT (publiczne)
    BASE_URL = "https://api-teryt.stat.gov.pl/api";
    // Alternatywne źródło - dane otwarte
    OPEN_DATA_URL = "https://danepubliczne.gov.pl/api/3/action";
    constructor() {
        this.client = axios.create({
            timeout: 15000,
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
    async getVoivodeships() {
        const cacheKey = "voivodeships";
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            // Lista województw z API TERYT
            const response = await this.client.get(`${this.BASE_URL}/terc/wojewodztwa`);
            const units = response.data.map((item) => ({
                id: String(item.WOJ),
                name: String(item.NAZWA),
                type: "voivodeship",
                code: String(item.WOJ).padStart(2, "0"),
            }));
            this.setCache(cacheKey, units);
            return units;
        }
        catch (error) {
            console.error("Error fetching voivodeships:", error);
            return this.getVoivodeshipsStatic();
        }
    }
    getVoivodeshipsStatic() {
        return [
            { id: "02", name: "DOLNOŚLĄSKIE", type: "voivodeship", code: "02" },
            { id: "04", name: "KUJAWSKO-POMORSKIE", type: "voivodeship", code: "04" },
            { id: "06", name: "LUBELSKIE", type: "voivodeship", code: "06" },
            { id: "08", name: "LUBUSKIE", type: "voivodeship", code: "08" },
            { id: "10", name: "ŁÓDZKIE", type: "voivodeship", code: "10" },
            { id: "12", name: "MAŁOPOLSKIE", type: "voivodeship", code: "12" },
            { id: "14", name: "MAZOWIECKIE", type: "voivodeship", code: "14" },
            { id: "16", name: "OPOLSKIE", type: "voivodeship", code: "16" },
            { id: "18", name: "PODKARPACKIE", type: "voivodeship", code: "18" },
            { id: "20", name: "PODLASKIE", type: "voivodeship", code: "20" },
            { id: "22", name: "POMORSKIE", type: "voivodeship", code: "22" },
            { id: "24", name: "ŚLĄSKIE", type: "voivodeship", code: "24" },
            { id: "26", name: "ŚWIĘTOKRZYSKIE", type: "voivodeship", code: "26" },
            {
                id: "28",
                name: "WARMIŃSKO-MAZURSKIE",
                type: "voivodeship",
                code: "28",
            },
            { id: "30", name: "WIELKOPOLSKIE", type: "voivodeship", code: "30" },
            { id: "32", name: "ZACHODNIOPOMORSKIE", type: "voivodeship", code: "32" },
        ];
    }
    async getCounties(voivodeshipId) {
        const cacheKey = `counties_${voivodeshipId}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.client.get(`${this.BASE_URL}/terc/powiaty/${voivodeshipId}`);
            const units = response.data.map((item) => ({
                id: `${voivodeshipId}${String(item.POW).padStart(2, "0")}`,
                name: String(item.NAZWA),
                type: "county",
                parentId: voivodeshipId,
                code: `${voivodeshipId}${String(item.POW).padStart(2, "0")}`,
            }));
            this.setCache(cacheKey, units);
            return units;
        }
        catch (error) {
            console.error("Error fetching counties:", error);
            return [];
        }
    }
    async getMunicipalities(countyId) {
        const cacheKey = `municipalities_${countyId}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const voivodeshipId = countyId.substring(0, 2);
            const powId = countyId.substring(2, 4);
            const response = await this.client.get(`${this.BASE_URL}/terc/gminy/${voivodeshipId}/${powId}`);
            const units = response.data.map((item) => ({
                id: `${countyId}${String(item.GMI).padStart(2, "0")}${item.RODZ}`,
                name: String(item.NAZWA),
                type: this.getMunicipalityType(String(item.RODZ)),
                parentId: countyId,
                code: `${countyId}${String(item.GMI).padStart(2, "0")}${item.RODZ}`,
            }));
            this.setCache(cacheKey, units);
            return units;
        }
        catch (error) {
            console.error("Error fetching municipalities:", error);
            return [];
        }
    }
    getMunicipalityType(rodz) {
        switch (rodz) {
            case "1":
                return "city";
            case "2":
                return "village";
            case "3":
                return "municipality";
            default:
                return "municipality";
        }
    }
    async searchUnits(query, limit = 20) {
        const cacheKey = `search_units_${query}_${limit}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.client.get(`${this.BASE_URL}/terc/szukaj/${encodeURIComponent(query)}`, { params: { limit } });
            const units = response.data.map((item) => ({
                id: String(item.ID),
                name: String(item.NAZWA),
                type: this.inferUnitType(String(item.ID)),
                code: String(item.ID),
            }));
            this.setCache(cacheKey, units);
            return units;
        }
        catch (error) {
            console.error("Error searching units:", error);
            // Fallback - szukaj w statycznych województwach
            const voivodeships = this.getVoivodeshipsStatic();
            return voivodeships.filter((v) => v.name.toLowerCase().includes(query.toLowerCase()));
        }
    }
    inferUnitType(id) {
        if (id.length === 2)
            return "voivodeship";
        if (id.length === 4)
            return "county";
        return "municipality";
    }
    async getStreets(municipalityId) {
        const cacheKey = `streets_${municipalityId}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.client.get(`${this.BASE_URL}/simc/ulice/${municipalityId}`);
            const streets = response.data.map((item) => ({
                id: String(item.SYM_UL),
                name: String(item.NAZWA_1),
                prefix: item.CECHA ? String(item.CECHA) : undefined,
                municipalityId,
                municipalityName: String(item.NAZWA_MIEJSC || ""),
            }));
            this.setCache(cacheKey, streets);
            return streets;
        }
        catch (error) {
            console.error("Error fetching streets:", error);
            return [];
        }
    }
    async searchStreets(query, municipalityId) {
        const cacheKey = `search_streets_${query}_${municipalityId || "all"}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const params = { nazwa: query };
            if (municipalityId)
                params.sym = municipalityId;
            const response = await this.client.get(`${this.BASE_URL}/simc/ulice/szukaj`, { params });
            const streets = response.data.map((item) => ({
                id: String(item.SYM_UL),
                name: String(item.NAZWA_1),
                prefix: item.CECHA ? String(item.CECHA) : undefined,
                municipalityId: String(item.SYM),
                municipalityName: String(item.NAZWA_MIEJSC || ""),
            }));
            this.setCache(cacheKey, streets);
            return streets;
        }
        catch (error) {
            console.error("Error searching streets:", error);
            return [];
        }
    }
    async getUnitByCode(code) {
        const cacheKey = `unit_${code}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.client.get(`${this.BASE_URL}/terc/jednostka/${code}`);
            if (!response.data)
                return null;
            const unit = {
                id: String(response.data.ID || code),
                name: String(response.data.NAZWA),
                type: this.inferUnitType(code),
                code,
                parentId: code.length > 2 ? code.substring(0, code.length - 2) : undefined,
            };
            this.setCache(cacheKey, unit);
            return unit;
        }
        catch (error) {
            console.error("Error fetching unit by code:", error);
            return null;
        }
    }
    async getUnitHierarchy(code) {
        const hierarchy = [];
        let currentCode = code;
        while (currentCode.length >= 2) {
            const unit = await this.getUnitByCode(currentCode);
            if (unit) {
                hierarchy.unshift(unit);
            }
            currentCode = currentCode.substring(0, currentCode.length - 2);
        }
        return hierarchy;
    }
    async search(options) {
        const { query, type, limit = 20 } = options;
        const results = {
            units: [],
            streets: [],
        };
        if (!type || type === "unit") {
            results.units = await this.searchUnits(query, limit);
        }
        if (!type || type === "street") {
            results.streets = await this.searchStreets(query);
        }
        return results;
    }
    getUnitTypeLabel(type) {
        const labels = {
            voivodeship: "Województwo",
            county: "Powiat",
            municipality: "Gmina",
            city: "Miasto",
            village: "Wieś",
        };
        return labels[type] || type;
    }
}
//# sourceMappingURL=teryt-service.js.map