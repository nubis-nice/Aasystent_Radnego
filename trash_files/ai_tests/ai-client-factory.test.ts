/**
 * Tests for AIClientFactory
 * Verifies singleton pattern and basic structure
 */

import { describe, it, expect } from "vitest";
import { AIClientFactory, getAIClientFactory } from "../ai-client-factory.js";

describe("AIClientFactory", () => {
  describe("Structure", () => {
    it("should have getLLMClient method", () => {
      const factory = new AIClientFactory();
      expect(typeof factory.getLLMClient).toBe("function");
    });

    it("should have getEmbeddingsClient method", () => {
      const factory = new AIClientFactory();
      expect(typeof factory.getEmbeddingsClient).toBe("function");
    });

    it("should have getVisionClient method", () => {
      const factory = new AIClientFactory();
      expect(typeof factory.getVisionClient).toBe("function");
    });

    it("should have getSTTClient method", () => {
      const factory = new AIClientFactory();
      expect(typeof factory.getSTTClient).toBe("function");
    });

    it("should have getTTSClient method", () => {
      const factory = new AIClientFactory();
      expect(typeof factory.getTTSClient).toBe("function");
    });

    it("should have getConfig method", () => {
      const factory = new AIClientFactory();
      expect(typeof factory.getConfig).toBe("function");
    });

    it("should have getFullConfig method", () => {
      const factory = new AIClientFactory();
      expect(typeof factory.getFullConfig).toBe("function");
    });

    it("should have invalidateCache method", () => {
      const factory = new AIClientFactory();
      expect(typeof factory.invalidateCache).toBe("function");
    });

    it("should have clearCache method", () => {
      const factory = new AIClientFactory();
      expect(typeof factory.clearCache).toBe("function");
    });
  });

  describe("Cache Operations", () => {
    it("should invalidate cache without throwing", () => {
      const factory = new AIClientFactory();
      expect(() => factory.invalidateCache("user-123")).not.toThrow();
    });

    it("should clear cache without throwing", () => {
      const factory = new AIClientFactory();
      expect(() => factory.clearCache()).not.toThrow();
    });
  });
});

describe("getAIClientFactory Singleton", () => {
  it("should return same instance on multiple calls", () => {
    const factory1 = getAIClientFactory();
    const factory2 = getAIClientFactory();

    expect(factory1).toBe(factory2);
  });

  it("should return AIClientFactory instance", () => {
    const factory = getAIClientFactory();
    expect(factory).toBeInstanceOf(AIClientFactory);
  });

  it("should have all required methods", () => {
    const factory = getAIClientFactory();

    expect(typeof factory.getLLMClient).toBe("function");
    expect(typeof factory.getEmbeddingsClient).toBe("function");
    expect(typeof factory.getVisionClient).toBe("function");
    expect(typeof factory.getSTTClient).toBe("function");
    expect(typeof factory.getTTSClient).toBe("function");
    expect(typeof factory.getConfig).toBe("function");
    expect(typeof factory.invalidateCache).toBe("function");
    expect(typeof factory.clearCache).toBe("function");
  });
});
