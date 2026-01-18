"use client";

import { Mic, Square, MessageCircle } from "lucide-react";
import { useVoice } from "@/contexts/VoiceContext";
import { useState, useMemo } from "react";
import { usePathname } from "next/navigation";

/**
 * Globalny floating button do sterowania głosem
 * Widoczny na wszystkich stronach, integruje się z głównym chatem
 */
export function FloatingVoiceButton() {
  const {
    state,
    isRecording,
    recordingDuration,
    startListening,
    stopListening,
    isVoiceActive,
    pendingMessage,
    navigateToChat,
    clearPendingMessage,
  } = useVoice();

  const pathname = usePathname();
  const [isHovering, setIsHovering] = useState(false);

  // Pokaż notyfikację gdy jest pending message i nie jesteśmy na /chat
  const showNotification = useMemo(
    () => Boolean(pendingMessage && pathname !== "/chat"),
    [pendingMessage, pathname]
  );

  // Ukryj na stronach auth
  if (pathname?.startsWith("/auth") || pathname === "/login") {
    return null;
  }

  const handleClick = async () => {
    if (state.isProcessing) return;

    if (isRecording || state.isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  };

  const handleNotificationClick = () => {
    navigateToChat();
    clearPendingMessage();
  };

  const getButtonState = () => {
    if (state.isProcessing) return "processing";
    if (state.isSpeaking) return "speaking";
    if (isRecording || state.isListening) return "recording";
    return "idle";
  };

  const buttonState = getButtonState();

  const stateColors = {
    idle: "bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700",
    recording: "bg-gradient-to-br from-red-500 to-rose-600 animate-pulse",
    processing: "bg-gradient-to-br from-amber-500 to-orange-600",
    speaking: "bg-gradient-to-br from-emerald-500 to-green-600",
  };

  const stateIcons = {
    idle: <Mic size={24} />,
    recording: <Square size={24} />,
    processing: (
      <div className="animate-spin">
        <Mic size={24} />
      </div>
    ),
    speaking: (
      <div className="animate-pulse">
        <MessageCircle size={24} />
      </div>
    ),
  };

  const tooltipText = {
    idle: `Porozmawiaj z ${state.assistantName}`,
    recording: "Kliknij aby zatrzymać",
    processing: "Przetwarzanie...",
    speaking: `${state.assistantName} mówi...`,
  };

  return (
    <>
      {/* Główny przycisk */}
      <div className="fixed bottom-6 left-6 z-50">
        <button
          onClick={handleClick}
          className={`
            w-14 h-14
            rounded-full
            ${stateColors[buttonState]}
            text-white
            shadow-lg shadow-violet-500/30
            transition-all
            duration-200
            flex
            items-center
            justify-center
            cursor-pointer
            hover:scale-110
            active:scale-95
            disabled:opacity-50
            disabled:cursor-not-allowed
          `}
          disabled={state.isProcessing}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          aria-label={tooltipText[buttonState]}
        >
          {stateIcons[buttonState]}
        </button>

        {/* Tooltip */}
        {isHovering && (
          <div className="absolute bottom-16 left-0 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
            {tooltipText[buttonState]}
            {(isRecording || state.isListening) && (
              <div className="text-xs text-gray-300 mt-1">
                {Math.floor(recordingDuration / 60)}:
                {(recordingDuration % 60).toString().padStart(2, "0")}
              </div>
            )}
          </div>
        )}

        {/* Wskaźnik aktywności głosowej */}
        {isVoiceActive && !isRecording && !state.isProcessing && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
        )}
      </div>

      {/* Notyfikacja o pending message */}
      {showNotification && pendingMessage && (
        <div
          className="fixed bottom-24 left-6 z-50 max-w-xs bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-2xl transition-shadow"
          onClick={handleNotificationClick}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <MessageCircle size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {state.assistantName} czeka na odpowiedź
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                &quot;{pendingMessage.transcription}&quot;
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-400 mt-2">
                Kliknij aby przejść do chatu →
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Błędy */}
      {state.error && (
        <div className="fixed bottom-24 left-6 z-50 bg-red-500 text-white text-sm px-4 py-2 rounded-lg shadow-lg max-w-xs">
          {state.error}
        </div>
      )}
    </>
  );
}
