/**
 * Tool Registry - Rejestr wszystkich dostępnych narzędzi
 */

import type { ToolDefinition, ToolCategory, OpenAITool } from "./types.js";

class ToolRegistryClass {
  private tools: Map<string, ToolDefinition> = new Map();
  private toolsByCategory: Map<ToolCategory, Set<string>> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    
    if (!this.toolsByCategory.has(tool.category)) {
      this.toolsByCategory.set(tool.category, new Set());
    }
    this.toolsByCategory.get(tool.category)!.add(tool.name);
    
    console.log(`[ToolRegistry] Registered tool: ${tool.name} (${tool.category})`);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: ToolCategory): ToolDefinition[] {
    const names = this.toolsByCategory.get(category);
    if (!names) return [];
    return Array.from(names).map(name => this.tools.get(name)!);
  }

  getByCategories(categories: ToolCategory[]): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const category of categories) {
      tools.push(...this.getByCategory(category));
    }
    return tools;
  }

  /**
   * Konwertuje narzędzia do formatu OpenAI Function Calling
   */
  toOpenAIFormat(tools?: ToolDefinition[]): OpenAITool[] {
    const toolList = tools || this.getAll();
    return toolList.map(tool => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        strict: true,
        parameters: {
          type: "object" as const,
          properties: tool.parameters.properties,
          required: tool.parameters.required,
          additionalProperties: false,
        },
      },
    }));
  }

  /**
   * Generuje prompt z opisem narzędzi dla modeli bez native function calling
   */
  toPromptFormat(tools?: ToolDefinition[]): string {
    const toolList = tools || this.getAll();
    
    const toolDescriptions = toolList.map(tool => {
      const params = Object.entries(tool.parameters.properties)
        .map(([name, param]) => {
          const required = tool.parameters.required.includes(name) ? " (wymagany)" : "";
          return `    - ${name}: ${param.description}${required}`;
        })
        .join("\n");
      
      return `- **${tool.name}**: ${tool.description}\n  Parametry:\n${params}`;
    }).join("\n\n");

    return toolDescriptions;
  }

  /**
   * Zwraca listę nazw wszystkich narzędzi
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Sprawdza czy narzędzie istnieje
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Liczba zarejestrowanych narzędzi
   */
  get size(): number {
    return this.tools.size;
  }
}

export const ToolRegistry = new ToolRegistryClass();
