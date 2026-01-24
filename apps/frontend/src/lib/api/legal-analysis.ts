/**
 * Legal Analysis API Client
 * Frontend API client dla silników analitycznych
 */

import { supabase } from "../supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function getAuthHeaders(accessToken?: string) {
  let token = accessToken;

  if (!token) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    token = session?.access_token;
  }

  if (!token) {
    throw new Error("Musisz być zalogowany");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// Legal Search
export interface LegalSearchRequest {
  query: string;
  searchMode?: "fulltext" | "semantic" | "hybrid";
  maxResults?: number;
  filters?: {
    sourceTypes?: string[];
    dateFrom?: string;
    dateTo?: string;
    documentTypes?: string[];
    jurisdiction?: string;
    legalScope?: string[];
  };
}

export interface LegalSearchResult {
  documentId: string;
  title: string;
  content: string;
  excerpt: string;
  relevanceScore: number;
  sourceType: string;
  url?: string;
  publishDate?: string;
  highlights?: string[];
}

export async function searchLegal(
  request: LegalSearchRequest,
  accessToken?: string
): Promise<LegalSearchResult[]> {
  const headers = await getAuthHeaders(accessToken);

  const response = await fetch(`${API_URL}/api/legal/search`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Legal search failed");
  }

  const data = await response.json();
  return data.results;
}

// Legal Reasoning
export interface LegalReasoningRequest {
  question: string;
  analysisType:
    | "legality"
    | "financial_risk"
    | "procedural_compliance"
    | "general";
  context?: {
    documentIds?: string[];
    legalScope?: string[];
    jurisdiction?: string;
  };
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

export async function analyzeLegal(
  request: LegalReasoningRequest,
  accessToken?: string
): Promise<LegalReasoningResponse> {
  const headers = await getAuthHeaders(accessToken);

  const response = await fetch(`${API_URL}/api/legal/reasoning`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Legal reasoning failed");
  }

  const data = await response.json();
  return data.analysis;
}

// Budget Analysis
export interface BudgetAnalysisRequest {
  documentId: string;
  analysisType: "changes" | "compliance" | "risk" | "comparison";
  compareWith?: string;
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

export async function analyzeBudget(
  request: BudgetAnalysisRequest,
  accessToken?: string
): Promise<BudgetAnalysisResult> {
  const headers = await getAuthHeaders(accessToken);

  const response = await fetch(`${API_URL}/api/legal/budget-analysis`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Budget analysis failed");
  }

  const data = await response.json();
  return data.analysis;
}

// Get available analysis types
export interface AnalysisTypes {
  searchModes: { value: string; label: string; description: string }[];
  reasoningTypes: { value: string; label: string; description: string }[];
  budgetAnalysisTypes: { value: string; label: string; description: string }[];
}

export async function getAnalysisTypes(): Promise<AnalysisTypes> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/legal/analysis-types`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch analysis types");
  }

  return await response.json();
}
