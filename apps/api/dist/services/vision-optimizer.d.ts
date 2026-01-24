/**
 * Vision Optimizer Service
 *
 * Optymalizacja obrazów i promptów dla Vision LLM (Qwen3-VL, GPT-4V, etc.)
 *
 * Funkcje:
 * - Normalizacja obrazów do optymalnej rozdzielczości (768px dla Qwen3-VL)
 * - Kompresja promptów tekstowych
 * - Zoptymalizowane prompty ekstrakcji dokumentów
 */
import { Buffer } from "node:buffer";
export interface VisionOptimizationConfig {
    maxDimension: number;
    quality: number;
    format: "webp" | "png" | "jpeg";
    sharpenText: boolean;
    normalizeContrast: boolean;
    grayscale: boolean;
}
export interface OptimizedImage {
    buffer: Buffer;
    base64: string;
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    dimensions: {
        width: number;
        height: number;
    };
    format: string;
}
export interface CompressedPrompt {
    original: string;
    compressed: string;
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
}
export interface DocumentStructure {
    typ: "uchwała" | "zarządzenie" | "protokół" | "druk" | "faktura" | "umowa" | "pismo" | "inny";
    numer: string | null;
    data: string | null;
    tytul: string;
    organ: string | null;
    streszczenie: string | null;
    osoby: string[];
    kwoty: string[];
    punkty: string[];
}
export declare const EXTRACTION_PROMPTS: {
    ocr: {
        system: string;
        user: string;
    };
    structured: {
        system: string;
        user: string;
    };
    session: {
        system: string;
        user: string;
    };
    classify: {
        system: string;
        user: string;
    };
};
export declare class VisionOptimizer {
    private config;
    constructor(modelName?: string);
    /**
     * Ustaw konfigurację ręcznie
     */
    setConfig(config: Partial<VisionOptimizationConfig>): void;
    /**
     * Pobierz aktualną konfigurację
     */
    getConfig(): VisionOptimizationConfig;
    /**
     * Optymalizuj obraz dla Vision API
     */
    optimizeImage(imageBuffer: Buffer): Promise<OptimizedImage>;
    /**
     * Optymalizuj wiele obrazów (batch)
     */
    optimizeImages(imageBuffers: Buffer[]): Promise<OptimizedImage[]>;
    /**
     * Kompresuj prompt tekstowy
     */
    compressPrompt(prompt: string, maxTokens?: number): CompressedPrompt;
    /**
     * Pobierz zoptymalizowany prompt dla danego typu ekstrakcji
     */
    getExtractionPrompt(type: keyof typeof EXTRACTION_PROMPTS): {
        system: string;
        user: string;
    };
    /**
     * Zbuduj pełny prompt z kontekstem
     */
    buildPrompt(type: keyof typeof EXTRACTION_PROMPTS, additionalContext?: string): {
        system: string;
        user: string;
    };
    /**
     * Prompt do ekstrakcji strukturalnej z tekstu OCR (etap 2)
     * Krótki, zoptymalizowany pod tokeny
     */
    getTextToStructuredPrompt(): {
        system: string;
        user: string;
    };
    /**
     * Parsuj odpowiedź JSON z LLM (z obsługą błędów)
     */
    parseStructuredResponse(response: string): DocumentStructure | null;
    private calculateDimensions;
    private estimateTokens;
    private removeRedundantPhrases;
    private shortenInstructions;
    private truncateToTokens;
    private formatBytes;
}
export declare function getVisionOptimizer(modelName?: string): VisionOptimizer;
export declare function optimizeImageForVision(imageBuffer: Buffer, modelName?: string): Promise<OptimizedImage>;
export declare function compressVisionPrompt(prompt: string, maxTokens?: number): CompressedPrompt;
/**
 * Dwuetapowa ekstrakcja: OCR tekst → Structured JSON
 * Użyj po otrzymaniu tekstu z Vision OCR
 */
export declare function getTextToStructuredPrompt(): {
    system: string;
    user: string;
};
export declare function parseDocumentStructure(response: string): DocumentStructure | null;
//# sourceMappingURL=vision-optimizer.d.ts.map