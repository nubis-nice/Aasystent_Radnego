/**
 * Research Providers Configuration
 * Agent AI "Winsdurf" - Deep Internet Researcher
 */
import type { ResearchProviderConfig } from "@shared/types/deep-research";
export declare const RESEARCH_PROVIDERS: Record<string, ResearchProviderConfig>;
export declare const LEGAL_DOMAINS: {
    courts: string[];
    legislation: string[];
    financial: string[];
    legal_portals: string[];
    municipalities: string[];
};
export declare const QUERY_TEMPLATES: {
    legal: {
        legislation: string;
        case_law: string;
        commentary: string;
        precedent: string;
    };
    financial: {
        budget: string;
        rio_opinion: string;
        audit: string;
    };
    procedural: {
        procedure: string;
        deadline: string;
        requirements: string;
    };
};
export declare const SEARCH_DEPTH_CONFIG: {
    quick: {
        maxResults: number;
        providers: string[];
        timeout: number;
    };
    standard: {
        maxResults: number;
        providers: string[];
        timeout: number;
    };
    deep: {
        maxResults: number;
        providers: string[];
        timeout: number;
    };
};
export declare function getActiveProviders(): ResearchProviderConfig[];
export declare function getProviderByName(name: string): ResearchProviderConfig | undefined;
export declare function getDomainsForResearchType(type: string): string[];
//# sourceMappingURL=research-providers.d.ts.map