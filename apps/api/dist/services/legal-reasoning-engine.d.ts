/**
 * Legal Reasoning Engine - analiza prawna z wykrywaniem ryzyk
 * Agent AI "Winsdurf" - wsparcie analityczno-kontrolne dla Radnego
 */
import type { LegalReasoningRequest, LegalReasoningResponse } from "@aasystent-radnego/shared";
export declare class LegalReasoningEngine {
    private userId;
    private llmClient;
    private model;
    private searchAPI;
    constructor(userId: string);
    private initializeOpenAI;
    analyze(request: LegalReasoningRequest): Promise<LegalReasoningResponse>;
    private gatherContext;
    private performAnalysis;
    private buildSystemPrompt;
    private buildUserPrompt;
    private parseAnalysisResponse;
}
//# sourceMappingURL=legal-reasoning-engine.d.ts.map