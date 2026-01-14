/**
 * Legal Search API - wyszukiwanie prawne (fulltext + semantic)
 * Agent AI "Winsdurf" - wyszukiwanie w dokumentach prawnych
 */
import { createClient } from "@supabase/supabase-js";
import { getEmbeddingsClient, getAIConfig } from "../ai/index.js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export class LegalSearchAPI {
    userId;
    embeddingsClient = null;
    embeddingModel = "nomic-embed-text";
    constructor(userId) {
        this.userId = userId;
    }
    async initializeOpenAI() {
        if (this.embeddingsClient)
            return;
        this.embeddingsClient = await getEmbeddingsClient(this.userId);
        const embConfig = await getAIConfig(this.userId, "embeddings");
        this.embeddingModel = embConfig.modelName;
        console.log(`[LegalSearchAPI] Initialized: model=${this.embeddingModel}`);
    }
    async search(query) {
        console.log("[LegalSearchAPI] Starting search:", query);
        switch (query.searchMode) {
            case "fulltext":
                return this.fulltextSearch(query);
            case "semantic":
                return this.semanticSearch(query);
            case "hybrid":
                return this.hybridSearch(query);
            default:
                throw new Error(`Unsupported search mode: ${query.searchMode}`);
        }
    }
    async fulltextSearch(query) {
        console.log("[LegalSearchAPI] Fulltext search");
        let dbQuery = supabase
            .from("processed_documents")
            .select("*")
            .eq("user_id", this.userId)
            .or(`title.ilike.%${query.query}%,content.ilike.%${query.query}%`);
        dbQuery = this.applyFilters(dbQuery, query.filters);
        const limit = query.maxResults || 10;
        dbQuery = dbQuery.limit(limit);
        const { data: documents, error } = await dbQuery;
        if (error) {
            console.error("[LegalSearchAPI] Fulltext search error:", error);
            throw error;
        }
        return this.formatResults(documents || [], query.query);
    }
    async semanticSearch(query) {
        console.log("[LegalSearchAPI] Semantic search");
        await this.initializeOpenAI();
        if (!this.embeddingsClient) {
            throw new Error("OpenAI not initialized");
        }
        const embeddingResponse = await this.embeddingsClient.embeddings.create({
            model: this.embeddingModel,
            input: query.query,
        });
        const queryEmbedding = embeddingResponse.data[0]?.embedding;
        if (!queryEmbedding) {
            throw new Error("Failed to generate query embedding");
        }
        const limit = query.maxResults || 10;
        const threshold = 0.3; // Obniżony próg dla lepszych wyników (zgodnie z Chat)
        const { data: documents, error } = await supabase.rpc("search_processed_documents", {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: limit,
            filter_user_id: this.userId,
        });
        if (error) {
            console.error("[LegalSearchAPI] Semantic search error:", error);
            throw error;
        }
        return this.formatSemanticResults(documents || [], query.query);
    }
    async hybridSearch(query) {
        console.log("[LegalSearchAPI] Hybrid search");
        const [fulltextResults, semanticResults] = await Promise.all([
            this.fulltextSearch({
                ...query,
                maxResults: Math.ceil((query.maxResults || 10) / 2),
            }),
            this.semanticSearch({
                ...query,
                maxResults: Math.ceil((query.maxResults || 10) / 2),
            }),
        ]);
        const combinedResults = [...fulltextResults, ...semanticResults];
        const uniqueResults = this.deduplicateResults(combinedResults);
        return uniqueResults
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, query.maxResults || 10);
    }
    applyFilters(dbQuery, filters) {
        if (!filters)
            return dbQuery;
        if (filters.dateFrom) {
            dbQuery = dbQuery.gte("publish_date", filters.dateFrom);
        }
        if (filters.dateTo) {
            dbQuery = dbQuery.lte("publish_date", filters.dateTo);
        }
        if (filters.documentTypes && filters.documentTypes.length > 0) {
            dbQuery = dbQuery.in("document_type", filters.documentTypes);
        }
        if (filters.jurisdiction) {
            dbQuery = dbQuery.contains("metadata", {
                jurisdiction: filters.jurisdiction,
            });
        }
        if (filters.legalScope && filters.legalScope.length > 0) {
            dbQuery = dbQuery.overlaps("keywords", filters.legalScope);
        }
        return dbQuery;
    }
    formatResults(documents, query) {
        return documents.map((doc) => {
            const excerpt = this.generateExcerpt(doc.content, query);
            const highlights = this.generateHighlights(doc.content, query);
            const relevanceScore = this.calculateRelevanceScore(doc, query);
            return {
                documentId: doc.id,
                title: doc.title,
                content: doc.content,
                excerpt,
                relevanceScore,
                sourceType: doc.metadata?.sourceType || "unknown",
                url: doc.source_url,
                publishDate: doc.publish_date,
                legalClassification: doc.metadata?.legalClassification,
                highlights,
            };
        });
    }
    formatSemanticResults(documents, query) {
        return documents.map((doc) => {
            const excerpt = this.generateExcerpt(doc.content, query);
            const highlights = this.generateHighlights(doc.content, query);
            return {
                documentId: doc.id,
                title: doc.title,
                content: doc.content,
                excerpt,
                relevanceScore: doc.similarity || 0,
                sourceType: doc.metadata?.sourceType || "unknown",
                url: doc.source_url,
                publishDate: doc.publish_date,
                legalClassification: doc.metadata?.legalClassification,
                highlights,
            };
        });
    }
    generateExcerpt(content, query, maxLength = 300) {
        const queryWords = query.toLowerCase().split(/\s+/);
        const sentences = content.split(/[.!?]+/);
        let bestSentence = sentences[0] || "";
        let maxMatches = 0;
        for (const sentence of sentences) {
            const lowerSentence = sentence.toLowerCase();
            const matches = queryWords.filter((word) => lowerSentence.includes(word)).length;
            if (matches > maxMatches) {
                maxMatches = matches;
                bestSentence = sentence;
            }
        }
        if (bestSentence.length > maxLength) {
            return bestSentence.substring(0, maxLength) + "...";
        }
        return bestSentence.trim();
    }
    generateHighlights(content, query, maxHighlights = 3) {
        const queryWords = query
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3);
        const highlights = [];
        const sentences = content.split(/[.!?]+/);
        for (const sentence of sentences) {
            if (highlights.length >= maxHighlights)
                break;
            const lowerSentence = sentence.toLowerCase();
            const hasMatch = queryWords.some((word) => lowerSentence.includes(word));
            if (hasMatch) {
                highlights.push(sentence.trim());
            }
        }
        return highlights;
    }
    calculateRelevanceScore(doc, query) {
        const queryWords = query.toLowerCase().split(/\s+/);
        const titleLower = (doc.title || "").toLowerCase();
        const contentLower = (doc.content || "").toLowerCase();
        let score = 0;
        for (const word of queryWords) {
            if (titleLower.includes(word))
                score += 2;
            if (contentLower.includes(word))
                score += 1;
        }
        const keywordMatches = (doc.keywords || []).filter((k) => queryWords.some((w) => k.toLowerCase().includes(w))).length;
        score += keywordMatches * 1.5;
        return Math.min(score / 10, 1);
    }
    deduplicateResults(results) {
        const seen = new Set();
        const unique = [];
        for (const result of results) {
            if (!seen.has(result.documentId)) {
                seen.add(result.documentId);
                unique.push(result);
            }
        }
        return unique;
    }
}
//# sourceMappingURL=legal-search-api.js.map