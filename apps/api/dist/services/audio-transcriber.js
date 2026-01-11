import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
const require = createRequire(import.meta.url);
const { toFile } = require("openai");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
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
    openai = null;
    constructor() { }
    async initializeWithUserConfig(userId) {
        const { data: config } = await supabase
            .from("api_configurations")
            .select("*")
            .eq("user_id", userId)
            .eq("is_default", true)
            .eq("is_active", true)
            .single();
        if (!config) {
            throw new Error("Brak skonfigurowanego klucza API. Przejdź do ustawień.");
        }
        const decodedApiKey = Buffer.from(config.api_key_encrypted, "base64").toString("utf-8");
        // Użyj base_url z konfiguracji jeśli istnieje, w przeciwnym razie użyj domyślnego
        const baseURL = config.base_url || this.getProviderBaseUrl(config.provider);
        this.openai = new OpenAI({
            apiKey: decodedApiKey,
            baseURL: baseURL,
        });
    }
    getProviderBaseUrl(provider) {
        switch (provider) {
            case "openai":
                return undefined;
            case "local":
                return "http://localhost:11434/v1"; // Ollama default
            case "openrouter":
                return "https://openrouter.ai/api/v1";
            default:
                return undefined;
        }
    }
    isAudioOrVideo(mimeType) {
        return (AUDIO_MIME_TYPES.includes(mimeType) || VIDEO_MIME_TYPES.includes(mimeType));
    }
    async transcribe(fileBuffer, fileName, mimeType) {
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
                error: `Plik jest zbyt duży (${Math.round(fileSize / 1024 / 1024)}MB). Maksymalny rozmiar to 25MB.`,
            };
        }
        if (!this.openai) {
            throw new Error("OpenAI client not initialized");
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
                    error: "Nie udało się rozpoznać mowy w pliku. Upewnij się, że plik zawiera wyraźną mowę.",
                };
            }
            // Step 2: Analyze with GPT-4
            const analysis = await this.analyzeTranscript(rawTranscript);
            // Step 3: Format output
            const formattedTranscript = this.formatTranscript(analysis.segments, analysis.summary);
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
        }
        catch (error) {
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
    async whisperTranscribe(fileBuffer, fileName) {
        if (!this.openai)
            throw new Error("OpenAI not initialized");
        // Convert buffer to File-like object for OpenAI
        const file = await toFile(Readable.from(fileBuffer), fileName);
        const response = await this.openai.audio.transcriptions.create({
            file,
            model: "whisper-1",
            language: "pl",
            response_format: "text",
        });
        return response;
    }
    async analyzeTranscript(transcript) {
        if (!this.openai)
            throw new Error("OpenAI not initialized");
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
        const response = await this.openai.chat.completions.create({
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
        }
        catch {
            console.error("[AudioTranscriber] Failed to parse GPT response:", content);
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
    formatTranscript(segments, summary) {
        let output = `📝 TRANSKRYPCJA AUDIO/VIDEO\n`;
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        for (const seg of segments) {
            output += `[${seg.timestamp}] 👤 ${seg.speaker}:\n`;
            output += `"${seg.text}"\n`;
            output += `📊 Sentyment: ${this.translateSentiment(seg.sentiment)} | Emocja: ${seg.emotionEmoji} ${seg.emotion}\n`;
            output += `⚡ Napięcie: ${seg.tension}/10 | 🎯 Wiarygodność: ${seg.credibility}% ${seg.credibilityEmoji}\n\n`;
        }
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        output += `📈 PODSUMOWANIE ANALIZY:\n`;
        output += `• Czas trwania: ${summary.duration}\n`;
        output += `• Liczba rozmówców: ${summary.speakerCount}\n`;
        output += `• Średnie napięcie: ${summary.averageTension.toFixed(1)}/10\n`;
        output += `• Dominujący sentyment: ${this.translateSentiment(summary.dominantSentiment)}\n`;
        output += `• Ogólna wiarygodność: ${summary.overallCredibility}% ${summary.overallCredibilityEmoji}\n`;
        return output;
    }
    translateSentiment(sentiment) {
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
    getFileType(mimeType) {
        if (AUDIO_MIME_TYPES.includes(mimeType))
            return "audio";
        if (VIDEO_MIME_TYPES.includes(mimeType))
            return "video";
        return "unknown";
    }
    getCredibilityEmoji(credibility) {
        if (credibility >= 90)
            return "✅";
        if (credibility >= 70)
            return "🟢";
        if (credibility >= 50)
            return "🟡";
        if (credibility >= 30)
            return "⚠️";
        return "🔴";
    }
}
//# sourceMappingURL=audio-transcriber.js.map