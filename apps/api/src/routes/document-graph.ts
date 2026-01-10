import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { documentGraphService } from "../services/document-graph-service.js";

export const documentGraphRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /documents/:id/related - Pobierz powiązane dokumenty
  fastify.get<{ Params: { id: string } }>(
    "/documents/:id/related",
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.headers["x-user-id"] as string;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const querySchema = z.object({
        maxDepth: z.coerce.number().int().min(1).max(10).default(3),
        minStrength: z.coerce.number().min(0).max(1).default(0.3),
      });

      try {
        const query = querySchema.parse(request.query);
        const related = await documentGraphService.getRelatedDocuments(
          id,
          query.maxDepth,
          query.minStrength
        );

        return reply.send({
          document_id: id,
          related_count: related.length,
          related,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /documents/:id/relations - Pobierz bezpośrednie relacje
  fastify.get<{ Params: { id: string } }>(
    "/documents/:id/relations",
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.headers["x-user-id"] as string;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      try {
        const relations = await documentGraphService.getDirectRelations(id);

        return reply.send({
          document_id: id,
          outgoing_count: relations.outgoing.length,
          incoming_count: relations.incoming.length,
          ...relations,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /documents/path - Znajdź ścieżkę między dokumentami
  fastify.get("/documents/path", async (request, reply) => {
    const userId = request.headers["x-user-id"] as string;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const querySchema = z.object({
      source: z.string().uuid(),
      target: z.string().uuid(),
      maxDepth: z.coerce.number().int().min(1).max(10).default(5),
    });

    try {
      const query = querySchema.parse(request.query);
      const path = await documentGraphService.findPath(
        query.source,
        query.target,
        query.maxDepth
      );

      if (!path) {
        return reply.send({
          found: false,
          message: "No path found between documents",
        });
      }

      return reply.send({
        found: true,
        ...path,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // POST /documents/:id/detect-references - Wykryj referencje w dokumencie
  fastify.post<{ Params: { id: string } }>(
    "/documents/:id/detect-references",
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.headers["x-user-id"] as string;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      try {
        const count = await documentGraphService.detectAndAddReferences(id);

        return reply.send({
          success: true,
          document_id: id,
          references_detected: count,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /documents/:id/relations - Dodaj relację
  fastify.post<{ Params: { id: string } }>(
    "/documents/:id/relations",
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.headers["x-user-id"] as string;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const bodySchema = z.object({
        target_document_id: z.string().uuid(),
        relation_type: z.enum([
          "references",
          "amends",
          "supersedes",
          "implements",
          "contains",
          "attachment",
          "related",
          "responds_to",
          "derived_from",
        ]),
        strength: z.number().min(0).max(1).optional(),
        context: z.string().optional(),
        reference_text: z.string().optional(),
      });

      try {
        const body = bodySchema.parse(request.body);
        const relation = await documentGraphService.addRelation(
          id,
          body.target_document_id,
          body.relation_type,
          {
            strength: body.strength,
            context: body.context,
            referenceText: body.reference_text,
            detectedAutomatically: false,
          }
        );

        if (!relation) {
          return reply.status(400).send({ error: "Failed to add relation" });
        }

        return reply.send({
          success: true,
          relation,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // DELETE /documents/relations/:id - Usuń relację
  fastify.delete<{ Params: { id: string } }>(
    "/documents/relations/:id",
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.headers["x-user-id"] as string;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      try {
        const success = await documentGraphService.removeRelation(id);

        if (!success) {
          return reply.status(400).send({ error: "Failed to remove relation" });
        }

        return reply.send({ success: true });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /documents/graph/stats - Statystyki grafu
  fastify.get("/documents/graph/stats", async (request, reply) => {
    const userId = request.headers["x-user-id"] as string;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    try {
      const stats = await documentGraphService.getGraphStats();

      return reply.send(stats || { error: "Could not fetch stats" });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // POST /documents/clusters - Utwórz klaster dokumentów
  fastify.post("/documents/clusters", async (request, reply) => {
    const userId = request.headers["x-user-id"] as string;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const bodySchema = z.object({
      name: z.string().min(1).max(200),
      root_document_id: z.string().uuid(),
      description: z.string().optional(),
      cluster_type: z.string().optional(),
      max_depth: z.number().int().min(1).max(5).optional(),
    });

    try {
      const body = bodySchema.parse(request.body);
      const cluster = await documentGraphService.createCluster(
        body.name,
        body.root_document_id,
        {
          description: body.description,
          clusterType: body.cluster_type,
          maxDepth: body.max_depth,
        }
      );

      if (!cluster) {
        return reply.status(400).send({ error: "Failed to create cluster" });
      }

      return reply.send({
        success: true,
        cluster,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
};
