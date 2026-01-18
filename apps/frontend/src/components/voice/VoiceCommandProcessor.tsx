"use client";

import { useState, useCallback } from "react";
import { VoiceButton } from "./VoiceButton";
import { VoiceCommand } from "@/hooks/useVoiceCommands";
import { MessageCircle, Navigation, Search, Settings } from "lucide-react";

interface VoiceCommandProcessorProps {
  onNavigate?: (path: string) => void;
  onSearch?: (query: string) => void;
  onChatMessage?: (message: string) => void;
  variant?: "floating" | "inline";
}

export function VoiceCommandProcessor({
  onNavigate,
  onSearch,
  onChatMessage,
  variant = "floating",
}: VoiceCommandProcessorProps) {
  const [lastTranscription, setLastTranscription] = useState<string>("");
  const [commandHistory, setCommandHistory] = useState<VoiceCommand[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleTranscription = useCallback((text: string) => {
    setLastTranscription(text);
  }, []);

  const handleCommand = useCallback(
    (command: unknown) => {
      const voiceCommand = command as VoiceCommand;
      setCommandHistory((prev) => [...prev, voiceCommand].slice(-10));

      switch (voiceCommand.action.type) {
        case "navigate":
          if (onNavigate && "path" in voiceCommand.action) {
            onNavigate(voiceCommand.action.path as string);
          }
          break;
        case "search":
          if (onSearch && "query" in voiceCommand.action) {
            onSearch(voiceCommand.action.query as string);
          }
          break;
        case "chat":
          if (onChatMessage && "message" in voiceCommand.action) {
            onChatMessage(voiceCommand.action.message as string);
          }
          break;
      }
    },
    [onNavigate, onSearch, onChatMessage]
  );

  const getIntentIcon = (intent: string) => {
    switch (intent) {
      case "navigation":
        return <Navigation size={16} className="text-blue-500" />;
      case "search":
        return <Search size={16} className="text-green-500" />;
      case "chat":
        return <MessageCircle size={16} className="text-purple-500" />;
      case "control":
        return <Settings size={16} className="text-orange-500" />;
      default:
        return null;
    }
  };

  const getIntentLabel = (intent: string) => {
    const labels = {
      navigation: "Nawigacja",
      search: "Wyszukiwanie",
      chat: "Czat",
      control: "Kontrola",
      unknown: "Nieznane",
    };
    return labels[intent as keyof typeof labels] || "Nieznane";
  };

  return (
    <div className="relative">
      <VoiceButton
        onTranscription={handleTranscription}
        onCommand={handleCommand}
        variant={variant}
      />

      {lastTranscription && variant === "inline" && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-900 mb-1">
            Transkrypcja:
          </p>
          <p className="text-blue-700">{lastTranscription}</p>
        </div>
      )}

      {variant === "floating" && commandHistory.length > 0 && (
        <div className="fixed bottom-24 left-6 z-40">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-lg hover:bg-gray-50 transition-colors"
          >
            Historia komend ({commandHistory.length})
          </button>

          {showHistory && (
            <div className="mt-2 bg-white border border-gray-300 rounded-lg shadow-xl overflow-hidden max-w-md">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">
                  Ostatnie komendy
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {commandHistory
                  .slice()
                  .reverse()
                  .map((cmd, idx) => (
                    <div
                      key={idx}
                      className="px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                    >
                      <div className="flex items-start gap-2 mb-1">
                        {getIntentIcon(cmd.intent)}
                        <span className="text-xs font-medium text-gray-500">
                          {getIntentLabel(cmd.intent)}
                        </span>
                        <span className="text-xs text-gray-400 ml-auto">
                          {cmd.confidence.toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-900">
                        {cmd.transcription}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
