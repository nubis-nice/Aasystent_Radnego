"use client";

import { Mic, MicOff, Square } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useVoiceCommands } from "@/hooks/useVoiceCommands";
import { useState, useEffect } from "react";

interface VoiceButtonProps {
  onTranscription?: (text: string) => void;
  onCommand?: (command: unknown) => void;
  size?: "sm" | "md" | "lg";
  variant?: "floating" | "inline";
}

export function VoiceButton({
  onTranscription,
  onCommand,
  size = "md",
  variant = "floating",
}: VoiceButtonProps) {
  const {
    state: recorderState,
    startRecording,
    stopRecording,
    isSupported,
  } = useVoiceRecorder();

  const {
    state: commandState,
    processAudio,
    executeCommand,
  } = useVoiceCommands();

  const [isHovering, setIsHovering] = useState(false);

  const buttonSizes = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-20 h-20",
  };

  const iconSizes = {
    sm: 20,
    md: 28,
    lg: 36,
  };

  const handleClick = async () => {
    if (recorderState.isRecording) {
      const audioBlob = await stopRecording();
      if (audioBlob) {
        const command = await processAudio(audioBlob);
        if (command) {
          if (onTranscription) {
            onTranscription(command.transcription);
          }
          if (onCommand) {
            onCommand(command);
          }
          await executeCommand(command);
        }
      }
    } else {
      await startRecording();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && variant === "floating") {
        e.preventDefault();
        if (!recorderState.isRecording) {
          startRecording();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && variant === "floating") {
        e.preventDefault();
        if (recorderState.isRecording) {
          stopRecording().then((audioBlob) => {
            if (audioBlob) {
              processAudio(audioBlob).then((command) => {
                if (command) {
                  if (onTranscription) {
                    onTranscription(command.transcription);
                  }
                  if (onCommand) {
                    onCommand(command);
                  }
                  executeCommand(command);
                }
              });
            }
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    recorderState.isRecording,
    variant,
    startRecording,
    stopRecording,
    processAudio,
    executeCommand,
    onTranscription,
    onCommand,
  ]);

  if (!isSupported) {
    return null;
  }

  const getButtonState = () => {
    if (commandState.isProcessing) return "processing";
    if (recorderState.isRecording) return "recording";
    return "idle";
  };

  const buttonState = getButtonState();

  const stateColors = {
    idle: "bg-blue-500 hover:bg-blue-600",
    recording: "bg-red-500 hover:bg-red-600 animate-pulse",
    processing: "bg-yellow-500 hover:bg-yellow-600",
  };

  const stateIcons = {
    idle: <Mic size={iconSizes[size]} />,
    recording: <Square size={iconSizes[size]} />,
    processing: (
      <div className="animate-spin">
        <Mic size={iconSizes[size]} />
      </div>
    ),
  };

  const tooltipText = {
    idle: "Kliknij i mów (lub przytrzymaj Space)",
    recording: "Kliknij aby zatrzymać",
    processing: "Przetwarzanie...",
  };

  const baseClasses = `
    ${buttonSizes[size]}
    rounded-full
    ${stateColors[buttonState]}
    text-white
    shadow-lg
    transition-all
    duration-200
    flex
    items-center
    justify-center
    cursor-pointer
    border-4
    border-white
    hover:scale-110
    active:scale-95
    disabled:opacity-50
    disabled:cursor-not-allowed
  `;

  const floatingClasses =
    variant === "floating"
      ? "fixed bottom-6 left-6 z-50"
      : "relative inline-flex";

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={`${baseClasses} ${floatingClasses}`}
        disabled={commandState.isProcessing}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        aria-label={tooltipText[buttonState]}
      >
        {stateIcons[buttonState]}
      </button>

      {isHovering && variant === "floating" && (
        <div className="fixed bottom-24 left-6 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg z-50 whitespace-nowrap">
          {tooltipText[buttonState]}
          {recorderState.isRecording && (
            <div className="text-xs text-gray-300 mt-1">
              {Math.floor(recorderState.duration / 60)}:
              {(recorderState.duration % 60).toString().padStart(2, "0")}
            </div>
          )}
        </div>
      )}

      {recorderState.error && variant === "floating" && (
        <div className="fixed bottom-24 left-6 bg-red-500 text-white text-sm px-3 py-2 rounded-lg shadow-lg z-50 max-w-xs">
          {recorderState.error}
        </div>
      )}

      {commandState.error && variant === "floating" && (
        <div className="fixed bottom-24 left-6 bg-orange-500 text-white text-sm px-3 py-2 rounded-lg shadow-lg z-50 max-w-xs">
          {commandState.error}
        </div>
      )}

      {!isSupported && variant === "floating" && (
        <div className="fixed bottom-6 left-6 bg-gray-700 text-white p-4 rounded-lg shadow-lg z-50">
          <MicOff className="inline mr-2" size={20} />
          Nagrywanie głosu nie jest wspierane
        </div>
      )}
    </div>
  );
}
