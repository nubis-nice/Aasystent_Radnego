import { ProviderError, } from "@aasystent-radnego/shared";
/**
 * Base Provider Adapter
 * Abstract class that all provider adapters must extend
 */
export class BaseProviderAdapter {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Build HTTP headers for requests
     * @returns Headers object
     */
    buildHeaders() {
        const headers = {
            "Content-Type": "application/json",
        };
        // Add authentication based on method
        switch (this.config.authMethod) {
            case "bearer":
                headers["Authorization"] = `Bearer ${this.config.apiKey}`;
                break;
            case "api-key":
                headers["x-api-key"] = this.config.apiKey;
                break;
            case "custom":
                // Custom headers from config
                break;
        }
        // Add custom headers
        if (this.config.customHeaders) {
            Object.assign(headers, this.config.customHeaders);
        }
        return headers;
    }
    /**
     * Build full URL for endpoint
     * @param endpoint - Endpoint path
     * @returns Full URL
     */
    buildUrl(endpoint) {
        const baseUrl = this.config.baseUrl.replace(/\/$/, "");
        const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
        return `${baseUrl}${path}`;
    }
    /**
     * Make HTTP request with retry logic
     * @param url - Request URL
     * @param options - Fetch options
     * @returns Response data
     */
    async makeRequest(url, options) {
        const maxRetries = this.config.maxRetries || 3;
        const timeout = (this.config.timeoutSeconds || 30) * 1000;
        let lastError = null;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    const errorText = await response.text();
                    let errorData;
                    try {
                        errorData = JSON.parse(errorText);
                    }
                    catch {
                        errorData = { message: errorText };
                    }
                    throw new ProviderError(errorData.message || `HTTP ${response.status}`, "HTTP_ERROR", response.status, errorText);
                }
                return await response.json();
            }
            catch (error) {
                lastError = error;
                // Don't retry on authentication errors
                if (error instanceof ProviderError &&
                    (error.status === 401 || error.status === 403)) {
                    throw error;
                }
                // Wait before retry (exponential backoff)
                if (attempt < maxRetries - 1) {
                    await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }
        throw lastError || new Error("Request failed after retries");
    }
    /**
     * Handle and normalize errors
     * @param error - Error object
     * @returns Normalized ProviderError
     */
    handleError(error) {
        if (error instanceof ProviderError) {
            return error;
        }
        if (error instanceof Error) {
            if (error.name === "AbortError") {
                return new ProviderError("Request timeout", "TIMEOUT", undefined, error.message);
            }
            return new ProviderError(error.message, "UNKNOWN_ERROR", undefined, error.stack);
        }
        return new ProviderError("Unknown error occurred", "UNKNOWN_ERROR", undefined, String(error));
    }
    /**
     * Validate configuration
     * @throws Error if configuration is invalid
     */
    validateConfig() {
        if (!this.config.apiKey) {
            throw new Error("API key is required");
        }
        if (!this.config.baseUrl) {
            throw new Error("Base URL is required");
        }
        try {
            new URL(this.config.baseUrl);
        }
        catch {
            throw new Error("Invalid base URL format");
        }
    }
}
//# sourceMappingURL=base.adapter.js.map