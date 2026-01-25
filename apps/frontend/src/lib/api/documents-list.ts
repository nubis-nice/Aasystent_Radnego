/**
 * API client dla listy dokumentów
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export type DocumentPriority = "critical" | "high" | "medium" | "low";

/**
 * Dane wyodrębnione przez AI (IntelligentScraper)
 */
export interface LLMAnalysisData {
  relevanceScore: number;
  contentType: string;
  summary: string;
  keyTopics: string[];
  isRelevantForCouncilor: boolean;
  extractedDates: string[];
  extractedEntities: string[];
}

/**
 * Metadane dokumentu z danymi AI
 */
export interface DocumentMetadata {
  llmAnalysis?: LLMAnalysisData;
  pdfLinks?: string[];
  // Dane sesji wyodrębnione przez AI
  sessionInfo?: {
    sessionNumber?: number;
    sessionDate?: string;
    sessionTime?: string;
    sessionLocation?: string;
  };
  [key: string]: unknown;
}

export interface DocumentScore {
  relevanceScore: number;
  urgencyScore: number;
  typeScore: number;
  recencyScore: number;
  totalScore: number;
  priority: DocumentPriority;
  scoringDetails: {
    typeBonus: number;
    keywordBonus: number;
    sessionBonus: number;
    recencyBonus: number;
  };
}

export interface Document {
  id: string;
  title: string;
  document_type: string;
  content: string;
  summary: string | null;
  keywords: string[];
  publish_date: string | null;
  source_url: string | null;
  processed_at: string;
  metadata: DocumentMetadata;
  score?: DocumentScore;
  // Dane sesji (wypełniane przez DocumentNormalizer)
  session_number?: number;
  normalized_publish_date?: string;
}

export interface GetDocumentsRequest {
  search?: string;
  documentType?: string;
  dateFrom?: string;
  dateTo?: string;
  priority?: DocumentPriority;
  sortBy?: "score" | "date" | "title" | "session";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface GetDocumentsResponse {
  documents: Document[];
  total: number;
}

/**
 * Pobierz listę dokumentów z bazy
 */
export async function getDocuments(
  request: GetDocumentsRequest = {},
): Promise<GetDocumentsResponse> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany aby zobaczyć dokumenty");
  }

  const params = new URLSearchParams();

  if (request.search) params.append("search", request.search);
  if (request.documentType) params.append("documentType", request.documentType);
  if (request.dateFrom) params.append("dateFrom", request.dateFrom);
  if (request.dateTo) params.append("dateTo", request.dateTo);
  if (request.priority) params.append("priority", request.priority);
  if (request.sortBy) params.append("sortBy", request.sortBy);
  if (request.sortOrder) params.append("sortOrder", request.sortOrder);
  if (request.limit) params.append("limit", request.limit.toString());
  if (request.offset) params.append("offset", request.offset.toString());

  const response = await fetch(
    `${API_URL}/api/documents?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch documents");
  }

  return response.json();
}

/**
 * Pobierz pojedynczy dokument
 */
export async function getDocument(id: string): Promise<Document> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany aby zobaczyć dokument");
  }

  const response = await fetch(`${API_URL}/api/documents/${id}`, {
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
    throw new Error(error.error || "Failed to fetch document");
  }

  const data = await response.json();
  return data.document;
}

/**
 * Referencja do druku/załącznika w dokumencie
 */
export interface DocumentReference {
  type: "druk" | "attachment" | "resolution" | "protocol" | "report";
  number: string;
  title?: string;
  found: boolean;
  content?: string;
  sourceUrl?: string;
}

/**
 * Analizuj dokument przez AI - profesjonalna analiza z kontekstem RAG
 */
export interface AnalyzeDocumentResponse {
  success: boolean;
  // Async response fields
  async?: boolean;
  taskId?: string;
  message?: string;
  // Document info (always present)
  document: {
    id: string;
    title: string;
    document_type?: string;
    publish_date?: string | null;
    summary?: string | null;
    contentPreview?: string;
  };
  // Sync response fields (only when async=false)
  score?: DocumentScore | null;
  references?: {
    found: number;
    missing: number;
    details: DocumentReference[];
  };
  analysisPrompt?: string;
  systemPrompt?: string;
  chatContext?: {
    type: string;
    documentId: string;
    documentTitle: string;
    hasAdditionalContext: boolean;
    missingReferences: string[];
  };
}

export async function analyzeDocument(
  id: string,
): Promise<AnalyzeDocumentResponse> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Musisz być zalogowany aby analizować dokumenty");
  }

  const response = await fetch(`${API_URL}/api/documents/${id}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to analyze document");
  }

  return response.json();
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

/**
 * Powiązany dokument
 */
export interface RelatedDocument {
  document_id: string;
  depth: number;
  path: string[];
  total_strength: number;
  relation_types: string[];
  document?: {
    id: string;
    title: string;
    document_type: string;
    publish_date: string | null;
    summary: string | null;
    filename?: string;
  };
}

/**
 * Pobierz powiązane dokumenty (załączniki, druki, referencje)
 */
export async function getRelatedDocuments(
  documentId: string,
  maxDepth: number = 3,
  minStrength: number = 0.3,
): Promise<RelatedDocument[]> {
  const token = await getAccessToken();

  if (!token) {
    return [];
  }

  try {
    const response = await fetch(
      `${API_URL}/api/documents/${documentId}/related?maxDepth=${maxDepth}&minStrength=${minStrength}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      console.warn("[getRelatedDocuments] Failed to fetch:", response.status);
      return [];
    }

    const data = await response.json();
    return data.related || [];
  } catch (error) {
    console.error("[getRelatedDocuments] Error:", error);
    return [];
  }
}
