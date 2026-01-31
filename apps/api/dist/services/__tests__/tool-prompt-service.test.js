import { describe, it, expect } from "vitest";
import { ToolPromptService } from "../tool-prompt-service.js";
describe("ToolPromptService", () => {
    describe("getAvailableTools", () => {
        it("should return all 8 tool types", () => {
            const tools = ToolPromptService.getAvailableTools();
            expect(tools).toHaveLength(8);
            expect(tools).toContain("speech");
            expect(tools).toContain("interpelation");
            expect(tools).toContain("letter");
            expect(tools).toContain("protocol");
            expect(tools).toContain("budget");
            expect(tools).toContain("application");
            expect(tools).toContain("resolution");
            expect(tools).toContain("report");
        });
    });
    describe("isValidToolType", () => {
        it("should return true for valid tool types", () => {
            expect(ToolPromptService.isValidToolType("speech")).toBe(true);
            expect(ToolPromptService.isValidToolType("interpelation")).toBe(true);
            expect(ToolPromptService.isValidToolType("letter")).toBe(true);
            expect(ToolPromptService.isValidToolType("protocol")).toBe(true);
            expect(ToolPromptService.isValidToolType("budget")).toBe(true);
            expect(ToolPromptService.isValidToolType("application")).toBe(true);
            expect(ToolPromptService.isValidToolType("resolution")).toBe(true);
            expect(ToolPromptService.isValidToolType("report")).toBe(true);
        });
        it("should return false for invalid tool types", () => {
            expect(ToolPromptService.isValidToolType("invalid")).toBe(false);
            expect(ToolPromptService.isValidToolType("")).toBe(false);
            expect(ToolPromptService.isValidToolType("SPEECH")).toBe(false);
        });
    });
    describe("getPromptConfig", () => {
        it("should return config for valid tool type", () => {
            const config = ToolPromptService.getPromptConfig("speech");
            expect(config).not.toBeNull();
            expect(config?.systemPrompt).toBeDefined();
            expect(config?.outputFormat).toBeDefined();
            expect(config?.systemPrompt).toContain("wystąpień publicznych");
        });
        it("should return config with outputFormat for interpelation", () => {
            const config = ToolPromptService.getPromptConfig("interpelation");
            expect(config).not.toBeNull();
            expect(config?.systemPrompt).toContain("interpelacjach");
            expect(config?.outputFormat).toContain("INTERPELACJA");
        });
        it("should return null for invalid tool type", () => {
            // @ts-expect-error Testing invalid input
            const config = ToolPromptService.getPromptConfig("invalid");
            expect(config).toBeNull();
        });
    });
    describe("buildSystemPrompt", () => {
        it("should build complete prompt for speech tool", () => {
            const prompt = ToolPromptService.buildSystemPrompt("speech");
            expect(prompt).toContain("wystąpień publicznych");
            expect(prompt).toContain("OCZEKIWANY FORMAT ODPOWIEDZI");
            expect(prompt).toContain("Plan wystąpienia");
            expect(prompt).toContain("markdown");
        });
        it("should build complete prompt for budget tool", () => {
            const prompt = ToolPromptService.buildSystemPrompt("budget");
            expect(prompt).toContain("budżet");
            expect(prompt).toContain("OCZEKIWANY FORMAT ODPOWIEDZI");
        });
        it("should return empty string for invalid tool type", () => {
            // @ts-expect-error Testing invalid input
            const prompt = ToolPromptService.buildSystemPrompt("invalid");
            expect(prompt).toBe("");
        });
        it("should include format instructions", () => {
            const prompt = ToolPromptService.buildSystemPrompt("letter");
            expect(prompt).toContain("WAŻNE: Odpowiedz w powyższym formacie");
        });
    });
    describe("tool content validation", () => {
        it("speech prompt should have proper structure", () => {
            const config = ToolPromptService.getPromptConfig("speech");
            expect(config?.systemPrompt).toContain("ZASADY");
            expect(config?.systemPrompt).toContain("STRUKTURA");
            expect(config?.outputFormat).toContain("Wstęp");
            expect(config?.outputFormat).toContain("Argumentacja");
        });
        it("interpelation prompt should reference legal basis", () => {
            const config = ToolPromptService.getPromptConfig("interpelation");
            expect(config?.systemPrompt).toContain("art. 24");
            expect(config?.systemPrompt).toContain("samorządzie gminnym");
        });
        it("resolution prompt should include formal requirements", () => {
            const config = ToolPromptService.getPromptConfig("resolution");
            expect(config?.systemPrompt).toBeDefined();
            expect(config?.outputFormat).toContain("UCHWAŁ");
        });
    });
});
//# sourceMappingURL=tool-prompt-service.test.js.map