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
     * Wyciągnij segment audio z timeout (60s) i fallback do re-encode
     */
    private extractAudioSegment;
    /**
     * Preprocessing pojedynczego segmentu na TOP QUALITY audio
     * Stosuje: highpass 80Hz, noise reduction, loudnorm
     * Zwraca ścieżkę do przetworzonego pliku (nadal top quality)
     */
    preprocessSegment(inputPath: string): Promise<string>;
    /**
     * Downsampling do formatu optymalnego dla Whisper (16kHz mono WAV)
     * Wykonywany PO preprocessingu na top quality audio
     */
    downsampleForWhisper(inputPath: string): Promise<string>;
    /**
     * Pełny pipeline: preprocessing + downsampling dla pojedynczego segmentu
     * 1. Preprocessing na top quality (highpass + noise reduction + loudnorm)
     * 2. Downsampling do 16kHz mono dla Whisper
     */
    prepareSegmentForWhisper(inputPath: string): Promise<string>;
    /**
     * BEST PRACTICE: Konwertuj dowolne audio do formatu optymalnego dla Whisper
     * - 16kHz sample rate
     * - Mono (1 channel)
     * - 16-bit PCM WAV
     * - Normalizacja głośności (loudnorm)
     */
    convertToWhisperFormat(inputPath: string, outputPath: string): Promise<void>;
}
export declare function getAudioPreprocessor(): AudioPreprocessor;
//# sourceMappingURL=audio-preprocessor.d.ts.map