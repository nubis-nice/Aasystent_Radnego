/**
 * EU Funds Routes
 * Endpointy dla dostępu do danych o funduszach europejskich
 */

import { FastifyPluginAsync } from "fastify";
import { EUFundsService } from "../services/eu-funds-service.js";

export const euFundsRoutes: FastifyPluginAsync = async (fastify) => {
  const euFundsService = new EUFundsService();

  fastify.get<{
    Querystring: {
      query?: string;
      program?: string;
      region?: string;
      municipality?: string;
      minValue?: string;
      maxValue?: string;
      limit?: string;
    };
  }>("/eu-funds/projects/search", async (request, reply) => {
    try {
      const {
        query,
        program,
        region,
        municipality,
        minValue,
        maxValue,
        limit,
      } = request.query;

      const projects = await euFundsService.searchProjects({
        query,
        program,
        region,
        municipality,
        minValue: minValue ? parseFloat(minValue) : undefined,
        maxValue: maxValue ? parseFloat(maxValue) : undefined,
        limit: limit ? parseInt(limit) : 20,
      });

      return reply.send({ success: true, count: projects.length, projects });
    } catch (error) {
      console.error("Error searching EU projects:", error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  fastify.get<{
    Params: { municipality: string };
  }>("/eu-funds/projects/summary/:municipality", async (request, reply) => {
    try {
      const { municipality } = request.params;
      const summary = await euFundsService.getProjectsSummary(municipality);
      return reply.send({ success: true, municipality, summary });
    } catch (error) {
      console.error("Error getting projects summary:", error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  fastify.get<{
    Querystring: { program?: string; region?: string; category?: string };
  }>("/eu-funds/competitions", async (request, reply) => {
    try {
      const { program, region, category } = request.query;
      const competitions = await euFundsService.getActiveCompetitions({
        program,
        region,
        category,
      });
      return reply.send({
        success: true,
        count: competitions.length,
        competitions,
      });
    } catch (error) {
      console.error("Error getting competitions:", error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  fastify.get<{
    Querystring: { months?: string };
  }>("/eu-funds/competitions/upcoming", async (request, reply) => {
    try {
      const months = request.query.months ? parseInt(request.query.months) : 3;
      const competitions = await euFundsService.getUpcomingCompetitions(months);
      return reply.send({
        success: true,
        count: competitions.length,
        competitions,
      });
    } catch (error) {
      console.error("Error getting upcoming competitions:", error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  fastify.get<{
    Params: { projectType: string };
  }>("/eu-funds/opportunities/:projectType", async (request, reply) => {
    try {
      const { projectType } = request.params;
      const opportunities = await euFundsService.findFundingOpportunities(
        projectType
      );
      return reply.send({ success: true, projectType, ...opportunities });
    } catch (error) {
      console.error("Error finding funding opportunities:", error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  fastify.get<{
    Querystring: { category?: string; region?: string; minValue?: string };
  }>("/eu-funds/competitiveness", async (request, reply) => {
    try {
      const { category, region, minValue } = request.query;
      const offers = await euFundsService.getCompetitivenessOffers({
        category,
        region,
        minValue: minValue ? parseFloat(minValue) : undefined,
      });
      return reply.send({ success: true, count: offers.length, offers });
    } catch (error) {
      console.error("Error getting competitiveness offers:", error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
};
