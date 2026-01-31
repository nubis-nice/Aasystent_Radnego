/**
 * Sentry Error Monitoring - Placeholder Configuration
 *
 * Aby włączyć Sentry:
 * 1. npm install @sentry/node w apps/api
 * 2. Ustaw SENTRY_DSN w zmiennych środowiskowych
 * 3. Odkomentuj kod poniżej
 */
/**
 * Inicjalizacja Sentry (placeholder)
 */
export declare function initSentry(): void;
/**
 * Raportuj błąd do Sentry
 */
export declare function captureException(error: Error, context?: Record<string, unknown>): void;
/**
 * Raportuj wiadomość do Sentry
 */
export declare function captureMessage(message: string, level?: "info" | "warning" | "error"): void;
/**
 * Ustaw kontekst użytkownika
 */
export declare function setUser(user: {
    id: string;
    email?: string;
}): void;
/**
 * Ustaw tag
 */
export declare function setTag(key: string, value: string): void;
declare const _default: {
    init: typeof initSentry;
    captureException: typeof captureException;
    captureMessage: typeof captureMessage;
    setUser: typeof setUser;
    setTag: typeof setTag;
};
export default _default;
//# sourceMappingURL=sentry.d.ts.map