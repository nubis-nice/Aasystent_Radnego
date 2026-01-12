import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { getSTTClient, getLLMClient, getAIConfig } from "../ai/index.js";
import { getAudioPreprocessor } from "./audio-preprocessor.js";
import type { AudioAnalysis } from "./audio-analyzer.js";

export interface DownloadResult {
  success: boolean;
  audioPath?: string;
  title?: string;
  duration?: string;
  error?: string;
}

export interface TranscriptSegment {
  timestamp: string;
  speaker: string;
  text: string;
  sentiment: string;
  emotion: string;
  emotionEmoji: string;
  tension: number;
  credibility: number;
  credibilityEmoji: string;
}

export interface TranscriptionWithAnalysis {
  success: boolean;
  rawTranscript: string;
  formattedTranscript: string;
  segments: TranscriptSegment[];
  summary: {
    averageTension: number;
    dominantSentiment: string;
    overallCredibility: number;
    overallCredibilityEmoji: string;
    speakerCount: number;
    duration: string;
  };
  metadata: {
    videoId: string;
    videoTitle: string;
    videoUrl: string;
  };
  audioAnalysis?: AudioAnalysis;
  error?: string;
}

export class YouTubeDownloader {
  private sttClient: OpenAI | null = null;
  private llmClient: OpenAI | null = null;
  private tempDir: string;
  private userId: string | null = null;
  private sttModel: string = "whisper-1";
  private llmModel: string = "gpt-4o";

  constructor() {
    this.tempDir = join(tmpdir(), "aasystent-youtube");
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Inicjalizacja z konfiguracją użytkownika przez AIClientFactory
   */
  async initializeWithUserConfig(userId: string): Promise<void> {
    this.userId = userId;

    // Pobierz klienta STT (Speech-to-Text) z fabryki
    this.sttClient = await getSTTClient(userId);

    // Pobierz konfigurację STT aby znać model
    const sttConfig = await getAIConfig(userId, "stt");
    this.sttModel = sttConfig.modelName;

    // Pobierz klienta LLM do analizy transkryptu
    this.llmClient = await getLLMClient(userId);

    // Pobierz konfigurację LLM aby znać model
    const llmConfig = await getAIConfig(userId, "llm");
    this.llmModel = llmConfig.modelName;

    console.log(
      `[YouTubeDownloader] Initialized for user ${userId.substring(0, 8)}...`
    );
    console.log(
      `[YouTubeDownloader] STT: provider=${sttConfig.provider}, model=${this.sttModel}, baseUrl=${sttConfig.baseUrl}`
    );
    console.log(`[YouTubeDownloader] LLM: model=${this.llmModel}`);
  }

  async downloadAudio(videoUrl: string): Promise<DownloadResult> {
    const videoId = this.extractVideoId(videoUrl);
    if (!videoId) {
      return { success: false, error: "Nieprawidłowy URL YouTube" };
    }

    const outputPath = join(this.tempDir, `${randomUUID()}.mp3`);

    try {
      console.log(`[YouTubeDownloader] Downloading audio from: ${videoUrl}`);

      // Use yt-dlp to download audio
      const result = await this.runYtDlp(videoUrl, outputPath);

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        audioPath: outputPath,
        title: result.title,
        duration: result.duration,
      };
    } catch (error) {
      console.error("[YouTubeDownloader] Download error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Błąd pobierania audio",
      };
    }
  }

