/**
 * Tool Registry - Rejestr wszystkich dostępnych narzędzi
 */
import type { ToolDefinition, ToolCategory, OpenAITool } from "./types.js";
declare class ToolRegistryClass {
    private tools;
    private toolsByCategory;
    register(tool: ToolDefinition): void;
    get(name: string): ToolDefinition | undefined;
    getAll(): ToolDefinition[];
    getByCategory(category: ToolCategory): ToolDefinition[];
    getByCategories(categories: ToolCategory[]): ToolDefinition[];
    /**
     * Konwertuje narzędzia do formatu OpenAI Function Calling
     */
    toOpenAIFormat(tools?: ToolDefinition[]): OpenAITool[];
    /**
     * Generuje prompt z opisem narzędzi dla modeli bez native function calling
     */
    toPromptFormat(tools?: ToolDefinition[]): string;
    /**
     * Zwraca listę nazw wszystkich narzędzi
     */
    getToolNames(): string[];
    /**
     * Sprawdza czy narzędzie istnieje
     */
    has(name: string): boolean;
    /**
     * Liczba zarejestrowanych narzędzi
     */
    get size(): number;
}
export declare const ToolRegistry: ToolRegistryClass;
export {};
//# sourceMappingURL=tool-registry.d.ts.map