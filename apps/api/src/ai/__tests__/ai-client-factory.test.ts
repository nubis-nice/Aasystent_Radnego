/**
 * Testy jednostkowe dla AIClientFactory
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AIClientFactory } from "../ai-client-factory.js";
import { AIError } from "../types.js";

// Mock AIConfigResolver
vi.mock("../ai-config-resolver.js", () => ({
  getConfigResolver: vi.fn(() => ({
    resolveFunction: vi.fn(),
    resolve: vi.fn(),
    invalidateCache: vi.fn(),
    clearCache: vi.fn(),
  })),
  AIConfigResolver: vi.fn(),
}));

describe("AIClientFactory", () => {
  let factory: AIClientFactory;
  let mockResolveFunction: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock resolver
    const { getConfigResolver } = await import("../ai-config-resolver.js");
    mockResolveFunction = vi.fn();
    (getConfigResolver as ReturnType<typeof vi.fn>).mockReturnValue({
      resolveFunction: mockResolveFunction,
      resolve: vi.fn(),
      invalidateCache: vi.fn(),
      clearCache: vi.fn(),
    });

    factory = new AIClientFactory();
  });

  describe("getConfig", () => {
    it("powinien zwrócić konfigurację dla funkcji LLM", async () => {
      const mockConfig = {
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test-key",
        modelName: "gpt-4",
        timeoutSeconds: 60,
        maxRetries: 3,
      };

      mockResolveFunction.mockResolvedValue(mockConfig);

      const config = await factory.getConfig("user-123", "llm");

      expect(config).toEqual(mockConfig);
      expect(mockResolveFunction).toHaveBeenCalledWith("user-123", "llm");
    });

    it("powinien rzucić AIError gdy brak konfiguracji", async () => {
      mockResolveFunction.mockResolvedValue(null);

      await expect(factory.getConfig("user-123", "llm")).rejects.toThrow(
        AIError,
      );
    });

    it("powinien rzucić AIError z odpowiednim komunikatem", async () => {
      mockResolveFunction.mockResolvedValue(null);

      try {
        await factory.getConfig("user-123", "vision");
        expect.fail("Powinien rzucić błąd");
      } catch (error) {
        expect(error).toBeInstanceOf(AIError);
        expect((error as AIError).message).toContain("vision");
      }
    });
  });

  describe("getLLMClient", () => {
    it("powinien zwrócić klienta OpenAI", async () => {
      const mockConfig = {
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test-key",
        modelName: "gpt-4",
        timeoutSeconds: 60,
        maxRetries: 3,
      };

      mockResolveFunction.mockResolvedValue(mockConfig);

      const client = await factory.getLLMClient("user-123");

      expect(client).toBeDefined();
      expect(typeof client.chat).toBe("object");
    });
  });

  describe("cache management", () => {
    it("powinien użyć cache dla kolejnych wywołań", async () => {
      const mockConfig = {
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test-key",
        modelName: "gpt-4",
        timeoutSeconds: 60,
        maxRetries: 3,
      };

      mockResolveFunction.mockResolvedValue(mockConfig);

      // Pierwsze wywołanie
      const client1 = await factory.getLLMClient("user-123");
      // Drugie wywołanie - powinno użyć cache
      const client2 = await factory.getLLMClient("user-123");

      expect(client1).toBe(client2);
      expect(mockResolveFunction).toHaveBeenCalledTimes(1);
    });

    it("powinien invalidować cache dla użytkownika", async () => {
      const mockConfig = {
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test-key",
        modelName: "gpt-4",
        timeoutSeconds: 60,
        maxRetries: 3,
      };

      mockResolveFunction.mockResolvedValue(mockConfig);

      await factory.getLLMClient("user-123");
      factory.invalidateCache("user-123");
      await factory.getLLMClient("user-123");

      // Po invalidacji powinno być 2 wywołania
      expect(mockResolveFunction).toHaveBeenCalledTimes(2);
    });

    it("powinien wyczyścić cały cache", async () => {
      const mockConfig = {
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test-key",
        modelName: "gpt-4",
        timeoutSeconds: 60,
        maxRetries: 3,
      };

      mockResolveFunction.mockResolvedValue(mockConfig);

      await factory.getLLMClient("user-1");
      await factory.getLLMClient("user-2");
      factory.clearCache();
      await factory.getLLMClient("user-1");
      await factory.getLLMClient("user-2");

      // 2 przed clear + 2 po clear = 4
      expect(mockResolveFunction).toHaveBeenCalledTimes(4);
    });
  });

  describe("różne typy klientów", () => {
    const mockConfig = {
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test-key",
      modelName: "gpt-4",
      timeoutSeconds: 60,
      maxRetries: 3,
    };

    beforeEach(() => {
      mockResolveFunction.mockResolvedValue(mockConfig);
    });

    it("powinien utworzyć klienta Embeddings", async () => {
      const client = await factory.getEmbeddingsClient("user-123");
      expect(client).toBeDefined();
      expect(mockResolveFunction).toHaveBeenCalledWith(
        "user-123",
        "embeddings",
      );
    });

    it("powinien utworzyć klienta Vision", async () => {
      const client = await factory.getVisionClient("user-123");
      expect(client).toBeDefined();
      expect(mockResolveFunction).toHaveBeenCalledWith("user-123", "vision");
    });

    it("powinien utworzyć klienta STT", async () => {
      const client = await factory.getSTTClient("user-123");
      expect(client).toBeDefined();
      expect(mockResolveFunction).toHaveBeenCalledWith("user-123", "stt");
    });

    it("powinien utworzyć klienta TTS", async () => {
      const client = await factory.getTTSClient("user-123");
      expect(client).toBeDefined();
      expect(mockResolveFunction).toHaveBeenCalledWith("user-123", "tts");
    });
  });

  describe("custom headers", () => {
    it("powinien obsługiwać custom headers w konfiguracji", async () => {
      const mockConfig = {
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        apiKey: "sk-ant-test",
        modelName: "claude-3",
        timeoutSeconds: 120,
        maxRetries: 2,
        customHeaders: {
          "anthropic-version": "2024-01-01",
        },
      };

      mockResolveFunction.mockResolvedValue(mockConfig);

      const client = await factory.getLLMClient("user-123");
      expect(client).toBeDefined();
    });
  });
});
