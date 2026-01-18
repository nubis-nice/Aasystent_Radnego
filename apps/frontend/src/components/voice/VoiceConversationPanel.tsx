"use client";

import { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MessageSquare,
  X,
  Loader2,
  User,
  Bot,
} from "lucide-react";
import { useVoiceConversation } from "@/hooks/useVoiceConversation";
import { useAISettings } from "@/hooks/useAISettings";

interface VoiceConversationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  assistantName?: string; // Opcjonalne - jeśli nie podane, pobiera z ustawień AI
}

export function VoiceConversationPanel({
  isOpen,
  onClose,
  assistantName: propAssistantName,
}: VoiceConversationPanelProps) {
  const [autoTTS, setAutoTTS] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoStartedRef = useRef(false);

  // Pobierz imię asystenta z ustawień AI
  const { settings: aiSettings } = useAISettings();

  // Użyj imienia z props lub z ustawień AI
  const assistantName =
    propAssistantName || aiSettings.assistantName || "Asystent";

  const {
    state,
    startListening,
    stopListening,
    stopSpeaking,
    clearMessages,
    isRecording,
    recordingDuration,
  } = useVoiceConversation({
    assistantName,
    autoTTS,
    autoStart: true,
    useVAD: true,
    vadSilenceDuration: 1500,
    onWakeWord: () => {
      console.log(`[VoicePanel] Wake word "${assistantName}" detected!`);
    },
  });

  // Reset gdy panel się zamknie
  useEffect(() => {
    if (!isOpen) {
      autoStartedRef.current = false;
    }
  }, [isOpen]);

  // Auto-scroll do najnowszej wiadomości
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // Formatuj czas trwania nagrywania
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-secondary-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">{assistantName}</h2>
              <p className="text-white/80 text-sm">
                {state.isSpeaking
                  ? "Mówię..."
                  : state.isListening
                  ? "Słucham..."
                  : state.isProcessing
                  ? "Przetwarzam..."
                  : "Gotowy do rozmowy"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoTTS(!autoTTS)}
              className={`p-2 rounded-full transition-colors ${
                autoTTS ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
              }`}
              title={
                autoTTS
                  ? "Wyłącz odpowiedzi głosowe"
                  : "Włącz odpowiedzi głosowe"
              }
            >
              {autoTTS ? (
                <Volume2 className="w-5 h-5" />
              ) : (
                <VolumeX className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-secondary-900">
          {state.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
              <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
              <p className="font-medium">Rozpocznij rozmowę</p>
              <p className="text-sm mt-1">
                Powiedz &quot;Hej {assistantName}&quot; lub kliknij mikrofon
              </p>
            </div>
          ) : (
            state.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-violet-500 text-white"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white rounded-tr-sm"
                      : "bg-white dark:bg-secondary-800 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      msg.role === "user"
                        ? "text-blue-100"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {msg.timestamp.toLocaleTimeString("pl-PL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Status bar */}
        {(state.isMicBlocked || state.error) && (
          <div
            className={`px-4 py-2 text-sm flex items-center gap-2 ${
              state.error
                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
            }`}
          >
            {state.error ? (
              <>
                <X className="w-4 h-4" />
                {state.error}
              </>
            ) : (
              <>
                <MicOff className="w-4 h-4" />
                Mikrofon zablokowany podczas odpowiedzi asystenta
              </>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-secondary-800">
          <div className="flex items-center justify-center gap-4">
            {/* Stop speaking button */}
            {state.isSpeaking && (
              <button
                onClick={stopSpeaking}
                className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                title="Zatrzymaj mówienie"
              >
                <VolumeX className="w-6 h-6" />
              </button>
            )}

            {/* Main mic button - wymaga gestu użytkownika dla AudioContext */}
            <button
              onClick={() => (isRecording ? stopListening() : startListening())}
              disabled={state.isMicBlocked || state.isProcessing}
              className={`p-6 rounded-full transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                isRecording
                  ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50"
                  : state.isProcessing
                  ? "bg-yellow-500 text-white"
                  : "bg-violet-500 text-white hover:bg-violet-600 shadow-lg shadow-violet-500/30"
              }`}
            >
              {state.isProcessing ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-8 h-8" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>

            {/* Clear history button */}
            {state.messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Wyczyść historię"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Recording indicator */}
          {isRecording && (
            <div className="mt-3 text-center">
              <span className="text-red-500 font-medium">
                ● Nagrywanie {formatDuration(recordingDuration)}
              </span>
            </div>
          )}

          {/* Hint */}
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-3">
            {isRecording
              ? "Kliknij mikrofon aby zakończyć"
              : `Powiedz "Hej ${assistantName}" aby rozpocząć`}
          </p>
        </div>
      </div>
    </div>
  );
}
