/**
 * useVAD - Voice Activity Detection hook
 * Wykrywa aktywność głosową i ciszę w strumieniu audio
 */

import { useState, useRef, useCallback, useEffect } from "react";

export interface VADConfig {
  silenceThreshold: number; // Próg ciszy (0-100), domyślnie 10
  silenceDuration: number; // Czas ciszy w ms przed zakończeniem, domyślnie 1500
  minSpeechDuration: number; // Min czas mowy w ms, domyślnie 300
  sampleRate: number; // Częstotliwość próbkowania, domyślnie 100ms
}

export interface VADState {
  isActive: boolean; // Czy VAD jest aktywny
  isSpeaking: boolean; // Czy użytkownik mówi
  audioLevel: number; // Poziom audio (0-100)
  speechDuration: number; // Czas mowy w ms
  silenceDuration: number; // Czas ciszy w ms
}

export interface UseVADResult {
  state: VADState;
  startVAD: (stream: MediaStream) => void;
  stopVAD: () => void;
  resetVAD: () => void;
}

const DEFAULT_CONFIG: VADConfig = {
  silenceThreshold: 10,
  silenceDuration: 1500,
  minSpeechDuration: 300,
  sampleRate: 100,
};

export function useVAD(
  config: Partial<VADConfig> = {},
  onSpeechEnd?: () => void
): UseVADResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const [state, setState] = useState<VADState>({
    isActive: false,
    isSpeaking: false,
    audioLevel: 0,
    speechDuration: 0,
    silenceDuration: 0,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const hasSpeechRef = useRef<boolean>(false);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const startVAD = useCallback(
    (stream: MediaStream) => {
      cleanup();

      try {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        speechStartRef.current = null;
        silenceStartRef.current = null;
        hasSpeechRef.current = false;

        setState({
          isActive: true,
          isSpeaking: false,
          audioLevel: 0,
          speechDuration: 0,
          silenceDuration: 0,
        });

        // Analiza audio w interwałach
        intervalRef.current = setInterval(() => {
          if (!analyserRef.current) return;

          const dataArray = new Uint8Array(
            analyserRef.current.frequencyBinCount
          );
          analyserRef.current.getByteFrequencyData(dataArray);

          // Oblicz średni poziom audio
          const average =
            dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const normalizedLevel = Math.min(100, (average / 255) * 100);

          const now = Date.now();
          const isSpeakingNow = normalizedLevel > cfg.silenceThreshold;

          if (isSpeakingNow) {
            // Użytkownik mówi
            if (!speechStartRef.current) {
              speechStartRef.current = now;
            }
            silenceStartRef.current = null;
            hasSpeechRef.current = true;

            const speechDuration = now - speechStartRef.current;

            setState((prev) => ({
              ...prev,
              isSpeaking: true,
              audioLevel: normalizedLevel,
              speechDuration,
              silenceDuration: 0,
            }));
          } else {
            // Cisza
            if (!silenceStartRef.current) {
              silenceStartRef.current = now;
            }

            const silenceDuration = now - silenceStartRef.current;
            const speechDuration = speechStartRef.current
              ? now - speechStartRef.current
              : 0;

            setState((prev) => ({
              ...prev,
              isSpeaking: false,
              audioLevel: normalizedLevel,
              speechDuration,
              silenceDuration,
            }));

            // Sprawdź czy minął wystarczający czas ciszy po mowie
            if (
              hasSpeechRef.current &&
              silenceDuration >= cfg.silenceDuration &&
              speechDuration >= cfg.minSpeechDuration
            ) {
              console.log(
                `[VAD] Speech ended: speechDuration=${speechDuration}ms, silenceDuration=${silenceDuration}ms`
              );

              // Reset dla następnej wypowiedzi
              speechStartRef.current = null;
              silenceStartRef.current = null;
              hasSpeechRef.current = false;

              // Callback - wykryto koniec mowy
              if (onSpeechEnd) {
                onSpeechEnd();
              }
            }
          }
        }, cfg.sampleRate);
      } catch (error) {
        console.error("[VAD] Error starting VAD:", error);
        cleanup();
      }
    },
    [
      cfg.silenceThreshold,
      cfg.silenceDuration,
      cfg.minSpeechDuration,
      cfg.sampleRate,
      cleanup,
      onSpeechEnd,
    ]
  );

  const stopVAD = useCallback(() => {
    cleanup();
    setState({
      isActive: false,
      isSpeaking: false,
      audioLevel: 0,
      speechDuration: 0,
      silenceDuration: 0,
    });
  }, [cleanup]);

  const resetVAD = useCallback(() => {
    speechStartRef.current = null;
    silenceStartRef.current = null;
    hasSpeechRef.current = false;
    setState((prev) => ({
      ...prev,
      isSpeaking: false,
      speechDuration: 0,
      silenceDuration: 0,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    startVAD,
    stopVAD,
    resetVAD,
  };
}
