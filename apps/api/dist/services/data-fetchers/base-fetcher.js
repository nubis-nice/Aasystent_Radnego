/**
 * Bazowa klasa dla wszystkich fetchers (API + scraping)
 * Agent AI "Winsdurf" - uniwersalny system pobierania danych
 */
export class BaseDataFetcher {
    config;
    errors = [];
    warnings = [];
    startTime = 0;
    constructor(config) {
        this.config = config;
    }
    logError(message, error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.errors.push(`${message}: ${errorMsg}`);
        console.error(`[${this.config.sourceType}] ${message}`, error);
    }
    logWarning(message) {
        this.warnings.push(message);
        console.warn(`[${this.config.sourceType}] ${message}`);
    }
    async delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    generateContentHash(content) {
        let hash = 0;
        const str = content || "";
        for (let i = 0; i < Math.min(str.length, 10000); i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(8, "0");
    }
    async execute() {
        this.startTime = Date.now();
        this.errors = [];
        this.warnings = [];
        try {
            const documents = await this.fetch();
            return {
                sourceId: this.config.id,
                success: this.errors.length === 0,
                fetchMethod: this.config.fetchMethod,
                itemsFetched: documents.length,
                itemsProcessed: 0,
                errors: this.errors,
                warnings: this.warnings,
                duration: Date.now() - this.startTime,
            };
        }
        catch (error) {
            this.logError("Fatal error during fetch", error);
            return {
                sourceId: this.config.id,
                success: false,
                fetchMethod: this.config.fetchMethod,
                itemsFetched: 0,
                itemsProcessed: 0,
                errors: this.errors,
                warnings: this.warnings,
                duration: Date.now() - this.startTime,
            };
        }
    }
}
//# sourceMappingURL=base-fetcher.js.map