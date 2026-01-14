/**
 * Research Providers Configuration
 * Agent AI "Winsdurf" - Deep Internet Researcher
 */
export const RESEARCH_PROVIDERS = {
    exa: {
        name: "Exa AI",
        baseUrl: "https://api.exa.ai",
        apiKey: process.env.EXA_API_KEY || "",
        priority: 1, // highest priority
        enabled: !!process.env.EXA_API_KEY,
        rateLimit: {
            maxRequests: 100,
            perSeconds: 60,
        },
    },
    tavily: {
        name: "Tavily AI",
        baseUrl: "https://api.tavily.com",
        apiKey: process.env.TAVILY_API_KEY || "",
        priority: 2,
        enabled: !!process.env.TAVILY_API_KEY,
        rateLimit: {
            maxRequests: 100,
            perSeconds: 60,
        },
    },
    serper: {
        name: "Serper (Google Search)",
        baseUrl: "https://google.serper.dev",
        apiKey: process.env.SERPER_API_KEY || "",
        priority: 3,
        enabled: !!process.env.SERPER_API_KEY,
        rateLimit: {
            maxRequests: 50,
            perSeconds: 60,
        },
    },
    brave: {
        name: "Brave Search",
        baseUrl: "https://api.search.brave.com",
        apiKey: process.env.BRAVE_API_KEY || "",
        priority: 2, // high priority - good for Polish sources
        enabled: !!process.env.BRAVE_API_KEY,
        rateLimit: {
            maxRequests: 100,
            perSeconds: 60,
        },
    },
    firecrawl: {
        name: "Firecrawl",
        baseUrl: "https://api.firecrawl.dev",
        apiKey: process.env.FIRECRAWL_API_KEY || "",
        priority: 4,
        enabled: false, // on-demand only
        rateLimit: {
            maxRequests: 20,
            perSeconds: 60,
        },
    },
};
// Predefined domain lists for legal research
export const LEGAL_DOMAINS = {
    courts: [
        "orzeczenia.nsa.gov.pl",
        "orzeczenia.wsa.gov.pl",
        "sn.pl",
        "trybunal.gov.pl",
    ],
    legislation: [
        "isap.sejm.gov.pl",
        "dziennikustaw.gov.pl",
        "monitorpolski.gov.pl",
    ],
    financial: ["rio.gov.pl", "mf.gov.pl", "nik.gov.pl"],
    legal_portals: [
        "lexlege.pl",
        "legalis.pl",
        "sip.lex.pl",
        "orzeczenia.ms.gov.pl",
    ],
    municipalities: [
        "bip.gov.pl",
        // Add specific BIP domains as needed
    ],
};
// Query templates for different research types
export const QUERY_TEMPLATES = {
    legal: {
        legislation: "ustawa {topic} aktualna wersja",
        case_law: "orzecznictwo {court} {topic}",
        commentary: "komentarz prawny {topic}",
        precedent: "precedens sądowy {topic}",
    },
    financial: {
        budget: "budżet {entity} {year}",
        rio_opinion: "stanowisko RIO {topic}",
        audit: "kontrola NIK {entity} {topic}",
    },
    procedural: {
        procedure: "procedura {topic} samorząd",
        deadline: "termin {action} {topic}",
        requirements: "wymogi formalne {topic}",
    },
};
// Search depth configurations
export const SEARCH_DEPTH_CONFIG = {
    quick: {
        maxResults: 5,
        providers: ["exa"], // only primary
        timeout: 5000, // 5s
    },
    standard: {
        maxResults: 20,
        providers: ["exa", "tavily"], // primary + secondary
        timeout: 15000, // 15s
    },
    deep: {
        maxResults: 50,
        providers: ["exa", "tavily", "serper"], // all except on-demand
        timeout: 30000, // 30s
    },
};
export function getActiveProviders() {
    return Object.values(RESEARCH_PROVIDERS)
        .filter((provider) => provider.enabled)
        .sort((a, b) => a.priority - b.priority);
}
export function getProviderByName(name) {
    return RESEARCH_PROVIDERS[name];
}
export function getDomainsForResearchType(type) {
    switch (type) {
        case "legal":
            return [
                ...LEGAL_DOMAINS.courts,
                ...LEGAL_DOMAINS.legislation,
                ...LEGAL_DOMAINS.legal_portals,
            ];
        case "financial":
            return [...LEGAL_DOMAINS.financial];
        case "procedural":
            return [...LEGAL_DOMAINS.legislation, ...LEGAL_DOMAINS.municipalities];
        default:
            return [];
    }
}
//# sourceMappingURL=research-providers.js.map