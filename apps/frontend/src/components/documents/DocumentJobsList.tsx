"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Loader2,
  Trash2,
  RefreshCw,
  Database,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface DocumentJob {
  id: string;
  job_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  result: {
    success: boolean;
    text?: string;
    metadata?: Record<string, unknown>;
    error?: string;
  } | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface DocumentJobsListProps {
  onViewResult?: (job: DocumentJob) => void;
  refreshTrigger?: number;
}

async function getAuthToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Brak autoryzacji");
  }
  return session.access_token;
}

export function DocumentJobsList({
  onViewResult,
  refreshTrigger,
}: DocumentJobsListProps) {
  const [jobs, setJobs] = useState<DocumentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingToRAG, setSavingToRAG] = useState<string | null>(null);
  const [ragTitle, setRagTitle] = useState<string>("");
  const [showRAGModal, setShowRAGModal] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch("/api/documents/jobs?limit=20", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Błąd pobierania zadań");
      }

      const data = await response.json();
      setJobs(data.jobs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs, refreshTrigger]);

  // Polling dla aktywnych zadań
  useEffect(() => {
    const hasActiveJobs = jobs.some(
      (job) => job.status === "pending" || job.status === "processing",
    );

    if (!hasActiveJobs) return;

    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  const handleDelete = async (jobId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to zadanie?")) return;

    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/documents/jobs/${jobId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Błąd usuwania");
      }

      setJobs((prev) => prev.filter((job) => job.job_id !== jobId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd");
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/documents/jobs/${jobId}/retry`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Nie można ponowić zadania");
      }

      fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd");
    }
  };

  const handleSaveToRAG = async (jobId: string) => {
    if (!ragTitle.trim()) {
      alert("Podaj tytuł dokumentu");
      return;
    }

    setSavingToRAG(jobId);
    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/documents/jobs/${jobId}/save-rag`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: ragTitle }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Błąd zapisu do RAG");
      }

      setShowRAGModal(null);
      setRagTitle("");
      alert("Zapisano do bazy wiedzy!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Błąd");
    } finally {
      setSavingToRAG(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Przed chwilą";
    if (diffMin < 60) return `${diffMin} min temu`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)} godz. temu`;
    return date.toLocaleDateString("pl-PL");
  };

  const getStatusIcon = (status: DocumentJob["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-slate-400" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusLabel = (status: DocumentJob["status"]) => {
    switch (status) {
      case "pending":
        return "Oczekuje";
      case "processing":
        return "Przetwarzanie...";
      case "completed":
        return "Zakończone";
      case "failed":
        return "Błąd";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 rounded-xl text-red-600">
        <AlertCircle className="h-5 w-5" />
        <span>{error}</span>
        <button
          onClick={fetchJobs}
          className="ml-auto text-sm underline hover:no-underline"
        >
          Ponów
        </button>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Brak zadań przetwarzania</p>
        <p className="text-sm mt-1">
          Prześlij plik aby rozpocząć przetwarzanie
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">
          📋 Twoje zadania ({jobs.length})
        </h3>
        <button
          onClick={fetchJobs}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          title="Odśwież listę"
        >
          <RefreshCw className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {jobs.map((job) => (
        <div
          key={job.id}
          className={`p-4 rounded-xl border transition-all ${
            job.status === "completed"
              ? "bg-green-50 border-green-200"
              : job.status === "failed"
                ? "bg-red-50 border-red-200"
                : job.status === "processing"
                  ? "bg-blue-50 border-blue-200"
                  : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{getStatusIcon(job.status)}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800 truncate">
                  {job.file_name}
                </span>
                <span className="text-xs text-slate-500">
                  {formatFileSize(job.file_size)}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                <span>{getStatusLabel(job.status)}</span>
                {job.status === "processing" && job.progress > 0 && (
                  <span className="text-blue-600 font-medium">
                    {job.progress}%
                  </span>
                )}
                <span>{formatTime(job.created_at)}</span>
              </div>

              {job.status === "processing" && (
                <div className="mt-2 w-full bg-blue-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              )}

              {job.status === "failed" && job.error && (
                <p className="mt-2 text-xs text-red-600">{job.error}</p>
              )}
            </div>

            <div className="flex items-center gap-1">
              {job.status === "completed" && (
                <>
                  <button
                    onClick={() => {
                      if (job.result?.text) {
                        onViewResult?.(job);
                      } else {
                        alert(
                          "Brak tekstu w wyniku - usuń zadanie i przetwórz ponownie",
                        );
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/50 transition-colors"
                    title="Podgląd wyniku"
                  >
                    <Eye className="h-4 w-4 text-slate-600" />
                  </button>
                  <button
                    onClick={() => {
                      if (job.result?.text) {
                        setShowRAGModal(job.job_id);
                        setRagTitle(job.file_name.replace(/\.[^/.]+$/, ""));
                      } else {
                        alert(
                          "Brak tekstu w wyniku - usuń zadanie i przetwórz ponownie",
                        );
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/50 transition-colors"
                    title="Zapisz do bazy wiedzy"
                  >
                    <Database className="h-4 w-4 text-violet-600" />
                  </button>
                </>
              )}

              {job.status === "failed" && (
                <button
                  onClick={() => handleRetry(job.job_id)}
                  className="p-1.5 rounded-lg hover:bg-white/50 transition-colors"
                  title="Ponów przetwarzanie"
                >
                  <RefreshCw className="h-4 w-4 text-orange-600" />
                </button>
              )}

              <button
                onClick={() => handleDelete(job.job_id)}
                className="p-1.5 rounded-lg hover:bg-red-100 transition-colors"
                title="Usuń zadanie"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Modal zapisu do RAG */}
      {showRAGModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              Zapisz do bazy wiedzy
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tytuł dokumentu
              </label>
              <input
                type="text"
                value={ragTitle}
                onChange={(e) => setRagTitle(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Wprowadź tytuł..."
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRAGModal(null);
                  setRagTitle("");
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={() => handleSaveToRAG(showRAGModal)}
                disabled={savingToRAG !== null}
                className="px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingToRAG ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Zapisywanie...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    Zapisz
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
