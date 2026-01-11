/**
 * Legal Analysis Routes - endpointy dla silników analitycznych
 * Agent AI "Winsdurf" - API dla Legal Search, Legal Reasoning, Budget Analysis
 */
import { LegalSearchAPI } from "../services/legal-search-api.js";
import { LegalReasoningEngine } from "../services/legal-reasoning-engine.js";
import { BudgetAnalysisEngine } from "../services/budget-analysis-engine.js";
export async function legalAnalysisRoutes(fastify) {
    // POST /api/legal/search - Wyszukiwanie prawne
    fastify.post("/legal/search", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const { query, searchMode = "hybrid", maxResults = 10, filters, } = request.body;
            if (!query) {
                return reply.status(400).send({ error: "Query is required" });
            }
            const searchAPI = new LegalSearchAPI(userId);
            const results = await searchAPI.search({
                query,
                searchMode,
                maxResults,
                filters,
            });
            return reply.send({
                results,
                count: results.length,
                searchMode,
            });
        }
        catch (error) {
            request.log.error("Legal search error:", error);
            return reply.status(500).send({
                error: "Internal server error",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // POST /api/legal/reasoning - Analiza prawna z wykrywaniem ryzyk
    fastify.post("/legal/reasoning", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const { question, analysisType = "general", context } = request.body;
            if (!question) {
                return reply.status(400).send({ error: "Question is required" });
            }
            request.log.info({ analysisType, question }, "Starting legal reasoning");
            const reasoningEngine = new LegalReasoningEngine(userId);
            const analysis = await reasoningEngine.analyze({
                question,
                analysisType,
                context,
            });
            return reply.send({
                analysis,
                analysisType,
            });
        }
        catch (error) {
            request.log.error("Legal reasoning error:", error);
            return reply.status(500).send({
                error: "Internal server error",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // POST /api/legal/budget-analysis - Analiza budżetowa
    fastify.post("/legal/budget-analysis", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const { documentId, analysisType, compareWith } = request.body;
            if (!documentId) {
                return reply.status(400).send({ error: "Document ID is required" });
            }
            if (analysisType === "comparison" && !compareWith) {
                return reply.status(400).send({
                    error: "compareWith document ID is required for comparison analysis",
                });
            }
            request.log.info({ documentId, analysisType }, "Starting budget analysis");
            const budgetEngine = new BudgetAnalysisEngine(userId);
            const analysis = await budgetEngine.analyze({
                documentId,
                analysisType,
                compareWith,
            });
            return reply.send({
                analysis,
                analysisType,
            });
        }
        catch (error) {
            request.log.error("Budget analysis error:", error);
            return reply.status(500).send({
                error: "Internal server error",
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // GET /api/legal/analysis-types - Lista dostępnych typów analiz
    fastify.get("/legal/analysis-types", async (request, reply) => {
        return reply.send({
            searchModes: [
                {
                    value: "fulltext",
                    label: "Wyszukiwanie pełnotekstowe",
                    description: "Szybkie wyszukiwanie po słowach kluczowych",
                },
                {
                    value: "semantic",
                    label: "Wyszukiwanie semantyczne",
                    description: "Wyszukiwanie po znaczeniu, używa AI",
                },
                {
                    value: "hybrid",
                    label: "Wyszukiwanie hybrydowe",
                    description: "Łączy pełnotekstowe i semantyczne",
                },
            ],
            reasoningTypes: [
                {
                    value: "legality",
                    label: "Analiza legalności",
                    description: "Zgodność z prawem, podstawy prawne, delegacje",
                },
                {
                    value: "financial_risk",
                    label: "Ryzyko finansowe",
                    description: "Zgodność z budżetem, WPF, stanowiska RIO",
                },
                {
                    value: "procedural_compliance",
                    label: "Zgodność proceduralna",
                    description: "Tryb uchwalania, konsultacje, terminy",
                },
                {
                    value: "general",
                    label: "Analiza kompleksowa",
                    description: "Pełna analiza prawna, finansowa i proceduralna",
                },
            ],
            budgetAnalysisTypes: [
                {
                    value: "changes",
                    label: "Analiza zmian",
                    description: "Wykrywa przesunięcia środków i zmiany ukryte",
                },
                {
                    value: "compliance",
                    label: "Zgodność z przepisami",
                    description: "Sprawdza zgodność z ustawą o finansach publicznych",
                },
                {
                    value: "risk",
                    label: "Analiza ryzyk",
                    description: "Identyfikuje ryzyka finansowe i proceduralne",
                },
                {
                    value: "comparison",
                    label: "Porównanie dokumentów",
                    description: "Porównuje dwa dokumenty budżetowe",
                },
            ],
        });
    });
}
//# sourceMappingURL=legal-analysis.js.map