  private runYtDlp(
    videoUrl: string,
    outputPath: string
  ): Promise<DownloadResult> {
    return new Promise((resolve) => {
      // Remove .mp3 extension - yt-dlp will add it
      const outputBase = outputPath.replace(/\.mp3$/, "");

      // yt-dlp arguments for audio extraction (64kbps mono for smaller files)
      const args = [
        "-x", // Extract audio
        "--audio-format",
        "mp3",
        "--audio-quality",
        "9", // Lower quality = smaller file (64kbps)
        "--postprocessor-args",
        "ffmpeg:-ac 1 -ar 16000", // Mono 16kHz (Whisper optimal)
        "-o",
        `${outputBase}.%(ext)s`,
        "--no-playlist",
        "--print",
        "after_move:filepath",
        "--print",
        "%(title)s|||%(duration_string)s",
        videoUrl,
      ];

      // Add FFmpeg location if specified in environment
      const ffmpegPath = process.env.FFMPEG_PATH;
      if (ffmpegPath) {
        args.unshift("--ffmpeg-location", ffmpegPath);
      }

      // Use full path to yt-dlp
      const ytdlpPath: string =
        process.env.YTDLP_PATH ||
        "C:\\ProgramData\\chocolatey\\lib\\yt-dlp\\tools\\x64\\yt-dlp.exe";

      console.log(`[YouTubeDownloader] Using yt-dlp path: ${ytdlpPath}`);
      console.log(
        `[YouTubeDownloader] Running command with args: ${args
          .slice(0, 5)
          .join(" ")}...`
      );

      const childProcess = spawn(ytdlpPath, args);

      let stdout = "";
      let stderr = "";

      childProcess.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      childProcess.on("close", (code: number | null) => {
        if (code === 0) {
          // Parse output - first line is filepath, second is title|||duration
          const lines = stdout.trim().split("\n");
          const actualFilePath = lines[0] || outputPath;
          const metaLine = lines[1] || "";
          const parts = metaLine.split("|||");
          const title = parts[0];
          const duration = parts[1];

          console.log(`[YouTubeDownloader] Output file: ${actualFilePath}`);

          resolve({
            success: true,
            audioPath: actualFilePath,
            title: title || "Nieznany tytuł",
            duration: duration || "0:00",
          });
        } else {
          console.error("[YouTubeDownloader] yt-dlp stderr:", stderr);

          // Check for common errors
          if (
            stderr.includes("not found") ||
            stderr.includes("nie odnaleziono")
          ) {
            resolve({
              success: false,
              error:
                "yt-dlp nie jest zainstalowany. Zainstaluj go poleceniem: pip install yt-dlp",
            });
          } else if (stderr.includes("File is larger than max-filesize")) {
            resolve({
              success: false,
              error:
                "Plik audio jest zbyt duży (max 25MB). Wybierz krótsze wideo.",
            });
          } else {
            resolve({
              success: false,
              error: `Błąd pobierania: ${stderr.slice(0, 200)}`,
            });
          }
        }
      });

      childProcess.on("error", (err: Error & { code?: string }) => {
        if (err.code === "ENOENT") {
          resolve({
            success: false,
            error:
              "yt-dlp nie jest zainstalowany. Zainstaluj go poleceniem: pip install yt-dlp",
          });
        } else {
          resolve({
            success: false,
            error: `Błąd uruchomienia yt-dlp: ${err.message}`,
          });
        }
      });
    });
  }

