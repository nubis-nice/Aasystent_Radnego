/**
 * Typy dla systemu źródeł danych (scraping)
 */

export type DataSourceType =
  | "municipality" // Strona gminy
  | "bip" // Biuletyn Informacji Publicznej
  | "legal" // Portale prawne
  | "councilor" // Serwisy dla radnych
  | "statistics" // Dane statystyczne
  | "national_park" // Parki narodowe
  | "hospital" // Szpitale
  | "school" // Szkoły
  | "cultural" // Instytucje kultury (muzea, teatry, biblioteki)
  | "environmental" // Ochrona środowiska
  | "transport" // Transport publiczny
  | "emergency" // Służby ratunkowe
  | "custom"; // Własne źródło

export type ScrapingFrequency =
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "manual";

export type ContentType = "html" | "pdf" | "json" | "xml" | "text";

export type DocumentType =
  | "resolution" // Uchwała
  | "protocol" // Protokół
  | "news" // Aktualność
  | "legal_act" // Akt prawny
  | "announcement" // Ogłoszenie
  | "article"; // Artykuł

export type ScrapingStatus = "success" | "error" | "partial" | "skipped";

export interface ScrapingConfig {
  selectors?: {
    [key: string]: string; // CSS selectors
  };
  pagination?: {
    enabled: boolean;
    selector?: string;
    maxPages?: number;
  };
  download_pdfs?: boolean;
  search_params?: {
    [key: string]: any;
  };
  api_endpoint?: string;
  requires_auth?: boolean;
  headers?: {
    [key: string]: string;
  };
  rate_limit?: {
    requests_per_second: number;
    delay_ms: number;
  };
}

