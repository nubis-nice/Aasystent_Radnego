import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { TerytService } from "../services/teryt-service.js";

export async function terytRoutes(fastify: FastifyInstance) {
  const terytService = new TerytService();

  // GET /api/teryt/voivodeships - lista województw
  fastify.get(
    "/teryt/voivodeships",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const voivodeships = await terytService.getVoivodeships();
        return reply.send({
          success: true,
          data: voivodeships,
          count: voivodeships.length,
        });
      } catch (error) {
        console.error("Error fetching voivodeships:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas pobierania województw",
        });
      }
    }
  );

  // GET /api/teryt/counties/:voivodeshipId - powiaty w województwie
  fastify.get(
    "/teryt/counties/:voivodeshipId",
    async (
      request: FastifyRequest<{ Params: { voivodeshipId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { voivodeshipId } = request.params;
        const counties = await terytService.getCounties(voivodeshipId);
        return reply.send({
          success: true,
          data: counties,
          count: counties.length,
          voivodeshipId,
        });
      } catch (error) {
        console.error("Error fetching counties:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas pobierania powiatów",
        });
      }
    }
  );

  // GET /api/teryt/municipalities/:countyId - gminy w powiecie
  fastify.get(
    "/teryt/municipalities/:countyId",
    async (
      request: FastifyRequest<{ Params: { countyId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { countyId } = request.params;
        const municipalities = await terytService.getMunicipalities(countyId);
        return reply.send({
          success: true,
          data: municipalities,
          count: municipalities.length,
          countyId,
        });
      } catch (error) {
        console.error("Error fetching municipalities:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas pobierania gmin",
        });
      }
    }
  );

  // GET /api/teryt/unit/:code - jednostka po kodzie TERYT
  fastify.get(
    "/teryt/unit/:code",
    async (
      request: FastifyRequest<{ Params: { code: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { code } = request.params;
        const unit = await terytService.getUnitByCode(code);

        if (!unit) {
          return reply.status(404).send({
            success: false,
            error: "Nie znaleziono jednostki o podanym kodzie",
          });
        }

        return reply.send({
          success: true,
          data: unit,
        });
      } catch (error) {
        console.error("Error fetching unit:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas pobierania jednostki",
        });
      }
    }
  );

  // GET /api/teryt/unit/:code/hierarchy - hierarchia jednostki
  fastify.get(
    "/teryt/unit/:code/hierarchy",
    async (
      request: FastifyRequest<{ Params: { code: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { code } = request.params;
        const hierarchy = await terytService.getUnitHierarchy(code);
        return reply.send({
          success: true,
          data: hierarchy,
          count: hierarchy.length,
        });
      } catch (error) {
        console.error("Error fetching hierarchy:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas pobierania hierarchii",
        });
      }
    }
  );

  // GET /api/teryt/streets/:municipalityId - ulice w gminie
  fastify.get(
    "/teryt/streets/:municipalityId",
    async (
      request: FastifyRequest<{ Params: { municipalityId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { municipalityId } = request.params;
        const streets = await terytService.getStreets(municipalityId);
        return reply.send({
          success: true,
          data: streets,
          count: streets.length,
          municipalityId,
        });
      } catch (error) {
        console.error("Error fetching streets:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas pobierania ulic",
        });
      }
    }
  );

  // GET /api/teryt/search/units - wyszukiwanie jednostek
  fastify.get(
    "/teryt/search/units",
    async (
      request: FastifyRequest<{
        Querystring: { query: string; limit?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { query, limit } = request.query;

        if (!query || query.length < 2) {
          return reply.status(400).send({
            success: false,
            error: "Zapytanie musi mieć co najmniej 2 znaki",
          });
        }

        const units = await terytService.searchUnits(
          query,
          limit ? parseInt(limit) : 20
        );
        return reply.send({
          success: true,
          data: units,
          count: units.length,
          query,
        });
      } catch (error) {
        console.error("Error searching units:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas wyszukiwania jednostek",
        });
      }
    }
  );

  // GET /api/teryt/search/streets - wyszukiwanie ulic
  fastify.get(
    "/teryt/search/streets",
    async (
      request: FastifyRequest<{
        Querystring: { query: string; municipalityId?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { query, municipalityId } = request.query;

        if (!query || query.length < 2) {
          return reply.status(400).send({
            success: false,
            error: "Zapytanie musi mieć co najmniej 2 znaki",
          });
        }

        const streets = await terytService.searchStreets(query, municipalityId);
        return reply.send({
          success: true,
          data: streets,
          count: streets.length,
          query,
        });
      } catch (error) {
        console.error("Error searching streets:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas wyszukiwania ulic",
        });
      }
    }
  );

  // GET /api/teryt/search - uniwersalne wyszukiwanie
  fastify.get(
    "/teryt/search",
    async (
      request: FastifyRequest<{
        Querystring: {
          query: string;
          type?: "unit" | "street";
          limit?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { query, type, limit } = request.query;

        if (!query || query.length < 2) {
          return reply.status(400).send({
            success: false,
            error: "Zapytanie musi mieć co najmniej 2 znaki",
          });
        }

        const results = await terytService.search({
          query,
          type,
          limit: limit ? parseInt(limit) : 20,
        });

        return reply.send({
          success: true,
          data: results,
          query,
          source: "TERYT GUS",
        });
      } catch (error) {
        console.error("Error in TERYT search:", error);
        return reply.status(500).send({
          success: false,
          error: "Błąd podczas wyszukiwania",
        });
      }
    }
  );
}
