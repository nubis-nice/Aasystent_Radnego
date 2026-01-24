import { Buffer } from "node:buffer";
import { type AudioAnalysis } from "./audio-analyzer.js";
export interface AudioPreprocessorOptions {
    normalizeVolume?: boolean;
    targetLoudness?: number;
    noiseReduction?: boolean;
    noiseReductionStrength?: number;
    highpassFilter?: boolean;
    highpassFrequency?: number;
    lowpassFilter?: boolean;
    lowpassFrequency?: number;
    compressor?: boolean;
    compressorThreshold?: number;
    compressorRatio?: number;
    speechEqualizer?: boolean;
    deesser?: boolean;
    outputFormat?: "wav" | "mp3" | "flac";
    sampleRate?: number;
    channels?: number;
}
export interface AudioPart {
    index: number;
    filePath: string;
    duration: number;
    startTime: number;
    endTime: number;
    fileSize: number;
}
export interface AudioSplitResult {
    success: boolean;
    parts: AudioPart[];
    totalDuration: number;
    error?: string;
}
export declare class AudioPreprocessor {
    private tempDir;
    private ffmpegPath;
    private analyzer;
    constructor();
    /**
     * Przetwarza plik audio z optymalizacją dla STT
     */
    preprocess(inputBuffer: Buffer, inputFileName: string, options?: AudioPreprocessorOptions): Promise<{
        buffer: Buffer;
        tempPath: string;
    }>;
    /**
     * Adaptacyjne przetwarzanie - analizuje audio i dobiera optymalne parametry
     */
    preprocessAdaptive(inputPath: string, outputFormat?: "wav" | "mp3" | "flac"): Promise<{
        outputPath: string;
        analysis: AudioAnalysis;
    }>;
    /**
     * Buduje adaptacyjny łańcuch filtrów na podstawie rekomendacji
     */
    private buildAdaptiveFilterChain;
    /**
     * Buduje łańcuch filtrów FFmpeg dla optymalizacji STT
     */
    private buildFilterChain;
    /**
     * Uruchamia FFmpeg z podanymi filtrami
     */
    private runFFmpeg;
    /**
     * Zwraca kodek dla danego formatu
     */
    private getCodec;
    /**
     * Cleanup pliku tymczasowego
     */
    cleanup(tempPath: string): void;
    /**
     * Pobierz długość audio w sekundach
     */
    getAudioDuration(inputPath: string): Promise<number>;
    /**
     * Podziel audio na części według czasu (MVP - bez silence detection)
     */
    splitAudioByTime(inputPath: string, maxPartDuration?: number): Promise<AudioSplitResult>;
    /**
     * Wyciągnij segment audio
     */
    private extractAudioSegment;
}
export declare function getAudioPreprocessor(): AudioPreprocessor;
//# sourceMappingURL=audio-preprocessor.d.ts.map