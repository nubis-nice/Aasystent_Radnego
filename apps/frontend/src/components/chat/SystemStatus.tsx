"use client";

import { useState, useEffect, useRef } from "react";
import {
  Database,
  Search,
  Mic,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface DiagnosticStatus {
  status: "healthy" | "degraded" | "error";
  message: string;
}

interface RAGDiagnostic extends DiagnosticStatus {
  documentsCount: number;
  embeddingsCount: number;
  lastIndexed: string | null;
}

interface ResearchDiagnostic extends DiagnosticStatus {
  providers: {
    exa: boolean;
    tavily: boolean;
    serper: boolean;
  };
}

interface TranscriptionDiagnostic extends DiagnosticStatus {
  model: string;
}

interface EmbeddingDiagnostic extends DiagnosticStatus {
  model: string;
  dimensions: number;
}

interface ReasoningEngineDiagnostics {
  rag: RAGDiagnostic;
  research: ResearchDiagnostic;
  transcription: TranscriptionDiagnostic;
  embedding: EmbeddingDiagnostic;
}

interface ApiError {
  message: string;
  code?: string;
  details?: string;
  billingUrl?: string;
}

interface SystemStatusProps {
  apiError?: ApiError | null;
}

export function SystemStatus({ apiError }: SystemStatusProps = {}) {
  const [diagnostics, setDiagnostics] =
    useState<ReasoningEngineDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExpanded]);

  useEffect(() => {
    fetchDiagnostics();
    // Odświeżaj co 30 sekund
    const interval = setInterval(fetchDiagnostics, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDiagnostics = async () => {
    try {
      // Pobierz token autoryzacji z Supabase
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Brak sesji użytkownika");
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
        }/api/diagnostics/reasoning-engine`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch diagnostics");
      }

      const data = await response.json();
      setDiagnostics(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching diagnostics:", err);
      setError("Nie można pobrać statusu systemu");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: "healthy" | "degraded" | "error") => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getIndicatorColor = (status: "healthy" | "degraded" | "error") => {
    switch (status) {
      case "healthy":
        return "bg-green-500";
      case "degraded":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
    }
  };

  if (loading) {
    return (
      <button
        className="p-2 rounded-full bg-gray-200 animate-pulse"
        title="Sprawdzanie statusu..."
      >
        <div className="w-3 h-3 rounded-full bg-gray-400" />
      </button>
    );
  }

  if (error || !diagnostics) {
    return (
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-2 rounded-full bg-red-100 hover:bg-red-200 transition-colors"
        title="Błąd systemu"
      >
        <div className="w-3 h-3 rounded-full bg-red-500" />
      </button>
    );
  }

  // Błąd API (quota/invalid key) = krytyczny błąd systemu
  const hasApiError =
    apiError?.code === "QUOTA_EXCEEDED" || apiError?.code === "INVALID_API_KEY";

  const overallStatus = hasApiError
    ? "error"
    : diagnostics.rag.status === "error" ||
      diagnostics.research.status === "error" ||
      diagnostics.transcription.status === "error" ||
      diagnostics.embedding.status === "error"
    ? "error"
    : diagnostics.rag.status === "degraded" ||
      diagnostics.research.status === "degraded" ||
      diagnostics.transcription.status === "degraded" ||
      diagnostics.embedding.status === "degraded"
    ? "degraded"
    : "healthy";

  const statusTitle = {
    healthy: "System działa poprawnie",
    degraded: "System działa z ograniczeniami",
    error: hasApiError ? "Brak dostępu do API" : "Wykryto błędy",
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Kompaktowy wskaźnik - tylko kropka */}
      <button
        onClick={() => {
          setIsExpanded(!isExpanded);
        }}
        className={`p-2 rounded-full transition-colors ${
          overallStatus === "healthy"
            ? "bg-green-100 hover:bg-green-200"
            : overallStatus === "degraded"
            ? "bg-yellow-100 hover:bg-yellow-200"
            : "bg-red-100 hover:bg-red-200"
        }`}
        title={statusTitle[overallStatus]}
      >
        <div
          className={`w-3 h-3 rounded-full ${getIndicatorColor(overallStatus)}`}
        />
      </button>

      {/* Rozwinięty widok - dropdown w obrębie chatu */}
      {isExpanded && (
        <div
          className="absolute w-72 space-y-2 p-3 bg-white border border-gray-200 rounded-lg shadow-xl z-50"
          style={{ bottom: "110%", left: "110%" }}
        >
          {/* RAG Status */}
          <div className="flex items-start gap-2">
            <Database className="h-4 w-4 mt-0.5 text-gray-600" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {getStatusIcon(diagnostics.rag.status)}
                <span className="text-sm font-medium text-gray-900">RAG</span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {diagnostics.rag.message}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {diagnostics.rag.documentsCount} dokumentów,{" "}
                {diagnostics.rag.embeddingsCount} z embeddingami
              </p>
            </div>
          </div>

          {/* Research Status */}
          <div className="flex items-start gap-2">
            <Search className="h-4 w-4 mt-0.5 text-gray-600" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {getStatusIcon(diagnostics.research.status)}
                <span className="text-sm font-medium text-gray-900">
                  Research
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {diagnostics.research.message}
              </p>
              <div className="flex gap-2 mt-1">
                {diagnostics.research.providers.exa && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                    Exa
                  </span>
                )}
                {diagnostics.research.providers.tavily && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                    Tavily
                  </span>
                )}
                {diagnostics.research.providers.serper && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                    Serper
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Transcription Status */}
          <div className="flex items-start gap-2">
            <Mic className="h-4 w-4 mt-0.5 text-gray-600" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {getStatusIcon(diagnostics.transcription.status)}
                <span className="text-sm font-medium text-gray-900">
                  Transkrypcja
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {diagnostics.transcription.message}
              </p>
            </div>
          </div>

          {/* Embedding Status */}
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 mt-0.5 text-gray-600" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {getStatusIcon(diagnostics.embedding.status)}
                <span className="text-sm font-medium text-gray-900">
                  Embedding
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {diagnostics.embedding.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
