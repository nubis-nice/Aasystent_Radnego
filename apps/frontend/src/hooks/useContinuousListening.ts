import { useState, useCallback, useEffect, useRef } from "react";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { useVoiceCommands } from "./useVoiceCommands";
import { getVoiceSettings } from "@/lib/api/voice";

export interface ContinuousListeningState {
  isActive: boolean;
  isListening: boolean;
  lastWakeWord: string | null;
  sessionDuration: number;
  commandsInSession: number;
}

export interface UseContinuousListeningOptions {
  onCommand?: (command: unknown) => void;
  onTranscription?: (text: string) => void;
  onError?: (error: string) => void;
  maxSessionDuration?: number;
}

export function useContinuousListening(
  options: UseContinuousListeningOptions = {}
) {
  const {
    onCommand,
    onTranscription,
    onError,
    maxSessionDuration = 600000, // 10 minut
  } = options;

  const [state, setState] = useState<ContinuousListeningState>({
    isActive: false,
    isListening: false,
    lastWakeWord: null,
    sessionDuration: 0,
    commandsInSession: 0,
  });

  const [wakeWord, setWakeWord] = useState("asystencie");
  const {
    state: recorderState,
    startRecording,
    stopRecording,
  } = useVoiceRecorder();
  const { processAudio, executeCommand } = useVoiceCommands();

  const sessionStartRef = useRef<number>(0);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const settings = await getVoiceSettings();
      if (settings.wakeWord) {
        setWakeWord(settings.wakeWord.toLowerCase());
      }
    } catch (error) {
      console.error("Failed to load voice settings:", error);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const detectWakeWord = useCallback(
    (transcription: string): boolean => {
      const lowerTranscription = transcription.toLowerCase();
      return lowerTranscription.includes(wakeWord);
    },
    [wakeWord]
  );

  const handleVoiceActivity = useCallback(async () => {
    if (!state.isActive || recorderState.isRecording) return;

    if (recorderState.audioLevel > 20) {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      if (!recorderState.isRecording) {
        await startRecording();
        setState((prev) => ({ ...prev, isListening: true }));
      }
    } else {
      if (recorderState.isRecording && !silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(async () => {
          const audioBlob = await stopRecording();
          setState((prev) => ({ ...prev, isListening: false }));

          if (audioBlob && audioBlob.size > 1000) {
            try {
              const command = await processAudio(audioBlob);
              if (command) {
                const hasWakeWord = detectWakeWord(command.transcription);

                if (hasWakeWord || state.commandsInSession > 0) {
                  if (onTranscription) {
                    onTranscription(command.transcription);
                  }

                  setState((prev) => ({
                    ...prev,
                    lastWakeWord: hasWakeWord ? wakeWord : prev.lastWakeWord,
                    commandsInSession: prev.commandsInSession + 1,
                  }));

                  await executeCommand(command);

                  if (onCommand) {
                    onCommand(command);
                  }
                }
              }
            } catch (error) {
              if (onError) {
                onError(
                  error instanceof Error ? error.message : "Processing error"
                );
              }
            }
          }

          silenceTimeoutRef.current = null;
        }, 1500);
      }
    }
  }, [
    state.isActive,
    state.commandsInSession,
    recorderState.isRecording,
    recorderState.audioLevel,
    startRecording,
    stopRecording,
    processAudio,
    executeCommand,
    detectWakeWord,
    wakeWord,
    onTranscription,
    onCommand,
    onError,
  ]);

  const stopContinuousListening = useCallback(() => {
    if (!state.isActive) return;

    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (recorderState.isRecording) {
      stopRecording();
    }

    setState({
      isActive: false,
      isListening: false,
      lastWakeWord: null,
      sessionDuration: 0,
      commandsInSession: 0,
    });

    console.log("[ContinuousListening] Stopped");
  }, [state.isActive, recorderState.isRecording, stopRecording]);

  const startContinuousListening = useCallback(() => {
    if (state.isActive) return;

    sessionStartRef.current = Date.now();

    setState({
      isActive: true,
      isListening: false,
      lastWakeWord: null,
      sessionDuration: 0,
      commandsInSession: 0,
    });

    vadIntervalRef.current = setInterval(handleVoiceActivity, 100);

    durationIntervalRef.current = setInterval(() => {
      const duration = Date.now() - sessionStartRef.current;

      setState((prev) => ({ ...prev, sessionDuration: duration }));

      if (duration >= maxSessionDuration) {
        stopContinuousListening();
      }
    }, 1000);

    console.log("[ContinuousListening] Started");
  }, [
    state.isActive,
    handleVoiceActivity,
    maxSessionDuration,
    stopContinuousListening,
  ]);

  useEffect(() => {
    return () => {
      stopContinuousListening();
    };
  }, [stopContinuousListening]);

  return {
    state,
    startContinuousListening,
    stopContinuousListening,
    wakeWord,
  };
}
