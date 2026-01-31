/**
 * Tool Registry - Rejestr wszystkich dostępnych narzędzi
 */
class ToolRegistryClass {
    tools = new Map();
    toolsByCategory = new Map();
    register(tool) {
        this.tools.set(tool.name, tool);
        if (!this.toolsByCategory.has(tool.category)) {
            this.toolsByCategory.set(tool.category, new Set());
        }
        this.toolsByCategory.get(tool.category).add(tool.name);
        console.log(`[ToolRegistry] Registered tool: ${tool.name} (${tool.category})`);
    }
    get(name) {
        return this.tools.get(name);
    }
    getAll() {
        return Array.from(this.tools.values());
    }
    getByCategory(category) {
        const names = this.toolsByCategory.get(category);
        if (!names)
            return [];
        return Array.from(names).map(name => this.tools.get(name));
    }
    getByCategories(categories) {
        const tools = [];
        for (const category of categories) {
            tools.push(...this.getByCategory(category));
        }
        return tools;
    }
    /**
     * Konwertuje narzędzia do formatu OpenAI Function Calling
     */
    toOpenAIFormat(tools) {
        const toolList = tools || this.getAll();
        return toolList.map(tool => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                strict: true,
                parameters: {
                    type: "object",
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
    toPromptFormat(tools) {
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
    getToolNames() {
        return Array.from(this.tools.keys());
    }
    /**
     * Sprawdza czy narzędzie istnieje
     */
    has(name) {
        return this.tools.has(name);
    }
    /**
     * Liczba zarejestrowanych narzędzi
     */
    get size() {
        return this.tools.size;
    }
}
export const ToolRegistry = new ToolRegistryClass();
//# sourceMappingURL=tool-registry.js.map