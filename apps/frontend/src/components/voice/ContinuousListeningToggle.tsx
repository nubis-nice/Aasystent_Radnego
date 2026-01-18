"use client";

import { MicOff, Radio } from "lucide-react";
import { useContinuousListening } from "@/hooks/useContinuousListening";

interface ContinuousListeningToggleProps {
  onCommand?: (command: unknown) => void;
  onTranscription?: (text: string) => void;
}

export function ContinuousListeningToggle({
  onCommand,
  onTranscription,
}: ContinuousListeningToggleProps) {
  const { state, startContinuousListening, stopContinuousListening, wakeWord } =
    useContinuousListening({
      onCommand,
      onTranscription,
      maxSessionDuration: 600000,
    });

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (state.isActive) {
            stopContinuousListening();
          } else {
            startContinuousListening();
          }
        }}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
          transition-all duration-200
          ${
            state.isActive
              ? "bg-green-500 hover:bg-green-600 text-white"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }
        `}
      >
        {state.isActive ? (
          <>
            <Radio size={16} className="animate-pulse" />
            Tryb głosowy aktywny
          </>
        ) : (
          <>
            <MicOff size={16} />
            Włącz tryb głosowy
          </>
        )}
      </button>

      {state.isActive && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[300px] z-50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Status sesji
              </span>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  state.isListening
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {state.isListening ? "🎤 Nasłuchuje..." : "✓ Gotowy"}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Czas sesji:</span>
                <span className="font-mono font-medium">
                  {formatDuration(state.sessionDuration)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Komendy:</span>
                <span className="font-medium">{state.commandsInSession}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Słowo wzywające:</span>
                <span className="font-medium capitalize">{wakeWord}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                💡 Powiedz &quot;{wakeWord}&quot; i komendę, aby wykonać akcję
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
