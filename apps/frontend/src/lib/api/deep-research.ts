/**
 * Deep Research API Client
 * Agent AI "Winsdurf" - Deep Internet Researcher
 */

import type {
  DeepResearchRequest,
  DeepResearchReport,
} from "@shared/types/deep-research";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export async function performResearch(
  request: DeepResearchRequest,
  token: string
): Promise<DeepResearchReport> {
  const response = await fetch(`${API_URL}/api/research`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to perform research");
  }

  const data = await response.json();
  return data.report;
}

export async function getResearchHistory(token: string): Promise<any[]> {
  const response = await fetch(`${API_URL}/api/research/history`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to fetch research history");
  }

  const data = await response.json();
  return data.reports;
}

export async function getResearchReport(
  id: string,
  token: string
): Promise<DeepResearchReport> {
  const response = await fetch(`${API_URL}/api/research/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to fetch research report");
  }

  const data = await response.json();
  return data.report;
}

export async function deleteResearchReport(
  id: string,
  token: string
): Promise<void> {
  const response = await fetch(`${API_URL}/api/research/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to delete research report");
  }
}

export async function getProvidersStatus(token: string): Promise<any[]> {
  const response = await fetch(`${API_URL}/api/research/providers/status`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to fetch providers status");
  }

  const data = await response.json();
  return data.providers;
}