  async transcribeAndAnalyze(
    audioPath: string,
    videoId: string,
    videoTitle: string,
    videoUrl: string,
    enablePreprocessing: boolean = true
  ): Promise<TranscriptionWithAnalysis> {
    if (!this.sttClient) {
      throw new Error(
        "STT client not initialized. Call initializeWithUserConfig first."
      );
    }

    let processedPath = audioPath;
    let audioAnalysis: AudioAnalysis | undefined;

    try {
      console.log(`[YouTubeDownloader] Transcribing: ${audioPath}`);

      // Adaptacyjny preprocessing audio (jeśli włączony)
      if (enablePreprocessing) {
        try {
          console.log(
            `[YouTubeDownloader] Starting adaptive audio preprocessing...`
          );
          const preprocessor = getAudioPreprocessor();
          const result = await preprocessor.preprocessAdaptive(
            audioPath,
            "wav"
          );
          processedPath = result.outputPath;
          audioAnalysis = result.analysis;
          console.log(
            `[YouTubeDownloader] Preprocessing complete. Issues: ${
              audioAnalysis.issues.map((i) => i.type).join(", ") || "none"
            }`
          );
        } catch (preprocessError) {
          console.warn(
            `[YouTubeDownloader] Preprocessing failed, using original audio:`,
            preprocessError
          );
          processedPath = audioPath;
        }
      }

      // Read audio file
      const audioBuffer = readFileSync(processedPath);
      const fileSizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);
      console.log(`[YouTubeDownloader] Audio file size: ${fileSizeMB}MB`);

      // Transcribe with Whisper using fs.createReadStream
      const { createReadStream } = await import("node:fs");
      const audioStream = createReadStream(processedPath);

      console.log(`[YouTubeDownloader] Using STT model: ${this.sttModel}`);

      const transcription = await this.sttClient.audio.transcriptions.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        file: audioStream as any,
        model: this.sttModel,
        language: "pl",
        response_format: "text",
      });

      const rawTranscript = transcription as unknown as string;

      if (!rawTranscript || rawTranscript.trim().length === 0) {
        return {
          success: false,
          rawTranscript: "",
          formattedTranscript: "",
          segments: [],
          summary: {
            averageTension: 0,
            dominantSentiment: "neutral",
            overallCredibility: 0,
            overallCredibilityEmoji: "🔴",
            speakerCount: 0,
            duration: "0:00",
          },
          metadata: { videoId, videoTitle, videoUrl },
          error: "Nie udało się rozpoznać mowy w nagraniu",
        };
      }

      // Correct transcription errors
      const correctedTranscript = await this.correctTranscript(rawTranscript);
      console.log("[YouTubeDownloader] Transcript corrected");

      // Analyze with GPT-4
      const analysis = await this.analyzeTranscript(correctedTranscript);

      // Format output as Markdown for export
      const formattedTranscript = this.formatTranscriptMarkdown(
        correctedTranscript,
        analysis.segments,
        analysis.summary,
        videoTitle,
        videoUrl
      );

      // Cleanup temp files
      try {
        unlinkSync(audioPath);
        if (processedPath !== audioPath && existsSync(processedPath)) {
          unlinkSync(processedPath);
        }
      } catch {
        /* ignore cleanup errors */
      }

      return {
        success: true,
        rawTranscript,
        formattedTranscript,
        segments: analysis.segments,
        summary: analysis.summary,
        metadata: { videoId, videoTitle, videoUrl },
        audioAnalysis,
      };
    } catch (error) {
      console.error("[YouTubeDownloader] Transcription error:", error);

      // Cleanup temp files
      try {
        unlinkSync(audioPath);
        if (processedPath !== audioPath && existsSync(processedPath)) {
          unlinkSync(processedPath);
        }
      } catch {
        /* ignore cleanup errors */
      }

      return {
        success: false,
        rawTranscript: "",
        formattedTranscript: "",
        segments: [],
        summary: {
          averageTension: 0,
          dominantSentiment: "neutral",
          overallCredibility: 0,
          overallCredibilityEmoji: "🔴",
          speakerCount: 0,
          duration: "0:00",
        },
        metadata: { videoId, videoTitle, videoUrl },
        error: error instanceof Error ? error.message : "Błąd transkrypcji",
      };
    }
  }

  private async correctTranscript(rawTranscript: string): Promise<string> {
    if (!this.llmClient) throw new Error("LLM client not initialized");

    console.log("[YouTubeDownloader] Correcting transcript errors...");

    const correctionPrompt = `Jesteś korektorem transkrypcji sesji rady miejskiej/gminnej. 

ZADANIE: Popraw błędy w transkrypcji, zachowując oryginalny kontekst i sens wypowiedzi.

ZASADY:
1. Poprawiaj TYLKO oczywiste błędy transkrypcji (przekręcone słowa, literówki)
2. Poprawiaj błędy stylistyczne (interpunkcja, wielkie litery na początku zdań)
3. NIE zmieniaj sensu wypowiedzi
4. NIE dodawaj własnych treści
5. NIE usuwaj fragmentów
6. Zachowaj strukturę i podział na akapity
7. Poprawiaj typowe błędy ASR: "rady" zamiast "raty", "sesja" zamiast "sesję" itp.

Zwróć TYLKO poprawiony tekst, bez komentarzy.`;

    const response = await this.llmClient.chat.completions.create({
      model: this.llmModel,
      messages: [
        { role: "system", content: correctionPrompt },
        { role: "user", content: rawTranscript.slice(0, 30000) },
      ],
      temperature: 0.1,
    });

    return response.choices[0]?.message?.content || rawTranscript;
  }

  private async analyzeTranscript(transcript: string): Promise<{
    segments: TranscriptSegment[];
    summary: {
      averageTension: number;
      dominantSentiment: string;
      overallCredibility: number;
      overallCredibilityEmoji: string;
      speakerCount: number;
      duration: string;
    };
  }> {
    if (!this.llmClient) throw new Error("LLM client not initialized");

    const systemPrompt = `Jesteś ekspertem analizy lingwistycznej sesji rady miejskiej/gminnej. Przeanalizuj transkrypcję i zwróć szczegółową analizę w formacie JSON.

Dla KAŻDEJ wypowiedzi określ:
1. **speaker** - identyfikuj rozmówców: "Przewodniczący", "Radny 1", "Radny 2", "Burmistrz", "Skarbnik" itp.
2. **sentiment** - "positive", "neutral", lub "negative"
3. **emotion** - główna emocja
4. **emotionEmoji** - emoji
5. **tension** - napięcie 1-10
6. **credibility** - wiarygodność 0-100%
7. **credibilityEmoji** - emoji: 90-100%=✅, 70-89%=🟢, 50-69%=🟡, 30-49%=⚠️, 0-29%=🔴

Odpowiedz TYLKO w formacie JSON:
{
  "segments": [
    {
      "timestamp": "00:00:00",
      "speaker": "Przewodniczący",
      "text": "tekst wypowiedzi",
      "sentiment": "neutral",
      "emotion": "spokój",
      "emotionEmoji": "🙂",
      "tension": 2,
      "credibility": 95,
      "credibilityEmoji": "✅"
    }
  ],
  "summary": {
    "averageTension": 3.5,
    "dominantSentiment": "neutral",
    "overallCredibility": 85,
    "overallCredibilityEmoji": "🟢",
    "speakerCount": 5,
    "duration": "1:32:00"
  }
}`;

    const response = await this.llmClient.chat.completions.create({
      model: this.llmModel,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Przeanalizuj transkrypcję sesji rady:\n\n${transcript.slice(
            0,
            15000
          )}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Brak odpowiedzi od GPT-4");
    }

    try {
      return JSON.parse(content);
    } catch {
      return {
        segments: [
          {
            timestamp: "00:00:00",
            speaker: "Mówca",
            text: transcript,
            sentiment: "neutral",
            emotion: "neutralny",
            emotionEmoji: "😐",
            tension: 5,
            credibility: 50,
            credibilityEmoji: "🟡",
          },
        ],
        summary: {
          averageTension: 5,
          dominantSentiment: "neutral",
          overallCredibility: 50,
          overallCredibilityEmoji: "🟡",
          speakerCount: 1,
          duration: "0:00",
        },
      };
    }
  }

  private formatTranscriptMarkdown(
    correctedTranscript: string,
    segments: TranscriptSegment[],
    summary: {
      averageTension: number;
      dominantSentiment: string;
      overallCredibility: number;
      overallCredibilityEmoji: string;
      speakerCount: number;
      duration: string;
    },
    videoTitle: string,
    videoUrl: string
  ): string {
    const date = new Date().toLocaleDateString("pl-PL", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    let md = `# Transkrypcja Sesji Rady\n\n`;
    md += `**Tytuł:** ${videoTitle}\n\n`;
    md += `**Źródło:** [YouTube](${videoUrl})\n\n`;
    md += `**Data transkrypcji:** ${date}\n\n`;
    md += `---\n\n`;

    md += `## Podsumowanie\n\n`;
    md += `| Parametr | Wartość |\n`;
    md += `|----------|--------|\n`;
    md += `| Czas trwania | ${summary.duration} |\n`;
    md += `| Liczba mówców | ${summary.speakerCount} |\n`;
    md += `| Średnie napięcie | ${
      summary.averageTension?.toFixed(1) || "N/A"
    }/10 |\n`;
    md += `| Dominujący sentyment | ${summary.dominantSentiment} |\n`;
    md += `| Ogólna wiarygodność | ${summary.overallCredibility}% ${summary.overallCredibilityEmoji} |\n\n`;

    md += `---\n\n`;
    md += `## Pełna transkrypcja\n\n`;
    md += `${correctedTranscript}\n\n`;

    md += `---\n\n`;
    md += `## Analiza wypowiedzi\n\n`;

    for (const seg of segments) {
      md += `### ${seg.speaker}\n\n`;
      md += `> ${seg.text}\n\n`;
      md += `- **Sentyment:** ${seg.sentiment} ${seg.emotionEmoji}\n`;
      md += `- **Emocja:** ${seg.emotion}\n`;
      md += `- **Napięcie:** ${seg.tension}/10\n`;
      md += `- **Wiarygodność:** ${seg.credibility}% ${seg.credibilityEmoji}\n\n`;
    }

    md += `---\n\n`;
    md += `*Dokument wygenerowany automatycznie przez Asystent Radnego*\n`;

    return md;
  }

  private extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  }
}
