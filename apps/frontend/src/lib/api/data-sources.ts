/**
 * API client dla źródeł danych
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface DataSource {
  id: string;
  user_id: string;
  name: string;
  source_type: string;
  base_url: string;
  scrape_config: Record<string, unknown>;
  schedule_cron: string;
  is_active: boolean;
  last_scraped_at: string | null;
  created_at: string;
  updated_at: string;
  scraped_count?: number;
  documents_count?: number;
  last_scrape?: {
    status: string;
    created_at: string;
  } | null;
}

export interface ScrapingLog {
  id: string;
  source_id: string;
  status: string;
  items_scraped: number;
  items_processed: number;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface DataSourcesStats {
  sources: {
    total: number;
    active: number;
  };
  documents: {
    total: number;
    byType: Record<string, number>;
    withEmbeddings?: number;
  };
  lastScrape: string | null;
  errorsLast24h: number;
}

export interface ProcessedDocument {
  id: string;
  title: string;
  document_type: string;
  content: string;
  summary: string | null;
  keywords: string[];
  publish_date: string | null;
  source_url: string | null;
  processed_at: string;
  data_sources?: {
    name: string;
    source_type: string;
  };
}

/**
 * Pobierz listę źródeł danych
 */
export async function getDataSources(): Promise<DataSource[]> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const response = await fetch(`${API_URL}/api/data-sources`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to fetch data sources");
  }

  const data = await response.json();
  return data.sources;
}

/**
 * Pobierz szczegóły źródła danych
 */
export async function getDataSource(
  id: string
): Promise<{ source: DataSource; logs: ScrapingLog[] }> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const response = await fetch(`${API_URL}/api/data-sources/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to fetch data source");
  }

  return response.json();
}

/**
 * Utwórz nowe źródło danych
 */
export async function createDataSource(data: {
  name: string;
  source_type: string;
  base_url: string;
  scrape_config?: Record<string, unknown>;
  schedule_cron?: string;
}): Promise<DataSource> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const response = await fetch(`${API_URL}/api/data-sources`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to create data source");
  }

  const result = await response.json();
  return result.source;
}

/**
 * Aktualizuj źródło danych
 */
export async function updateDataSource(
  id: string,
  data: Partial<{
    name: string;
    base_url: string;
    scrape_config: Record<string, unknown>;
    schedule_cron: string;
    is_active: boolean;
  }>
): Promise<DataSource> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const response = await fetch(`${API_URL}/api/data-sources/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to update data source");
  }

  const result = await response.json();
  return result.source;
}

/**
 * Usuń źródło danych
 */
export async function deleteDataSource(id: string): Promise<void> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const response = await fetch(`${API_URL}/api/data-sources/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to delete data source");
  }
}

/**
 * Uruchom scraping dla źródła
 */
export async function triggerScraping(
  id: string
): Promise<{ message: string; status: string }> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const response = await fetch(`${API_URL}/api/data-sources/${id}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to trigger scraping");
  }

  return response.json();
}

/**
 * Pobierz dokumenty ze źródeł danych
 */
export async function getSourceDocuments(params?: {
  search?: string;
  type?: string;
  source_id?: string;
  limit?: number;
  offset?: number;
}): Promise<{ documents: ProcessedDocument[]; total: number }> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append("search", params.search);
  if (params?.type) searchParams.append("type", params.type);
  if (params?.source_id) searchParams.append("source_id", params.source_id);
  if (params?.limit) searchParams.append("limit", params.limit.toString());
  if (params?.offset) searchParams.append("offset", params.offset.toString());

  const response = await fetch(
    `${API_URL}/api/data-sources/documents?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to fetch documents");
  }

  return response.json();
}

/**
 * Pobierz statystyki źródeł danych
 */
export async function getDataSourcesStats(): Promise<DataSourcesStats> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const response = await fetch(`${API_URL}/api/data-sources/stats`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to fetch stats");
  }

  return response.json();
}

/**
 * Wypełnij bazę danymi testowymi
 */
export async function seedTestData(): Promise<{
  success: boolean;
  message: string;
  documentsCreated: number;
}> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const response = await fetch(`${API_URL}/api/data-sources/seed-test-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to seed test data");
  }

  return response.json();
}

/**
 * Usuń dokument z RAG
 */
export async function deleteDocument(
  id: string
): Promise<{ success: boolean; message: string }> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const response = await fetch(`${API_URL}/api/documents/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to delete document");
  }

  return response.json();
}

/**
 * Usuń wiele dokumentów z RAG
 */
export async function deleteDocumentsBulk(
  documentIds: string[]
): Promise<{ success: boolean; deletedCount: number; message: string }> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const response = await fetch(`${API_URL}/api/documents/bulk`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ documentIds }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to delete documents");
  }

  return response.json();
}

/**
 * Usuń WSZYSTKIE dokumenty z RAG
 */
export async function deleteAllDocuments(): Promise<{
  success: boolean;
  deletedCount: number;
  message: string;
}> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const response = await fetch(`${API_URL}/api/documents/all`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to delete all documents");
  }

  return response.json();
}

/**
 * Napraw dokument (usuń i pobierz ponownie)
 */
export async function repairDocument(id: string): Promise<{
  success: boolean;
  message: string;
  documentId?: string;
  contentLength?: number;
  error?: string;
}> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const response = await fetch(`${API_URL}/api/documents/${id}/repair`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to repair document");
  }

  return data;
}

/**
 * Pobierz dokumenty bez treści (błędy OCR)
 */
export async function getEmptyDocuments(): Promise<{
  documents: Array<ProcessedDocument & { reason: string }>;
  total: number;
}> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const response = await fetch(`${API_URL}/api/documents/empty`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to fetch empty documents");
  }

  return response.json();
}

/**
 * Uruchom scraping dla wszystkich aktywnych źródeł (w kolejce)
 */
export async function triggerScrapingAll(
  sourceIds: string[],
  options?: { maxDocumentAgeDays?: number }
): Promise<{
  success: boolean;
  results: Array<{ id: string; status: string; message: string }>;
}> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  const results: Array<{ id: string; status: string; message: string }> = [];

  // Scrapuj źródła sekwencyjnie (kolejka)
  for (const id of sourceIds) {
    try {
      const response = await fetch(`${API_URL}/api/data-sources/${id}/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          maxDocumentAgeDays: options?.maxDocumentAgeDays,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        results.push({ id, status: "success", message: data.message || "OK" });
      } else {
        const error = await response.json().catch(() => ({ error: "Unknown" }));
        results.push({ id, status: "error", message: error.error || "Failed" });
      }
    } catch (err) {
      results.push({
        id,
        status: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  return {
    success: results.every((r) => r.status === "success"),
    results,
  };
}

/**
 * Pomocnicza funkcja do pobierania access token z Supabase
 */
async function getAccessToken(): Promise<string> {
  if (typeof window === "undefined") {
    return "";
  }

  const { supabase } = await import("@/lib/supabase/client");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || "";
}
