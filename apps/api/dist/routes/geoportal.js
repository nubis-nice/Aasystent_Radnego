/**
 * Geoportal Routes
 * Endpointy dla dostępu do danych przestrzennych z Geoportal.gov.pl
 */
import { GeoportalService } from "../services/geoportal-service.js";
export const geoportalRoutes = async (fastify) => {
    const geoportalService = new GeoportalService();
    // Wyszukiwanie działki po ID
    fastify.get("/geoportal/parcel/:parcelId", async (request, reply) => {
        try {
            const { parcelId } = request.params;
            const parcel = await geoportalService.getParcelById(parcelId);
            if (!parcel) {
                return reply.status(404).send({
                    success: false,
                    error: "Nie znaleziono działki o podanym identyfikatorze",
                });
            }
            return reply.send({
                success: true,
                parcel,
                links: {
                    geoportal: geoportalService.getGeoportalLink(parcelId),
                },
            });
        }
        catch (error) {
            console.error("Error fetching parcel:", error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // Wyszukiwanie działki po współrzędnych
    fastify.get("/geoportal/parcel/coordinates", async (request, reply) => {
        try {
            const { lat, lon } = request.query;
            const parcel = await geoportalService.getParcelByCoordinates(parseFloat(lat), parseFloat(lon));
            if (!parcel) {
                return reply.status(404).send({
                    success: false,
                    error: "Nie znaleziono działki dla podanych współrzędnych",
                });
            }
            return reply.send({
                success: true,
                parcel,
                links: {
                    geoportal: geoportalService.getGeoportalLink(parcel.id),
                    orthophoto: geoportalService.getOrthophotoUrl(parseFloat(lat), parseFloat(lon)),
                },
            });
        }
        catch (error) {
            console.error("Error fetching parcel by coordinates:", error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // Wyszukiwanie adresów
    fastify.get("/geoportal/address/search", async (request, reply) => {
        try {
            const { query, limit } = request.query;
            const addresses = await geoportalService.searchAddress(query, limit ? parseInt(limit) : 10);
            return reply.send({
                success: true,
                count: addresses.length,
                addresses,
            });
        }
        catch (error) {
            console.error("Error searching addresses:", error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // Wyszukiwanie gmin
    fastify.get("/geoportal/municipality/search", async (request, reply) => {
        try {
            const { name } = request.query;
            const municipalities = await geoportalService.searchMunicipalities(name);
            return reply.send({
                success: true,
                count: municipalities.length,
                municipalities,
            });
        }
        catch (error) {
            console.error("Error searching municipalities:", error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // Pobieranie jednostki administracyjnej
    fastify.get("/geoportal/admin/:code", async (request, reply) => {
        try {
            const { code } = request.params;
            const unit = await geoportalService.getAdministrativeUnit(code);
            if (!unit) {
                return reply.status(404).send({
                    success: false,
                    error: "Nie znaleziono jednostki administracyjnej",
                });
            }
            return reply.send({
                success: true,
                unit,
            });
        }
        catch (error) {
            console.error("Error fetching admin unit:", error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // Informacje o MPZP dla lokalizacji
    fastify.get("/geoportal/mpzp", async (request, reply) => {
        try {
            const { lat, lon } = request.query;
            const plans = await geoportalService.getSpatialPlanInfo(parseFloat(lat), parseFloat(lon));
            return reply.send({
                success: true,
                count: plans.length,
                plans,
            });
        }
        catch (error) {
            console.error("Error fetching MPZP:", error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // Uniwersalne wyszukiwanie
    fastify.get("/geoportal/search", async (request, reply) => {
        try {
            const { query, parcelId, address, lat, lon, municipality } = request.query;
            const results = await geoportalService.search({
                query,
                parcelId,
                address,
                coordinates: lat && lon
                    ? { lat: parseFloat(lat), lon: parseFloat(lon) }
                    : undefined,
                municipality,
            });
            return reply.send({
                success: true,
                results,
            });
        }
        catch (error) {
            console.error("Error in geoportal search:", error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
};
//# sourceMappingURL=geoportal.js.map