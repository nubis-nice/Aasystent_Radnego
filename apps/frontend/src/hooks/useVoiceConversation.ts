/**
 * useVoiceConversation - hook do prowadzenia rozmów głosowych z asystentem
 *
 * Funkcje:
 * - Wake word detection (np. "Stefan")
 * - VAD (Voice Activity Detection) - wykrywanie ciszy
 * - Auto-start mikrofonu
 * - Blokada mikrofonu podczas TTS
 * - Automatyczne TTS odpowiedzi
 * - Historia konwersacji
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { useVAD } from "./useVAD";
import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

export interface VoiceConversationState {
  isListening: boolean;
  isSpeaking: boolean;
  isMicBlocked: boolean;
  isProcessing: boolean;
  wakeWordDetected: boolean;
  messages: ConversationMessage[];
  error: string | null;
  assistantName: string;
}

export interface UseVoiceConversationOptions {
  assistantName?: string;
  autoTTS?: boolean;
  ttsVoice?: string;
  autoStart?: boolean; // Auto-start mikrofonu po otwarciu
  useVAD?: boolean; // Używaj VAD do wykrywania końca mowy
  vadSilenceDuration?: number; // Czas ciszy przed wysłaniem (ms)
  onMessage?: (message: ConversationMessage) => void;
  onWakeWord?: () => void;
  onSpeechEnd?: () => void; // Callback gdy VAD wykryje koniec mowy
}

const DEFAULT_OPTIONS: UseVoiceConversationOptions = {
  assistantName: "Stefan",
  autoTTS: true,
  ttsVoice: "pl-PL-MarekNeural",
  autoStart: false,
  useVAD: true,
  vadSilenceDuration: 1500,
};

export function useVoiceConversation(
  options: UseVoiceConversationOptions = {}
) {
  const opts = useMemo(
    () => ({ ...DEFAULT_OPTIONS, ...options }),
    [
      options.assistantName,
      options.autoTTS,
      options.ttsVoice,
      options.onMessage,
      options.onWakeWord,
    ]
  );

  const [state, setState] = useState<VoiceConversationState>({
    isListening: false,
    isSpeaking: false,
    isMicBlocked: false,
    isProcessing: false,
    wakeWordDetected: false,
    messages: [],
    error: null,
    assistantName: opts.assistantName || "Stefan",
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const messagesRef = useRef<ConversationMessage[]>([]);

  const {
    startRecording,
    stopRecording,
    state: recorderState,
  } = useVoiceRecorder();

  // Ref do przechowywania pending processVoiceInput i funkcji
  const pendingProcessRef = useRef<boolean>(false);
  const processVoiceInputRef = useRef<
    ((audioBlob: Blob) => Promise<string | null>) | null
  >(null);
  const startListeningRef = useRef<(() => Promise<void>) | null>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);

  // VAD callback - wywoływany gdy wykryto koniec mowy
  const handleVADSpeechEnd = useCallback(async () => {
    if (pendingProcessRef.current) return; // Zapobiegaj podwójnemu wywołaniu
    pendingProcessRef.current = true;

    console.log("[VoiceConversation] VAD detected speech end, processing...");

    try {
      const audioBlob = await stopRecording();
      console.log(
        "[VoiceConversation] Audio blob:",
        audioBlob?.size || 0,
        "bytes"
      );

      if (audioBlob && audioBlob.size > 0) {
        setState((prev) => ({ ...prev, isListening: false }));

        // Wywołaj processVoiceInput przez ref (bo jest zdefiniowany później)
        if (processVoiceInputRef.current) {
          console.log("[VoiceConversation] Calling processVoiceInput...");
          await processVoiceInputRef.current(audioBlob);
        } else {
          console.warn(
            "[VoiceConversation] processVoiceInputRef.current is null!"
          );
        }
      } else {
        console.warn("[VoiceConversation] Audio blob is empty or null");
      }
    } catch (err) {
      console.error("[VoiceConversation] VAD callback error:", err);
    } finally {
      pendingProcessRef.current = false;
    }
  }, [stopRecording]);

  // VAD hook
  const {
    state: vadState,
    startVAD,
    stopVAD,
    resetVAD,
  } = useVAD(
    {
      silenceDuration: opts.vadSilenceDuration || 1500,
      silenceThreshold: 10,
      minSpeechDuration: 300,
    },
    opts.useVAD ? handleVADSpeechEnd : undefined
  );

  // Inicjalizacja AudioContext
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioContextRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    }
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  /**
   * Sprawdź czy transkrypcja zawiera wake word
   */
  const detectWakeWord = useCallback(
    (transcription: string): boolean => {
      const name = state.assistantName.toLowerCase();
      const text = transcription.toLowerCase();

      // Wzorce wake word
      const patterns = [
        `hej ${name}`,
        `hey ${name}`,
        `cześć ${name}`,
        `witaj ${name}`,
        `ok ${name}`,
        `okej ${name}`,
        name, // samo imię też działa
      ];

      return patterns.some((pattern) => text.includes(pattern));
    },
    [state.assistantName]
  );

  /**
   * Usuń wake word z transkrypcji
   */
  const stripWakeWord = useCallback(
    (transcription: string): string => {
      const name = state.assistantName;

      const patterns = [
        new RegExp(`^(hej|hey|cześć|witaj)?\\s*${name}[,.]?\\s*`, "i"),
        new RegExp(`^(ok|okej)?\\s*${name}[,.]?\\s*`, "i"),
      ];

      let result = transcription;
      for (const pattern of patterns) {
        result = result.replace(pattern, "").trim();
      }

      return result || transcription;
    },
    [state.assistantName]
  );

  /**
   * Wykryj komendę wyłączenia dialogu
   */
  const detectStopCommand = useCallback(
    (transcription: string): boolean => {
      const name = state.assistantName.toLowerCase();
      const text = transcription.toLowerCase().trim();

      const stopPatterns = [
        `wyłącz się ${name}`,
        `wyłącz się`,
        `zamknij się ${name}`,
        `zamknij się`,
        `koniec ${name}`,
        `koniec rozmowy`,
        `do widzenia ${name}`,
        `do widzenia`,
        `pa ${name}`,
        `dziękuję ${name}`,
        `dziękuję to wszystko`,
        `stop`,
        `zakończ`,
        `zakończ rozmowę`,
      ];

      return stopPatterns.some((pattern) => text.includes(pattern));
    },
    [state.assistantName]
  );

  /**
   * Blokuj mikrofon (podczas TTS)
   */
  const blockMicrophone = useCallback(() => {
    setState((prev) => ({ ...prev, isMicBlocked: true }));

    // Jeśli nagrywanie jest aktywne, zatrzymaj je
    if (recorderState.isRecording) {
      stopRecording();
    }

    // Wycisz strumień mikrofonu jeśli istnieje
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
  }, [recorderState.isRecording, stopRecording]);

  /**
   * Odblokuj mikrofon
   */
  const unblockMicrophone = useCallback(() => {
    setState((prev) => ({ ...prev, isMicBlocked: false }));

    // Włącz ponownie strumień mikrofonu
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }
  }, []);

  /**
   * Odtwórz odpowiedź TTS
   */
  const speakResponse = useCallback(
    async (text: string): Promise<void> => {
      console.log("[VoiceConversation] speakResponse called:", {
        autoTTS: opts.autoTTS,
        textLength: text?.length,
      });

      if (!opts.autoTTS || !text) {
        console.log("[VoiceConversation] TTS skipped:", {
          autoTTS: opts.autoTTS,
          hasText: !!text,
        });
        return;
      }

      setState((prev) => ({ ...prev, isSpeaking: true }));
      blockMicrophone();

      try {
        // Pobierz token z Supabase
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) return;

        const response = await fetch(`${API_URL}/api/edge-tts/synthesize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            text,
            voice: opts.ttsVoice || "pl-PL-MarekNeural",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.warn(
            "[VoiceConversation] TTS API error:",
            response.status,
            errorData
          );
          console.log(
            "[VoiceConversation] TTS not available, skipping voice response"
          );
          return;
        }

        // Edge TTS zwraca JSON z audio w base64
        const ttsData = await response.json();
        if (!ttsData.success || !ttsData.audio) {
          console.warn("[VoiceConversation] TTS response invalid:", ttsData);
          return;
        }

        // audio jest w formacie "data:audio/mp3;base64,..."
        const audioUrl = ttsData.audio;
        console.log(
          "[VoiceConversation] TTS audio received, length:",
          audioUrl?.length
        );

        // Odtwórz audio
        if (!audioRef.current) {
          console.warn(
            "[VoiceConversation] audioRef.current is null, creating new Audio element"
          );
          audioRef.current = new Audio();
        }

        console.log("[VoiceConversation] Setting audio src and playing...");
        audioRef.current.src = audioUrl;

        await new Promise<void>((resolve, reject) => {
          if (!audioRef.current) {
            reject(new Error("Audio element not found"));
            return;
          }

          audioRef.current.onended = () => {
            resolve();
          };

          audioRef.current.onerror = () => {
            reject(new Error("Audio playback failed"));
          };

          audioRef.current.play().catch(reject);
        });
      } catch (error) {
        console.error("[VoiceConversation] TTS error:", error);
        console.error(
          "[VoiceConversation] TTS error details:",
          JSON.stringify(error, Object.getOwnPropertyNames(error as object))
        );
      } finally {
        setState((prev) => ({ ...prev, isSpeaking: false }));
        unblockMicrophone();
      }
    },
    [opts.autoTTS, opts.ttsVoice, blockMicrophone, unblockMicrophone]
  );

  /**
   * Dodaj wiadomość do historii
   */
  const addMessage = useCallback(
    (role: "user" | "assistant", content: string): ConversationMessage => {
      const message: ConversationMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role,
        content,
        timestamp: new Date(),
      };

      messagesRef.current = [...messagesRef.current, message];
      setState((prev) => ({ ...prev, messages: messagesRef.current }));

      if (opts.onMessage) {
        opts.onMessage(message);
      }

      return message;
    },
    [opts]
  );

  /**
   * Przetwórz komendę głosową i uzyskaj odpowiedź
   */
  const processVoiceInput = useCallback(
    async (audioBlob: Blob): Promise<string | null> => {
      setState((prev) => ({ ...prev, isProcessing: true, error: null }));

      try {
        // 1. Transkrypcja
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        // Pobierz token i userId z Supabase
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const userId = sessionData.session?.user?.id || "";

        if (!token) {
          throw new Error("Nie jesteś zalogowany");
        }

        console.log(
          `[VoiceConversation] Sending audio to transcribe, userId: ${userId}, blob size: ${audioBlob.size}`
        );

        const transcribeResponse = await fetch(
          `${API_URL}/api/voice/transcribe`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        if (!transcribeResponse.ok) {
          const errorData = await transcribeResponse.json().catch(() => ({}));
          console.error(
            "[VoiceConversation] Transcription API error:",
            transcribeResponse.status,
            errorData
          );
          throw new Error(
            errorData.error ||
              errorData.message ||
              `Transcription failed (${transcribeResponse.status})`
          );
        }

        const { text: transcription } = await transcribeResponse.json();

        if (!transcription || transcription.trim().length === 0) {
          setState((prev) => ({
            ...prev,
            isProcessing: false,
            error: "Nie wykryto mowy",
          }));
          // Wznów nasłuchiwanie po pustej transkrypcji
          setTimeout(() => startListeningRef.current?.(), 500);
          return null;
        }

        // 2. Sprawdź komendę wyłączenia dialogu
        if (detectStopCommand(transcription)) {
          console.log(
            "[VoiceConversation] Stop command detected:",
            transcription
          );
          addMessage("user", transcription);
          addMessage("assistant", "Do widzenia! Zamykam rozmowę.");
          if (opts.autoTTS) {
            await speakResponse("Do widzenia!");
          }
          stopListeningRef.current?.();
          setState((prev) => ({ ...prev, isProcessing: false }));
          return null;
        }

        // 3. Usuń wake word z wiadomości (opcjonalnie)
        const cleanedMessage = stripWakeWord(transcription);

        // 4. Dodaj wiadomość użytkownika
        addMessage("user", cleanedMessage);

        // 5. Wyślij do AI chat (użyj tokenu z wcześniejszego wywołania)
        const chatResponse = await fetch(`${API_URL}/api/chat/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: cleanedMessage,
            conversationId: null,
            includeDocuments: true,
          }),
        });

        if (!chatResponse.ok) {
          const errorData = await chatResponse.json().catch(() => ({}));
          console.error(
            "[VoiceConversation] Chat API error:",
            chatResponse.status,
            errorData
          );
          throw new Error(
            errorData.error ||
              errorData.message ||
              `Chat request failed (${chatResponse.status})`
          );
        }

        const chatData = await chatResponse.json();
        // API zwraca message jako obiekt z polem content
        const assistantResponse =
          chatData.message?.content || chatData.response || "";

        if (!assistantResponse || typeof assistantResponse !== "string") {
          console.warn(
            "[VoiceConversation] Empty or invalid response from chat API"
          );
          return null;
        }

        // 6. Dodaj odpowiedź asystenta
        addMessage("assistant", assistantResponse);

        // 7. Odczytaj odpowiedź (TTS)
        await speakResponse(assistantResponse);

        setState((prev) => ({ ...prev, isProcessing: false }));

        // 8. Wznów nasłuchiwanie dla ciągłego dialogu
        console.log(
          "[VoiceConversation] Resuming listening for continuous dialog"
        );
        setTimeout(() => startListeningRef.current?.(), 500);

        return assistantResponse;
      } catch (error) {
        console.error("[VoiceConversation] Error:", error);
        console.error("[VoiceConversation] Error type:", typeof error);
        console.error(
          "[VoiceConversation] Error JSON:",
          JSON.stringify(error, Object.getOwnPropertyNames(error))
        );

        let errorMessage = "Błąd przetwarzania";
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === "string") {
          errorMessage = error;
        } else if (error && typeof error === "object" && "message" in error) {
          errorMessage = String((error as { message: unknown }).message);
        }

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
        }));
        return null;
      }
    },
    [stripWakeWord, detectStopCommand, addMessage, speakResponse, opts]
  );

  // Aktualizuj ref do processVoiceInput
  useEffect(() => {
    processVoiceInputRef.current = processVoiceInput;
  }, [processVoiceInput]);

  /**
   * Rozpocznij nasłuchiwanie
   * UWAGA: startRecording() sam wywołuje getUserMedia, nie duplikujemy
   */
  const startListening = useCallback(async () => {
    if (state.isMicBlocked || state.isSpeaking) {
      console.log(
        "[VoiceConversation] Mikrofon zablokowany podczas mówienia asystenta"
      );
      return;
    }

    setState((prev) => ({ ...prev, isListening: true, error: null }));

    try {
      // startRecording() sam wywołuje getUserMedia i zarządza strumieniem
      await startRecording();

      // Jeśli VAD włączony, uzyskaj strumień audio i startuj VAD
      if (opts.useVAD) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        mediaStreamRef.current = stream;
        startVAD(stream);
        console.log("[VoiceConversation] VAD started");
      }
    } catch (error) {
      console.error("[VoiceConversation] Start listening error:", error);
      setState((prev) => ({
        ...prev,
        isListening: false,
        error: "Nie można uzyskać dostępu do mikrofonu",
      }));
    }
  }, [
    state.isMicBlocked,
    state.isSpeaking,
    startRecording,
    opts.useVAD,
    startVAD,
  ]);

  /**
   * Zatrzymaj nasłuchiwanie i przetwórz
   */
  const stopListening = useCallback(async () => {
    setState((prev) => ({ ...prev, isListening: false }));

    // Zatrzymaj VAD
    if (opts.useVAD) {
      stopVAD();
    }

    const audioBlob = await stopRecording();

    // Zatrzymaj strumień mikrofonu
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioBlob) {
      await processVoiceInput(audioBlob);
    }
  }, [stopRecording, processVoiceInput, opts.useVAD, stopVAD]);

  /**
   * Anuluj nasłuchiwanie BEZ transkrypcji (do wyłączania)
   */
  const cancelListening = useCallback(() => {
    setState((prev) => ({ ...prev, isListening: false, isProcessing: false }));

    // Zatrzymaj VAD
    if (opts.useVAD) {
      stopVAD();
    }

    // Zatrzymaj nagrywanie bez przetwarzania
    stopRecording();

    // Zatrzymaj strumień mikrofonu
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, [stopRecording, opts.useVAD, stopVAD]);

  // Aktualizuj refy dla ciągłego dialogu
  useEffect(() => {
    startListeningRef.current = startListening;
    stopListeningRef.current = stopListening;
  }, [startListening, stopListening]);

  /**
   * Zatrzymaj odtwarzanie TTS
   */
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState((prev) => ({ ...prev, isSpeaking: false }));
    unblockMicrophone();
  }, [unblockMicrophone]);

  /**
   * Wyczyść historię
   */
  const clearMessages = useCallback(() => {
    messagesRef.current = [];
    setState((prev) => ({ ...prev, messages: [] }));
  }, []);

  /**
   * Ustaw imię asystenta
   */
  const setAssistantName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, assistantName: name }));
  }, []);

  // Inicjalizacja elementu audio
  useEffect(() => {
    if (typeof window !== "undefined" && !audioRef.current) {
      audioRef.current = new Audio();
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    state,
    startListening,
    stopListening,
    cancelListening,
    stopSpeaking,
    speakResponse,
    clearMessages,
    setAssistantName,
    blockMicrophone,
    unblockMicrophone,
    addMessage,
    isRecording: recorderState.isRecording,
    recordingDuration: recorderState.duration,
    // VAD
    vadState,
    resetVAD,
    processVoiceInput,
  };
}
