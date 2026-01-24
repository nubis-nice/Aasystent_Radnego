/* global URL */

import { FastifyInstance } from "fastify";
import {
  semanticWebSearch,
  SemanticSearchQuery,
} from "../services/semantic-web-search.js";

export async function webSearchRoutes(fastify: FastifyInstance) {
  // POST /api/web-search - Wyszukiwanie z weryfikacją wiarygodności
  fastify.post<{
    Body: {
      query: string;
      maxResults?: number;
      minCredibility?: number;
      requireCrossReference?: boolean;
      excludeDomains?: string[];
      preferredDomains?: string[];
    };
  }>("/web-search", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const {
        query,
        maxResults,
        minCredibility,
        requireCrossReference,
        excludeDomains,
        preferredDomains,
      } = request.body;

      if (!query || query.trim().length === 0) {
        return reply.status(400).send({ error: "Query is required" });
      }

      request.log.info({ query }, "Starting verified web search");

      const searchQuery: SemanticSearchQuery = {
        query: query.trim(),
        maxResults: maxResults || 10,
        minCredibility: minCredibility || 50,
        requireCrossReference: requireCrossReference ?? true,
        excludeDomains,
        preferredDomains,
        language: "pl",
      };

      const result = await semanticWebSearch(userId, searchQuery);

      request.log.info(
        {
          success: result.success,
          sourcesAnalyzed: result.sourcesAnalyzed,
          reliableCount: result.reliableSourcesCount,
          confidence: result.overallConfidence,
        },
        "Web search completed",
      );

      return reply.send(result);
    } catch (error) {
      request.log.error({ err: error }, "Web search error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // GET /api/web-search/trusted-domains - Lista zaufanych domen
  fastify.get("/web-search/trusted-domains", async (request, reply) => {
    const userId = request.headers["x-user-id"] as string;
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // Zwróć listę zaufanych domen dla UI
    return reply.send({
      trustedDomains: [
        { domain: "gov.pl", trust: 95, category: "Rządowe PL" },
        { domain: "sejm.gov.pl", trust: 95, category: "Sejm" },
        { domain: "isap.sejm.gov.pl", trust: 95, category: "ISAP" },
        { domain: "stat.gov.pl", trust: 95, category: "GUS" },
        { domain: "bip.gov.pl", trust: 90, category: "BIP" },
        { domain: "europa.eu", trust: 90, category: "EU" },
        { domain: "pap.pl", trust: 85, category: "Agencja PAP" },
        { domain: "reuters.com", trust: 85, category: "Reuters" },
      ],
      untrustedDomains: [
        { domain: "niepoprawni.pl", reason: "Dezinformacja" },
        { domain: "niezalezna.pl", reason: "Niska wiarygodność" },
      ],
      satireDomains: [{ domain: "aszdziennik.pl", reason: "Satyra" }],
    });
  });

  // POST /api/web-search/verify-url - Zweryfikuj pojedynczy URL
  fastify.post<{
    Body: { url: string };
  }>("/web-search/verify-url", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { url } = request.body;
      if (!url) {
        return reply.status(400).send({ error: "URL is required" });
      }

      // Parsuj domenę
      let domain: string;
      try {
        domain = new URL(url).hostname;
      } catch {
        return reply.status(400).send({ error: "Invalid URL" });
      }

      // Sprawdź domenę w bazie zaufanych/niezaufanych
      const trustedDomains: Record<string, number> = {
        "gov.pl": 95,
        "sejm.gov.pl": 95,
        "stat.gov.pl": 95,
        "europa.eu": 90,
        "pap.pl": 85,
      };

      const untrustedDomains = ["niepoprawni.pl", "niezalezna.pl"];
      const satireDomains = ["aszdziennik.pl"];

      let trustScore = 50; // Default
      let category = "unknown";
      const flags: string[] = [];

      // Check trusted
      for (const [pattern, score] of Object.entries(trustedDomains)) {
        if (domain.includes(pattern)) {
          trustScore = score;
          category = "trusted";
          break;
        }
      }

      // Check untrusted
      if (untrustedDomains.some((d) => domain.includes(d))) {
        trustScore = 10;
        category = "untrusted";
        flags.push("Źródło znane z rozpowszechniania dezinformacji");
      }

      // Check satire
      if (satireDomains.some((d) => domain.includes(d))) {
        trustScore = 20;
        category = "satire";
        flags.push("Strona satyryczna - nie traktować jako źródło faktów");
      }

      return reply.send({
        url,
        domain,
        trustScore,
        category,
        flags,
        isReliable: trustScore >= 50,
      });
    } catch (error) {
      request.log.error({ err: error }, "URL verification error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
}
