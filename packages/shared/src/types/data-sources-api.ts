/**
 * Typy dla systemu źródeł danych opartego na API
 * Agent AI "Winsdurf" - architektura bez MCP, tylko API/scraping
 */

// ============================================================================
// TYPY ŹRÓDEŁ DANYCH
// ============================================================================

export type DataSourceType =
  | "api_isap" // ISAP - prawo powszechnie obowiązujące
  | "api_rcl" // RCL - akty wykonawcze
  | "api_wsa_nsa" // WSA/NSA - orzecznictwo sądów administracyjnych
  | "api_rio" // RIO - uchwały i rozstrzygnięcia nadzorcze
  | "scraper_bip" // BIP JST - scraping
  | "scraper_dziennik" // Dzienniki Urzędowe Województw - scraping
  | "scraper_custom" // Niestandardowe źródło - scraping
  | "api_custom"; // Niestandardowe API

export type DataFetchMethod = "api" | "scraping" | "hybrid";

// ============================================================================
// KONFIGURACJA API CLIENT
// ============================================================================

export interface ApiClientConfig {
  method: "GET" | "POST" | "PUT" | "DELETE";
  baseUrl: string;
  endpoint?: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  bodyTemplate?: Record<string, unknown>;
  authentication?: {
    type: "none" | "api_key" | "bearer" | "basic" | "oauth2";
    apiKey?: string;
    apiKeyHeader?: string;
    token?: string;
    username?: string;
    password?: string;
    oauth2Config?: {
      tokenUrl: string;
      clientId: string;
      clientSecret: string;
      scope?: string;
    };
  };
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  pagination?: {
    type: "offset" | "page" | "cursor" | "none";
    limitParam?: string;
    offsetParam?: string;
    pageParam?: string;
    cursorParam?: string;
    maxPages?: number;
  };
  responseMapping?: {
    dataPath: string; // JSONPath do danych, np. "data.items"
    titlePath?: string; // JSONPath do tytułu
    contentPath?: string; // JSONPath do treści
    datePath?: string; // JSONPath do daty
    urlPath?: string; // JSONPath do URL
    metadataPath?: string; // JSONPath do metadanych
  };
}

// ============================================================================
// KONFIGURACJA SCRAPINGU
// ============================================================================

export interface ScraperConfig {
  maxPages: number;
  maxDepth: number;
  delayMs: number;
  selectors: {
    documentList?: string;
    title?: string;
    content?: string;
    links?: string;
    date?: string;
    pdfLinks?: string;
    metadata?: Record<string, string>;
  };
  urlPatterns?: {
    include?: string[];
    exclude?: string[];
  };
  javascript?: {
    enabled: boolean;
    waitForSelector?: string;
    waitTime?: number;
  };
}

// ============================================================================
// UNIFIED DATA SOURCE CONFIG
// ============================================================================

export interface DataSourceConfig {
  id: string;
  userId: string;
  name: string;
  description?: string;
  url?: string; // Base URL źródła danych
  sourceType: DataSourceType;
  fetchMethod: DataFetchMethod;

  // Konfiguracja API (jeśli fetchMethod = 'api' lub 'hybrid')
  apiConfig?: ApiClientConfig;

  // Konfiguracja scrapingu (jeśli fetchMethod = 'scraping' lub 'hybrid')
  scraperConfig?: ScraperConfig;

  // Harmonogram
  schedule: {
    enabled: boolean;
    frequency: "hourly" | "daily" | "weekly" | "monthly" | "custom";
    cronExpression?: string;
    nextRunAt?: string;
  };

  // Przetwarzanie
  processing: {
    enableEmbeddings: boolean;
    enableClassification: boolean;
    enableKeywordExtraction: boolean;
    enableSummarization: boolean;
    customProcessors?: string[];
  };

  // Metadane
  metadata: {
    category:
      | "legal"
      | "administrative"
      | "financial"
      | "statistical"
      | "other";
    tags: string[];
    priority: "low" | "normal" | "high" | "critical";
    jurisdiction?: string; // np. "gmina Drawno", "województwo zachodniopomorskie"
    legalScope?: string[]; // np. ["budżet", "podatki", "planowanie przestrzenne"]
  };

  // Status
  isActive: boolean;
  lastFetchedAt?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastErrorMessage?: string;

  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// FETCHED DATA
// ============================================================================

export interface FetchedDocument {
  sourceId: string;
  sourceType: DataSourceType;
  fetchMethod: DataFetchMethod;

  // Dane podstawowe
  title: string;
  content: string;
  contentType: "html" | "text" | "json" | "xml" | "pdf";

  // Metadane
  url?: string;
  publishDate?: string;
  author?: string;
  documentNumber?: string; // np. "Dz.U. 2024 poz. 123"

  // Klasyfikacja prawna
  legalClassification?: {
    type:
      | "ustawa"
      | "rozporządzenie"
      | "uchwała"
      | "zarządzenie"
      | "wyrok"
      | "postanowienie"
      | "inne";
    issuer?: string; // np. "Sejm RP", "Rada Gminy Drawno"
    subject?: string[]; // np. ["budżet", "podatki"]
    legalBasis?: string[]; // podstawy prawne
  };

  // Dane techniczne
  contentHash: string;
  fetchedAt: string;
  rawData?: Record<string, unknown>;