export interface DataSource {
  id: string;
  user_id: string;
  name: string;
  type: DataSourceType;
  url: string;
  scraping_enabled: boolean;
  scraping_frequency: ScrapingFrequency;
  last_scraped_at: string | null;
  next_scrape_at: string | null;
  scraping_config: ScrapingConfig;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ScrapedContent {
  id: string;
  source_id: string;
  url: string;
  title: string | null;
  content_type: ContentType;
  raw_content: string;
  content_hash: string;
  scraped_at: string;
  metadata: Record<string, any>;
}

export interface ProcessedDocument {
  id: string;
  scraped_content_id: string | null;
  user_id: string;
  document_type: DocumentType;
  title: string;
  content: string;
  summary: string | null;
  keywords: string[];
  publish_date: string | null;
  source_url: string | null;
  metadata: Record<string, any>;
  processed_at: string;
}

export interface ScrapingLog {
  id: string;
  source_id: string;
  status: ScrapingStatus;
  items_scraped: number;
  items_processed: number;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
}

// Request/Response types

export interface CreateDataSourceRequest {
  name: string;
  type: DataSourceType;
  url: string;
  scraping_enabled?: boolean;
  scraping_frequency?: ScrapingFrequency;
  scraping_config?: ScrapingConfig;
  metadata?: Record<string, any>;
}

export interface UpdateDataSourceRequest {
  name?: string;
  url?: string;
  scraping_enabled?: boolean;
  scraping_frequency?: ScrapingFrequency;
  scraping_config?: ScrapingConfig;
  metadata?: Record<string, any>;
}

export interface TriggerScrapingRequest {
  source_id: string;
  force?: boolean; // Ignoruj next_scrape_at
}

export interface SearchDocumentsRequest {
  query: string;
  document_types?: DocumentType[];
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface SearchDocumentsResponse {
  documents: Array<ProcessedDocument & { similarity: number }>;
  total: number;
}

export interface DataSourceStats {
  total_sources: number;
  active_sources: number;
  total_documents: number;
  documents_by_type: Record<DocumentType, number>;
  last_scrape_time: string | null;
  next_scrape_time: string | null;
  scraping_errors_last_24h: number;
}

// Predefiniowane źródła danych

export interface PredefinedSource {
  name: string;
  type: DataSourceType;
  url: string;
  description: string;
  scraping_frequency: ScrapingFrequency;
  scraping_config: ScrapingConfig;
  icon?: string;
  category: string;
}

export const PREDEFINED_SOURCES: PredefinedSource[] = [
  // Portale prawne
  {
    name: "ISAP - Internetowy System Aktów Prawnych",
    type: "legal",
    url: "https://isap.sejm.gov.pl",
    description: "Oficjalna baza aktów prawnych Sejmu RP",
    scraping_frequency: "weekly",
    scraping_config: {
      search_params: {
        category: "samorzad",
      },
    },
    icon: "Scale",
    category: "Prawo",
  },
  {
    name: "Lexlege - Baza Aktów Prawnych",
    type: "legal",
    url: "https://lexlege.pl",
    description: "Kompleksowa baza aktów prawnych",
    scraping_frequency: "weekly",
    scraping_config: {},
    icon: "BookOpen",
    category: "Prawo",
  },
  {
    name: "Monitor Polski",
    type: "legal",
    url: "https://monitorpolski.gov.pl",
    description: "Dziennik urzędowy RP - akty wykonawcze",
    scraping_frequency: "daily",
    scraping_config: {},
    icon: "FileText",
    category: "Prawo",
  },

  // Serwisy dla radnych
  {
    name: "Portal Samorządowy",
    type: "councilor",
    url: "https://portalsamorzadowy.pl",
    description: "Informacje, szkolenia i narzędzia dla samorządowców",
    scraping_frequency: "daily",
    scraping_config: {
      selectors: {
        news_list: ".article",
        title: "h2",
        content: ".content",
      },
    },
    icon: "Users",
    category: "Dla radnych",
  },
  {
    name: "Związek Gmin Wiejskich RP",
    type: "councilor",
    url: "https://zgwrp.org.pl",
    description: "Aktualności i stanowiska ZGW RP",
    scraping_frequency: "weekly",
    scraping_config: {},
    icon: "Home",
    category: "Dla radnych",
  },
  {
    name: "Fundacja Rozwoju Demokracji Lokalnej",
    type: "councilor",
    url: "https://frdl.org.pl",
    description: "Szkolenia, publikacje, projekty dla JST",
    scraping_frequency: "weekly",
    scraping_config: {},
    icon: "GraduationCap",
    category: "Dla radnych",
  },

  // Dane statystyczne
  {
    name: "GUS - Bank Danych Lokalnych",
    type: "statistics",
    url: "https://bdl.stat.gov.pl",
    description: "Dane demograficzne, ekonomiczne, społeczne",
    scraping_frequency: "monthly",
    scraping_config: {
      api_endpoint: "/api/v1/data",
    },
    icon: "BarChart",
    category: "Statystyki",
  },
  {
    name: "Ministerstwo Finansów - Budżety JST",
    type: "statistics",
    url: "https://www.gov.pl/web/finanse",
    description: "Dane budżetowe jednostek samorządu terytorialnego",
    scraping_frequency: "monthly",
    scraping_config: {},
    icon: "DollarSign",
    category: "Statystyki",
  },

  // Parki narodowe
  {
    name: "Drawieński Park Narodowy",
    type: "national_park",
    url: "https://www.dpn.pl",
    description: "Aktualności, wydarzenia, ochrona przyrody",
    scraping_frequency: "weekly",
    scraping_config: {
      selectors: {
        news_list: ".news-item",
        title: "h2",
        content: ".content",
      },
    },
    icon: "Trees",
    category: "Instytucje lokalne",
  },

  // Szpitale
  {
    name: "Szpital Powiatowy w Drawsku",
    type: "hospital",
    url: "https://szpital-drawsko.pl",
    description: "Informacje o szpitalu, godziny przyjęć, ogłoszenia",
    scraping_frequency: "daily",
    scraping_config: {
      selectors: {
        news_list: ".announcement",
        title: "h3",
        content: ".text",
      },
    },
    icon: "Hospital",
    category: "Instytucje lokalne",
  },

  // Szkoły
  {
    name: "Szkoły w Gminie Drawno",
    type: "school",
    url: "https://szkoly.drawno.pl",
    description: "Aktualności ze szkół, wydarzenia, ogłoszenia",
    scraping_frequency: "daily",
    scraping_config: {},
    icon: "School",
    category: "Instytucje lokalne",
  },

  // Kultura
  {
    name: "Gminny Ośrodek Kultury",
    type: "cultural",
    url: "https://gok.drawno.pl",
    description: "Wydarzenia kulturalne, wystawy, koncerty",
    scraping_frequency: "daily",
    scraping_config: {},
    icon: "Theater",
    category: "Instytucje lokalne",
  },
  {
    name: "Biblioteka Publiczna",
    type: "cultural",
    url: "https://biblioteka.drawno.pl",
    description: "Nowości książkowe, wydarzenia, godziny otwarcia",
    scraping_frequency: "weekly",
    scraping_config: {},
    icon: "Library",
    category: "Instytucje lokalne",
  },

  // Ochrona środowiska
  {
    name: "WIOŚ - Wojewódzki Inspektorat Ochrony Środowiska",
    type: "environmental",
    url: "https://www.wios.szczecin.pl",
    description: "Raporty o stanie środowiska, kontrole, decyzje",
    scraping_frequency: "weekly",
    scraping_config: {},
    icon: "Leaf",
    category: "Środowisko",
  },

  // Transport
  {
    name: "PKS - Rozkład jazdy",
    type: "transport",
    url: "https://pks.drawno.pl",
    description: "Rozkład jazdy, zmiany w kursach, ogłoszenia",
    scraping_frequency: "daily",
    scraping_config: {},
    icon: "Bus",
    category: "Transport",
  },

  // Służby ratunkowe
  {
    name: "Straż Pożarna - OSP Drawno",
    type: "emergency",
    url: "https://osp.drawno.pl",
    description: "Interwencje, szkolenia, apele",
    scraping_frequency: "daily",
    scraping_config: {},
    icon: "Siren",
    category: "Bezpieczeństwo",
  },
];

// Pomocnicze funkcje

export function getSourceTypeLabel(type: DataSourceType): string {
  const labels: Record<DataSourceType, string> = {
    municipality: "Strona gminy",
    bip: "BIP",
    legal: "Portal prawny",
    councilor: "Serwis dla radnych",
    statistics: "Dane statystyczne",
    national_park: "Park narodowy",
    hospital: "Szpital",
    school: "Szkoła",
    cultural: "Kultura",
    environmental: "Środowisko",
    transport: "Transport",
    emergency: "Służby ratunkowe",
    custom: "Własne źródło",
  };
  return labels[type];
}

export function getDocumentTypeLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    resolution: "Uchwała",
    protocol: "Protokół",
    news: "Aktualność",
    legal_act: "Akt prawny",
    announcement: "Ogłoszenie",
    article: "Artykuł",
  };
  return labels[type];
}

export function getFrequencyLabel(frequency: ScrapingFrequency): string {
  const labels: Record<ScrapingFrequency, string> = {
    hourly: "Co godzinę",
    daily: "Codziennie",
    weekly: "Co tydzień",
    monthly: "Co miesiąc",
    manual: "Ręcznie",
  };
  return labels[frequency];
}

export function getStatusColor(status: ScrapingStatus): string {
  const colors: Record<ScrapingStatus, string> = {
    success: "text-success",
    error: "text-danger",
    partial: "text-warning",
    skipped: "text-text-secondary",
  };
  return colors[status];
}
