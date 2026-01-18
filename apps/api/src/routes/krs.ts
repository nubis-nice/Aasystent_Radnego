import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { KrsService } from "../services/krs-service.js";

export async function krsRoutes(fastify: FastifyInstance) {
  const krsService = new KrsService();

  // GET /api/krs/entity/:krsNumber - podmiot po numerze KRS
  fastify.get(
    "/krs/entity/:krsNumber",
    async (
      request: FastifyRequest<{ Params: { krsNumber: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { krsNumber } = request.params;
        const entity = await krsService.getByKrs(krsNumber);

        if (!entity) {
          return reply.status(404).send({
            success: false,
            error: "Nie znaleziono podmiotu o podanym numerze KRS",
          });
        }

        return reply.send({
          success: true,
          data: entity,
          source: "KRS",
        });
      } catch (error) {
        console.error("Error fetching KRS entity:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas pobierania danych z KRS",
        });
      }
    }
  );

  // GET /api/krs/nip/:nip - podmiot po NIP
  fastify.get(
    "/krs/nip/:nip",
    async (
      request: FastifyRequest<{ Params: { nip: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { nip } = request.params;
        const entity = await krsService.getByNip(nip);

        if (!entity) {
          return reply.status(404).send({
            success: false,
            error: "Nie znaleziono podmiotu o podanym NIP",
          });
        }

        return reply.send({
          success: true,
          data: entity,
          source: "KRS",
        });
      } catch (error) {
        console.error("Error fetching by NIP:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas wyszukiwania po NIP",
        });
      }
    }
  );

  // GET /api/krs/regon/:regon - podmiot po REGON
  fastify.get(
    "/krs/regon/:regon",
    async (
      request: FastifyRequest<{ Params: { regon: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { regon } = request.params;
        const entity = await krsService.getByRegon(regon);

        if (!entity) {
          return reply.status(404).send({
            success: false,
            error: "Nie znaleziono podmiotu o podanym REGON",
          });
        }

        return reply.send({
          success: true,
          data: entity,
          source: "KRS",
        });
      } catch (error) {
        console.error("Error fetching by REGON:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas wyszukiwania po REGON",
        });
      }
    }
  );

  // GET /api/krs/entity/:krsNumber/representatives - reprezentanci
  fastify.get(
    "/krs/entity/:krsNumber/representatives",
    async (
      request: FastifyRequest<{ Params: { krsNumber: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { krsNumber } = request.params;
        const representatives = await krsService.getRepresentatives(krsNumber);

        return reply.send({
          success: true,
          data: representatives,
          count: representatives.length,
          krsNumber,
        });
      } catch (error) {
        console.error("Error fetching representatives:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas pobierania reprezentantów",
        });
      }
    }
  );

  // GET /api/krs/entity/:krsNumber/pkd - kody PKD
  fastify.get(
    "/krs/entity/:krsNumber/pkd",
    async (
      request: FastifyRequest<{ Params: { krsNumber: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { krsNumber } = request.params;
        const pkdCodes = await krsService.getPkdCodes(krsNumber);

        return reply.send({
          success: true,
          data: pkdCodes,
          count: pkdCodes.length,
          krsNumber,
        });
      } catch (error) {
        console.error("Error fetching PKD codes:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas pobierania kodów PKD",
        });
      }
    }
  );

  // GET /api/krs/search - wyszukiwanie podmiotów
  fastify.get(
    "/krs/search",
    async (
      request: FastifyRequest<{
        Querystring: {
          name?: string;
          krs?: string;
          nip?: string;
          regon?: string;
          page?: string;
          limit?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { name, krs, nip, regon, page, limit } = request.query;

        if (!name && !krs && !nip && !regon) {
          return reply.status(400).send({
            success: false,
            error:
              "Wymagany co najmniej jeden parametr wyszukiwania: name, krs, nip lub regon",
          });
        }

        const result = await krsService.search({
          name,
          krs,
          nip,
          regon,
          page: page ? parseInt(page) : 1,
          limit: limit ? parseInt(limit) : 20,
        });

        return reply.send({
          success: true,
          data: result.entities,
          totalCount: result.totalCount,
          page: result.page,
          pageSize: result.pageSize,
          source: "KRS",
        });
      } catch (error) {
        console.error("Error searching KRS:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas wyszukiwania w KRS",
        });
      }
    }
  );
}
