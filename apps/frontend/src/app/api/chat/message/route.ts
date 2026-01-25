import { NextRequest, NextResponse } from "next/server";

// Zwiększony timeout dla długich operacji AI (5 minut)
export const maxDuration = 300;

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Brak tokenu autoryzacji" },
        { status: 401 },
      );
    }

    // Proxy do backendu z dłuższym timeoutem
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4 * 60 * 1000); // 4 minuty

    try {
      const response = await fetch(`${API_URL}/api/chat/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({
        error: "PARSE_ERROR",
        message: `Błąd parsowania odpowiedzi: HTTP ${response.status}`,
      }));

      // Loguj błędy backendu
      if (!response.ok) {
        console.error("[API Route] Backend error:", {
          status: response.status,
          error: data.error,
          message: data.message,
          details: data.details,
        });
      }

      return NextResponse.json(data, { status: response.status });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json(
          {
            error: "TIMEOUT",
            message:
              "Przekroczono czas oczekiwania na odpowiedź AI. Spróbuj ponownie.",
          },
          { status: 504 },
        );
      }

      throw fetchError;
    }
  } catch (error) {
    console.error("[API Route] Chat message error:", error);

    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: error instanceof Error ? error.message : "Błąd serwera",
      },
      { status: 500 },
    );
  }
}
