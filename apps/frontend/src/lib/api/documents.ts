/**
 * API client dla operacji na dokumentach
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface CreateDocumentRequest {
  title: string;
  content: string;
  documentType: string;
  summary?: string;
  keywords?: string[];
  conversationId?: string;
}

export interface CreateSummaryRequest {
  query: string;
  documentTypes?: string[];
  conversationId?: string;
}

export interface CreateDocumentResponse {
  success: boolean;
  document: {
    id: string;
    title: string;
    document_type: string;
    content: string;
    summary: string;
    created_at: string;
  };
  message: string;
}

export interface CreateSummaryResponse {
  success: boolean;
  summary: string;
  document: {
    id: string;
    title: string;
    content: string;
  };
  sourceDocuments: number;
}

/**
 * Utwórz nowy dokument na bazie analizy czatu
 */
export async function createDocument(
  request: CreateDocumentRequest
): Promise<CreateDocumentResponse> {
  const response = await fetch(`${API_URL}/api/chat/create-document`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": await getUserId(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create document");
  }

  return response.json();
}

/**
 * Utwórz podsumowanie dokumentów
 */
export async function createSummary(
  request: CreateSummaryRequest
): Promise<CreateSummaryResponse> {
  const response = await fetch(`${API_URL}/api/chat/create-summary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": await getUserId(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create summary");
  }

  return response.json();
}

/**
 * Pomocnicza funkcja do pobierania user ID z Supabase
 */
async function getUserId(): Promise<string> {
  if (typeof window === "undefined") {
    return "";
  }

  const { createBrowserClient } = await import("@supabase/ssr");
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || "";
}
