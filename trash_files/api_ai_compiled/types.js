/**
 * AI Provider Types
 * Typy i interfejsy dla systemu zarządzania providerami AI
 */
// ═══════════════════════════════════════════════════════════════════════════
// Błędy
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Kody błędów AI
 */
export var AIErrorCode;
(function (AIErrorCode) {
    AIErrorCode["AUTHENTICATION_ERROR"] = "AUTH_ERROR";
    AIErrorCode["RATE_LIMIT"] = "RATE_LIMIT";
    AIErrorCode["MODEL_NOT_FOUND"] = "MODEL_NOT_FOUND";
    AIErrorCode["PROVIDER_UNAVAILABLE"] = "PROVIDER_UNAVAILABLE";
    AIErrorCode["INVALID_REQUEST"] = "INVALID_REQUEST";
    AIErrorCode["TIMEOUT"] = "TIMEOUT";
    AIErrorCode["CONFIGURATION_ERROR"] = "CONFIG_ERROR";
    AIErrorCode["UNSUPPORTED_FUNCTION"] = "UNSUPPORTED_FUNCTION";
})(AIErrorCode || (AIErrorCode = {}));
/**
 * Błąd AI
 */
export class AIError extends Error {
    code;
    provider;
    functionType;
    cause;
    constructor(message, code, provider, functionType, cause) {
        super(message);
        this.code = code;
        this.provider = provider;
        this.functionType = functionType;
        this.cause = cause;
        this.name = "AIError";
    }
}
//# sourceMappingURL=types.js.map