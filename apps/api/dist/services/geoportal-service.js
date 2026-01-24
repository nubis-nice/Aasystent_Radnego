/**
 * Geoportal Service - Integracja z Geoportal.gov.pl
 * Dostęp do danych przestrzennych: działki, MPZP, granice administracyjne
 */
import axios from "axios";
const GEOPORTAL_SERVICES = {
    ULDK: "https://uldk.gugik.gov.pl",
    PRG: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries",
    BDOT: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/BDOT/WFS/Topographic",
    EMUiA: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/EMUiA/WFS/Addresses",
    MPZP: "https://integracja.gugik.gov.pl/cgi-bin/KraijsowaBazaMPZP",
    ORTHOPHOTO: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution",
};
export class GeoportalService {
    httpClient;
    cache = new Map();
    cacheTTL = 3600000; // 1 hour
    constructor() {
        this.httpClient = axios.create({
            timeout: 30000,
            headers: {
                "User-Agent": "AsystentRadnego/1.0",
                Accept: "application/json, application/xml, text/xml",
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
    /**
     * Wyszukiwanie działki po identyfikatorze (ULDK API)
     */
    async getParcelById(parcelId) {
        const cacheKey = `parcel:${parcelId}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.httpClient.get(`${GEOPORTAL_SERVICES.ULDK}/`, {
                params: {
                    request: "GetParcelById",
                    id: parcelId,
                    result: "teryt,voivodeship,county,commune,region,parcel,geom_wkt",
                },
            });
            if (response.data && response.data !== "-1") {
                const parts = response.data.split("|");
                const parcel = {
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
        }
        catch (error) {
            console.error("[GeoportalService] Error fetching parcel:", error);
            return null;
        }
    }
    /**
     * Wyszukiwanie działki po współrzędnych
     */
    async getParcelByCoordinates(lat, lon) {
        const cacheKey = `parcel:coords:${lat}:${lon}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.httpClient.get(`${GEOPORTAL_SERVICES.ULDK}/`, {
                params: {
                    request: "GetParcelByXY",
                    xy: `${lon},${lat}`,
                    result: "teryt,voivodeship,county,commune,region,parcel,geom_wkt",
                },
            });
            if (response.data && response.data !== "-1") {
                const parts = response.data.split("|");
                const parcel = {
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
        }
        catch (error) {
            console.error("[GeoportalService] Error fetching parcel by coordinates:", error);
            return null;
        }
    }
    /**
     * Wyszukiwanie adresów (EMUiA)
     */
    async searchAddress(query, limit = 10) {
        const cacheKey = `address:${query}:${limit}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            // Użycie GUGIK geocoder API
            const response = await this.httpClient.get("https://services.gugik.gov.pl/uug/", {
                params: {
                    request: "GetAddress",
                    address: query,
                },
            });
            const results = [];
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
        }
        catch (error) {
            console.error("[GeoportalService] Error searching address:", error);
            return [];
        }
    }
    /**
     * Pobieranie granic jednostki administracyjnej (PRG WFS)
     */
    async getAdministrativeUnit(code) {
        const cacheKey = `admin:${code}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.httpClient.get(GEOPORTAL_SERVICES.PRG, {
                params: {
                    SERVICE: "WFS",
                    VERSION: "2.0.0",
                    REQUEST: "GetFeature",
                    TYPENAMES: "A03_Gminy",
                    CQL_FILTER: `JPT_KOD_JE='${code}'`,
                    OUTPUTFORMAT: "application/json",
                },
            });
            if (response.data?.features?.length > 0) {
                const feature = response.data.features[0];
                const unit = {
                    id: feature.id,
                    name: feature.properties?.JPT_NAZWA_ || "",
                    type: this.getUnitType(code),
                    code: code,
                    geometry: feature.geometry,
                };
                this.setCache(cacheKey, unit);
                return unit;
            }
            return null;
        }
        catch (error) {
            console.error("[GeoportalService] Error fetching administrative unit:", error);
            return null;
        }
    }
    /**
     * Wyszukiwanie gmin po nazwie
     */
    async searchMunicipalities(name) {
        const cacheKey = `municipalities:${name}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.httpClient.get(GEOPORTAL_SERVICES.PRG, {
                params: {
                    SERVICE: "WFS",
                    VERSION: "2.0.0",
                    REQUEST: "GetFeature",
                    TYPENAMES: "A03_Gminy",
                    CQL_FILTER: `JPT_NAZWA_ LIKE '%${name}%'`,
                    OUTPUTFORMAT: "application/json",
                    COUNT: 20,
                },
            });
            const units = [];
            if (response.data?.features) {
                for (const feature of response.data.features) {
                    units.push({
                        id: feature.id,
                        name: feature.properties?.JPT_NAZWA_ || "",
                        type: "municipality",
                        code: feature.properties?.JPT_KOD_JE || "",
                    });
                }
            }
            this.setCache(cacheKey, units);
            return units;
        }
        catch (error) {
            console.error("[GeoportalService] Error searching municipalities:", error);
            return [];
        }
    }
    /**
     * Informacje o MPZP dla lokalizacji
     */
    async getSpatialPlanInfo(lat, lon) {
        const cacheKey = `mpzp:${lat}:${lon}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            // Najpierw znajdź działkę
            const parcel = await this.getParcelByCoordinates(lat, lon);
            if (!parcel)
                return [];
            // Mock - w rzeczywistości należałoby odpytać serwis MPZP
            const plans = [
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
        }
        catch (error) {
            console.error("[GeoportalService] Error fetching spatial plan:", error);
            return [];
        }
    }
    /**
     * Uniwersalne wyszukiwanie danych przestrzennych
     */
    async search(params) {
        const results = {
            parcels: [],
            addresses: [],
            units: [],
        };
        try {
            // Wyszukaj po ID działki
            if (params.parcelId) {
                const parcel = await this.getParcelById(params.parcelId);
                if (parcel)
                    results.parcels.push(parcel);
            }
            // Wyszukaj po współrzędnych
            if (params.coordinates) {
                const parcel = await this.getParcelByCoordinates(params.coordinates.lat, params.coordinates.lon);
                if (parcel)
                    results.parcels.push(parcel);
            }
            // Wyszukaj adresy
            if (params.address || params.query) {
                results.addresses = await this.searchAddress(params.address || params.query || "", 10);
            }
            // Wyszukaj gminy
            if (params.municipality || params.query) {
                results.units = await this.searchMunicipalities(params.municipality || params.query || "");
            }
        }
        catch (error) {
            console.error("[GeoportalService] Search error:", error);
        }
        return results;
    }
    /**
     * Pobranie URL do mapy ortofoto dla lokalizacji
     */
    getOrthophotoUrl(lat, lon, zoom = 15) {
        return `https://mapy.geoportal.gov.pl/imap/Imgp_2.html?centerX=${lon}&centerY=${lat}&scale=${zoom}`;
    }
    /**
     * Pobranie linku do Geoportalu dla działki
     */
    getGeoportalLink(parcelId) {
        return `https://mapy.geoportal.gov.pl/imap/Imgp_2.html?identifyParcel=${parcelId}`;
    }
    getUnitType(code) {
        if (code.length === 2)
            return "voivodeship";
        if (code.length === 4)
            return "county";
        if (code.length === 7)
            return "municipality";
        return "city";
    }
}
//# sourceMappingURL=geoportal-service.js.map