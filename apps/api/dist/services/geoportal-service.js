/**
 * Geoportal Service - Integracja z Geoportal.gov.pl
 * Dostęp do danych przestrzennych: działki, MPZP, granice administracyjne
 */
import axios from "axios";
import { XMLParser } from "fast-xml-parser";
const GEOPORTAL_SERVICES = {
    ULDK: "https://uldk.gugik.gov.pl",
    PRG: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries",
    BDOT_BUDYNKI: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/BDOT10k/WFS/StatystykiBudynkow",
    BDOT_DROGI: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/BDOT10k/WFS/StatystykiSieciKomunikacyjnej",
    BDOT_WODY: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/BDOT10k/WFS/StatystykiSieciWodnej",
    ADRESY: "https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej",
    PRNG: "https://mapy.geoportal.gov.pl/wss/service/PZGiK/PRNG/WFS/GeographicalNames",
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
            // ULDK API domyślnie używa EPSG:2180, dodajemy SRID=4326 dla WGS84
            const response = await this.httpClient.get(`${GEOPORTAL_SERVICES.ULDK}/`, {
                params: {
                    request: "GetParcelByXY",
                    xy: `${lon},${lat},4326`,
                    result: "teryt,voivodeship,county,commune,region,parcel",
                },
            });
            console.log(`[GeoportalService] ULDK response for ${lat},${lon}:`, typeof response.data === "string"
                ? response.data.substring(0, 100)
                : "not string");
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
     * Wyszukiwanie adresów - GUGIK geocoder z fallback na Nominatim (OpenStreetMap)
     */
    async searchAddress(query, limit = 10) {
        const cacheKey = `address:${query}:${limit}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        let results = [];
        // 1. Próbuj GUGIK geocoder (niestabilny, timeout 8s)
        try {
            console.log(`[GeoportalService] Trying GUGIK geocoder for: "${query}"`);
            const response = await this.httpClient.get("https://services.gugik.gov.pl/uug/", {
                params: {
                    request: "GetAddress",
                    address: query,
                },
                timeout: 8000, // 8s timeout
            });
            if (response.data?.results) {
                for (const item of Object.values(response.data.results).slice(0, limit)) {
                    const r = item;
                    results.push({
                        id: r.id || `gugik_${results.length}`,
                        street: r.street,
                        houseNumber: r.number,
                        postalCode: r.postcode,
                        city: r.city || r.locality,
                        voivodeship: r.voivodeship,
                        coordinates: {
                            lat: parseFloat(r.y),
                            lon: parseFloat(r.x),
                        },
                    });
                }
                console.log(`[GeoportalService] GUGIK returned ${results.length} results`);
            }
        }
        catch {
            console.warn("[GeoportalService] GUGIK geocoder timeout/error - trying Photon API fallback");
        }
        // 2. Fallback: Photon API (Komoot) - stabilny, bez limitu User-Agent
        if (results.length === 0) {
            try {
                console.log(`[GeoportalService] Trying Photon API for: "${query}"`);
                const photonResponse = await this.httpClient.get("https://photon.komoot.io/api/", {
                    params: {
                        q: query,
                        limit: limit,
                        lat: 52.0, // Centrum Polski dla lepszych wyników
                        lon: 19.0,
                    },
                    timeout: 10000,
                });
                if (photonResponse.data?.features &&
                    Array.isArray(photonResponse.data.features)) {
                    for (const feature of photonResponse.data.features) {
                        const props = feature.properties || {};
                        const coords = feature.geometry?.coordinates || [];
                        // Filtruj tylko wyniki z Polski
                        if (props.country === "Poland" || props.country === "Polska") {
                            results.push({
                                id: `photon_${props.osm_id || results.length}`,
                                street: props.street,
                                houseNumber: props.housenumber,
                                postalCode: props.postcode,
                                city: props.city || props.town || props.village || props.name,
                                voivodeship: props.state,
                                coordinates: {
                                    lat: coords[1],
                                    lon: coords[0],
                                },
                            });
                        }
                    }
                    console.log(`[GeoportalService] Photon returned ${results.length} results`);
                }
            }
            catch (photonError) {
                console.error("[GeoportalService] Photon also failed:", photonError);
            }
        }
        if (results.length > 0) {
            this.setCache(cacheKey, results);
        }
        return results;
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
                    TYPENAMES: "ms:A03_Granice_gmin",
                    CQL_FILTER: `JPT_KOD_JE='${code}'`,
                    OUTPUTFORMAT: "application/gml+xml; version=3.2",
                },
            });
            const features = this.parseGmlFeatures(response.data);
            if (features.length > 0) {
                const feature = features[0];
                const unit = {
                    id: feature.id,
                    name: feature.name || "",
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
        console.log(`[GeoportalService] searchMunicipalities called with: "${name}"`);
        const cacheKey = `municipalities:${name}`;
        const cached = this.getCached(cacheKey);
        if (cached) {
            console.log(`[GeoportalService] Returning cached result for: "${name}"`);
            return cached;
        }
        try {
            console.log(`[GeoportalService] Fetching from PRG WFS...`);
            const response = await this.httpClient.get(GEOPORTAL_SERVICES.PRG, {
                params: {
                    SERVICE: "WFS",
                    VERSION: "2.0.0",
                    REQUEST: "GetFeature",
                    TYPENAMES: "ms:A03_Granice_gmin",
                    CQL_FILTER: `JPT_NAZWA_ LIKE '%${name}%'`,
                    OUTPUTFORMAT: "application/gml+xml; version=3.2",
                    COUNT: 20,
                },
            });
            console.log(`[GeoportalService] PRG response received, data length: ${typeof response.data === "string" ? response.data.length : "not string"}`);
            const units = [];
            const features = this.parseGmlFeatures(response.data);
            console.log(`[GeoportalService] Parsed ${features.length} features from GML`);
            for (const feature of features) {
                units.push({
                    id: feature.id,
                    name: feature.name || "",
                    type: "municipality",
                    code: feature.code || "",
                });
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
            // Wyszukaj gminy (PRG WFS - stabilne)
            if (params.municipality || params.query) {
                results.units = await this.searchMunicipalities(params.municipality || params.query || "");
            }
            // GUGIK geocoder - próbuj wyszukać adresy (niestabilny, timeout 8s)
            if (params.address || params.query) {
                try {
                    results.addresses = await this.searchAddress(params.address || params.query || "", 10);
                }
                catch {
                    // Geocoder niestabilny - loguj warning
                    console.warn("[GeoportalService] GUGIK geocoder timeout - service unstable");
                }
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
    /**
     * Parsowanie odpowiedzi GML z WFS
     */
    parseGmlFeatures(gmlData) {
        try {
            console.log(`[GeoportalService] parseGmlFeatures called, input length: ${gmlData?.length || 0}`);
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: "@_",
                removeNSPrefix: true,
            });
            const parsed = parser.parse(gmlData);
            console.log(`[GeoportalService] XML parsed, keys: ${Object.keys(parsed).join(", ")}`);
            const features = [];
            // Nawigacja do featureMember/featureMembers
            const featureCollection = parsed.FeatureCollection || parsed;
            let members = featureCollection.featureMember ||
                featureCollection.member ||
                featureCollection.featureMembers;
            if (!members) {
                console.warn("[GeoportalService] No features found in GML response");
                return [];
            }
            // Normalizuj do tablicy
            if (!Array.isArray(members)) {
                members = [members];
            }
            for (const member of members) {
                // Szukaj A03_Granice_gmin wewnątrz member
                const feature = member.A03_Granice_gmin || member;
                if (feature) {
                    features.push({
                        id: feature["@_id"] || feature.id || "",
                        name: feature.JPT_NAZWA_ || feature.jpt_nazwa_ || "",
                        code: feature.JPT_KOD_JE || feature.jpt_kod_je || "",
                        geometry: feature.msGeometry || feature.geometry || undefined,
                    });
                }
            }
            return features;
        }
        catch (error) {
            console.error("[GeoportalService] Error parsing GML:", error);
            return [];
        }
    }
    /**
     * Pobierz statystyki budynków dla gminy (BDOT10k)
     */
    async getBuildingStats(terytCode) {
        const cacheKey = `bdot:buildings:${terytCode}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.httpClient.get(GEOPORTAL_SERVICES.BDOT_BUDYNKI, {
                params: {
                    SERVICE: "WFS",
                    VERSION: "2.0.0",
                    REQUEST: "GetFeature",
                    TYPENAMES: "ms:BDOT10k_BUBD_A",
                    CQL_FILTER: `TERYT LIKE '${terytCode}%'`,
                    OUTPUTFORMAT: "application/json",
                    COUNT: 1000,
                },
            });
            if (response.data?.features) {
                const features = response.data.features;
                const stats = {
                    totalBuildings: features.length,
                    residentialBuildings: features.filter((f) => f.properties?.X_KOD?.startsWith("BUBD01")).length,
                    commercialBuildings: features.filter((f) => f.properties?.X_KOD?.startsWith("BUBD02")).length,
                    industrialBuildings: features.filter((f) => f.properties?.X_KOD?.startsWith("BUBD03")).length,
                    publicBuildings: features.filter((f) => f.properties?.X_KOD?.startsWith("BUBD04")).length,
                };
                this.setCache(cacheKey, stats);
                return stats;
            }
            return null;
        }
        catch (error) {
            console.error("[GeoportalService] Error fetching building stats:", error);
            return null;
        }
    }
    /**
     * Wyszukaj działkę po nazwie obrębu i numerze
     */
    async getParcelByName(precinctName, parcelNumber) {
        const cacheKey = `parcel:name:${precinctName}:${parcelNumber}`;
        const cached = this.getCached(cacheKey);
        if (cached)
            return cached;
        try {
            const response = await this.httpClient.get(`${GEOPORTAL_SERVICES.ULDK}/`, {
                params: {
                    request: "GetParcelByIdOrNr",
                    id: `${precinctName} ${parcelNumber}`,
                    result: "teryt,voivodeship,county,commune,region,parcel",
                },
            });
            console.log(`[GeoportalService] ULDK response for ${precinctName} ${parcelNumber}:`, typeof response.data === "string"
                ? response.data.substring(0, 100)
                : "not string");
            if (response.data && !response.data.includes("-1")) {
                const lines = response.data.split("\n").filter((l) => l.trim());
                if (lines.length > 0) {
                    const parts = lines[0].split("|");
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
            }
            return null;
        }
        catch (error) {
            console.error("[GeoportalService] Error fetching parcel by name:", error);
            return null;
        }
    }
}
//# sourceMappingURL=geoportal-service.js.map