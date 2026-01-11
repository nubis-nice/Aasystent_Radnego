import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import OpenAI from "openai";
import { getSTTClient, getLLMClient, getAIConfig } from "../ai/index.js";

const require = createRequire(import.meta.url);
const { toFile } = require("openai");

export interface TranscriptSegment {
  timestamp: string;
  speaker: string;
  text: string;
  sentiment: "positive" | "neutral" | "negative";
  emotion: string;
  emotionEmoji: string;
  tension: number; // 1-10
  credibility: number; // 0-100
  credibilityEmoji: string;
}

export interface TranscriptionResult {
  success: boolean;
  rawTranscript: string;
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
    fileName: string;
    fileType: string;
    mimeType: string;
    fileSize: number;
    language: string;
  };
  formattedTranscript: string;
  error?: string;
}

const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
  "audio/x-m4a",
  "audio/m4a",
  "audio/flac",
  "audio/aac",
];

const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/x-matroska",
  "video/avi",
  "video/quicktime",
];

export class AudioTranscriber {
  private sttClient: OpenAI | null = null;
  private llmClient: OpenAI | null = null;
  private sttModel: string = "whisper-1";

  constructor() {}

  /**
   * Inicjalizacja z konfiguracją użytkownika przez AIClientFactory
   */
  async initializeWithUserConfig(userId: string): Promise<void> {
    // Pobierz klienta STT (Speech-to-Text) z fabryki
    this.sttClient = await getSTTClient(userId);

    // Pobierz konfigurację STT aby znać model
    const sttConfig = await getAIConfig(userId, "stt");
    this.sttModel = sttConfig.modelName;

    // Pobierz klienta LLM do analizy transkryptu
    this.llmClient = await getLLMClient(userId);

    console.log(
      `[AudioTranscriber] Initialized for user ${userId.substring(0, 8)}...`
    );
    console.log(
      `[AudioTranscriber] STT: provider=${sttConfig.provider}, model=${this.sttModel}`
    );
  }

  isAudioOrVideo(mimeType: string): boolean {
    return (
      AUDIO_MIME_TYPES.includes(mimeType) || VIDEO_MIME_TYPES.includes(mimeType)
    );
  }

