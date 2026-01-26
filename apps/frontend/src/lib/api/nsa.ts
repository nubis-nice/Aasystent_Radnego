/**
 * NSA/WSA API Client
 * Klient dla Centralnej Bazy Orzeczeń Sądów Administracyjnych
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
export interface NSAJudgment {
  id: string;
  signature: string;
  court: string;
  courtCode: string;
  judgmentDate: string;
  judgmentType: string;
  caseSymbol: string;
  legalBasis?: string[];
  keywords?: string[];
  thesis?: string;
  hasJustification: boolean;
  isFinal: boolean;
  url: string;
}

export interface NSASearchParams {
  query?: string;
  signature?: string;
  court?: string;
  judgmentType?: string;
  caseSymbol?: string;
  dateFrom?: string;
  dateTo?: string;
  judge?: string;
  withThesis?: boolean;
  withJustification?: boolean;
  isFinal?: boolean;
  limit?: number;
  offset?: number;
}

export interface NSASearchResult {
  success: boolean;
  count: number;
  totalCount: number;
  offset: number;
  items: NSAJudgment[];
}

export interface NSACourt {
  code: string;
  name: string;
}

export interface NSACaseSymbol {
  code: string;
  name: string;
}

/**
 * Pobierz listę sądów administracyjnych
 */
export async function getNSACourts(): Promise<NSACourt[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/nsa/courts`, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Nie udało się pobrać listy sądów");
  }

  const data = await response.json();
  return data.courts;
}

/**
 * Pobierz listę symboli spraw
 */
export async function getNSACaseSymbols(): Promise<NSACaseSymbol[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/nsa/case-symbols`, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Nie udało się pobrać symboli spraw");
  }

  const data = await response.json();
  return data.symbols;
}

/**
 * Wyszukaj orzeczenia
 */
export async function searchNSAJudgments(
  params: NSASearchParams,
): Promise<NSASearchResult> {
  const headers = await getAuthHeaders();

  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set("query", params.query);
  if (params.signature) searchParams.set("signature", params.signature);
  if (params.court) searchParams.set("court", params.court);
  if (params.judgmentType)
    searchParams.set("judgmentType", params.judgmentType);
  if (params.caseSymbol) searchParams.set("caseSymbol", params.caseSymbol);
  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params.judge) searchParams.set("judge", params.judge);
  if (params.withThesis) searchParams.set("withThesis", "1");
  if (params.withJustification) searchParams.set("withJustification", "1");
  if (params.isFinal) searchParams.set("isFinal", "1");
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));

  const response = await fetch(
    `${API_URL}/api/nsa/judgments/search?${searchParams.toString()}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error("Nie udało się wyszukać orzeczeń");
  }

  return response.json();
}

/**
 * Pobierz szczegóły orzeczenia
 */
export async function getNSAJudgmentDetails(id: string): Promise<NSAJudgment> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/nsa/judgments/${encodeURIComponent(id)}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error("Nie udało się pobrać szczegółów orzeczenia");
  }

  const data = await response.json();
  return data.judgment;
}

/**
 * Wyszukaj orzeczenia dotyczące samorządu
 */
export async function searchLocalGovernmentJudgments(
  topic?: string,
  limit: number = 20,
): Promise<NSAJudgment[]> {
  const headers = await getAuthHeaders();

  const searchParams = new URLSearchParams();
  if (topic) searchParams.set("topic", topic);
  searchParams.set("limit", String(limit));

  const response = await fetch(
    `${API_URL}/api/nsa/judgments/local-government?${searchParams.toString()}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error("Nie udało się wyszukać orzeczeń samorządowych");
  }

  const data = await response.json();
  return data.items;
}

/**
 * Wyszukaj orzeczenia po sygnaturze
 */
export async function searchBySignature(
  signature: string,
): Promise<NSAJudgment[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/nsa/judgments/signature/${encodeURIComponent(signature)}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error("Nie udało się wyszukać orzeczeń po sygnaturze");
  }

  const data = await response.json();
  return data.items;
}
