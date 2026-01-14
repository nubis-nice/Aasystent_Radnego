/**
 * Audio Analyzer - Analiza parametrów audio przed przetwarzaniem
 * Używa ffprobe do zbierania metryk potrzebnych do adaptacyjnego preprocessingu
 */
export interface AudioAnalysis {
    duration: number;
    sampleRate: number;
    channels: number;
    bitRate: number;
    codec: string;
    meanVolume: number;
    maxVolume: number;
    dynamicRange: number;
    integratedLoudness: number;
    loudnessRange: number;
    truePeak: number;
    issues: AudioIssue[];
    recommendations: PreprocessingRecommendations;
}
export interface AudioIssue {
    type: "too_quiet" | "too_loud" | "high_dynamic_range" | "clipping" | "noise" | "low_quality";
    severity: "low" | "medium" | "high";
    description: string;
}
export interface PreprocessingRecommendations {
    enableHighpass: boolean;
    enableLowpass: boolean;
    enableNoiseReduction: boolean;
    enableCompressor: boolean;
    enableLoudnorm: boolean;
    enableDeesser: boolean;
    highpassFreq: number;
    lowpassFreq: number;
    noiseFloor: number;
    compressorThreshold: number;
    compressorRatio: number;
    targetLoudness: number;
    gainBoost: number;
}
export declare class AudioAnalyzer {
    private ffprobePath;
    private ffmpegPath;
    constructor();
    /**
     * Pełna analiza pliku audio
     */
    analyze(inputPath: string): Promise<AudioAnalysis>;
    /**
     * Pobiera podstawowe informacje o pliku (ffprobe)
     */
    private getBasicInfo;
    /**
     * Analiza głośności (volumedetect)
     */
    private analyzeVolume;
    /**
     * Analiza głośności EBU R128 (loudnorm)
     */
    private analyzeLoudness;
    /**
     * Wykrywa problemy z audio
     */
    private detectIssues;
    /**
     * Generuje rekomendacje preprocessingu na podstawie analizy
     */
    private generateRecommendations;
}
export declare function getAudioAnalyzer(): AudioAnalyzer;
//# sourceMappingURL=audio-analyzer.d.ts.map