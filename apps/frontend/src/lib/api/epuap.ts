/**
 * ePUAP API Client
 * Klient dla integracji z ePUAP
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function getAccessToken(): Promise<string> {
  if (typeof window === "undefined") return "";
  const { supabase } = await import("@/lib/supabase/client");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || "";
}

async function getAuthHeaders() {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Typy
export interface EPUAPMessage {
  id: string;
  messageId: string;
  sender: string;
  senderName: string;
  recipient: string;
  subject: string;
  content?: string;
  attachments: EPUAPAttachment[];
  receivedAt: string;
  status: "new" | "read" | "processed" | "archived";
  documentType?: string;
  caseNumber?: string;
  metadata: Record<string, unknown>;
}

export interface EPUAPAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  downloadUrl?: string;
}

export interface EPUAPSearchParams {
  status?: EPUAPMessage["status"];
  sender?: string;
  dateFrom?: string;
  dateTo?: string;
  documentType?: string;
  limit?: number;
  offset?: number;
}

export interface EPUAPSearchResult {
  success: boolean;
  count: number;
  totalCount: number;
  offset: number;
  items: EPUAPMessage[];
}

export interface EPUAPStats {
  total: number;
  new: number;
  read: number;
  processed: number;
  lastSync?: string;
}

export interface EPUAPStatus {
  success: boolean;
  configured: boolean;
  stats: EPUAPStats;
}

/**
 * Pobierz status integracji ePUAP
 */
export async function getEPUAPStatus(): Promise<EPUAPStatus> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/epuap/status`, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Nie udało się pobrać statusu ePUAP");
  }

  return response.json();
}

/**
 * Wyszukaj wiadomości ePUAP
 */
export async function searchEPUAPMessages(
  params: EPUAPSearchParams = {},
): Promise<EPUAPSearchResult> {
  const headers = await getAuthHeaders();

  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.sender) searchParams.set("sender", params.sender);
  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params.documentType)
    searchParams.set("documentType", params.documentType);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));

  const response = await fetch(
    `${API_URL}/api/epuap/messages?${searchParams.toString()}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error("Nie udało się wyszukać wiadomości ePUAP");
  }

  return response.json();
}

/**
 * Pobierz szczegóły wiadomości
 */
export async function getEPUAPMessage(id: string): Promise<EPUAPMessage> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/epuap/messages/${encodeURIComponent(id)}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error("Nie udało się pobrać wiadomości");
  }

  const data = await response.json();
  return data.message;
}

/**
 * Oznacz wiadomość jako przeczytaną
 */
export async function markMessageAsRead(id: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/epuap/messages/${encodeURIComponent(id)}/read`,
    {
      method: "POST",
      headers,
    },
  );

  if (!response.ok) {
    throw new Error("Nie udało się oznaczyć wiadomości jako przeczytanej");
  }
}

/**
 * Oznacz wiadomość jako przetworzoną
 */
export async function markMessageAsProcessed(
  id: string,
  caseNumber?: string,
): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/epuap/messages/${encodeURIComponent(id)}/process`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ caseNumber }),
    },
  );

  if (!response.ok) {
    throw new Error("Nie udało się oznaczyć wiadomości jako przetworzonej");
  }
}

/**
 * Synchronizuj wiadomości z ePUAP
 */
export async function syncEPUAPMessages(): Promise<{
  synced: number;
  errors: string[];
}> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/epuap/sync`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    throw new Error("Nie udało się zsynchronizować wiadomości");
  }

  const data = await response.json();
  return { synced: data.synced, errors: data.errors };
}

/**
 * Zapisz konfigurację ePUAP
 */
export async function saveEPUAPConfig(config: {
  espAddress: string;
  testMode?: boolean;
}): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/epuap/config`, {
    method: "POST",
    headers,
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error("Nie udało się zapisać konfiguracji");
  }
}
