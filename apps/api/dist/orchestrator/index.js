/**
 * Universal Tool Orchestrator
 *
 * Obsługuje zarówno natywne function calling (OpenAI, Ollama)
 * jak i fallback prompt-based dla modeli bez wsparcia.
 */
import OpenAI from "openai";
import { ToolRegistry } from "./tool-registry.js";
const TOOL_SELECTION_SYSTEM_PROMPT = `Jesteś asystentem radnego z dostępem do narzędzi. Przeanalizuj pytanie użytkownika i zdecyduj które narzędzie użyć.

ZASADY:
1. Wybierz JEDNO narzędzie które najlepiej odpowiada na pytanie
2. Jeśli pytanie nie wymaga narzędzia, ustaw action: "none" i podaj odpowiedź
3. Ekstrahuj parametry z pytania użytkownika
4. Zawsze wypełnij pole "thought" wyjaśniając swoje rozumowanie

DOSTĘPNE NARZĘDZIA:
{TOOLS}

Odpowiedz TYLKO w formacie JSON (bez markdown):
{
  "thought": "Twoje rozumowanie dlaczego wybierasz to narzędzie",
  "action": "nazwa_narzedzia",
  "parameters": {"param1": "value1"}
}

Lub jeśli nie potrzebujesz narzędzia:
{
  "thought": "Wyjaśnienie dlaczego odpowiadasz bez narzędzia",
  "action": "none",
  "answer": "Twoja odpowiedź na pytanie"
}`;
const SYNTHESIS_SYSTEM_PROMPT = `Jesteś asystentem radnego. Na podstawie wyników narzędzi, sformułuj pomocną odpowiedź dla użytkownika.

ZASADY:
1. Przedstaw dane w czytelny sposób
2. Użyj polskiego języka
3. Jeśli dane są niekompletne, powiedz o tym
4. Podaj źródło informacji jeśli jest znane
5. Bądź zwięzły ale kompletny`;
export class UniversalToolOrchestrator {
    client;
    config;
    userId;
    supportsNativeTools = null;
    constructor(userId, config) {
        this.userId = userId;
        this.config = config;
        this.client = new OpenAI({
            apiKey: config.apiKey || "not-needed",
            baseURL: config.baseUrl,
        });
    }
    /**
     * Główna metoda przetwarzania wiadomości
     */
    async process(userMessage, conversationHistory = []) {
        const startTime = Date.now();
        const toolsUsed = [];
        let reasoning;
        console.log(`[Orchestrator] Processing: "${userMessage.substring(0, 50)}..."`);
        // Sprawdź wsparcie dla native tools (cache wyniku)
        if (this.supportsNativeTools === null) {
            this.supportsNativeTools = await this.checkNativeToolSupport();
        }
        const context = {
            userId: this.userId,
            userMessage,
            conversationHistory,
        };
        let response;
        let uiAction;
        if (this.supportsNativeTools) {
            console.log("[Orchestrator] Using native function calling");
            const result = await this.processWithNativeTools(userMessage, context);
            response = result.response;
            toolsUsed.push(...result.toolsUsed);
            uiAction = result.uiAction;
            reasoning = result.reasoning;
        }
        else {
            console.log("[Orchestrator] Using prompt-based tool selection");
            const result = await this.processWithPromptBased(userMessage, context);
            response = result.response;
            toolsUsed.push(...result.toolsUsed);
            uiAction = result.uiAction;
            reasoning = result.reasoning;
        }
        return {
            response,
            toolsUsed,
            executionTimeMs: Date.now() - startTime,
            reasoning,
            uiAction,
        };
    }
    /**
     * Przetwarzanie z natywnym function calling
     */
    async processWithNativeTools(userMessage, context) {
        const toolsUsed = [];
        const tools = ToolRegistry.toOpenAIFormat();
        if (tools.length === 0) {
            return { response: await this.simpleChat(userMessage), toolsUsed: [] };
        }
        try {
            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages: [
                    {
                        role: "system",
                        content: "Jesteś asystentem radnego. Używaj dostępnych narzędzi gdy potrzebne.",
                    },
                    { role: "user", content: userMessage },
                ],
                tools,
                tool_choice: "auto",
            });
            const message = response.choices[0]?.message;
            if (!message?.tool_calls || message.tool_calls.length === 0) {
                return { response: message?.content || "", toolsUsed: [] };
            }
            // Wykonaj narzędzia
            const toolResults = [];
            for (const toolCall of message.tool_calls) {
                // Handle both standard and custom tool call formats
                const callData = toolCall;
                if (callData.type !== "function" || !callData.function)
                    continue;
                const toolName = callData.function.name;
                toolsUsed.push(toolName);
                console.log(`[Orchestrator] Executing tool: ${toolName}`);
                const tool = ToolRegistry.get(toolName);
                if (!tool) {
                    toolResults.push({
                        call: {
                            id: callData.id,
                            type: "function",
                            function: callData.function,
                        },
                        result: { success: false, error: `Unknown tool: ${toolName}` },
                    });
                    continue;
                }
                try {
                    const args = JSON.parse(callData.function.arguments);
                    const result = await tool.execute(args, context);
                    toolResults.push({
                        call: {
                            id: callData.id,
                            type: "function",
                            function: callData.function,
                        },
                        result,
                    });
                }
                catch (error) {
                    toolResults.push({
                        call: {
                            id: callData.id,
                            type: "function",
                            function: callData.function,
                        },
                        result: { success: false, error: String(error) },
                    });
                }
            }
            // Syntezuj odpowiedź z wynikami
            const synthesis = await this.synthesizeResponse(userMessage, toolResults);
            return {
                response: synthesis,
                toolsUsed,
                reasoning: `Użyto narzędzi: ${toolsUsed.join(", ")}`,
            };
        }
        catch (error) {
            console.error("[Orchestrator] Native tools error:", error);
            // Fallback do prompt-based
            return this.processWithPromptBased(userMessage, context);
        }
    }
    /**
     * Przetwarzanie prompt-based (fallback)
     */
    async processWithPromptBased(userMessage, context) {
        const toolsUsed = [];
        const toolsDescription = ToolRegistry.toPromptFormat();
        if (!toolsDescription || ToolRegistry.size === 0) {
            return { response: await this.simpleChat(userMessage), toolsUsed: [] };
        }
        const systemPrompt = TOOL_SELECTION_SYSTEM_PROMPT.replace("{TOOLS}", toolsDescription);
        try {
            const selectionResponse = await this.client.chat.completions.create({
                model: this.config.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
                temperature: 0.1,
            });
            const content = selectionResponse.choices[0]?.message?.content || "";
            // Parse JSON response
            let selection;
            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error("No JSON found in response");
                }
                selection = JSON.parse(jsonMatch[0]);
            }
            catch {
                console.error("[Orchestrator] Failed to parse tool selection:", content);
                return { response: await this.simpleChat(userMessage), toolsUsed: [] };
            }
            console.log(`[Orchestrator] Tool selection: ${selection.action}, thought: ${selection.thought}`);
            if (selection.action === "none") {
                return {
                    response: selection.answer || (await this.simpleChat(userMessage)),
                    toolsUsed: [],
                    reasoning: selection.thought,
                };
            }
            // Wykonaj wybrane narzędzie
            const tool = ToolRegistry.get(selection.action);
            if (!tool) {
                console.warn(`[Orchestrator] Unknown tool selected: ${selection.action}`);
                return { response: await this.simpleChat(userMessage), toolsUsed: [] };
            }
            toolsUsed.push(selection.action);
            try {
                const result = await tool.execute(selection.parameters || {}, context);
                if (!result.success) {
                    return {
                        response: `Przepraszam, wystąpił błąd podczas pobierania danych: ${result.error}`,
                        toolsUsed,
                        reasoning: selection.thought,
                    };
                }
                // Syntezuj odpowiedź
                const synthesis = await this.synthesizeFromData(userMessage, selection.action, result);
                return {
                    response: synthesis,
                    toolsUsed,
                    reasoning: selection.thought,
                };
            }
            catch (error) {
                console.error(`[Orchestrator] Tool execution error:`, error);
                return {
                    response: `Przepraszam, wystąpił błąd: ${error}`,
                    toolsUsed,
                    reasoning: selection.thought,
                };
            }
        }
        catch (error) {
            console.error("[Orchestrator] Prompt-based error:", error);
            return { response: await this.simpleChat(userMessage), toolsUsed: [] };
        }
    }
    /**
     * Syntezuj odpowiedź z wyników wielu narzędzi
     */
    async synthesizeResponse(userMessage, toolResults) {
        const resultsDescription = toolResults
            .map(({ call, result }) => {
            const status = result.success ? "SUKCES" : "BŁĄD";
            const data = result.success
                ? JSON.stringify(result.data, null, 2)
                : result.error;
            return `Narzędzie: ${call.function.name}\nStatus: ${status}\nDane:\n${data}`;
        })
            .join("\n\n---\n\n");
        const response = await this.client.chat.completions.create({
            model: this.config.model,
            messages: [
                { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `Pytanie użytkownika: ${userMessage}\n\nWyniki narzędzi:\n${resultsDescription}\n\nSformułuj odpowiedź:`,
                },
            ],
            temperature: 0.3,
        });
        return (response.choices[0]?.message?.content ||
            "Przepraszam, nie udało się przetworzyć wyników.");
    }
    /**
     * Syntezuj odpowiedź z pojedynczego wyniku
     */
    async synthesizeFromData(userMessage, toolName, result) {
        const dataStr = JSON.stringify(result.data, null, 2);
        const response = await this.client.chat.completions.create({
            model: this.config.model,
            messages: [
                { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `Pytanie użytkownika: ${userMessage}\n\nDane z narzędzia ${toolName}:\n${dataStr}\n\nŹródło: ${result.metadata?.source || "nieznane"}\n\nSformułuj odpowiedź:`,
                },
            ],
            temperature: 0.3,
        });
        return (response.choices[0]?.message?.content ||
            "Przepraszam, nie udało się przetworzyć wyników.");
    }
    /**
     * Prosty chat bez narzędzi
     */
    async simpleChat(userMessage) {
        const response = await this.client.chat.completions.create({
            model: this.config.model,
            messages: [
                { role: "system", content: "Jesteś pomocnym asystentem radnego." },
                { role: "user", content: userMessage },
            ],
        });
        return response.choices[0]?.message?.content || "";
    }
    /**
     * Sprawdź czy model wspiera natywne function calling
     */
    async checkNativeToolSupport() {
        // OpenAI modele
        if (this.config.provider === "openai") {
            return true;
        }
        // Ollama - sprawdź czy model wspiera tools
        if (this.config.provider === "ollama" || this.config.provider === "local") {
            const supportedModels = [
                "qwen2.5",
                "qwen2",
                "qwen3",
                "llama3.1",
                "llama3.2",
                "llama3.3",
                "mistral",
                "mixtral",
                "command-r",
                "command-r-plus",
                "phi3",
                "phi4",
                "deepseek",
            ];
            const modelLower = this.config.model.toLowerCase();
            const hasSupport = supportedModels.some((m) => modelLower.includes(m));
            if (hasSupport) {
                // Dodatkowy test - spróbuj wywołać z tools
                try {
                    await this.client.chat.completions.create({
                        model: this.config.model,
                        messages: [{ role: "user", content: "test" }],
                        tools: [
                            {
                                type: "function",
                                function: {
                                    name: "test",
                                    description: "test",
                                    parameters: { type: "object", properties: {}, required: [] },
                                },
                            },
                        ],
                        max_tokens: 1,
                    });
                    console.log(`[Orchestrator] Model ${this.config.model} supports native tools`);
                    return true;
                }
                catch {
                    console.log(`[Orchestrator] Model ${this.config.model} does not support native tools`);
                    return false;
                }
            }
        }
        return false;
    }
}
export { ToolRegistry } from "./tool-registry.js";
export * from "./types.js";
//# sourceMappingURL=index.js.map