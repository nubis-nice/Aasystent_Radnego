import { supabase } from "@/lib/supabase/client";
import { AIErrorHandler } from "@/lib/errors/ai-error-handler";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SendMessageRequest {
  message: string;
  conversationId?: string;
  includeDocuments?: boolean;
  includeMunicipalData?: boolean;
  temperature?: number;
}

interface Citation {
  documentId?: string;
  documentTitle: string;
  page?: number;
  text: string;
  relevanceScore?: number;
}

interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[];
  createdAt: string;
}

interface SendMessageResponse {
  conversationId: string;
  message: Message;
  relatedDocuments?: Array<{
    id: string;
    title: string;
    relevanceScore: number;
  }>;
}

interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string | null;
  lastMessageAt?: string;
  lastMessageRole?: string | null;
  messageCount?: number;
}

async function getAuthToken(): Promise<string | null> {
  // 1) Spróbuj istniejącej sesji
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;

  // 2) Spróbuj odświeżyć sesję
  const { data: refreshData } = await supabase.auth.refreshSession();
  if (refreshData?.session?.access_token) {
    return refreshData.session.access_token;
  }

  // 3) Ostateczny fallback do lokalStorage (jeśli token był zapisany ręcznie)
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("supabase_access_token");
    if (stored) return stored;
  }

  return null;
}

export async function sendMessage(
  request: SendMessageRequest,
): Promise<SendMessageResponse> {
  const token = await getAuthToken();

  if (!token) {
    const error = new Error(
      "Nie jesteś zalogowany. Zaloguj się aby korzystać z czatu.",
    );
    throw error;
  }

  // Retry logic with exponential backoff
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${API_URL}/api/chat/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(180000), // 3 minute timeout for LLM responses
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: "SERVER_ERROR",
          message: `Błąd serwera: HTTP ${response.status} ${response.statusText}`,
        }));

        // Obsługa specjalnych błędów API (quota, invalid key)
        if (
          errorData.error === "QUOTA_EXCEEDED" ||
          errorData.error === "INVALID_API_KEY"
        ) {
          const apiError = new Error(errorData.message) as Error & {
            code: string;
            details: string;
            billingUrl?: string;
            settingsUrl?: string;
          };
          /* eslint-disable @typescript-eslint/no-explicit-any */
          (apiError as any).code = errorData.error;
          (apiError as any).details = errorData.details;
          (apiError as any).billingUrl = errorData.billingUrl;
          (apiError as any).settingsUrl = errorData.settingsUrl;
          /* eslint-enable @typescript-eslint/no-explicit-any */
          throw apiError;
        }

        const errorMessage =
          errorData.message ||
          errorData.details ||
          errorData.error ||
          `HTTP ${response.status}: ${response.statusText}`;

        // Loguj pełne dane błędu dla debugowania
        console.error("[Chat API] Error response:", {
          status: response.status,
          error: errorData.error,
          message: errorData.message,
          details: errorData.details,
        });

        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(errorMessage);
        }

        // Retry on server errors (5xx)
        lastError = new Error(errorMessage);

        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAY * Math.pow(2, attempt)); // Exponential backoff
          continue;
        }
      } else {
        // Parsuj JSON z obsługą błędów
        try {
          return await response.json();
        } catch (parseError) {
          console.error("[Chat API] JSON parse error:", parseError);
          throw new Error(
            "Otrzymano nieprawidłową odpowiedź z serwera (nie JSON)",
          );
        }
      }
    } catch (error) {
      // Lepsze logowanie błędów
      if (error instanceof Error) {
        lastError = error;
        console.error(
          `[Chat API] Attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
          error.message,
        );
      } else {
        lastError = new Error(`Nieznany błąd: ${String(error)}`);
        console.error(
          `[Chat API] Attempt ${attempt + 1}/${MAX_RETRIES} unknown error:`,
          error,
        );
      }

      // Don't retry on network errors after first attempt
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        throw error; // Immediate fail on network errors
      }

      // Retry on timeout
      if (
        attempt < MAX_RETRIES - 1 &&
        error instanceof Error &&
        error.name === "TimeoutError"
      ) {
        await sleep(RETRY_DELAY * Math.pow(2, attempt));
        continue;
      }

      if (attempt === MAX_RETRIES - 1) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error("Failed to send message after retries");
}

export async function getConversations(): Promise<Conversation[]> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_URL}/api/chat/conversations`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to fetch conversations");
  }

  try {
    const data = await response.json();
    return data.conversations;
  } catch (parseError) {
    console.error("[Chat API] getConversations JSON parse error:", parseError);
    throw new Error("Nieprawidłowa odpowiedź serwera");
  }
}

export async function getConversation(id: string): Promise<{
  conversation: Conversation & { messages: Message[] };
}> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_URL}/api/chat/conversation/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Failed to fetch conversation");
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.error("[Chat API] getConversation JSON parse error:", parseError);
    throw new Error("Nieprawidłowa odpowiedź serwera");
  }
}

export async function deleteConversation(id: string): Promise<void> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  try {
    const response = await fetch(`${API_URL}/api/chat/conversation/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || "Failed to delete conversation");
    }
  } catch (error) {
    console.error("Delete conversation error:", error);
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("Request timeout - sprawdź połączenie z serwerem");
    }
    throw error;
  }
}
