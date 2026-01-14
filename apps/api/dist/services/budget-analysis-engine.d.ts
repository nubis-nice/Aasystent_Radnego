/**
 * Budget Analysis Engine - analiza budżetowa i wykrywanie anomalii
 * Agent AI "Winsdurf" - kontrola finansowa dla Radnego
 */
import type { BudgetAnalysisRequest, BudgetAnalysisResult } from "@aasystent-radnego/shared";
export declare class BudgetAnalysisEngine {
    private userId;
    private llmClient;
    private model;
    constructor(userId: string);
    private initializeOpenAI;
    analyze(request: BudgetAnalysisRequest): Promise<BudgetAnalysisResult>;
    private loadDocument;
    private searchRIOReferences;
    private analyzeChanges;
    private analyzeCompliance;
    private analyzeRisks;
    private analyzeComparison;
    private buildBudgetPrompt;
    private buildComparisonPrompt;
    private parseBudgetResponse;
}
//# sourceMappingURL=budget-analysis-engine.d.ts.map