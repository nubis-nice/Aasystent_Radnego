/**
 * Deep Research Service - Research Orchestrator
 * Agent AI "Winsdurf" - Deep Internet Researcher
 * Main service coordinating multi-provider research with AI synthesis
 */
import type { DeepResearchRequest, DeepResearchReport } from "@aasystent-radnego/shared";
export declare class DeepResearchService {
    private providers;
    private openai;
    private supabase;
    private userId;
    private initialized;
    private model;
    constructor(userId: string);
    private initializeProviders;
    /**
     * Get base URL for LLM provider
     */
    private getProviderBaseUrl;
    /**
     * Main research method - orchestrates multi-provider search and AI synthesis
     */
    research(request: DeepResearchRequest): Promise<DeepResearchReport>;
    /**
     * Decompose complex query into sub-queries using GPT-4
     */
    private decomposeQuery;
    /**
     * Search across multiple providers
     */
    private multiProviderSearch;
    /**
     * Search local sources (ISAP, RIO, WSA/NSA from database)
     */
    private searchLocalSources;
    /**
     * Deduplicate and rank results
     */
    private rankAndDeduplicate;
    /**
     * Generate AI summary of research results
     */
    private generateSummary;
    /**
     * Extract key findings from results
     */
    private extractKeyFindings;
    /**
     * Generate related queries
     */
    private generateRelatedQueries;
    /**
     * Calculate confidence score based on cross-source verification
     * Pewność obliczana na podstawie potwierdzeń z wielu źródeł vs informacji sprzecznych
     */
    private calculateConfidence;
    /**
     * Analyze agreement between sources by comparing content similarity
     * Wykrywa potwierdzenia i sprzeczności między źródłami
     */
    private analyzeSourceAgreement;
    /**
     * Calculate text similarity using Jaccard index on words
     */
    private calculateTextSimilarity;
    /**
     * Detect contradiction between two results
     * Wykrywa sprzeczności na podstawie słów kluczowych negacji
     */
    private detectContradiction;
    /**
     * Aggregate sources statistics
     */
    private aggregateSources;
    /**
     * Save research report to database
     */
    private saveReport;
    /**
     * Normalize URL for deduplication
     */
    private normalizeUrl;
    /**
     * Verify a claim using multi-source research
     */
    verifyClaim(claim: string): Promise<any>;
}
//# sourceMappingURL=deep-research-service.d.ts.map