  // Powiązania
  relatedDocuments?: string[];
  amendments?: string[]; // dokumenty zmieniające
  repeals?: string[]; // dokumenty uchylające
}

// ============================================================================
// LEGAL SEARCH & REASONING
// ============================================================================

export interface LegalSearchQuery {
  query: string;
  filters?: {
    sourceTypes?: DataSourceType[];
    dateFrom?: string;
    dateTo?: string;
    documentTypes?: string[];
    jurisdiction?: string;
    legalScope?: string[];
  };
  searchMode: "fulltext" | "semantic" | "hybrid";
  maxResults?: number;
}

export interface LegalSearchResult {
  documentId: string;
  title: string;
  content: string;
  excerpt: string;
  relevanceScore: number;
  sourceType: DataSourceType;
  url?: string;
  publishDate?: string;
  legalClassification?: FetchedDocument["legalClassification"];
  highlights?: string[];
}

export interface LegalReasoningRequest {
  question: string;
  context?: {
    documentIds?: string[];
    legalScope?: string[];
    jurisdiction?: string;
  };
  analysisType:
    | "legality"
    | "financial_risk"
    | "procedural_compliance"
    | "general";
}

export interface LegalReasoningResponse {
  answer: string;
  reasoning: string[];
  legalBasis: {
    documentId: string;
    title: string;
    excerpt: string;
    relevance: number;
  }[];
  risks: {
    level: "low" | "medium" | "high" | "critical";
    description: string;
    legalBasis?: string;
    recommendation?: string;
  }[];
  citations: {
    documentId: string;
    quote: string;
    context: string;
  }[];
}

// ============================================================================
// BUDGET ANALYSIS
// ============================================================================

export interface BudgetAnalysisRequest {
  documentId: string;
  analysisType: "changes" | "compliance" | "risk" | "comparison";
  compareWith?: string; // ID dokumentu do porównania
}

export interface BudgetAnalysisResult {
  documentId: string;
  analysisType: string;
  findings: {
    type: "change" | "risk" | "violation" | "anomaly";
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    affectedItems: {
      chapter?: string;
      section?: string;
      paragraph?: string;
      amount?: number;
      change?: number;
    }[];
    recommendation?: string;
  }[];
  summary: string;
  rioReferences?: {
    title: string;
    url: string;
    relevance: string;
  }[];
}

// ============================================================================
// PREDEFINED SOURCE TEMPLATES
// ============================================================================

export const PREDEFINED_SOURCES: Record<string, Partial<DataSourceConfig>> = {
  isap: {
    name: "ISAP - Internetowy System Aktów Prawnych",
    sourceType: "api_isap",
    fetchMethod: "scraping", // ISAP nie ma publicznego API, używamy scrapingu
    scraperConfig: {
      maxPages: 50,
      maxDepth: 2,
      delayMs: 2000,
      selectors: {
        documentList: ".act-list .act-item, table.acts tr",
        title: "h1.act-title, .title",
        content: ".act-content, .content",
        date: ".act-date, .date",
      },
      urlPatterns: {
        include: ["isap.sejm.gov.pl"],
        exclude: ["login", "admin"],
      },
    },
    metadata: {
      category: "legal",
      tags: ["prawo", "ustawy", "rozporządzenia"],
      priority: "high",
      jurisdiction: "Rzeczpospolita Polska",
      legalScope: ["prawo powszechnie obowiązujące"],
    },
  },

  wsa_nsa: {
    name: "WSA/NSA - Orzecznictwo sądów administracyjnych",
    sourceType: "api_wsa_nsa",
    fetchMethod: "scraping",
    scraperConfig: {
      maxPages: 30,
      maxDepth: 2,
      delayMs: 2000,
      selectors: {
        documentList: ".judgment-list .judgment-item",
        title: "h2.judgment-title",
        content: ".judgment-content",
        date: ".judgment-date",
      },
    },
    metadata: {
      category: "legal",
      tags: ["orzecznictwo", "sądy administracyjne"],
      priority: "high",
      legalScope: ["orzecznictwo"],
    },
  },

  rio: {
    name: "RIO - Regionalna Izba Obrachunkowa",
    sourceType: "api_rio",
    fetchMethod: "scraping",
    scraperConfig: {
      maxPages: 20,
      maxDepth: 2,
      delayMs: 1500,
      selectors: {
        documentList: ".resolution-list .item, table.resolutions tr",
        title: "h3.title, .resolution-title",
        content: ".content, .resolution-content",
        date: ".date, .resolution-date",
      },
    },
    metadata: {
      category: "administrative",
      tags: ["RIO", "nadzór", "finanse publiczne"],
      priority: "critical",
      legalScope: ["finanse publiczne", "nadzór"],
    },
  },

  bip_template: {
    name: "BIP - Biuletyn Informacji Publicznej",
    sourceType: "scraper_bip",
    fetchMethod: "scraping",
    scraperConfig: {
      maxPages: 50,
      maxDepth: 3,
      delayMs: 1000,
      selectors: {
        documentList:
          ".dokument, .document, table.dokumenty tr, .lista-dokumentow li",
        title: "h1, h2, .title, .tytul",
        content: ".tresc, .content, .main-content, article",
        links: "a[href]",
        pdfLinks: 'a[href$=".pdf"], a[href*="pdf"]',
        date: ".data, .date, time",
      },
      urlPatterns: {
        include: ["uchwaly", "protokoly", "zarzadzenia", "ogloszenia"],
        exclude: ["login", "admin", "rss"],
      },
    },
    metadata: {
      category: "administrative",
      tags: ["BIP", "samorząd"],
      priority: "high",
      legalScope: ["prawo lokalne"],
    },
  },
};

// ============================================================================
// FETCH RESULT
// ============================================================================

export interface DataFetchResult {
  sourceId: string;
  success: boolean;
  fetchMethod: DataFetchMethod;
  itemsFetched: number;
  itemsProcessed: number;
  errors: string[];
  warnings: string[];
  duration: number;
  nextFetchAt?: string;
  metadata?: {
    apiCallsUsed?: number;
    pagesScraped?: number;
    rateLimitRemaining?: number;
  };
}