  async transcribe(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<TranscriptionResult> {
    const fileSize = fileBuffer.length;
    const maxSize = 25 * 1024 * 1024; // 25MB - Whisper limit

    if (fileSize > maxSize) {
      return {
        success: false,
        rawTranscript: "",
        segments: [],
        summary: {
          averageTension: 0,
          dominantSentiment: "neutral",
          overallCredibility: 0,
          overallCredibilityEmoji: "🔴",
          speakerCount: 0,
          duration: "0:00",
        },
        metadata: {
          fileName,
          fileType: this.getFileType(mimeType),
          mimeType,
          fileSize,
          language: "pl",
        },
        formattedTranscript: "",
        error: `Plik jest zbyt duży (${Math.round(
          fileSize / 1024 / 1024
        )}MB). Maksymalny rozmiar to 25MB.`,
      };
    }

    if (!this.sttClient) {
      throw new Error(
        "STT client not initialized. Call initializeWithUserConfig first."
      );
    }

    try {
      console.log(`[AudioTranscriber] Transcribing: ${fileName} (${mimeType})`);

      // Step 1: Transcribe with Whisper
      const rawTranscript = await this.whisperTranscribe(fileBuffer, fileName);

      if (!rawTranscript || rawTranscript.trim().length === 0) {
        return {
          success: false,
          rawTranscript: "",
          segments: [],
          summary: {
            averageTension: 0,
            dominantSentiment: "neutral",
            overallCredibility: 0,
            overallCredibilityEmoji: "🔴",
            speakerCount: 0,
            duration: "0:00",
          },
          metadata: {
            fileName,
            fileType: this.getFileType(mimeType),
            mimeType,
            fileSize,
            language: "pl",
          },
          formattedTranscript: "",
          error:
            "Nie udało się rozpoznać mowy w pliku. Upewnij się, że plik zawiera wyraźną mowę.",
        };
      }

      // Step 2: Analyze with GPT-4
      const analysis = await this.analyzeTranscript(rawTranscript);

      // Step 3: Format output
      const formattedTranscript = this.formatTranscript(
        analysis.segments,
        analysis.summary
      );

      return {
        success: true,
        rawTranscript,
        segments: analysis.segments,
        summary: analysis.summary,
        metadata: {
          fileName,
          fileType: this.getFileType(mimeType),
          mimeType,
          fileSize,
          language: "pl",
        },
        formattedTranscript,
      };
    } catch (error) {
      console.error("[AudioTranscriber] Error:", error);
      return {
        success: false,
        rawTranscript: "",
        segments: [],
        summary: {
          averageTension: 0,
          dominantSentiment: "neutral",
          overallCredibility: 0,
          overallCredibilityEmoji: "🔴",
          speakerCount: 0,
          duration: "0:00",
        },
        metadata: {
          fileName,
          fileType: this.getFileType(mimeType),
          mimeType,
          fileSize,
          language: "pl",
        },
        formattedTranscript: "",
        error: error instanceof Error ? error.message : "Błąd transkrypcji",
      };
    }
  }

  private async whisperTranscribe(
    fileBuffer: Buffer,
    fileName: string
  ): Promise<string> {
    if (!this.sttClient) throw new Error("STT client not initialized");

    // Convert buffer to File-like object for OpenAI
    const file = await toFile(Readable.from(fileBuffer), fileName);

    const response = await this.sttClient.audio.transcriptions.create({
      file,
      model: this.sttModel,
      language: "pl",
      response_format: "text",
    });

    return response;
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

    const systemPrompt = `Jesteś ekspertem analizy lingwistycznej i psychologicznej. Przeanalizuj transkrypcję i zwróć szczegółową analizę w formacie JSON.

Dla KAŻDEJ wypowiedzi określ:
1. **speaker** - identyfikuj rozmówców jako "Rozmówca 1", "Rozmówca 2" itd. na podstawie kontekstu, zmiany tonu, odpowiedzi na pytania
2. **sentiment** - "positive", "neutral", lub "negative"
3. **emotion** - główna emocja (np. "spokój", "zaniepokojenie", "frustracja", "entuzjazm", "wahanie", "pewność siebie", "defensywność")
4. **emotionEmoji** - emoji odpowiadające emocji (😊😢😠😨🤔😰😤🙂😐)
5. **tension** - napięcie emocjonalne 1-10 (1=spokój, 10=silne napięcie)
6. **credibility** - wiarygodność 0-100% na podstawie:
   - Spójność wypowiedzi
   - Wahania, zmiany zdania ("właściwie", "albo", "nie pamiętam")
   - Nadmierne szczegóły lub ich brak
   - Unikanie odpowiedzi
   - Defensywność
   - Kontradykcje
7. **credibilityEmoji** - emoji: 90-100%=✅, 70-89%=🟢, 50-69%=🟡, 30-49%=⚠️, 0-29%=🔴

Odpowiedz TYLKO w formacie JSON:
{
  "segments": [
    {
      "timestamp": "00:00:00",
      "speaker": "Rozmówca 1",
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
    "speakerCount": 2,
    "duration": "5:32"
  }
}`;

    const response = await this.llmClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Przeanalizuj tę transkrypcję:\n\n${transcript}`,
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
      const parsed = JSON.parse(content);
      return {
        segments: parsed.segments || [],
        summary: parsed.summary || {
          averageTension: 0,
          dominantSentiment: "neutral",
          overallCredibility: 0,
          overallCredibilityEmoji: "🔴",
          speakerCount: 0,
          duration: "0:00",
        },
      };
    } catch {
      console.error(
        "[AudioTranscriber] Failed to parse GPT response:",
        content
      );
      // Return basic analysis if parsing fails
      return {
        segments: [
          {
            timestamp: "00:00:00",
            speaker: "Rozmówca",
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

  private formatTranscript(
    segments: TranscriptSegment[],
    summary: {
      averageTension: number;
      dominantSentiment: string;
      overallCredibility: number;
      overallCredibilityEmoji: string;
      speakerCount: number;
      duration: string;
    }
  ): string {
    let output = `📝 TRANSKRYPCJA AUDIO/VIDEO\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const seg of segments) {
      output += `[${seg.timestamp}] 👤 ${seg.speaker}:\n`;
      output += `"${seg.text}"\n`;
      output += `📊 Sentyment: ${this.translateSentiment(
        seg.sentiment
      )} | Emocja: ${seg.emotionEmoji} ${seg.emotion}\n`;
      output += `⚡ Napięcie: ${seg.tension}/10 | 🎯 Wiarygodność: ${seg.credibility}% ${seg.credibilityEmoji}\n\n`;
    }

    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `📈 PODSUMOWANIE ANALIZY:\n`;
    output += `• Czas trwania: ${summary.duration}\n`;
    output += `• Liczba rozmówców: ${summary.speakerCount}\n`;
    output += `• Średnie napięcie: ${summary.averageTension.toFixed(1)}/10\n`;
    output += `• Dominujący sentyment: ${this.translateSentiment(
      summary.dominantSentiment
    )}\n`;
    output += `• Ogólna wiarygodność: ${summary.overallCredibility}% ${summary.overallCredibilityEmoji}\n`;

    return output;
  }

  private translateSentiment(sentiment: string): string {
    switch (sentiment) {
      case "positive":
        return "Pozytywny";
      case "negative":
        return "Negatywny";
      case "neutral":
        return "Neutralny";
      default:
        return sentiment;
    }
  }

  private getFileType(mimeType: string): string {
    if (AUDIO_MIME_TYPES.includes(mimeType)) return "audio";
    if (VIDEO_MIME_TYPES.includes(mimeType)) return "video";
    return "unknown";
  }

  getCredibilityEmoji(credibility: number): string {
    if (credibility >= 90) return "✅";
    if (credibility >= 70) return "🟢";
    if (credibility >= 50) return "🟡";
    if (credibility >= 30) return "⚠️";
    return "🔴";
  }
}
