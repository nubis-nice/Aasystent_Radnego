import { useState, useCallback, useRef } from "react";
import { transcribeAudio, processVoiceCommand } from "@/lib/api/voice";
import type { VoiceCommandResult } from "@/lib/api/voice";

export interface VoiceCommand {
  transcription: string;
  intent: VoiceIntent;
  confidence: number;
  action: VoiceAction;
  timestamp: Date;
}

function normalizeVoiceAction(
  action: VoiceCommandResult["action"],
  fallbackTranscription: string,
): VoiceAction {
  if (!action || typeof action !== "object" || !("type" in action)) {
    return { type: "chat", message: fallbackTranscription };
  }

  switch (action.type) {
    case "navigate":
      return {
        type: "navigate",
        path:
          typeof action.path === "string" && action.path.length > 0
            ? action.path
            : "/dashboard",
      };
    case "search":
      return {
        type: "search",
        query:
          typeof action.query === "string" && action.query.length > 0
            ? action.query
            : fallbackTranscription,
        tool: typeof action.tool === "string" ? action.tool : undefined,
      };
    case "chat":
      return {
        type: "chat",
        message:
          typeof action.message === "string" && action.message.length > 0
            ? action.message
            : fallbackTranscription,
      };
    case "control":
      return {
        type: "control",
        command:
          typeof action.command === "string" && action.command.length > 0
            ? action.command
            : "stop",
      };
    default:
      return { type: "chat", message: fallbackTranscription };
  }
}

export type VoiceIntent =
  | "navigation"
  | "search"
  | "chat"
  | "control"
  | "unknown";

export type VoiceAction =
  | { type: "navigate"; path: string }
  | { type: "search"; query: string; tool?: string }
  | { type: "chat"; message: string }
  | { type: "control"; command: string };

export interface VoiceCommandsState {
  isProcessing: boolean;
  lastCommand: VoiceCommand | null;
  history: VoiceCommand[];
  error: string | null;
}

export interface UseVoiceCommandsResult {
  state: VoiceCommandsState;
  processAudio: (audioBlob: Blob) => Promise<VoiceCommand | null>;
  executeCommand: (command: VoiceCommand) => Promise<void>;
  clearHistory: () => void;
}

export function useVoiceCommands(): UseVoiceCommandsResult {
  const [state, setState] = useState<VoiceCommandsState>({
    isProcessing: false,
    lastCommand: null,
    history: [],
    error: null,
  });

  const historyRef = useRef<VoiceCommand[]>([]);

  const processAudio = useCallback(
    async (audioBlob: Blob): Promise<VoiceCommand | null> => {
      setState((prev) => ({ ...prev, isProcessing: true, error: null }));

      try {
        const transcription = await transcribeAudio(audioBlob);

        if (!transcription || transcription.trim().length === 0) {
          setState((prev) => ({
            ...prev,
            isProcessing: false,
            error: "Nie wykryto mowy",
          }));
          return null;
        }

        const commandResult = await processVoiceCommand(transcription);

        const normalizedAction = normalizeVoiceAction(
          commandResult.action,
          transcription,
        );

        const voiceCommand: VoiceCommand = {
          transcription,
          intent: commandResult.intent,
          confidence: commandResult.confidence,
          action: normalizedAction,
          timestamp: new Date(),
        };

        historyRef.current = [...historyRef.current, voiceCommand].slice(-50);

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          lastCommand: voiceCommand,
          history: historyRef.current,
          error: null,
        }));

        return voiceCommand;
      } catch (error) {
        console.error("Error processing audio:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Błąd przetwarzania audio";

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
        }));

        return null;
      }
    },
    [],
  );

  const executeCommand = useCallback(async (command: VoiceCommand) => {
    try {
      switch (command.action.type) {
        case "navigate":
          if (typeof window !== "undefined") {
            window.location.href = command.action.path;
          }
          break;

        case "search":
          console.log("Executing search:", command.action.query);
          break;

        case "chat":
          console.log("Sending chat message:", command.action.message);
          break;

        case "control":
          console.log("Executing control command:", command.action.command);
          break;
      }
    } catch (error) {
      console.error("Error executing command:", error);
      throw error;
    }
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setState((prev) => ({
      ...prev,
      history: [],
      lastCommand: null,
      error: null,
    }));
  }, []);

  return {
    state,
    processAudio,
    executeCommand,
    clearHistory,
  };
}
