/**
 * Chat Helpers
 * Funkcje pomocnicze dla chat.ts - bridge między starym kodem a nową architekturą AI
 */

import OpenAI from "openai";
import { getConfigResolver } from "./ai-config-resolver.js";

/**
 * Pobierz konfigurację AI dla użytkownika w formacie kompatybilnym ze starym kodem chat.ts
 * To jest bridge między starą architekturą a nową
 */
export async function getChatAIConfig(userId: string): Promise<{
  apiKey: string;
  baseUrl: string | undefined;
  model: string;
  embeddingModel: string;
  provider: string;
}> {
  const resolver = getConfigResolver();
  const config = await resolver.resolve(userId);

  // Pobierz konfigurację LLM
  const llmConfig = config.llm;
  const embConfig = config.embeddings;

  return {
    apiKey: llmConfig?.apiKey || "",
    baseUrl: llmConfig?.baseUrl,
    model: llmConfig?.modelName || process.env.OPENAI_MODEL || "gpt-4o-mini",
    embeddingModel: embConfig?.modelName || "text-embedding-3-small",
    provider: llmConfig?.provider || "openai",
  };
}

/**
 * Utwórz klienta OpenAI z konfiguracji użytkownika
 */
export async function createChatClient(userId: string): Promise<{
  openai: OpenAI;
  embeddingsClient: OpenAI;
  model: string;
  embeddingModel: string;
  provider: string;
}> {
  const config = await getChatAIConfig(userId);

  const clientConfig: ConstructorParameters<typeof OpenAI>[0] = {
    apiKey: config.apiKey || "dummy-key",
    baseURL: config.baseUrl,
  };

  // Google Gemini native API używa x-goog-api-key
  if (
    config.provider === "google" &&
    config.baseUrl &&
    !config.baseUrl.includes("/openai")
  ) {
    clientConfig.defaultHeaders = {
      "x-goog-api-key": config.apiKey,
    };
    clientConfig.apiKey = "dummy";
  }

  const openai = new OpenAI(clientConfig);

  // Dla embeddings - zawsze używaj OpenAI API jeśli możliwe
  const resolver = getConfigResolver();
  const fullConfig = await resolver.resolve(userId);
  const embConfig = fullConfig.embeddings;

  const embeddingsClientConfig: ConstructorParameters<typeof OpenAI>[0] = {
    apiKey: embConfig?.apiKey || config.apiKey || "dummy-key",
    baseURL: embConfig?.baseUrl,
  };

  const embeddingsClient = new OpenAI(embeddingsClientConfig);

  return {
    openai,
    embeddingsClient,
    model: config.model,
    embeddingModel: config.embeddingModel,
    provider: config.provider,
  };
}
