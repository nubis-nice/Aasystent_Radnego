import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { setTimeout, clearTimeout } from "node:timers";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  AudioAnalyzer,
  getAudioAnalyzer,
  type AudioAnalysis,
  type PreprocessingRecommendations,
} from "./audio-analyzer.js";

export interface AudioPreprocessorOptions {
  // Normalizacja głośności
  normalizeVolume?: boolean;
  targetLoudness?: number; // w LUFS, domyślnie -16 (standard dla mowy)

  // Redukcja szumu
  noiseReduction?: boolean;
  noiseReductionStrength?: number; // 0.0-1.0, domyślnie 0.21

  // Filtr górnoprzepustowy (usuwa niskie częstotliwości/szum)
  highpassFilter?: boolean;
  highpassFrequency?: number; // Hz, domyślnie 80

  // Filtr dolnoprzepustowy (usuwa wysokie częstotliwości/szum)
  lowpassFilter?: boolean;
  lowpassFrequency?: number; // Hz, domyślnie 8000

  // Kompresor dynamiki (wyrównuje głośność)
  compressor?: boolean;
  compressorThreshold?: number; // dB, domyślnie -20
  compressorRatio?: number; // domyślnie 4

  // Equalizer dla mowy
  speechEqualizer?: boolean;

  // De-esser (redukcja syczących dźwięków)
  deesser?: boolean;

