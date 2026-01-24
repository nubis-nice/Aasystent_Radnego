"use client";

import { useEffect, useState } from "react";
import { X, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { getTranscriptionJobDetailed } from "@/lib/api/youtube-sessions";

// ============================================================================
// TYPES
// ============================================================================

interface TranscriptionStepProgress {
  name: string;
  label: string;
  status: "pending" | "active" | "completed" | "failed";
  progress: number;
  startTime?: string;
  endTime?: string;
  duration?: number;
  details?: {
    fileSize?: string;
    downloadSpeed?: string;
    audioIssues?: string[];
    appliedFilters?: string[];
    model?: string;
    language?: string;
    processedDuration?: string;
    totalDuration?: string;
    speakersFound?: number;
    [key: string]: unknown;
  };
}

interface DetailedTranscriptionProgress {
  globalProgress: number;
  globalMessage: string;
  currentStep: string;
  steps: TranscriptionStepProgress[];
  estimatedTimeRemaining?: number;
  startedAt: string;
  lastUpdate: string;
}

interface TranscriptionJob {
  id: string;
  videoTitle: string;
  videoUrl: string;
  status: "waiting" | "active" | "completed" | "failed" | "delayed";
  progress: number;
  progressMessage: string;
  detailedProgress?: DetailedTranscriptionProgress;
  createdAt: string;
  completedAt?: string;
  error?: string;
  resultDocumentId?: string;
}

interface TranscriptionDetailModalProps {
  jobId: string;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TranscriptionDetailModal({
  jobId,
  onClose,
}: TranscriptionDetailModalProps) {
  const [job, setJob] = useState<TranscriptionJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch detailed job status
  const fetchJobDetails = async () => {
    try {
      const data = await getTranscriptionJobDetailed(jobId);
      setJob(data.job);
      setError(null);
    } catch (err) {
      console.error("Error fetching job details:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Błąd pobierania szczegółów zadania",
      );
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  // Real-time polling (every 2s) for active jobs
  useEffect(() => {
    if (!job || ["completed", "failed"].includes(job.status)) {
      return;
    }

    const interval = setInterval(() => {
      fetchJobDetails();
    }, 2000);

    return () => clearInterval(interval);
  }, [job?.status]);

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Format time
  const formatTime = (seconds?: number): string => {
    if (!seconds) return "N/A";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600)
      return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor(
      (seconds % 3600) / 60,
    )}m`;
  };

  // Format estimated time remaining
  const formatEstimatedTime = (seconds?: number): string => {
    if (!seconds) return "Obliczanie...";
    if (seconds < 60) return `~${Math.ceil(seconds)}s`;
    if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min`;
    return `~${Math.floor(seconds / 3600)}h ${Math.ceil(
      (seconds % 3600) / 60,
    )}min`;
  };

  // Get step icon
  const getStepIcon = (status: TranscriptionStepProgress["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "active":
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-slate-400" />;
    }
  };

  // Get step class
  const getStepClass = (status: TranscriptionStepProgress["status"]) => {
    switch (status) {
      case "completed":
        return "border-green-400 bg-green-50";
      case "active":
        return "border-blue-400 bg-blue-50 animate-pulse";
      case "failed":
        return "border-red-400 bg-red-50";
      default:
        return "border-slate-200 bg-slate-50";
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-red-600">Błąd</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <p className="text-slate-700">{error || "Nie znaleziono zadania"}</p>
        </div>
      </div>
    );
  }

  const detailedProgress = job.detailedProgress;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                🎬 {job.videoTitle}
              </h2>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <span>ID: {job.id.slice(0, 8)}...</span>
                {job.videoUrl && (
                  <a
                    href={job.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Otwórz nagranie →
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Global Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">
                Postęp ogólny
              </span>
              <span className="text-lg font-bold text-blue-600">
                {job.progress}%
              </span>
            </div>
            <div className="h-3 bg-white rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-slate-600">{job.progressMessage}</span>
              {detailedProgress?.estimatedTimeRemaining && (
                <span className="text-slate-500 font-medium">
                  {formatEstimatedTime(detailedProgress.estimatedTimeRemaining)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-16rem)]">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Pipeline transkrypcji
          </h3>

          <div className="space-y-3">
            {detailedProgress?.steps.map((step, index) => (
              <div
                key={step.name}
                className={`border-2 rounded-xl p-4 transition-all duration-300 ${getStepClass(
                  step.status,
                )}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStepIcon(step.status)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-slate-900">
                        {step.label}
                      </h4>
                      <span className="text-sm font-medium text-slate-600">
                        {step.progress}%
                      </span>
                    </div>

                    {/* Progress bar per step */}
                    {step.status !== "pending" && (
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full transition-all duration-500 ${
                            step.status === "completed"
                              ? "bg-green-500"
                              : step.status === "active"
                                ? "bg-blue-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                    )}

                    {/* Step details */}
                    <div className="space-y-1 text-sm text-slate-600">
                      {step.duration && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Czas: {formatTime(step.duration)}</span>
                        </div>
                      )}

                      {step.details?.fileSize && (
                        <div>📦 Rozmiar: {step.details.fileSize}</div>
                      )}

                      {step.details?.audioIssues &&
                        step.details.audioIssues.length > 0 && (
                          <div>
                            ⚠️ Problemy: {step.details.audioIssues.join(", ")}
                          </div>
                        )}

                      {step.details?.appliedFilters &&
                        step.details.appliedFilters.length > 0 && (
                          <div>
                            🎚️ Filtry: {step.details.appliedFilters.join(", ")}
                          </div>
                        )}

                      {step.details?.model && (
                        <div>🤖 Model: {step.details.model}</div>
                      )}

                      {step.details?.speakersFound !== undefined && (
                        <div>
                          👥 Znaleziono mówców: {step.details.speakersFound}
                        </div>
                      )}

                      {step.status === "pending" && (
                        <div className="text-slate-400 italic">Oczekuje...</div>
                      )}

                      {step.status === "active" && !step.duration && (
                        <div className="text-blue-600 font-medium">
                          W trakcie...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {job.completedAt ? (
                <span>
                  Zakończono:{" "}
                  {new Date(job.completedAt).toLocaleString("pl-PL")}
                </span>
              ) : (
                <span>
                  Rozpoczęto: {new Date(job.createdAt).toLocaleString("pl-PL")}
                </span>
              )}
              {job.status === "completed" && !job.resultDocumentId && (
                <span className="ml-2 text-amber-600">
                  (Transkrypcja nie została zapisana do RAG)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {job.status === "completed" && job.resultDocumentId && (
                <a
                  href={`/documents/youtube?viewDocument=${job.resultDocumentId}`}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                >
                  Podgląd transkrypcji
                </a>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors font-medium"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
