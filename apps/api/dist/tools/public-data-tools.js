/**
 * Narzędzia do publicznych danych - ISAP, Geoportal, TERYT, KRS, CEIDG, GDOŚ, EU Funds
 */
import { ISAPApiService } from "../services/isap-api-service.js";
import { GeoportalService } from "../services/geoportal-service.js";
import { TerytService } from "../services/teryt-service.js";
import { KrsService } from "../services/krs-service.js";
import { CeidgService } from "../services/ceidg-service.js";
import { GdosService } from "../services/gdos-service.js";
import { EUFundsService } from "../services/eu-funds-service.js";
// ISAP - Akty prawne
export const isapLegalTool = {
    name: "isap_legal",
    description: "Wyszukuje akty prawne w ISAP (Internetowy System Aktów Prawnych) - ustawy, rozporządzenia, dziennik ustaw",
    category: "public_data",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Fraza wyszukiwania - tytuł ustawy, temat, słowa kluczowe",
            },
            type: {
                type: "string",
                description: "Typ aktu prawnego",
                enum: ["ustawa", "rozporządzenie", "obwieszczenie", "wszystkie"],
            },
        },
        required: ["query"],
    },
    execute: async (args) => {
        const startTime = Date.now();
        const query = args.query;
        try {
            const isapService = new ISAPApiService();
            const acts = await isapService.searchByTitle(query, undefined, 15);
            if (acts.length === 0) {
                const localGovActs = await isapService.searchLocalGovernmentActs(query, 15);
                return {
                    success: true,
                    data: {
                        type: "local_government_acts",
                        query,
                        count: localGovActs.length,
                        acts: localGovActs,
                    },
                    metadata: { source: "ISAP", executionTimeMs: Date.now() - startTime },
                };
            }
            return {
                success: true,
                data: { type: "search_results", query, count: acts.length, acts },
                metadata: { source: "ISAP", executionTimeMs: Date.now() - startTime },
            };
        }
        catch (error) {
            return {
                success: false,
                error: String(error),
                metadata: { source: "ISAP", executionTimeMs: Date.now() - startTime },
            };
        }
    },
};
// Geoportal - Dane przestrzenne
export const geoportalTool = {
    name: "geoportal_spatial",
    description: "Wyszukuje dane przestrzenne z Geoportal.gov.pl - działki, adresy, MPZP, plany zagospodarowania",
    category: "spatial",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Adres, nazwa miejscowości lub numer działki",
            },
            coordinates: {
                type: "string",
                description: "Współrzędne geograficzne w formacie 'lat,lon' np. '52.23,21.01'",
            },
        },
        required: ["query"],
    },
    execute: async (args) => {
        const startTime = Date.now();
        const query = args.query;
        const coordinates = args.coordinates;
        try {
            const geoportalService = new GeoportalService();
            // Sprawdź współrzędne
            let lat, lon;
            if (coordinates) {
                const parts = coordinates.split(",").map((s) => parseFloat(s.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    lat = parts[0];
                    lon = parts[1];
                }
            }
            // Sprawdź czy query zawiera współrzędne
            if (!lat) {
                const coordMatch = query.match(/(\d+[.,]\d+)\s*[,;\s]\s*(\d+[.,]\d+)/);
                if (coordMatch) {
                    lat = parseFloat(coordMatch[1].replace(",", "."));
                    lon = parseFloat(coordMatch[2].replace(",", "."));
                }
            }
            // Sprawdź czy query to pełny ID działki np. "141201_1.0001.6509"
            const parcelIdMatch = query.match(/^(\d{6}_\d\.\d{4}\.\d+[/\d]*)$/);
            if (parcelIdMatch) {
                const parcel = await geoportalService.getParcelById(parcelIdMatch[1]);
                if (parcel) {
                    return {
                        success: true,
                        data: {
                            type: "parcel_info",
                            searchMethod: "id",
                            parcel,
                            links: {
                                geoportal: geoportalService.getGeoportalLink(parcel.id),
                            },
                        },
                        metadata: {
                            source: "Geoportal.gov.pl (ULDK)",
                            executionTimeMs: Date.now() - startTime,
                        },
                    };
                }
            }
            if (lat && lon) {
                const parcel = await geoportalService.getParcelByCoordinates(lat, lon);
                const plans = await geoportalService.getSpatialPlanInfo(lat, lon);
                return {
                    success: true,
                    data: {
                        type: "location_info",
                        coordinates: { lat, lon },
                        parcel,
                        spatialPlans: plans,
                        links: parcel
                            ? {
                                geoportal: geoportalService.getGeoportalLink(parcel.id),
                                orthophoto: geoportalService.getOrthophotoUrl(lat, lon),
                            }
                            : null,
                    },
                    metadata: {
                        source: "Geoportal.gov.pl",
                        executionTimeMs: Date.now() - startTime,
                    },
                };
            }
            // Sprawdź czy query wygląda jak adres (zawiera numer) czy nazwa gminy
            const looksLikeAddress = /\d+/.test(query);
            const results = await geoportalService.search({
                query,
                address: looksLikeAddress ? query : undefined,
                municipality: looksLikeAddress ? undefined : query, // Nie szukaj gminy gdy to adres
            });
            // Jeśli znaleziono adresy ale nie działki - użyj współrzędnych do wyszukania działki w ULDK
            if (results.addresses.length > 0 && results.parcels.length === 0) {
                const firstAddress = results.addresses[0];
                if (firstAddress.coordinates?.lat && firstAddress.coordinates?.lon) {
                    console.log(`[Geoportal] Using address coordinates to find parcel: ${firstAddress.coordinates.lat}, ${firstAddress.coordinates.lon}`);
                    const parcel = await geoportalService.getParcelByCoordinates(firstAddress.coordinates.lat, firstAddress.coordinates.lon);
                    if (parcel) {
                        results.parcels.push(parcel);
                    }
                }
            }
            // Jeśli to adres i nadal nie znaleziono wyników, zwróć informację z alternatywami
            if (looksLikeAddress &&
                results.parcels.length === 0 &&
                results.addresses.length === 0) {
                const geoportalSearchUrl = `https://mapy.geoportal.gov.pl/imap/Imgp_2.html?locale=pl&gui=new&identifyParcel=${encodeURIComponent(query)}`;
                return {
                    success: true,
                    data: {
                        type: "address_search_fallback",
                        query,
                        warning: "Nie udało się znaleźć adresu w żadnym z serwisów geokodowania (GUGIK, OpenStreetMap).",
                        message: `Nie znaleziono działki dla adresu "${query}".`,
                        alternatives: [
                            "Sprawdź poprawność adresu (ulica, numer, miejscowość)",
                            "Podaj współrzędne GPS (np. '52.2297, 21.0122')",
                            "Podaj pełny ID działki TERYT (np. '141201_1.0001.6509')",
                            "Wyszukaj ręcznie na mapie Geoportalu",
                        ],
                        links: {
                            geoportalSearch: geoportalSearchUrl,
                            geoportalMain: "https://mapy.geoportal.gov.pl",
                        },
                    },
                    metadata: {
                        source: "Geoportal.gov.pl",
                        executionTimeMs: Date.now() - startTime,
                    },
                };
            }
            return {
                success: true,
                data: {
                    type: "search_results",
                    query,
                    parcels: results.parcels,
                    addresses: results.addresses,
                    municipalities: results.units,
                },
                metadata: {
                    source: "Geoportal.gov.pl",
                    executionTimeMs: Date.now() - startTime,
                },
            };
        }
        catch (error) {
            return {
                success: false,
                error: String(error),
                metadata: {
                    source: "Geoportal.gov.pl",
                    executionTimeMs: Date.now() - startTime,
                },
            };
        }
    },
};
// TERYT - Rejestr jednostek terytorialnych
export const terytTool = {
    name: "teryt_registry",
    description: "Wyszukuje w rejestrze TERYT - gminy, powiaty, województwa, kody terytorialne, ulice",
    category: "public_data",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Nazwa gminy, powiatu, województwa lub ulicy",
            },
        },
        required: ["query"],
    },
    execute: async (args) => {
        const startTime = Date.now();
        const query = args.query;
        try {
            const terytService = new TerytService();
            const results = await terytService.search({ query });
            return {
                success: true,
                data: {
                    type: "teryt_search",
                    query,
                    units: results.units,
                    streets: results.streets,
                },
                metadata: {
                    source: "TERYT GUS",
                    executionTimeMs: Date.now() - startTime,
                },
            };
        }
        catch (error) {
            return {
                success: false,
                error: String(error),
                metadata: {
                    source: "TERYT GUS",
                    executionTimeMs: Date.now() - startTime,
                },
            };
        }
    },
};
// KRS - Krajowy Rejestr Sądowy
export const krsTool = {
    name: "krs_registry",
    description: "Wyszukuje w KRS - spółki, stowarzyszenia, fundacje. Można szukać po nazwie, NIP lub numerze KRS",
    category: "public_data",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Nazwa firmy, NIP (10 cyfr) lub numer KRS",
            },
        },
        required: ["query"],
    },
    execute: async (args) => {
        const startTime = Date.now();
        const query = args.query;
        try {
            const krsService = new KrsService();
            const nipMatch = query.match(/\b\d{10}\b/);
            const krsMatch = query.match(/KRS\s*(\d+)/i) || query.match(/\b\d{10}\b/);
            if (nipMatch) {
                const entity = await krsService.getByNip(nipMatch[0]);
                return {
                    success: true,
                    data: { type: "krs_entity", entity, searchType: "nip" },
                    metadata: { source: "KRS", executionTimeMs: Date.now() - startTime },
                };
            }
            if (krsMatch && krsMatch[1]) {
                const entity = await krsService.getByKrs(krsMatch[1]);
                return {
                    success: true,
                    data: { type: "krs_entity", entity, searchType: "krs" },
                    metadata: { source: "KRS", executionTimeMs: Date.now() - startTime },
                };
            }
            const results = await krsService.search({ name: query });
            return {
                success: true,
                data: {
                    type: "krs_search",
                    query,
                    entities: results.entities,
                    totalCount: results.totalCount,
                },
                metadata: { source: "KRS", executionTimeMs: Date.now() - startTime },
            };
        }
        catch (error) {
            return {
                success: false,
                error: String(error),
                metadata: { source: "KRS", executionTimeMs: Date.now() - startTime },
            };
        }
    },
};
// CEIDG - Działalność gospodarcza
export const ceidgTool = {
    name: "ceidg_registry",
    description: "Wyszukuje w CEIDG - jednoosobowe działalności gospodarcze. Można szukać po nazwie lub NIP",
    category: "public_data",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Nazwa firmy lub NIP (10 cyfr)",
            },
        },
        required: ["query"],
    },
    execute: async (args) => {
        const startTime = Date.now();
        const query = args.query;
        try {
            const ceidgService = new CeidgService();
            const nipMatch = query.match(/\b\d{10}\b/);
            if (nipMatch) {
                const entry = await ceidgService.getByNip(nipMatch[0]);
                return {
                    success: true,
                    data: { type: "ceidg_entry", entry },
                    metadata: {
                        source: "CEIDG",
                        executionTimeMs: Date.now() - startTime,
                    },
                };
            }
            const results = await ceidgService.search({ name: query });
            return {
                success: true,
                data: {
                    type: "ceidg_search",
                    query,
                    entries: results.entries,
                    totalCount: results.totalCount,
                },
                metadata: { source: "CEIDG", executionTimeMs: Date.now() - startTime },
            };
        }
        catch (error) {
            return {
                success: false,
                error: String(error),
                metadata: { source: "CEIDG", executionTimeMs: Date.now() - startTime },
            };
        }
    },
};
// GDOŚ - Ochrona środowiska
export const gdosTool = {
    name: "gdos_environmental",
    description: "Wyszukuje dane środowiskowe z GDOŚ - obszary Natura 2000, rezerwaty, parki narodowe, obszary chronione",
    category: "public_data",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Nazwa obszaru chronionego lub współrzędne",
            },
            coordinates: {
                type: "string",
                description: "Współrzędne w formacie 'lat,lon'",
            },
        },
        required: ["query"],
    },
    execute: async (args) => {
        const startTime = Date.now();
        const query = args.query;
        const coordinates = args.coordinates;
        try {
            const gdosService = new GdosService();
            let lat, lon;
            if (coordinates) {
                const parts = coordinates.split(",").map((s) => parseFloat(s.trim()));
                if (parts.length === 2) {
                    lat = parts[0];
                    lon = parts[1];
                }
            }
            if (!lat) {
                const coordMatch = query.match(/(\d+[.,]\d+)\s*[,;\s]\s*(\d+[.,]\d+)/);
                if (coordMatch) {
                    lat = parseFloat(coordMatch[1].replace(",", "."));
                    lon = parseFloat(coordMatch[2].replace(",", "."));
                }
            }
            if (lat && lon) {
                const data = await gdosService.getEnvironmentalDataAtLocation(lat, lon);
                return {
                    success: true,
                    data: {
                        type: "environmental_data",
                        location: { lat, lon },
                        isInProtectedArea: data.isInProtectedArea,
                        protectedAreas: data.protectedAreas,
                        natura2000Sites: data.natura2000Sites,
                        restrictions: data.restrictions,
                    },
                    metadata: { source: "GDOŚ", executionTimeMs: Date.now() - startTime },
                };
            }
            const areas = await gdosService.searchProtectedAreas({ name: query });
            return {
                success: true,
                data: { type: "protected_areas_search", query, areas },
                metadata: { source: "GDOŚ", executionTimeMs: Date.now() - startTime },
            };
        }
        catch (error) {
            return {
                success: false,
                error: String(error),
                metadata: { source: "GDOŚ", executionTimeMs: Date.now() - startTime },
            };
        }
    },
};
// Fundusze Europejskie
export const euFundsTool = {
    name: "eu_funds",
    description: "Wyszukuje informacje o funduszach europejskich - dotacje, nabory, konkursy, projekty UE",
    category: "public_data",
    parameters: {
        type: "object",
        properties: {
            project_type: {
                type: "string",
                description: "Typ projektu lub obszar dofinansowania",
            },
            municipality: {
                type: "string",
                description: "Gmina dla której szukać projektów",
            },
        },
        required: [],
    },
    execute: async (args) => {
        const startTime = Date.now();
        const projectType = args.project_type;
        const municipality = args.municipality;
        try {
            const euService = new EUFundsService();
            if (projectType) {
                const opportunities = await euService.findFundingOpportunities(projectType);
                return {
                    success: true,
                    data: {
                        type: "funding_opportunities",
                        projectType,
                        ...opportunities,
                    },
                    metadata: {
                        source: "Portal Funduszy Europejskich",
                        executionTimeMs: Date.now() - startTime,
                    },
                };
            }
            if (municipality) {
                const projects = await euService.searchProjects({
                    municipality,
                    limit: 20,
                });
                const summary = await euService.getProjectsSummary(municipality);
                return {
                    success: true,
                    data: {
                        type: "municipality_projects",
                        municipality,
                        projects,
                        summary,
                    },
                    metadata: {
                        source: "Mapa Dotacji UE",
                        executionTimeMs: Date.now() - startTime,
                    },
                };
            }
            const competitions = await euService.getActiveCompetitions();
            return {
                success: true,
                data: {
                    type: "active_competitions",
                    count: competitions.length,
                    competitions,
                },
                metadata: {
                    source: "Portal Funduszy Europejskich",
                    executionTimeMs: Date.now() - startTime,
                },
            };
        }
        catch (error) {
            return {
                success: false,
                error: String(error),
                metadata: {
                    source: "Fundusze UE",
                    executionTimeMs: Date.now() - startTime,
                },
            };
        }
    },
};
//# sourceMappingURL=public-data-tools.js.map