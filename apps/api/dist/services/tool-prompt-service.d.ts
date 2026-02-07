/**
 * ToolPromptService - Dedykowane prompty systemowe dla narzędzi ChatAI
 */
export type ToolType = "speech" | "interpelation" | "letter" | "protocol" | "budget" | "application" | "resolution" | "report" | "script";
interface ToolPromptConfig {
    systemPrompt: string;
    outputFormat: string;
}
export declare class ToolPromptService {
    /**
     * Pobiera konfigurację promptu dla danego narzędzia
     */
    static getPromptConfig(toolType: ToolType): ToolPromptConfig | null;
    /**
     * Buduje pełny prompt systemowy dla narzędzia
     */
    static buildSystemPrompt(toolType: ToolType): string;
    /**
     * Sprawdza czy typ narzędzia jest prawidłowy
     */
    static isValidToolType(type: string): type is ToolType;
    /**
     * Zwraca listę dostępnych typów narzędzi
     */
    static getAvailableTools(): ToolType[];
}
export {};
//# sourceMappingURL=tool-prompt-service.d.ts.map