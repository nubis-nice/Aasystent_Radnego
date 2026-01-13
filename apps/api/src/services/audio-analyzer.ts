/**
 * Audio Analyzer - Analiza parametrów audio przed przetwarzaniem
 * Używa ffprobe do zbierania metryk potrzebnych do adaptacyjnego preprocessingu
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// ═══════════════════════════════════════════════════════════════════════════
// Typy
// ═══════════════════════════════════════════════════════════════════════════

export interface AudioAnalysis {
  // Podstawowe informacje
  duration: number; // sekundy
  sampleRate: number; // Hz
  channels: number;
  bitRate: number; // kbps
  codec: string;

  // Analiza głośności (volumedetect)
  meanVolume: number; // dB
  maxVolume: number; // dB
  dynamicRange: number; // różnica max-mean

  // Analiza EBU R128 (loudnorm)
  integratedLoudness: number; // LUFS
  loudnessRange: number; // LU
  truePeak: number; // dBTP

  // Wykryte problemy
  issues: AudioIssue[];

  // Rekomendowane ustawienia
  recommendations: PreprocessingRecommendations;
}

export interface AudioIssue {
  type:
    | "too_quiet"
    | "too_loud"
    | "high_dynamic_range"
    | "clipping"
    | "noise"
    | "low_quality";
  severity: "low" | "medium" | "high";
  description: string;
}

export interface PreprocessingRecommendations {
  // Czy włączyć dany filtr
  enableHighpass: boolean;
  enableLowpass: boolean;
  enableNoiseReduction: boolean;
  enableCompressor: boolean;
  enableLoudnorm: boolean;
  enableDeesser: boolean;

  // Parametry filtrów
  highpassFreq: number; // Hz
  lowpassFreq: number; // Hz
  noiseFloor: number; // dB
  compressorThreshold: number; // dB
  compressorRatio: number;
  targetLoudness: number; // LUFS
  gainBoost: number; // dB (dodatkowe wzmocnienie przed normalizacją)
}

// ═══════════════════════════════════════════════════════════════════════════
// AudioAnalyzer
// ═══════════════════════════════════════════════════════════════════════════

export class AudioAnalyzer {
  private ffprobePath: string;
  private ffmpegPath: string;

  constructor() {
    // Rozwiąż ścieżki do ffprobe i ffmpeg
    let ffprobeEnv = process.env.FFPROBE_PATH || "ffprobe";
    let ffmpegEnv = process.env.FFMPEG_PATH || "ffmpeg";

    // Jeśli ścieżka to katalog, dodaj nazwę pliku
    if (ffmpegEnv !== "ffmpeg" && fs.existsSync(ffmpegEnv)) {
      const stats = fs.statSync(ffmpegEnv);
      if (stats.isDirectory()) {
        ffmpegEnv = path.join(ffmpegEnv, "ffmpeg.exe");
        // ffprobe jest w tym samym katalogu
        if (ffprobeEnv === "ffprobe") {
          ffprobeEnv = path.join(process.env.FFMPEG_PATH!, "ffprobe.exe");
        }
      }
    } else if (ffmpegEnv !== "ffmpeg" && !ffmpegEnv.endsWith(".exe")) {
      const withExe = path.join(ffmpegEnv, "ffmpeg.exe");
      if (fs.existsSync(withExe)) {
        ffmpegEnv = withExe;
        if (ffprobeEnv === "ffprobe") {
          ffprobeEnv = path.join(process.env.FFMPEG_PATH!, "ffprobe.exe");
        }
      }
    }

    this.ffprobePath = ffprobeEnv;
    this.ffmpegPath = ffmpegEnv;
  }

  /**
   * Pełna analiza pliku audio
   */
  async analyze(inputPath: string): Promise<AudioAnalysis> {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Plik nie istnieje: ${inputPath}`);
    }

    console.log(`[AudioAnalyzer] Analyzing: ${inputPath}`);

    // Równoległe uruchomienie analiz
    const [basicInfo, volumeInfo, loudnessInfo] = await Promise.all([
      this.getBasicInfo(inputPath),
      this.analyzeVolume(inputPath),
      this.analyzeLoudness(inputPath),
    ]);

    // Oblicz zakres dynamiki
    const dynamicRange = volumeInfo.maxVolume - volumeInfo.meanVolume;

    // Wykryj problemy
    const issues = this.detectIssues(
      volumeInfo,
      loudnessInfo,
      dynamicRange,
      basicInfo
    );

    // Wygeneruj rekomendacje
    const recommendations = this.generateRecommendations(
      volumeInfo,
      loudnessInfo,
      dynamicRange,
      issues
    );

    const analysis: AudioAnalysis = {
      ...basicInfo,
      ...volumeInfo,
      ...loudnessInfo,
      dynamicRange,
      issues,
      recommendations,
    };

    console.log(`[AudioAnalyzer] Analysis complete:`, {
      duration: `${analysis.duration.toFixed(1)}s`,
      meanVolume: `${analysis.meanVolume.toFixed(1)}dB`,
      maxVolume: `${analysis.maxVolume.toFixed(1)}dB`,
      integratedLoudness: `${analysis.integratedLoudness.toFixed(1)} LUFS`,
      loudnessRange: `${analysis.loudnessRange.toFixed(1)} LU`,
      issues: issues.map((i) => i.type),
    });

    return analysis;
  }

  /**
   * Pobiera podstawowe informacje o pliku (ffprobe)
   */
  private async getBasicInfo(inputPath: string): Promise<{
    duration: number;
    sampleRate: number;
    channels: number;
    bitRate: number;
    codec: string;
  }> {
    return new Promise((resolve, reject) => {
      const args = [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        "-select_streams",
        "a:0",
        inputPath,
      ];

      const ffprobe = spawn(this.ffprobePath, args);
      let stdout = "";
      let stderr = "";

      ffprobe.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffprobe.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe error: ${stderr}`));
          return;
        }

        try {
          const info = JSON.parse(stdout);
          const stream = info.streams?.[0] || {};
          const format = info.format || {};

          resolve({
            duration: parseFloat(format.duration) || 0,
            sampleRate: parseInt(stream.sample_rate) || 44100,
            channels: stream.channels || 2,
            bitRate: parseInt(format.bit_rate) / 1000 || 128,
            codec: stream.codec_name || "unknown",
          });
        } catch (e) {
          reject(new Error(`Failed to parse ffprobe output: ${e}`));
        }
      });

      ffprobe.on("error", (error) => {
        reject(new Error(`ffprobe spawn error: ${error.message}`));
      });
    });
  }

  /**
   * Analiza głośności (volumedetect)
   */
  private async analyzeVolume(
    inputPath: string
  ): Promise<{ meanVolume: number; maxVolume: number }> {
    return new Promise((resolve, reject) => {
      const args = ["-i", inputPath, "-af", "volumedetect", "-f", "null", "-"];

      const ffmpeg = spawn(this.ffmpegPath, args);
      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("close", (code) => {
        // volumedetect pisze do stderr, kod 0 oznacza sukces
        const meanMatch = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);
        const maxMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);

        resolve({
          meanVolume: meanMatch ? parseFloat(meanMatch[1]) : -20,
          maxVolume: maxMatch ? parseFloat(maxMatch[1]) : 0,
        });
      });

      ffmpeg.on("error", (error) => {
        // Fallback na domyślne wartości
        console.warn(
          `[AudioAnalyzer] volumedetect error: ${error.message}, using defaults`
        );
        resolve({ meanVolume: -20, maxVolume: 0 });
      });
    });
  }

  /**
   * Analiza głośności EBU R128 (loudnorm)
   */
  private async analyzeLoudness(inputPath: string): Promise<{
    integratedLoudness: number;
    loudnessRange: number;
    truePeak: number;
  }> {
    return new Promise((resolve, reject) => {
      // Pierwszy przebieg loudnorm - tylko analiza
      const args = [
        "-i",
        inputPath,
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
        "-f",
        "null",
        "-",
      ];

      const ffmpeg = spawn(this.ffmpegPath, args);
      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("close", (code) => {
        // Szukaj JSON w output
        const jsonMatch = stderr.match(
          /\{[\s\S]*"input_i"[\s\S]*"input_lra"[\s\S]*\}/
        );

        if (jsonMatch) {
          try {
            const loudnessData = JSON.parse(jsonMatch[0]);
            resolve({
              integratedLoudness: parseFloat(loudnessData.input_i) || -23,
              loudnessRange: parseFloat(loudnessData.input_lra) || 7,
              truePeak: parseFloat(loudnessData.input_tp) || -1,
            });
            return;
          } catch (e) {
            console.warn(`[AudioAnalyzer] Failed to parse loudnorm JSON: ${e}`);
          }
        }

        // Fallback
        resolve({
          integratedLoudness: -23,
          loudnessRange: 7,
          truePeak: -1,
        });
      });

      ffmpeg.on("error", (error) => {
        console.warn(
          `[AudioAnalyzer] loudnorm error: ${error.message}, using defaults`
        );
        resolve({
          integratedLoudness: -23,
          loudnessRange: 7,
          truePeak: -1,
        });
      });
    });
  }

  /**
   * Wykrywa problemy z audio
   */
  private detectIssues(
    volumeInfo: { meanVolume: number; maxVolume: number },
    loudnessInfo: {
      integratedLoudness: number;
      loudnessRange: number;
      truePeak: number;
    },
    dynamicRange: number,
    basicInfo: { sampleRate: number; bitRate: number }
  ): AudioIssue[] {
    const issues: AudioIssue[] = [];

    // Zbyt cicho
    if (volumeInfo.meanVolume < -35) {
      issues.push({
        type: "too_quiet",
        severity: volumeInfo.meanVolume < -45 ? "high" : "medium",
        description: `Średnia głośność ${volumeInfo.meanVolume.toFixed(
          1
        )}dB jest zbyt niska`,
      });
    }

    // Zbyt głośno / clipping
    if (volumeInfo.maxVolume > -0.5) {
      issues.push({
        type: "clipping",
        severity: volumeInfo.maxVolume > 0 ? "high" : "medium",
        description: `Szczytowa głośność ${volumeInfo.maxVolume.toFixed(
          1
        )}dB - możliwe przesterowanie`,
      });
    }

    // Wysoki zakres dynamiki (różni mówcy, różne odległości od mikrofonu)
    if (dynamicRange > 25) {
      issues.push({
        type: "high_dynamic_range",
        severity: dynamicRange > 35 ? "high" : "medium",
        description: `Zakres dynamiki ${dynamicRange.toFixed(
          1
        )}dB - duże różnice głośności`,
      });
    }

    // Wysoki LRA (Loudness Range) - typowe dla sesji rady
    if (loudnessInfo.loudnessRange > 15) {
      issues.push({
        type: "high_dynamic_range",
        severity: loudnessInfo.loudnessRange > 20 ? "high" : "medium",
        description: `Zakres głośności ${loudnessInfo.loudnessRange.toFixed(
          1
        )} LU - wymaga kompresji`,
      });
    }

    // Niska jakość źródła
    if (basicInfo.sampleRate < 16000 || basicInfo.bitRate < 64) {
      issues.push({
        type: "low_quality",
        severity: "low",
        description: `Niska jakość źródła: ${basicInfo.sampleRate}Hz, ${basicInfo.bitRate}kbps`,
      });
    }

    // Potencjalny szum (bardzo niska średnia głośność przy wysokim max)
    if (volumeInfo.meanVolume < -30 && dynamicRange > 20) {
      issues.push({
        type: "noise",
        severity: "medium",
        description: "Wykryto potencjalny szum tła",
      });
    }

    return issues;
  }

  /**
   * Generuje rekomendacje preprocessingu na podstawie analizy
   */
  private generateRecommendations(
    volumeInfo: { meanVolume: number; maxVolume: number },
    loudnessInfo: {
      integratedLoudness: number;
      loudnessRange: number;
      truePeak: number;
    },
    dynamicRange: number,
    issues: AudioIssue[]
  ): PreprocessingRecommendations {
    const hasIssue = (type: AudioIssue["type"]) =>
      issues.some((i) => i.type === type);

    // Bazowe rekomendacje
    const recommendations: PreprocessingRecommendations = {
      // Filtry zawsze włączone dla sesji rady
      enableHighpass: true,
      enableLowpass: true,
      enableNoiseReduction: true,
      enableCompressor: true,
      enableLoudnorm: true,
      enableDeesser: true,

      // Domyślne parametry
      highpassFreq: 100, // Usuwa dudnienia z sali
      lowpassFreq: 10000, // Zachowuje klarowność mowy
      noiseFloor: -25,
      compressorThreshold: -20,
      compressorRatio: 4,
      targetLoudness: -16,
      gainBoost: 0,
    };

    // Adaptacja na podstawie wykrytych problemów

    // Zbyt cicho - dodaj wzmocnienie
    if (hasIssue("too_quiet")) {
      const boost = Math.min(20, Math.abs(volumeInfo.meanVolume + 20));
      recommendations.gainBoost = boost;
      console.log(
        `[AudioAnalyzer] Recommending gain boost: +${boost.toFixed(1)}dB`
      );
    }

    // Wysoki zakres dynamiki - agresywniejsza kompresja
    if (hasIssue("high_dynamic_range")) {
      if (dynamicRange > 30) {
        recommendations.compressorRatio = 6;
        recommendations.compressorThreshold = -25;
      } else {
        recommendations.compressorRatio = 5;
        recommendations.compressorThreshold = -22;
      }
      console.log(
        `[AudioAnalyzer] Recommending stronger compression: ratio=${recommendations.compressorRatio}`
      );
    }

    // Szum - silniejsza redukcja szumów
    if (hasIssue("noise")) {
      recommendations.noiseFloor = -20;
      recommendations.highpassFreq = 120; // Wyższy highpass
      console.log(
        `[AudioAnalyzer] Recommending stronger noise reduction: floor=${recommendations.noiseFloor}dB`
      );
    }

    // Clipping - nie dodawaj wzmocnienia
    if (hasIssue("clipping")) {
      recommendations.gainBoost = 0;
      recommendations.compressorThreshold = -15; // Wcześniejsza kompresja
      console.log(`[AudioAnalyzer] Detected clipping, adjusting compressor`);
    }

    // Niska jakość - delikatniejsze filtry
    if (hasIssue("low_quality")) {
      recommendations.lowpassFreq = 8000;
      recommendations.enableDeesser = false; // De-esser może pogorszyć niską jakość
    }

    return recommendations;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════════════════════════

let analyzerInstance: AudioAnalyzer | null = null;

export function getAudioAnalyzer(): AudioAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new AudioAnalyzer();
  }
  return analyzerInstance;
}
