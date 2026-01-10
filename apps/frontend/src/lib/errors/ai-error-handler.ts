/**
 * AI-Powered Error Handler
 * Analizuje błędy i generuje pomocne wyjaśnienia dla użytkownika
 */

export interface ErrorExplanation {
  title: string;
  message: string;
  technicalDetails?: string;
  suggestedActions: string[];
  severity: "low" | "medium" | "high" | "critical";
}

export class AIErrorHandler {
  /**
   * Analizuje błąd i zwraca przyjazne wyjaśnienie
   */
  static explain(error: unknown): ErrorExplanation {
    // Network errors
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      return this.explainNetworkError();
    }

    // API errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes("unauthorized") || message.includes("401")) {
        return this.explainAuthError();
      }

      if (message.includes("not found") || message.includes("404")) {
        return this.explainNotFoundError();
      }

      if (message.includes("rate limit") || message.includes("429")) {
        return this.explainRateLimitError();
      }

      if (message.includes("timeout")) {
        return this.explainTimeoutError();
      }

      if (message.includes("openai") || message.includes("api key")) {
        return this.explainOpenAIError(error.message);
      }

      if (message.includes("supabase") || message.includes("database")) {
        return this.explainDatabaseError();
      }

      // Generic error
      return this.explainGenericError(error);
    }

    return this.explainUnknownError();
  }

  private static explainNetworkError(): ErrorExplanation {
    return {
      title: "Brak połączenia z serwerem",
      message:
        "Nie można połączyć się z API. Serwer może być wyłączony lub występują problemy z siecią.",
      technicalDetails: "Failed to fetch - Network request failed",
      suggestedActions: [
        "Sprawdź czy serwer API działa (http://localhost:3001/health)",
        "Zrestartuj serwer API: cd apps/api && npm run dev",
        "Sprawdź czy port 3001 nie jest zajęty",
        "Sprawdź połączenie internetowe",
        "Sprawdź firewall i antywirus",
      ],
      severity: "high",
    };
  }

  private static explainAuthError(): ErrorExplanation {
    return {
      title: "Błąd autoryzacji",
      message:
        "Twoja sesja wygasła lub nie masz uprawnień do wykonania tej operacji.",
      technicalDetails: "401 Unauthorized - Invalid or expired token",
      suggestedActions: [
        "Wyloguj się i zaloguj ponownie",
        "Sprawdź czy token Supabase jest prawidłowy",
        "Sprawdź czy użytkownik ma odpowiednie uprawnienia",
        "Skontaktuj się z administratorem jeśli problem się powtarza",
      ],
      severity: "medium",
    };
  }

  private static explainNotFoundError(): ErrorExplanation {
    return {
      title: "Zasób nie znaleziony",
      message: "Żądany zasób nie istnieje lub został usunięty.",
      technicalDetails: "404 Not Found",
      suggestedActions: [
        "Sprawdź czy URL jest prawidłowy",
        "Odśwież stronę i spróbuj ponownie",
        "Sprawdź czy zasób nie został usunięty",
      ],
      severity: "low",
    };
  }

  private static explainRateLimitError(): ErrorExplanation {
    return {
      title: "Przekroczono limit zapytań",
      message:
        "Wysłano zbyt wiele zapytań w krótkim czasie. Poczekaj chwilę i spróbuj ponownie.",
      technicalDetails: "429 Too Many Requests - Rate limit exceeded",
      suggestedActions: [
        "Poczekaj 1-2 minuty przed kolejną próbą",
        "Sprawdź limit zapytań w ustawieniach API",
        "Rozważ upgrade planu jeśli często przekraczasz limity",
      ],
      severity: "medium",
    };
  }

  private static explainTimeoutError(): ErrorExplanation {
    return {
      title: "Przekroczono czas oczekiwania",
      message:
        "Serwer nie odpowiedział w wymaganym czasie. Operacja może trwać zbyt długo.",
      technicalDetails: "Request timeout",
      suggestedActions: [
        "Spróbuj ponownie za chwilę",
        "Sprawdź czy serwer nie jest przeciążony",
        "Zmniejsz rozmiar zapytania jeśli to możliwe",
        "Sprawdź połączenie internetowe",
      ],
      severity: "medium",
    };
  }

  private static explainOpenAIError(message: string): ErrorExplanation {
    return {
      title: "Błąd OpenAI API",
      message:
        "Problem z połączeniem do OpenAI. Sprawdź konfigurację klucza API.",
      technicalDetails: message,
      suggestedActions: [
        "Przejdź do Ustawienia → Konfiguracja API",
        "Sprawdź czy klucz OpenAI jest prawidłowy",
        "Sprawdź czy masz wystarczające środki na koncie OpenAI",
        "Sprawdź limit zapytań na https://platform.openai.com/usage",
        "Spróbuj wygenerować nowy klucz API",
      ],
      severity: "high",
    };
  }

  private static explainDatabaseError(): ErrorExplanation {
    return {
      title: "Błąd bazy danych",
      message:
        "Problem z połączeniem do bazy danych. Sprawdź konfigurację Supabase.",
      technicalDetails: "Database connection error",
      suggestedActions: [
        "Sprawdź czy projekt Supabase jest aktywny",
        "Sprawdź czy zmienne środowiskowe są prawidłowe",
        "Sprawdź czy migracje zostały uruchomione",
        "Sprawdź status projektu w Supabase Dashboard",
      ],
      severity: "critical",
    };
  }

  private static explainGenericError(error: Error): ErrorExplanation {
    return {
      title: "Wystąpił błąd",
      message: error.message || "Nieoczekiwany błąd. Spróbuj ponownie.",
      technicalDetails: error.stack,
      suggestedActions: [
        "Odśwież stronę i spróbuj ponownie",
        "Sprawdź konsolę przeglądarki (F12) po więcej szczegółów",
        "Skontaktuj się z wsparciem jeśli problem się powtarza",
      ],
      severity: "medium",
    };
  }

  private static explainUnknownError(): ErrorExplanation {
    return {
      title: "Nieznany błąd",
      message: "Wystąpił nieoczekiwany błąd. Spróbuj odświeżyć stronę.",
      suggestedActions: [
        "Odśwież stronę (F5)",
        "Wyczyść cache przeglądarki",
        "Spróbuj w trybie incognito",
        "Sprawdź konsolę przeglądarki po więcej informacji",
      ],
      severity: "medium",
    };
  }

  /**
   * Formatuje błąd do logowania
   */
  static formatForLogging(error: unknown): string {
    const explanation = this.explain(error);
    return `[${explanation.severity.toUpperCase()}] ${explanation.title}: ${
      explanation.message
    }`;
  }
}