  // Format wyjściowy
  outputFormat?: "wav" | "mp3" | "flac";
  sampleRate?: number; // Hz, domyślnie 16000 (optymalny dla Whisper)
  channels?: number; // domyślnie 1 (mono)
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

const DEFAULT_OPTIONS: Required<AudioPreprocessorOptions> = {
  normalizeVolume: true,
  targetLoudness: -16,
  noiseReduction: true,
  noiseReductionStrength: 0.21,
  highpassFilter: true,
  highpassFrequency: 80,
  lowpassFilter: true,
  lowpassFrequency: 8000,
  compressor: true,
  compressorThreshold: -20,
  compressorRatio: 4,
  speechEqualizer: true,
  deesser: true,
  outputFormat: "wav",
  sampleRate: 16000,
  channels: 1,
};

export class AudioPreprocessor {
  private tempDir: string;
  private ffmpegPath: string;
  private analyzer: AudioAnalyzer;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), "aasystent-audio-preprocess");
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Użyj ffmpeg z PATH lub zmiennej środowiskowej
    let ffmpegEnv = process.env.FFMPEG_PATH || "ffmpeg";

    // Jeśli ścieżka to katalog (kończy się na bin lub nie ma .exe), dodaj ffmpeg.exe
    if (ffmpegEnv !== "ffmpeg" && fs.existsSync(ffmpegEnv)) {
      const stats = fs.statSync(ffmpegEnv);
      if (stats.isDirectory()) {
        ffmpegEnv = path.join(ffmpegEnv, "ffmpeg.exe");
      }
    } else if (ffmpegEnv !== "ffmpeg" && !ffmpegEnv.endsWith(".exe")) {
      // Ścieżka nie istnieje lub nie kończy się na .exe - spróbuj dodać ffmpeg.exe
      const withExe = path.join(ffmpegEnv, "ffmpeg.exe");
      if (fs.existsSync(withExe)) {
        ffmpegEnv = withExe;
      }
    }

    this.ffmpegPath = ffmpegEnv;
    this.analyzer = getAudioAnalyzer();
    console.log(`[AudioPreprocessor] Using ffmpeg path: ${this.ffmpegPath}`);
  }

  /**
   * Przetwarza plik audio z optymalizacją dla STT
   */
  async preprocess(
    inputBuffer: Buffer,
    inputFileName: string,
    options: AudioPreprocessorOptions = {},
  ): Promise<{ buffer: Buffer; tempPath: string }> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Zapisz input do pliku tymczasowego
    const inputPath = path.join(
      this.tempDir,
      `input-${Date.now()}-${inputFileName}`,
    );
    const outputPath = path.join(
      this.tempDir,
      `output-${Date.now()}.${opts.outputFormat}`,
    );

    fs.writeFileSync(inputPath, inputBuffer);

    try {
      // Zbuduj łańcuch filtrów audio
      const filterChain = this.buildFilterChain(opts);

      console.log(
        `[AudioPreprocessor] Processing: ${inputFileName} with filters: ${filterChain}`,
      );

      // Uruchom ffmpeg
      await this.runFFmpeg(inputPath, outputPath, filterChain, opts);

      // Odczytaj wynik
      const outputBuffer = fs.readFileSync(outputPath);

      // Cleanup input
      fs.unlinkSync(inputPath);

      console.log(
        `[AudioPreprocessor] Processed: ${inputFileName} -> ${outputPath}`,
      );
      console.log(
        `[AudioPreprocessor] Size: ${(inputBuffer.length / 1024 / 1024).toFixed(
          2,
        )}MB -> ${(outputBuffer.length / 1024 / 1024).toFixed(2)}MB`,
      );

      return { buffer: outputBuffer, tempPath: outputPath };
    } catch (error) {
      // Cleanup on error
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      throw error;
    }
  }

  /**
   * Adaptacyjne przetwarzanie - analizuje audio i dobiera optymalne parametry
   */
  async preprocessAdaptive(
    inputPath: string,
    outputFormat: "wav" | "mp3" | "flac" = "wav",
  ): Promise<{ outputPath: string; analysis: AudioAnalysis }> {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Plik nie istnieje: ${inputPath}`);
    }

    console.log(
      `[AudioPreprocessor] Starting adaptive preprocessing: ${inputPath}`,
    );

    // 1. Analiza audio
    const analysis = await this.analyzer.analyze(inputPath);
    const recs = analysis.recommendations;

    // 2. Zbuduj adaptacyjny łańcuch filtrów
    const filterChain = this.buildAdaptiveFilterChain(recs);

    console.log(`[AudioPreprocessor] Adaptive filter chain: ${filterChain}`);
    console.log(
      `[AudioPreprocessor] Issues detected: ${
        analysis.issues.map((i) => i.type).join(", ") || "none"
      }`,
    );

    // 3. Przygotuj ścieżkę wyjściową
    const outputPath = path.join(
      this.tempDir,
      `adaptive-${Date.now()}.${outputFormat}`,
    );

    // 4. Uruchom FFmpeg z adaptacyjnymi filtrami
    const opts: Required<AudioPreprocessorOptions> = {
      ...DEFAULT_OPTIONS,
      outputFormat,
    };

    await this.runFFmpeg(inputPath, outputPath, filterChain, opts);

    // 5. Loguj wyniki
    const inputStats = fs.statSync(inputPath);
    const outputStats = fs.statSync(outputPath);
    const inputSizeMB = (inputStats.size / 1024 / 1024).toFixed(2);
    const outputSizeMB = (outputStats.size / 1024 / 1024).toFixed(2);

    const sizeRatio = outputStats.size / inputStats.size;
    const sizeChangePercent = ((sizeRatio - 1) * 100).toFixed(1);
    const sizeChangeLabel = sizeRatio > 1 ? "Increase" : "Reduction";
    const sizeChangeSign = sizeRatio > 1 ? "+" : "";

    console.log(`[AudioPreprocessor] Adaptive preprocessing complete:`);
    console.log(`  Input: ${inputSizeMB}MB`);
    console.log(`  Output: ${outputSizeMB}MB`);
    console.log(`  ${sizeChangeLabel}: ${sizeChangeSign}${sizeChangePercent}%`);

    return { outputPath, analysis };
  }

  /**
   * Buduje adaptacyjny łańcuch filtrów na podstawie rekomendacji
   */
  private buildAdaptiveFilterChain(recs: PreprocessingRecommendations): string {
    const filters: string[] = [];

    // 1. Wzmocnienie (jeśli potrzebne)
    if (recs.gainBoost > 0) {
      filters.push(`volume=${recs.gainBoost}dB`);
    }

    // 2. Highpass - usuwa dudnienia z sali, szum AC
    if (recs.enableHighpass) {
      filters.push(`highpass=f=${recs.highpassFreq}:poles=2`);
    }

    // 3. Lowpass - usuwa szumy wysokoczęstotliwościowe
    if (recs.enableLowpass) {
      filters.push(`lowpass=f=${recs.lowpassFreq}:poles=2`);
    }

    // 4. Redukcja szumów (AFFTDN)
    if (recs.enableNoiseReduction) {
      // nf = noise floor, nt=w = white noise model, om=o = output mode
      filters.push(`afftdn=nf=${recs.noiseFloor}:nt=w:om=o`);
    }

    // 5. Equalizer dla mowy
    filters.push(
      // Wzmocnienie fundamentalnych częstotliwości mowy (200-500 Hz)
      "equalizer=f=350:t=q:w=1:g=2",
      // Wzmocnienie klarowności mowy (1000-4000 Hz)
      "equalizer=f=2500:t=q:w=1.5:g=3",
      // Lekkie wzmocnienie "presence" (4000-6000 Hz)
      "equalizer=f=5000:t=q:w=1:g=1",
    );

    // 6. De-esser
    if (recs.enableDeesser) {
      // Redukcja sybilantów w paśmie 5-8 kHz
      filters.push("equalizer=f=6500:t=q:w=1:g=-4");
    }

    // 7. Kompresor dynamiki
    if (recs.enableCompressor) {
      // acompressor: threshold, ratio, attack, release, makeup gain
      filters.push(
        `acompressor=threshold=${recs.compressorThreshold}dB:ratio=${recs.compressorRatio}:attack=5:release=50:makeup=2`,
      );
    }

    // 8. Normalizacja EBU R128
    if (recs.enableLoudnorm) {
      filters.push(`loudnorm=I=${recs.targetLoudness}:TP=-1.5:LRA=11`);
    }

    // 9. Resample do 16kHz mono (optymalny dla Whisper)
    filters.push("aresample=16000");

    return filters.join(",");
  }

  /**
   * Buduje łańcuch filtrów FFmpeg dla optymalizacji STT
   */
  private buildFilterChain(opts: Required<AudioPreprocessorOptions>): string {
    const filters: string[] = [];

    // 1. Filtr górnoprzepustowy - usuwa niskie częstotliwości (szum, dudnienie)
    if (opts.highpassFilter) {
      filters.push(`highpass=f=${opts.highpassFrequency}`);
    }

    // 2. Filtr dolnoprzepustowy - usuwa wysokie częstotliwości (szum, syczenie)
    if (opts.lowpassFilter) {
      filters.push(`lowpass=f=${opts.lowpassFrequency}`);
    }

    // 3. Redukcja szumu (afftdn - Adaptive FFT Denoiser)
    if (opts.noiseReduction) {
      // nr = noise reduction amount (0-1)
      // nf = noise floor in dB
      // tn = track noise (adaptacyjne śledzenie szumu)
      filters.push(
        `afftdn=nr=${opts.noiseReductionStrength * 100}:nf=-25:tn=1`,
      );
    }

    // 4. Equalizer zoptymalizowany dla mowy (wzmocnienie pasma 300-3000 Hz)
    if (opts.speechEqualizer) {
      // Wzmocnienie pasma mowy ludzkiej
      filters.push(
        // Lekkie wycięcie niskich częstotliwości (poniżej 100 Hz)
        "equalizer=f=100:t=h:w=100:g=-3",
        // Wzmocnienie fundamentalnych częstotliwości mowy (200-500 Hz)
        "equalizer=f=350:t=q:w=1:g=2",
        // Wzmocnienie klarowności mowy (1000-4000 Hz)
        "equalizer=f=2500:t=q:w=1.5:g=3",
        // Lekkie wzmocnienie "presence" (4000-6000 Hz)
        "equalizer=f=5000:t=q:w=1:g=1",
      );
    }

    // 5. De-esser - redukcja syczących dźwięków (s, sz, ć)
    if (opts.deesser) {
      // Kompresja w paśmie 4-8 kHz gdzie występują syczące dźwięki
      filters.push(
        "highpass=f=4000,compand=attacks=0:decays=0.3:points=-80/-80|-12/-12|-6/-9|0/-6:soft-knee=6,lowpass=f=8000",
      );
    }

    // 6. Kompresor dynamiki - wyrównuje głośność (ciche fragmenty głośniejsze, głośne cichsze)
    if (opts.compressor) {
      // threshold:ratio:attack:release:makeup
      filters.push(
        `compand=attacks=0.1:decays=0.3:points=-70/-70|${
          opts.compressorThreshold
        }/${opts.compressorThreshold}|0/${
          -opts.compressorThreshold / opts.compressorRatio
        }:soft-knee=6:gain=3`,
      );
    }

    // 7. Normalizacja głośności (loudnorm - EBU R128)
    if (opts.normalizeVolume) {
      // I = integrated loudness target (LUFS)
      // TP = true peak (dBTP)
      // LRA = loudness range target
      filters.push(
        `loudnorm=I=${opts.targetLoudness}:TP=-1.5:LRA=11:print_format=summary`,
      );
    }

    return filters.join(",");
  }

  /**
   * Uruchamia FFmpeg z podanymi filtrami
   */
  private runFFmpeg(
    inputPath: string,
    outputPath: string,
    filterChain: string,
    opts: Required<AudioPreprocessorOptions>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        "-y", // Nadpisz plik wyjściowy
        "-i",
        inputPath,
        "-af",
        filterChain,
        "-ar",
        opts.sampleRate.toString(), // Sample rate
        "-ac",
        opts.channels.toString(), // Kanały (mono)
        "-acodec",
        this.getCodec(opts.outputFormat),
        outputPath,
      ];

      console.log(`[AudioPreprocessor] Running: ffmpeg ${args.join(" ")}`);

      const ffmpeg = spawn(this.ffmpegPath, args);

      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.error("[AudioPreprocessor] FFmpeg error:", stderr);
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on("error", (error) => {
        reject(new Error(`FFmpeg spawn error: ${error.message}`));
      });
    });
  }

  /**
   * Zwraca kodek dla danego formatu
   */
  private getCodec(format: string): string {
    switch (format) {
      case "wav":
        return "pcm_s16le";
      case "mp3":
        return "libmp3lame";
      case "flac":
        return "flac";
      default:
        return "pcm_s16le";
    }
  }

  /**
   * Cleanup pliku tymczasowego
   */
  cleanup(tempPath: string): void {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
      console.log(`[AudioPreprocessor] Cleaned up: ${tempPath}`);
    }
  }

  /**
   * Pobierz długość audio w sekundach
   */
  async getAudioDuration(inputPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const args = ["-i", inputPath, "-f", "null", "-"];

      const ffmpeg = spawn(this.ffmpegPath, args);
      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("close", () => {
        const durationMatch = stderr.match(
          /Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/,
        );
        if (durationMatch) {
          const hours = parseInt(durationMatch[1], 10);
          const minutes = parseInt(durationMatch[2], 10);
          const seconds = parseFloat(durationMatch[3]);
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;
          resolve(totalSeconds);
        } else {
          reject(new Error("Could not parse audio duration"));
        }
      });

      ffmpeg.on("error", reject);
    });
  }

  /**
   * Podziel audio na części według czasu (MVP - bez silence detection)
   */
  async splitAudioByTime(
    inputPath: string,
    maxPartDuration: number = 600,
  ): Promise<AudioSplitResult> {
    try {
      console.log(`[AudioPreprocessor] Splitting audio: ${inputPath}`);
      console.log(`[AudioPreprocessor] Max part duration: ${maxPartDuration}s`);

      const totalDuration = await this.getAudioDuration(inputPath);
      console.log(
        `[AudioPreprocessor] Total duration: ${totalDuration.toFixed(1)}s`,
      );

      if (totalDuration <= maxPartDuration) {
        console.log(
          `[AudioPreprocessor] Audio shorter than maxPartDuration, no splitting needed`,
        );
        return {
          success: true,
          parts: [],
          totalDuration: totalDuration,
        };
      }

      const parts: AudioPart[] = [];
      const baseName = path.basename(inputPath, path.extname(inputPath));
      const outputDir = path.dirname(inputPath);

      let currentTime = 0;
      let partIndex = 1;

      while (currentTime < totalDuration) {
        const startTime = currentTime;
        const endTime = Math.min(currentTime + maxPartDuration, totalDuration);
        const partDuration = endTime - startTime;

        const outputPath = path.join(
          outputDir,
          `${baseName}_part_${String(partIndex).padStart(3, "0")}.wav`,
        );

        console.log(
          `[AudioPreprocessor] Extracting part ${partIndex}: ${startTime.toFixed(
            1,
          )}s - ${endTime.toFixed(1)}s`,
        );

        await this.extractAudioSegment(
          inputPath,
          outputPath,
          startTime,
          endTime,
        );

        const stats = fs.statSync(outputPath);

        parts.push({
          index: partIndex,
          filePath: outputPath,
          duration: partDuration,
          startTime: startTime,
          endTime: endTime,
          fileSize: stats.size,
        });

        currentTime = endTime;
        partIndex++;
      }

      console.log(`[AudioPreprocessor] Split into ${parts.length} parts`);

      return {
        success: true,
        parts: parts,
        totalDuration: totalDuration,
      };
    } catch (error) {
      console.error(`[AudioPreprocessor] Split failed:`, error);
      return {
        success: false,
        parts: [],
        totalDuration: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Wyciągnij segment audio z timeout (60s) i fallback do re-encode
   */
  private extractAudioSegment(
    inputPath: string,
    outputPath: string,
    startTime: number,
    endTime: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Użyj re-encode zamiast -c copy (copy wisi na dużych WAV)
      const args = [
        "-y", // Overwrite output
        "-ss",
        startTime.toString(), // Seek PRZED input (szybsze)
        "-i",
        inputPath,
        "-t",
        (endTime - startTime).toString(), // Duration zamiast -to
        "-acodec",
        "pcm_s16le", // Re-encode do WAV (stabilniejsze niż copy)
        outputPath,
      ];

      const ffmpeg = spawn(this.ffmpegPath, args);
      let killed = false;

      // Timeout 60s per segment
      const timeout = setTimeout(() => {
        if (!killed) {
          killed = true;
          ffmpeg.kill("SIGKILL");
          reject(new Error(`FFmpeg extraction timeout after 60s`));
        }
      }, 60000);

      ffmpeg.on("close", (code) => {
        clearTimeout(timeout);
        if (killed) return;
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg extraction failed with code ${code}`));
        }
      });

      ffmpeg.on("error", (err) => {
        clearTimeout(timeout);
        if (!killed) reject(err);
      });
    });
  }

  /**
   * Preprocessing pojedynczego segmentu na TOP QUALITY audio
   * Stosuje: highpass 80Hz, noise reduction, loudnorm
   * Zwraca ścieżkę do przetworzonego pliku (nadal top quality)
   */
  async preprocessSegment(inputPath: string): Promise<string> {
    const outputPath = inputPath.replace(/\.wav$/, "_preprocessed.wav");

    console.log(`[AudioPreprocessor] Preprocessing segment: ${inputPath}`);

    return new Promise((resolve, reject) => {
      // Filtry na top quality audio:
      // 1. highpass=f=80 - usuwa niskie częstotliwości (buczenie, szum)
      // 2. afftdn=nf=-25 - noise reduction (FFT-based)
      // 3. loudnorm - normalizacja głośności do -16 LUFS
      const filterChain =
        "highpass=f=80,afftdn=nf=-25,loudnorm=I=-16:TP=-1.5:LRA=11";

      const args = [
        "-i",
        inputPath,
        "-af",
        filterChain,
        "-y", // Overwrite output
        outputPath,
      ];

      console.log(
        `[AudioPreprocessor] Running: ffmpeg -i input -af "${filterChain}" output`,
      );

      const ffmpeg = spawn(this.ffmpegPath, args);
      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          // Usuń oryginalny plik, zachowaj przetworzony
          if (fs.existsSync(inputPath) && inputPath !== outputPath) {
            fs.unlinkSync(inputPath);
          }
          console.log(
            `[AudioPreprocessor] Segment preprocessed: ${outputPath}`,
          );
          resolve(outputPath);
        } else {
          console.error(`[AudioPreprocessor] Preprocessing failed:`, stderr);
          reject(new Error(`Preprocessing failed with code ${code}`));
        }
      });

      ffmpeg.on("error", reject);
    });
  }

  /**
   * Downsampling do formatu optymalnego dla Whisper (16kHz mono WAV)
   * Wykonywany PO preprocessingu na top quality audio
   */
  async downsampleForWhisper(inputPath: string): Promise<string> {
    const outputPath = inputPath.replace(
      /(_preprocessed)?\.wav$/,
      "_whisper.wav",
    );

    console.log(`[AudioPreprocessor] Downsampling for Whisper: ${inputPath}`);

    return new Promise((resolve, reject) => {
      const args = [
        "-i",
        inputPath,
        "-ar",
        "16000", // 16kHz - optimal for Whisper
        "-ac",
        "1", // Mono
        "-y",
        outputPath,
      ];

      const ffmpeg = spawn(this.ffmpegPath, args);
      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          // Usuń plik preprocessed, zachowaj whisper-ready
          if (fs.existsSync(inputPath) && inputPath !== outputPath) {
            fs.unlinkSync(inputPath);
          }
          const stats = fs.statSync(outputPath);
          console.log(
            `[AudioPreprocessor] Downsampled for Whisper: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`,
          );
          resolve(outputPath);
        } else {
          console.error(`[AudioPreprocessor] Downsampling failed:`, stderr);
          reject(new Error(`Downsampling failed with code ${code}`));
        }
      });

      ffmpeg.on("error", reject);
    });
  }

  /**
   * Pełny pipeline: preprocessing + downsampling dla pojedynczego segmentu
   * 1. Preprocessing na top quality (highpass + noise reduction + loudnorm)
   * 2. Downsampling do 16kHz mono dla Whisper
   */
  async prepareSegmentForWhisper(inputPath: string): Promise<string> {
    console.log(`[AudioPreprocessor] Full pipeline for segment: ${inputPath}`);

    // 1. Preprocessing na top quality
    const preprocessedPath = await this.preprocessSegment(inputPath);

    // 2. Downsampling do Whisper format
    const whisperReadyPath = await this.downsampleForWhisper(preprocessedPath);

    return whisperReadyPath;
  }

  /**
   * BEST PRACTICE: Konwertuj dowolne audio do formatu optymalnego dla Whisper
   * - 16kHz sample rate
   * - Mono (1 channel)
   * - 16-bit PCM WAV
   * - Normalizacja głośności (loudnorm)
   */
  async convertToWhisperFormat(
    inputPath: string,
    outputPath: string,
  ): Promise<void> {
    console.log(
      `[AudioPreprocessor] Converting to Whisper format: ${inputPath}`,
    );

    return new Promise((resolve, reject) => {
      // FFmpeg: konwersja do 16kHz mono 16-bit PCM WAV z pełnym preprocessingiem
      // Filtry dla lepszej jakości transkrypcji:
      // 1. highpass=f=80 - usuwa niskie szumy/hum
      // 2. afftdn=nf=-25 - redukcja szumów FFT
      // 3. acompressor - wyrównuje głośność mówców
      // 4. loudnorm - normalizacja głośności dla Whisper
      const filterChain = [
        "highpass=f=80", // Usuń niskie częstotliwości (hum, szumy)
        "afftdn=nf=-25", // Redukcja szumów (FFT denoiser)
        "acompressor=threshold=-20dB:ratio=4:attack=5:release=50", // Kompresja dynamiki
        "loudnorm=I=-16:TP=-1.5:LRA=11", // Normalizacja głośności
      ].join(",");

      const args = [
        "-y", // Overwrite
        "-i",
        inputPath,
        "-af",
        filterChain,
        "-ar",
        "16000", // 16kHz - optimal dla Whisper
        "-ac",
        "1", // Mono
        "-acodec",
        "pcm_s16le", // 16-bit PCM
        outputPath,
      ];

      const ffmpeg = spawn(this.ffmpegPath, args);
      let stderr = "";
      let killed = false;

      // Timeout 10 min dla konwersji (długie sesje rady mogą trwać kilka godzin)
      const timeout = setTimeout(() => {
        if (!killed) {
          killed = true;
          ffmpeg.kill("SIGKILL");
          reject(new Error("FFmpeg conversion timeout after 600s"));
        }
      }, 600000);

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("close", (code) => {
        clearTimeout(timeout);
        if (killed) return;
        if (code === 0) {
          const stats = fs.statSync(outputPath);
          console.log(
            `[AudioPreprocessor] Converted to Whisper format: ${(stats.size / 1024 / 1024).toFixed(2)}MB`,
          );
          resolve();
        } else {
          console.error(
            `[AudioPreprocessor] Conversion failed:`,
            stderr.slice(-500),
          );
          reject(new Error(`FFmpeg conversion failed with code ${code}`));
        }
      });

      ffmpeg.on("error", (err) => {
        clearTimeout(timeout);
        if (!killed) reject(err);
      });
    });
  }
}

// Singleton
let preprocessorInstance: AudioPreprocessor | null = null;

export function getAudioPreprocessor(): AudioPreprocessor {
  if (!preprocessorInstance) {
    preprocessorInstance = new AudioPreprocessor();
  }
  return preprocessorInstance;
}
