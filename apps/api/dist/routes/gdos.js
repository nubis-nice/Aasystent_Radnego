import { GdosService } from "../services/gdos-service.js";
export async function gdosRoutes(fastify) {
    const gdosService = new GdosService();
    // GET /api/gdos/location - dane środowiskowe dla lokalizacji
    fastify.get("/gdos/location", async (request, reply) => {
        try {
            const { lat, lon } = request.query;
            if (!lat || !lon) {
                return reply.status(400).send({
                    success: false,
                    error: "Wymagane parametry: lat i lon",
                });
            }
            const data = await gdosService.getEnvironmentalDataAtLocation(parseFloat(lat), parseFloat(lon));
            return reply.send({
                success: true,
                data,
                source: "GDOŚ",
            });
        }
        catch (error) {
            console.error("Error fetching environmental data:", error);
            return reply.status(500).send({
                success: false,
                error: "Błąd podczas pobierania danych środowiskowych",
            });
        }
    });
    // GET /api/gdos/protected-areas - wyszukiwanie obszarów chronionych
    fastify.get("/gdos/protected-areas", async (request, reply) => {
        try {
            const { lat, lon, name, type, voivodeship, municipality, limit } = request.query;
            // Wyszukiwanie po lokalizacji
            if (lat && lon) {
                const areas = await gdosService.getProtectedAreasAtLocation(parseFloat(lat), parseFloat(lon));
                return reply.send({
                    success: true,
                    data: areas,
                    count: areas.length,
                    source: "GDOŚ",
                });
            }
            // Wyszukiwanie po parametrach
            const areas = await gdosService.searchProtectedAreas({
                name,
                type: type,
                voivodeship,
                municipality,
                limit: limit ? parseInt(limit) : 50,
            });
            return reply.send({
                success: true,
                data: areas,
                count: areas.length,
                source: "GDOŚ",
            });
        }
        catch (error) {
            console.error("Error searching protected areas:", error);
            return reply.status(500).send({
                success: false,
                error: "Błąd podczas wyszukiwania obszarów chronionych",
            });
        }
    });
    // GET /api/gdos/protected-area/:id - szczegóły obszaru chronionego
    fastify.get("/gdos/protected-area/:id", async (request, reply) => {
        try {
            const { id } = request.params;
            const area = await gdosService.getProtectedAreaById(id);
            if (!area) {
                return reply.status(404).send({
                    success: false,
                    error: "Nie znaleziono obszaru chronionego",
                });
            }
            return reply.send({
                success: true,
                data: {
                    ...area,
                    typeLabel: gdosService.getAreaTypeLabel(area.type),
                },
                source: "GDOŚ",
            });
        }
        catch (error) {
            console.error("Error fetching protected area:", error);
            return reply.status(500).send({
                success: false,
                error: "Błąd podczas pobierania danych obszaru",
            });
        }
    });
    // GET /api/gdos/natura2000 - wyszukiwanie obszarów Natura 2000
    fastify.get("/gdos/natura2000", async (request, reply) => {
        try {
            const { lat, lon, name, limit } = request.query;
            // Wyszukiwanie po lokalizacji
            if (lat && lon) {
                const sites = await gdosService.getNatura2000AtLocation(parseFloat(lat), parseFloat(lon));
                return reply.send({
                    success: true,
                    data: sites.map((site) => ({
                        ...site,
                        typeLabel: gdosService.getNatura2000TypeLabel(site.type),
                    })),
                    count: sites.length,
                    source: "GDOŚ - Natura 2000",
                });
            }
            // Wyszukiwanie po nazwie
            if (name) {
                const sites = await gdosService.searchNatura2000(name, limit ? parseInt(limit) : 50);
                return reply.send({
                    success: true,
                    data: sites.map((site) => ({
                        ...site,
                        typeLabel: gdosService.getNatura2000TypeLabel(site.type),
                    })),
                    count: sites.length,
                    source: "GDOŚ - Natura 2000",
                });
            }
            return reply.status(400).send({
                success: false,
                error: "Wymagane parametry: (lat i lon) lub name",
            });
        }
        catch (error) {
            console.error("Error searching Natura 2000:", error);
            return reply.status(500).send({
                success: false,
                error: "Błąd podczas wyszukiwania obszarów Natura 2000",
            });
        }
    });
    // GET /api/gdos/natura2000/:code - szczegóły obszaru Natura 2000
    fastify.get("/gdos/natura2000/:code", async (request, reply) => {
        try {
            const { code } = request.params;
            const site = await gdosService.getNatura2000SiteByCode(code);
            if (!site) {
                return reply.status(404).send({
                    success: false,
                    error: "Nie znaleziono obszaru Natura 2000",
                });
            }
            return reply.send({
                success: true,
                data: {
                    ...site,
                    typeLabel: gdosService.getNatura2000TypeLabel(site.type),
                },
                source: "GDOŚ - Natura 2000",
            });
        }
        catch (error) {
            console.error("Error fetching Natura 2000 site:", error);
            return reply.status(500).send({
                success: false,
                error: "Błąd podczas pobierania danych obszaru",
            });
        }
    });
    // GET /api/gdos/check-restrictions - sprawdzenie ograniczeń dla lokalizacji
    fastify.get("/gdos/check-restrictions", async (request, reply) => {
        try {
            const { lat, lon } = request.query;
            if (!lat || !lon) {
                return reply.status(400).send({
                    success: false,
                    error: "Wymagane parametry: lat i lon",
                });
            }
            const data = await gdosService.getEnvironmentalDataAtLocation(parseFloat(lat), parseFloat(lon));
            return reply.send({
                success: true,
                data: {
                    isInProtectedArea: data.isInProtectedArea,
                    restrictions: data.restrictions,
                    protectedAreasCount: data.protectedAreas.length,
                    natura2000Count: data.natura2000Sites.length,
                    areas: data.protectedAreas.map((a) => ({
                        name: a.name,
                        type: a.type,
                        typeLabel: gdosService.getAreaTypeLabel(a.type),
                    })),
                    natura2000: data.natura2000Sites.map((s) => ({
                        code: s.code,
                        name: s.name,
                        type: s.type,
                        typeLabel: gdosService.getNatura2000TypeLabel(s.type),
                    })),
                },
                source: "GDOŚ",
            });
        }
        catch (error) {
            console.error("Error checking restrictions:", error);
            return reply.status(500).send({
                success: false,
                error: "Błąd podczas sprawdzania ograniczeń",
            });
        }
    });
}
//# sourceMappingURL=gdos.js.map