/**
 * Provider Types
 * Shared types for LLM provider management
 */
/**
 * Provider error
 */
export class ProviderError extends Error {
    code;
    status;
    providerError;
    constructor(message, code, status, providerError) {
        super(message);
        this.code = code;
        this.status = status;
        this.providerError = providerError;
        this.name = "ProviderError";
    }
}
//# sourceMappingURL=provider.js.map