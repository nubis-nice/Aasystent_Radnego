"use client";

import { Mic, Square, Play, Pause, Trash2 } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { AudioVisualizer } from "./AudioVisualizer";

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob) => void;
  maxDuration?: number;
}

export function VoiceRecorder({
  onRecordingComplete,
  maxDuration = 300,
}: VoiceRecorderProps) {
  const {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    isSupported,
  } = useVoiceRecorder();

  const handleStop = async () => {
    const audioBlob = await stopRecording();
    if (audioBlob && onRecordingComplete) {
      onRecordingComplete(audioBlob);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isSupported) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p className="text-red-700">
          Nagrywanie głosu nie jest wspierane w tej przeglądarce
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Nagrywanie głosowe
          </h3>
          <div className="text-sm text-gray-500">
            {formatTime(state.duration)} / {formatTime(maxDuration)}
          </div>
        </div>

        <AudioVisualizer
          audioLevel={state.audioLevel}
          isActive={state.isRecording && !state.isPaused}
          size="md"
        />

        {state.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          {!state.isRecording ? (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <Mic size={20} />
              Rozpocznij nagrywanie
            </button>
          ) : (
            <>
              <button
                onClick={handleStop}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <Square size={20} />
                Zatrzymaj
              </button>

              {state.isPaused ? (
                <button
                  onClick={resumeRecording}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  <Play size={20} />
                  Wznów
                </button>
              ) : (
                <button
                  onClick={pauseRecording}
                  className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  <Pause size={20} />
                  Pauza
                </button>
              )}

              <button
                onClick={cancelRecording}
                className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
              >
                <Trash2 size={20} />
                Anuluj
              </button>
            </>
          )}
        </div>

        {state.isRecording && state.duration >= maxDuration - 30 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700 text-center">
            Pozostało {maxDuration - state.duration} sekund
          </div>
        )}
      </div>
    </div>
  );
}
