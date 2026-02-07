/**
 * RIO API Client
 * Klient dla Regionalnych Izb Obrachunkowych
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
export interface RIODecision {
  id: string;
  rio: string;
  rioCode: string;
  decisionNumber: string;
  decisionDate: string;
  decisionType: "uchwala" | "rozstrzygniecie" | "opinia" | "stanowisko";
  subject: string;
  municipality?: string;
  legalBasis?: string[];
  summary?: string;
  pdfUrl?: string;
  sourceUrl: string;
}

export interface RIOSearchParams {
  rio?: string;
  decisionType?: "uchwala" | "rozstrzygniecie" | "opinia" | "stanowisko";
  municipality?: string;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface RIOSearchResult {
  success: boolean;
  count: number;
  totalCount: number;
  offset: number;
  items: RIODecision[];
}

export interface RIOChamber {
  code: string;
  name: string;
  province: string;
  url: string;
}

export interface RIODecisionType {
  code: string;
  name: string;
}

/**
 * Pobierz listę Regionalnych Izb Obrachunkowych
 */
export async function getRIOChambers(): Promise<RIOChamber[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/rio/chambers`, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Nie udało się pobrać listy RIO");
  }

  const data = await response.json();
  return data.chambers;
}

/**
 * Pobierz listę typów decyzji
 */
export async function getRIODecisionTypes(): Promise<RIODecisionType[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/rio/decision-types`, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Nie udało się pobrać typów decyzji");
  }

  const data = await response.json();
  return data.types;
}

/**
 * Wyszukaj decyzje RIO
 */
export async function searchRIODecisions(
  params: RIOSearchParams,
): Promise<RIOSearchResult> {
  const headers = await getAuthHeaders();

  const searchParams = new URLSearchParams();
  if (params.rio) searchParams.set("rio", params.rio);
  if (params.decisionType)
    searchParams.set("decisionType", params.decisionType);
  if (params.municipality)
    searchParams.set("municipality", params.municipality);
  if (params.query) searchParams.set("query", params.query);
  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));

  const response = await fetch(
    `${API_URL}/api/rio/decisions/search?${searchParams.toString()}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error("Nie udało się wyszukać decyzji RIO");
  }

  return response.json();
}

/**
 * Pobierz szczegóły decyzji
 */
export async function getRIODecisionDetails(id: string): Promise<RIODecision> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/rio/decisions/${encodeURIComponent(id)}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error("Nie udało się pobrać szczegółów decyzji");
  }

  const data = await response.json();
  return data.decision;
}

/**
 * Wyszukaj rozstrzygnięcia dla gminy
 */
export async function searchByMunicipality(
  municipality: string,
  limit: number = 20,
): Promise<RIODecision[]> {
  const headers = await getAuthHeaders();

  const searchParams = new URLSearchParams();
  searchParams.set("municipality", municipality);
  searchParams.set("limit", String(limit));

  const response = await fetch(
    `${API_URL}/api/rio/decisions/municipality?${searchParams.toString()}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error("Nie udało się wyszukać rozstrzygnięć dla gminy");
  }

  const data = await response.json();
  return data.items;
}

/**
 * Wyszukaj decyzje budżetowe
 */
export async function searchBudgetDecisions(
  rio?: string,
  limit: number = 20,
): Promise<RIODecision[]> {
  const headers = await getAuthHeaders();

  const searchParams = new URLSearchParams();
  if (rio) searchParams.set("rio", rio);
  searchParams.set("limit", String(limit));

  const response = await fetch(
    `${API_URL}/api/rio/decisions/budget?${searchParams.toString()}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error("Nie udało się wyszukać decyzji budżetowych");
  }

  const data = await response.json();
  return data.items;
}
