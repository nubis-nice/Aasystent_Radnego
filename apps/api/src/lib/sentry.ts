/**
 * Sentry Error Monitoring - Placeholder Configuration
 *
 * Aby włączyć Sentry:
 * 1. npm install @sentry/node w apps/api
 * 2. Ustaw SENTRY_DSN w zmiennych środowiskowych
 * 3. Odkomentuj kod poniżej
 */

// import * as Sentry from "@sentry/node";

interface SentryConfig {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
}

let isInitialized = false;

/**
 * Inicjalizacja Sentry (placeholder)
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log("[Sentry] SENTRY_DSN not set, skipping initialization");
    return;
  }

  const config: SentryConfig = {
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  };

  // Odkomentuj po zainstalowaniu @sentry/node:
  // Sentry.init({
  //   dsn: config.dsn,
  //   environment: config.environment,
  //   tracesSampleRate: config.tracesSampleRate,
  // });

  console.log(`[Sentry] Would initialize with env: ${config.environment}`);
  isInitialized = true;
}

/**
 * Raportuj błąd do Sentry
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>,
): void {
  if (!isInitialized) {
    console.error("[Sentry] Not initialized, logging error:", error.message);
    if (context) {
      console.error("[Sentry] Context:", context);
    }
    return;
  }

  // Odkomentuj po zainstalowaniu @sentry/node:
  // Sentry.captureException(error, { extra: context });
  console.error("[Sentry] Would capture:", error.message);
}

/**
 * Raportuj wiadomość do Sentry
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
): void {
  if (!isInitialized) {
    console.log(`[Sentry] ${level.toUpperCase()}: ${message}`);
    return;
  }

  // Odkomentuj po zainstalowaniu @sentry/node:
  // Sentry.captureMessage(message, level);
  console.log(`[Sentry] Would capture ${level}: ${message}`);
}

/**
 * Ustaw kontekst użytkownika
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function setUser(user: { id: string; email?: string }): void {
  if (!isInitialized) return;

  // Odkomentuj po zainstalowaniu @sentry/node:
  // Sentry.setUser(user);
}

/**
 * Ustaw tag
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function setTag(key: string, value: string): void {
  if (!isInitialized) return;

  // Odkomentuj po zainstalowaniu @sentry/node:
  // Sentry.setTag(key, value);
}

export default {
  init: initSentry,
  captureException,
  captureMessage,
  setUser,
  setTag,
};
