import OpenAI from "openai";
export declare function createOpenAIClient(apiKey?: string): OpenAI;
export declare const MODELS: {
    readonly GPT4_VISION: "gpt-4-vision-preview";
    readonly GPT4_TURBO: "gpt-4-turbo-preview";
    readonly GPT4: "gpt-4";
    readonly GPT35_TURBO: "gpt-3.5-turbo";
    readonly EMBEDDING: "text-embedding-3-small";
};
export declare const DETERMINISTIC_PARAMS: {
    readonly temperature: 0;
    readonly top_p: 1;
    readonly frequency_penalty: 0;
    readonly presence_penalty: 0;
};
export declare function extractTextFromImage(client: OpenAI, imageBase64: string, mimeType: string): Promise<{
    text: string;
    qualityScore: number;
    metadata: Record<string, unknown>;
}>;
export declare function generateSummary(client: OpenAI, text: string, promptVersion?: string): Promise<{
    summary: string;
    keyPoints: string[];
    tokensUsed: number;
}>;
export declare function scanForRisks(client: OpenAI, text: string, promptVersion?: string): Promise<{
    risks: Array<{
        type: string;
        description: string;
        severity: "low" | "medium" | "high";
        citation: string;
    }>;
    tokensUsed: number;
}>;
export declare function generateEmbedding(client: OpenAI, text: string): Promise<number[]>;
export declare function chunkText(text: string, maxTokens?: number, overlap?: number): string[];
export declare function detectDocumentRelations(client: OpenAI, sourceText: string, targetText: string): Promise<{
    relationType: "amends" | "repeals" | "implements" | "references" | null;
    description: string;
    confidence: number;
}>;
//# sourceMappingURL=openai.d.ts.map