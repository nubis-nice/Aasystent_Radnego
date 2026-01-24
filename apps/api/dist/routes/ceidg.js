import { CeidgService } from "../services/ceidg-service.js";
export async function ceidgRoutes(fastify) {
    const ceidgService = new CeidgService();
    // GET /api/ceidg/nip/:nip - wpis po NIP
    fastify.get("/ceidg/nip/:nip", async (request, reply) => {
        try {
            const { nip } = request.params;
            const entry = await ceidgService.getByNip(nip);
            if (!entry) {
                return reply.status(404).send({
                    success: false,
                    error: "Nie znaleziono wpisu o podanym NIP",
                });
            }
            return reply.send({
                success: true,
                data: entry,
                source: "CEIDG",
            });
        }
        catch (error) {
            console.error("Error fetching CEIDG entry:", error);
            return reply.status(500).send({
                success: false,
                error: "Błąd podczas pobierania danych z CEIDG",
            });
        }
    });
    // GET /api/ceidg/regon/:regon - wpis po REGON
    fastify.get("/ceidg/regon/:regon", async (request, reply) => {
        try {
            const { regon } = request.params;
            const entry = await ceidgService.getByRegon(regon);
            if (!entry) {
                return reply.status(404).send({
                    success: false,
                    error: "Nie znaleziono wpisu o podanym REGON",
                });
            }
            return reply.send({
                success: true,
                data: entry,
                source: "CEIDG",
            });
        }
        catch (error) {
            console.error("Error fetching by REGON:", error);
            return reply.status(500).send({
                success: false,
                error: "Błąd podczas wyszukiwania po REGON",
            });
        }
    });
    // GET /api/ceidg/status/:nip - sprawdzenie statusu działalności
    fastify.get("/ceidg/status/:nip", async (request, reply) => {
        try {
            const { nip } = request.params;
            const status = await ceidgService.checkStatus(nip);
            return reply.send({
                success: true,
                data: status,
                nip,
                source: "CEIDG",
            });
        }
        catch (error) {
            console.error("Error checking status:", error);
            return reply.status(500).send({
                success: false,
                error: "Błąd podczas sprawdzania statusu",
            });
        }
    });
    // GET /api/ceidg/city/:city - firmy w mieście
    fastify.get("/ceidg/city/:city", async (request, reply) => {
        try {
            const { city } = request.params;
            const { page, limit } = request.query;
            const result = await ceidgService.getByCity(city, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
            return reply.send({
                success: true,
                data: result.entries,
                totalCount: result.totalCount,
                page: result.page,
                pageSize: result.pageSize,
                city,
                source: "CEIDG",
            });
        }
        catch (error) {
            console.error("Error fetching by city:", error);
            return reply.status(500).send({
                success: false,
                error: "Błąd podczas wyszukiwania firm w mieście",
            });
        }
    });
    // GET /api/ceidg/pkd/:pkdCode - firmy z danym PKD
    fastify.get("/ceidg/pkd/:pkdCode", async (request, reply) => {
        try {
            const { pkdCode } = request.params;
            const { page, limit } = request.query;
            const result = await ceidgService.getByPkd(pkdCode, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
            return reply.send({
                success: true,
                data: result.entries,
                totalCount: result.totalCount,
                page: result.page,
                pageSize: result.pageSize,
                pkdCode,
                source: "CEIDG",
            });
        }
        catch (error) {
            console.error("Error fetching by PKD:", error);
            return reply.status(500).send({
                success: false,
                error: "Błąd podczas wyszukiwania firm po PKD",
            });
        }
    });
    // GET /api/ceidg/search - wyszukiwanie firm
    fastify.get("/ceidg/search", async (request, reply) => {
        try {
            const { nip, regon, name, firstName, lastName, city, pkd, page, limit, } = request.query;
            if (!nip &&
                !regon &&
                !name &&
                !firstName &&
                !lastName &&
                !city &&
                !pkd) {
                return reply.status(400).send({
                    success: false,
                    error: "Wymagany co najmniej jeden parametr wyszukiwania",
                });
            }
            const result = await ceidgService.search({
                nip,
                regon,
                name,
                firstName,
                lastName,
                city,
                pkd,
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20,
            });
            return reply.send({
                success: true,
                data: result.entries,
                totalCount: result.totalCount,
                page: result.page,
                pageSize: result.pageSize,
                source: "CEIDG",
            });
        }
        catch (error) {
            console.error("Error searching CEIDG:", error);
            return reply.status(500).send({
                success: false,
                error: "Błąd podczas wyszukiwania w CEIDG",
            });
        }
    });
}
//# sourceMappingURL=ceidg.js.map