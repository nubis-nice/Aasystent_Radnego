/**
 * NSA/WSA API Routes
 * Endpointy dla dostępu do orzeczeń sądów administracyjnych (CBOSA)
 */

import { FastifyPluginAsync } from "fastify";
import { NSAApiService } from "../services/nsa-api-service.js";

export const nsaRoutes: FastifyPluginAsync = async (fastify) => {
  const nsaService = new NSAApiService();

  fastify.get("/nsa/courts", async (_request, reply) => {
    try {
      const courts = nsaService.getCourts();
      return reply.send({ success: true, courts });
    } catch (error) {
      fastify.log.error(
        "Error fetching courts: " +
          String(error instanceof Error ? error.message : error),
      );
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  fastify.get("/nsa/case-symbols", async (_request, reply) => {
    try {
      const symbols = nsaService.getCaseSymbols();
      return reply.send({ success: true, symbols });
    } catch (error) {
      fastify.log.error(
        "Error fetching case symbols: " +
          String(error instanceof Error ? error.message : error),
      );
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  fastify.get<{
    Querystring: {
      query?: string;
      signature?: string;
      court?: string;
      judgmentType?: string;
      caseSymbol?: string;
      dateFrom?: string;
      dateTo?: string;
      judge?: string;
      withThesis?: string;
      withJustification?: string;
      isFinal?: string;
      limit?: string;
      offset?: string;
    };
  }>("/nsa/judgments/search", async (request, reply) => {
    try {
      const {
        query,
        signature,
        court,
        judgmentType,
        caseSymbol,
        dateFrom,
        dateTo,
        judge,
        withThesis,
        withJustification,
        isFinal,
        limit,
        offset,
      } = request.query;

      const result = await nsaService.searchJudgments({
        query,
        signature,
        court,
        judgmentType,
        caseSymbol,
        dateFrom,
        dateTo,
        judge,
        withThesis: withThesis === "1" || withThesis === "true",
        withJustification:
          withJustification === "1" || withJustification === "true",
        isFinal: isFinal === "1" || isFinal === "true",
        limit: limit ? parseInt(limit) : 20,
        offset: offset ? parseInt(offset) : 0,
      });

      return reply.send({ success: true, ...result });
    } catch (error) {
      fastify.log.error(
        "Error searching judgments: " +
          String(error instanceof Error ? error.message : error),
      );
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  fastify.get<{
    Params: { id: string };
  }>("/nsa/judgments/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const judgment = await nsaService.getJudgmentDetails(id);

      if (!judgment) {
        return reply.status(404).send({
          success: false,
          error: "Orzeczenie nie znalezione",
        });
      }

      return reply.send({ success: true, judgment });
    } catch (error) {
      fastify.log.error(
        "Error fetching judgment: " +
          String(error instanceof Error ? error.message : error),
      );
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  fastify.get<{
    Querystring: {
      topic?: string;
      limit?: string;
    };
  }>("/nsa/judgments/local-government", async (request, reply) => {
    try {
      const { topic, limit } = request.query;
      const judgments = await nsaService.searchLocalGovernmentJudgments(
        topic,
        limit ? parseInt(limit) : 20,
      );

      return reply.send({
        success: true,
        count: judgments.length,
        items: judgments,
      });
    } catch (error) {
      fastify.log.error(
        "Error fetching local government judgments: " +
          String(error instanceof Error ? error.message : error),
      );
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  fastify.get<{
    Params: { signature: string };
  }>("/nsa/judgments/signature/:signature", async (request, reply) => {
    try {
      const { signature } = request.params;
      const judgments = await nsaService.searchBySignature(
        decodeURIComponent(signature),
      );

      return reply.send({
        success: true,
        count: judgments.length,
        items: judgments,
      });
    } catch (error) {
      fastify.log.error(
        "Error searching by signature: " +
          String(error instanceof Error ? error.message : error),
      );
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
};
