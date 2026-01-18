const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
  const { supabase } = await import("@/lib/supabase/client");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  return {
    Authorization: `Bearer ${token}`,
    "x-user-id": userId || "",
  };
}

/**
 * Zapisz klucz API GUS użytkownika
 */
export async function saveGUSApiKey(apiKey: string): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const headers = await getAuthHeaders();

    console.log("[GUS API] Saving API key to:", `${API_URL}/api/gus/api-key`);
    console.log("[GUS API] Headers:", headers);

    const response = await fetch(`${API_URL}/api/gus/api-key`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ apiKey }),
    });

    console.log("[GUS API] Response status:", response.status);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save GUS API key");
    }

    return response.json();
  } catch (error) {
    console.error("[GUS API] Fetch error:", error);
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        "Backend API nie odpowiada. Sprawdź czy serwer działa na http://localhost:3001"
      );
    }
    throw error;
  }
}

/**
 * Wyszukaj gminę po nazwie
 */
export async function searchGmina(name: string): Promise<{
  gmina: {
    id: string;
    name: string;
    level: number;
  };
}> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/gus/gmina/search?name=${encodeURIComponent(name)}`,
    {
      method: "GET",
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to search gmina");
  }

  return response.json();
}

/**
 * Pobierz statystyki gminy
 */
export async function getGminaStats(
  gminaId: string,
  year?: number
): Promise<{
  stats: {
    unitId: string;
    unitName: string;
    level: number;
    variables: Array<{
      id: string;
      name: string;
      value: number;
      year: number;
      unit: string;
    }>;
  };
}> {
  const headers = await getAuthHeaders();

  const url = year
    ? `${API_URL}/api/gus/gmina/${gminaId}/stats?year=${year}`
    : `${API_URL}/api/gus/gmina/${gminaId}/stats`;

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch gmina stats");
  }

  return response.json();
}
