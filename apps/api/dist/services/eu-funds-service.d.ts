/**
 * EU Funds Service
 * Obsługa źródeł danych o funduszach europejskich
 */
export interface EUProject {
    id: string;
    title: string;
    beneficiary: string;
    program: string;
    priority: string;
    totalValue: number;
    euCoFinancing: number;
    startDate?: string;
    endDate?: string;
    status: string;
    region?: string;
    municipality?: string;
    description?: string;
    category?: string;
}
export interface EUCompetition {
    id: string;
    title: string;
    program: string;
    institution: string;
    startDate: string;
    endDate: string;
    budget: number;
    status: "planned" | "open" | "closed";
    url: string;
    description?: string;
    targetGroups?: string[];
}
export interface CompetitivenessOffer {
    id: string;
    title: string;
    beneficiary: string;
    deadline: string;
    value: number;
    category: string;
    region?: string;
    url: string;
}
export interface EUFundsSearchParams {
    query?: string;
    program?: string;
    region?: string;
    municipality?: string;
    minValue?: number;
    maxValue?: number;
    status?: string;
    category?: string;
    limit?: number;
    offset?: number;
}
export declare class EUFundsService {
    private cache;
    private cacheTTL;
    constructor();
    searchProjects(params: EUFundsSearchParams): Promise<EUProject[]>;
    getActiveCompetitions(params?: {
        program?: string;
        region?: string;
        category?: string;
    }): Promise<EUCompetition[]>;
    getCompetitivenessOffers(params?: {
        category?: string;
        region?: string;
        minValue?: number;
    }): Promise<CompetitivenessOffer[]>;
    getProjectsSummary(municipality: string): Promise<{
        totalProjects: number;
        totalValue: number;
        totalEuCoFinancing: number;
        byProgram: Record<string, {
            count: number;
            value: number;
        }>;
        byStatus: Record<string, number>;
    }>;
    getUpcomingCompetitions(months?: number): Promise<EUCompetition[]>;
    findFundingOpportunities(projectType: string): Promise<{
        competitions: EUCompetition[];
        relatedPrograms: string[];
        recommendations: string[];
    }>;
}
//# sourceMappingURL=eu-funds-service.d.ts.map