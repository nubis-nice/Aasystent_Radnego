/**
 * TTS Text Processor - inteligentne przetwarzanie tekstu przed syntezą mowy
 *
 * Funkcje:
 * - Pomijanie bloków kodu
 * - Formatowanie liczb i dat
 * - Konwersja URL/emoji na tekst
 * - Skracanie długich odpowiedzi
 */
export interface TTSProcessingOptions {
    maxLength?: number;
    skipCodeBlocks?: boolean;
    skipUrls?: boolean;
    expandAbbreviations?: boolean;
    language?: "pl" | "en";
}
export declare class TTSTextProcessor {
    private options;
    constructor(options?: Partial<TTSProcessingOptions>);
    /**
     * Główna metoda przetwarzania tekstu dla TTS
     */
    process(text: string): string;
    /**
     * Usuń bloki kodu (``` ... ```) i inline code (` ... `)
     */
    private removeCodeBlocks;
    /**
     * Usuń URL-e i zamień na "link"
     */
    private removeUrls;
    /**
     * Konwertuj emoji na tekst
     */
    private convertEmojis;
    /**
     * Rozwiń polskie skróty
     */
    private expandAbbreviations;
    /**
     * Formatuj liczby dla lepszej wymowy
     */
    private formatNumbers;
    /**
     * Konwertuj liczbę na polskie słowa (uproszczone)
     */
    private numberToPolishWords;
    /**
     * Formatuj daty
     */
    private formatDates;
    /**
     * Usuń formatowanie Markdown
     */
    private cleanMarkdown;
    /**
     * Normalizuj białe znaki
     */
    private normalizeWhitespace;
    /**
     * Inteligentne skracanie tekstu
     */
    private truncateIntelligently;
    /**
     * Wyodrębnij najważniejsze zdania (dla długich odpowiedzi)
     */
    extractKeySentences(text: string, maxSentences?: number): string;
}
export declare const ttsTextProcessor: TTSTextProcessor;
//# sourceMappingURL=tts-text-processor.d.ts.map