import { FastifyInstance, FastifyRequest } from "fastify";
import { getSTTClient, getTTSClient, getAIConfig } from "../ai/index.js";
import { VoiceCommandService } from "../services/voice-command-service.js";
import { VoiceActionService } from "../services/voice-action-service.js";
import { supabase } from "../lib/supabase.js";
import { ttsTextProcessor } from "../services/tts-text-processor.js";
import fs from "fs/promises";
import * as fsSync from "fs";
import path from "path";
import os from "os";
import { Buffer } from "node:buffer";

interface CommandBody {
  transcription: string;
}

interface VoiceSettingsBody {
  wakeWord?: string;
  continuousMode?: boolean;
  autoTTS?: boolean;
  ttsVoice?: string;
  ttsSpeed?: number;
}

export async function voiceRoutes(fastify: FastifyInstance) {
  fastify.post("/voice/transcribe", async (request: FastifyRequest, reply) => {
    const userId = request.headers["x-user-id"] as string;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    let tempFilePath: string | null = null;

    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: "No audio file provided" });
      }

      const buffer = await data.toBuffer();

      if (buffer.length === 0) {
        return reply.code(400).send({ error: "Empty audio file" });
      }

      if (buffer.length > 10 * 1024 * 1024) {
        return reply
          .code(400)
          .send({ error: "Audio file too large (max 10MB)" });
      }

      const tempDir = os.tmpdir();
      tempFilePath = path.join(tempDir, `voice_${Date.now()}_${data.filename}`);

      await fs.writeFile(tempFilePath, buffer);

      const sttClient = await getSTTClient(userId);
      const sttConfig = await getAIConfig(userId, "stt");

      const audioStream = fsSync.createReadStream(tempFilePath);
      const startTime = Date.now();
      const transcription = await sttClient.audio.transcriptions.create({
        file: audioStream as any,
        model: sttConfig.modelName,
        language: "pl",
      });
      const duration = Date.now() - startTime;

      console.log(
        `[Voice] STT completed: ${transcription.text.substring(
          0,
          50
        )}... (${duration}ms)`
      );

      const { error: logError } = await supabase.from("voice_commands").insert({
        user_id: userId,
        transcription: transcription.text,
        intent: null,
        action: null,
        executed: false,
        audio_duration_ms: buffer.length,
        processing_time_ms: duration,
      });

      if (logError) {
        console.error("Failed to log voice command:", logError);
      }

      return reply.send({
        text: transcription.text,
        duration: duration,
      });
    } catch (error) {
      console.error("Transcription error:", error);
      return reply.code(500).send({
        error: "Transcription failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      // Cleanup temp file w każdym przypadku (sukces lub błąd)
      if (tempFilePath) {
        await fs.unlink(tempFilePath).catch((err) => {
          console.error("Failed to delete temp file:", err);
        });
      }
    }
  });

  fastify.post<{ Body: CommandBody }>(
    "/voice/command",
    async (request, reply) => {
      const userId = request.headers["x-user-id"] as string;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { transcription } = request.body;

      if (!transcription || transcription.trim().length === 0) {
        return reply.code(400).send({ error: "Empty transcription" });
      }

      try {
        const voiceCommandService = new VoiceCommandService(userId);
        const result = await voiceCommandService.processCommand(transcription);

        const { error: updateError } = await supabase
          .from("voice_commands")
          .update({
            intent: result.intent,
            action: result.action,
            confidence: result.confidence,
            executed: true,
            execution_result: result,
          })
          .eq("user_id", userId)
          .eq("transcription", transcription)
          .order("created_at", { ascending: false })
          .limit(1);

        if (updateError) {
          console.error("Failed to update voice command:", updateError);
        }

        return reply.send(result);
      } catch (error) {
        console.error("Command processing error:", error);
        return reply.code(500).send({
          error: "Command processing failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  fastify.get("/voice/settings", async (request, reply) => {
    const userId = request.headers["x-user-id"] as string;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    try {
      const { data, error } = await supabase
        .from("user_voice_settings")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Failed to fetch voice settings:", error);
      }

      const defaultSettings = {
        wakeWord: "Asystencie",
        continuousMode: false,
        autoTTS: true,
        ttsVoice: "pl-PL-MarekNeural",
        ttsSpeed: 1.0,
      };

      const settings = data
        ? {
            wakeWord: data.wake_word,
            continuousMode: data.continuous_mode,
            autoTTS: data.auto_tts,
            ttsVoice: data.tts_voice,
            ttsSpeed: data.tts_speed,
          }
        : defaultSettings;

      return reply.send(settings);
    } catch (error) {
      console.error("Error fetching voice settings:", error);
      return reply.code(500).send({ error: "Failed to fetch settings" });
    }
  });

  fastify.put<{ Body: VoiceSettingsBody }>(
    "/voice/settings",
    async (request, reply) => {
      const userId = request.headers["x-user-id"] as string;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const settings = request.body;

      try {
        const { data: existing, error } = await supabase
          .from("user_voice_settings")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (error) {
          throw error;
        }

        const updatedSettings = {
          ...(existing || {}),
          ...settings,
        };

        const { error: updateError } = await supabase
          .from("user_voice_settings")
          .upsert({
            user_id: userId,
            wake_word: updatedSettings.wakeWord,
            continuous_mode: updatedSettings.continuousMode,
            auto_tts: updatedSettings.autoTTS,
            tts_voice: updatedSettings.ttsVoice,
            tts_speed: updatedSettings.ttsSpeed,
            updated_at: new Date().toISOString(),
          });

        if (updateError) {
          throw updateError;
        }

        return reply.send({ success: true });
      } catch (error) {
        console.error("Error updating voice settings:", error);
        return reply.code(500).send({ error: "Failed to update settings" });
      }
    }
  );

  fastify.post<{
    Body: { text: string; voice?: string; processForTTS?: boolean };
  }>("/voice/synthesize", async (request, reply) => {
    const userId = request.headers["x-user-id"] as string;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { text, voice, processForTTS = true } = request.body;

    if (!text || text.trim().length === 0) {
      return reply.code(400).send({ error: "Empty text" });
    }

    // Inteligentne przetwarzanie tekstu dla TTS
    const processedText = processForTTS ? ttsTextProcessor.process(text) : text;

    console.log(
      `[Voice TTS] Original: ${text.length} chars → Processed: ${processedText.length} chars`
    );

    try {
      const ttsClient = await getTTSClient(userId);
      const ttsConfig = await getAIConfig(userId, "tts");

      const { data: settings, error } = await supabase
        .from("user_voice_settings")
        .select("tts_voice, tts_speed")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.warn("Failed to fetch voice settings:", error);
      }

      // OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
      const selectedVoice = voice || settings?.tts_voice || "alloy";
      const speed = settings?.tts_speed || 1.0;

      const response = await ttsClient.audio.speech.create({
        model: ttsConfig.modelName,
        voice: selectedVoice as
          | "alloy"
          | "echo"
          | "fable"
          | "onyx"
          | "nova"
          | "shimmer",
        input: processedText,
        speed: speed,
      });

      const audioBuffer = Buffer.from(await response.arrayBuffer());

      return reply
        .header("Content-Type", "audio/mpeg")
        .header("Content-Length", audioBuffer.length)
        .send(audioBuffer);
    } catch (error) {
      console.error("TTS synthesis error:", error);
      return reply.code(500).send({
        error: "TTS synthesis failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  fastify.get("/voice/history", async (request, reply) => {
    const userId = request.headers["x-user-id"] as string;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    try {
      const { data, error } = await supabase
        .from("voice_commands")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      return reply.send({ commands: data || [] });
    } catch (error) {
      console.error("Error fetching voice history:", error);
      return reply.code(500).send({ error: "Failed to fetch history" });
    }
  });

  /**
   * Endpoint dla akcji głosowych Stefana
   * Obsługuje: kalendarz, zadania, alerty, dokumenty, QuickTools, nawigację
   */
  fastify.post<{ Body: { command: string; pendingActionId?: string } }>(
    "/voice/action",
    async (request, reply) => {
      const userId = request.headers["x-user-id"] as string;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { command, pendingActionId } = request.body;

      if (!command || command.trim().length === 0) {
        return reply.code(400).send({ error: "Empty command" });
      }

      try {
        const voiceActionService = new VoiceActionService(userId);
        const result = await voiceActionService.processVoiceCommand(command, {
          pendingActionId,
        });

        // Loguj akcję
        await supabase.from("voice_commands").insert({
          user_id: userId,
          transcription: command,
          intent: result.actionType,
          action: result.actionType,
          confidence: 1.0,
          executed: result.success,
          execution_result: result,
        });

        return reply.send(result);
      } catch (error) {
        console.error("[Voice Action] Error:", error);
        return reply.code(500).send({
          error: "Voice action failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  /**
   * Wykryj wake word w transkrypcji
   */
  fastify.post<{ Body: { transcription: string; assistantName?: string } }>(
    "/voice/detect-wake-word",
    async (request, reply) => {
      const { transcription, assistantName = "Stefan" } = request.body;

      if (!transcription) {
        return reply.code(400).send({ error: "Empty transcription" });
      }

      const text = transcription.toLowerCase().trim();
      const name = assistantName.toLowerCase();

      // Wzorce wake word
      const wakePatterns = [
        `hej ${name}`,
        `hey ${name}`,
        `cześć ${name}`,
        `witaj ${name}`,
        `ok ${name}`,
        `okej ${name}`,
      ];

      const detected = wakePatterns.some((pattern) => text.includes(pattern));

      // Wyodrębnij komendę po wake word
      let command = transcription;
      if (detected) {
        for (const pattern of wakePatterns) {
          const regex = new RegExp(`${pattern}[,.]?\\s*`, "i");
          command = command.replace(regex, "").trim();
        }
      }

      // Sprawdź słowo wykonania
      const executePatterns = [/wykonaj/i, /zrób to/i, /potwierdź/i, /tak$/i];
      const isExecuteCommand = executePatterns.some((p) => p.test(text));

      return reply.send({
        wakeWordDetected: detected,
        isExecuteCommand,
        command: command || null,
        originalTranscription: transcription,
      });
    }
  );
}
