/**
 * Chat Helpers
 * Funkcje pomocnicze dla chat.ts - bridge między starym kodem a nową architekturą AI
 */
import OpenAI from "openai";
/**
 * Pobierz konfigurację AI dla użytkownika w formacie kompatybilnym ze starym kodem chat.ts
 * To jest bridge między starą architekturą a nową
 */
export declare function getChatAIConfig(userId: string): Promise<{
    apiKey: string;
    baseUrl: string | undefined;
    model: string;
    embeddingModel: string;
    provider: string;
}>;
/**
 * Utwórz klienta OpenAI z konfiguracji użytkownika
 */
export declare function createChatClient(userId: string): Promise<{
    openai: OpenAI;
    embeddingsClient: OpenAI;
    model: string;
    embeddingModel: string;
    provider: string;
}>;
//# sourceMappingURL=chat-helpers.d.ts.map