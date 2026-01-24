"use client";

import { useState } from "react";
import { DocumentJobsList } from "@/components/documents/DocumentJobsList";
import {
  ArrowLeft,
  Paperclip,
  Loader2,
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  Info,
  FileImage,
  FileAudio,
  File,
  Gauge,
  Clock,
  Layers,
} from "lucide-react";
import Link from "next/link";

interface ProcessingMetadata {
  fileName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  pageCount?: number;
  confidence?: number;
  language?: string;
  processingMethod?: "direct" | "ocr" | "stt" | "vision";
  sttModel?: string;
  ocrEngine?: string;
  processingTimeMs?: number;
  blankPagesSkipped?: number;
  normalizedImages?: number;
}

interface ProcessingResult {
  success: boolean;
  text?: string;
  transcription?: string;
  metadata?: ProcessingMetadata;
  error?: string;
}

export default function DocumentProcessPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>("");
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stan dla zapisu do RAG
  const [documentTitle, setDocumentTitle] = useState<string>("");
  const [documentType, setDocumentType] = useState<string>("uploaded");
  const [savingToRag, setSavingToRag] = useState(false);
  const [savedToRag, setSavedToRag] = useState(false);
  const [jobsRefreshTrigger, setJobsRefreshTrigger] = useState(0);
  const [useQueue, setUseQueue] = useState(true); // Użyj kolejki Redis

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const getFileTypeIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <FileImage className="h-5 w-5" />;
    if (mimeType.startsWith("audio/") || mimeType.startsWith("video/"))
      return <FileAudio className="h-5 w-5" />;
    if (mimeType === "application/pdf") return <FileText className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  const getProcessingMethodLabel = (method?: string) => {
    switch (method) {
      case "direct":
        return "Bezpośrednia ekstrakcja tekstu";
      case "ocr":
        return "OCR (Tesseract + Vision AI)";
      case "stt":
        return "Transkrypcja mowy (Whisper)";
      case "vision":
        return "Vision AI";
      default:
        return "Nieznana";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const handleProcess = async () => {
    if (!file) {
      setError("Wybierz plik do przetworzenia");
      return;
    }

    const startTime = Date.now();

    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setProcessingStage("Przygotowanie pliku...");

      const formData = new FormData();
      formData.append("file", file);

      // Pobierz token autoryzacji
      const { supabase } = await import("@/lib/supabase/client");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Brak autoryzacji - zaloguj się ponownie");
      }

      // Określ etap na podstawie typu pliku
      const isAudioVideo =
        file.type.startsWith("audio/") || file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      const isPDF = file.type === "application/pdf";

      if (isAudioVideo) {
        setProcessingStage(
          "🎙️ Transkrypcja audio/video (może potrwać kilka minut)...",
        );
      } else if (isImage) {
        setProcessingStage("🔍 Analiza obrazu i OCR...");
      } else if (isPDF) {
        setProcessingStage("📄 Przetwarzanie PDF (ekstrakcja tekstu / OCR)...");
      } else {
        setProcessingStage("📝 Ekstrakcja tekstu...");
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

      if (useQueue) {
        // Użyj kolejki Redis (asynchronicznie)
        setProcessingStage("📤 Dodawanie do kolejki przetwarzania...");
        const response = await fetch(`${apiUrl}/api/documents/jobs`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Błąd dodawania do kolejki");
        }

        setProcessingStage("");
        setFile(null);
        // Odśwież listę zadań
        setJobsRefreshTrigger((prev) => prev + 1);
      } else {
        // Bezpośrednie przetwarzanie (synchronicznie)
        const response = await fetch(`${apiUrl}/api/documents/process`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        const data = await response.json();
        const processingTimeMs = Date.now() - startTime;

        if (!response.ok) {
          throw new Error(data.error || "Błąd przetwarzania pliku");
        }

        setResult({
          success: true,
          text: data.text,
          transcription: data.transcription,
          metadata: {
            ...data.metadata,
            processingTimeMs,
          },
        });
        setProcessingStage("");
        setDocumentTitle(file.name.replace(/\.[^/.]+$/, ""));
        setSavedToRag(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd przetwarzania");
      setProcessingStage("");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToRag = async () => {
    if (!result?.success || (!result.text && !result.transcription)) {
      setError("Brak tekstu do zapisania");
      return;
    }

    if (!documentTitle.trim()) {
      setError("Podaj tytuł dokumentu");
      return;
    }

    try {
      setSavingToRag(true);
      setError(null);

      const { supabase } = await import("@/lib/supabase/client");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Brak autoryzacji - zaloguj się ponownie");
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const response = await fetch(`${apiUrl}/api/documents/save-to-rag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          text: result.text || result.transcription,
          title: documentTitle.trim(),
          sourceFileName: result.metadata?.fileName || file?.name || "unknown",
          documentType: documentType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Błąd zapisu do RAG");
      }

      setSavedToRag(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu do RAG");
    } finally {
      setSavingToRag(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/documents"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Powrót do dokumentów</span>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
              <Paperclip className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                OCR / Transkrypcja
              </h1>
              <p className="text-slate-600">
                Przetwórz dokumenty (OCR) lub pliki audio/video (transkrypcja)
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Wybierz plik
              </label>
              <div className="relative">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png,.mp3,.mp4,.wav,.m4a"
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="flex items-center justify-center gap-3 w-full px-6 py-8 rounded-xl border-2 border-dashed border-slate-300 hover:border-primary-400 hover:bg-primary-50 transition-all cursor-pointer"
                >
                  <Upload className="h-8 w-8 text-slate-400" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      {file ? file.name : "Kliknij aby wybrać plik"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      PDF, obrazy (OCR) lub audio/video (transkrypcja)
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Tryb przetwarzania */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="use-queue"
                checked={useQueue}
                onChange={(e) => setUseQueue(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <label htmlFor="use-queue" className="text-sm text-slate-600">
                Użyj kolejki (zalecane dla dużych plików - nie zgubi się przy
                zamknięciu przeglądarki)
              </label>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleProcess}
              disabled={loading || !file}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4 text-white font-semibold shadow-lg hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Przetwarzam...</span>
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  <span>Przetwórz plik</span>
                </>
              )}
            </button>

            {/* Processing Stage */}
            {loading && processingStage && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
                <span>{processingStage}</span>
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="mt-8 space-y-6">
              {/* Success/Error Header */}
              <div className="flex items-center gap-3">
                {result.success ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-500" />
                )}
                <h3 className="text-lg font-bold text-slate-800">
                  {result.success
                    ? "Przetwarzanie zakończone"
                    : "Błąd przetwarzania"}
                </h3>
              </div>

              {/* Metadata Panel */}
              {result.metadata && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* File Info */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      {getFileTypeIcon(result.metadata.mimeType)}
                      <span>Typ pliku</span>
                    </div>
                    <p className="font-semibold text-slate-800">
                      {result.metadata.fileType.toUpperCase()}
                    </p>
                  </div>

                  {/* Processing Method */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <Layers className="h-4 w-4" />
                      <span>Metoda</span>
                    </div>
                    <p className="font-semibold text-slate-800 text-sm">
                      {getProcessingMethodLabel(
                        result.metadata.processingMethod,
                      )}
                    </p>
                  </div>

                  {/* Confidence */}
                  {result.metadata.confidence !== undefined && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                        <Gauge className="h-4 w-4" />
                        <span>Pewność OCR</span>
                      </div>
                      <p className="font-semibold text-slate-800">
                        {(result.metadata.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  )}

                  {/* Processing Time */}
                  {result.metadata.processingTimeMs && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                        <Clock className="h-4 w-4" />
                        <span>Czas</span>
                      </div>
                      <p className="font-semibold text-slate-800">
                        {(result.metadata.processingTimeMs / 1000).toFixed(1)}s
                      </p>
                    </div>
                  )}

                  {/* Page Count */}
                  {result.metadata.pageCount && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                        <FileText className="h-4 w-4" />
                        <span>Strony</span>
                      </div>
                      <p className="font-semibold text-slate-800">
                        {result.metadata.pageCount}
                      </p>
                    </div>
                  )}

                  {/* File Size */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <Info className="h-4 w-4" />
                      <span>Rozmiar</span>
                    </div>
                    <p className="font-semibold text-slate-800">
                      {formatFileSize(result.metadata.fileSize)}
                    </p>
                  </div>

                  {/* Blank Pages Skipped */}
                  {result.metadata.blankPagesSkipped !== undefined &&
                    result.metadata.blankPagesSkipped > 0 && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="flex items-center gap-2 text-amber-600 text-sm mb-1">
                          <AlertCircle className="h-4 w-4" />
                          <span>Puste strony</span>
                        </div>
                        <p className="font-semibold text-amber-800">
                          {result.metadata.blankPagesSkipped} pominięte
                        </p>
                      </div>
                    )}
                </div>
              )}

              {/* Extracted Text */}
              {(result.text || result.transcription) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-700">
                      {result.transcription
                        ? "Transkrypcja"
                        : "Wyodrębniony tekst"}
                    </h4>
                    <span className="text-sm text-slate-500">
                      {(result.text || result.transcription || "").length}{" "}
                      znaków
                    </span>
                  </div>
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 max-h-96 overflow-y-auto">
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed font-mono text-sm">
                      {result.text || result.transcription}
                    </p>
                  </div>
                </div>
              )}

              {/* Save to RAG Section */}
              {result.success && (result.text || result.transcription) && (
                <div className="p-6 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200">
                  <h4 className="font-semibold text-primary-800 mb-4 flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    Zapisz do bazy wiedzy (RAG)
                  </h4>

                  {savedToRag ? (
                    <div className="flex items-center gap-3 text-green-700 bg-green-50 p-4 rounded-xl border border-green-200">
                      <CheckCircle className="h-6 w-6" />
                      <span className="font-semibold">
                        Dokument zapisany do bazy wiedzy!
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-primary-700 mb-2">
                          Tytuł dokumentu *
                        </label>
                        <input
                          type="text"
                          value={documentTitle}
                          onChange={(e) => setDocumentTitle(e.target.value)}
                          placeholder="Np. Protokół z sesji nr 14"
                          className="w-full px-4 py-3 rounded-xl border border-primary-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-primary-700 mb-2">
                          Typ dokumentu
                        </label>
                        <select
                          value={documentType}
                          onChange={(e) => setDocumentType(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-primary-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all bg-white"
                        >
                          <option value="uploaded">Przesłany dokument</option>
                          <option value="protocol">Protokół</option>
                          <option value="resolution">Uchwała</option>
                          <option value="report">Raport</option>
                          <option value="transcript">Transkrypcja</option>
                          <option value="other">Inny</option>
                        </select>
                      </div>

                      <button
                        onClick={handleSaveToRag}
                        disabled={savingToRag || !documentTitle.trim()}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4 text-white font-semibold shadow-lg hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingToRag ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Zapisywanie...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-5 w-5" />
                            <span>Zapisz do bazy wiedzy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {result.error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
                  {result.error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lista zadań w kolejce */}
        <div className="mt-8 bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
          <DocumentJobsList
            refreshTrigger={jobsRefreshTrigger}
            onViewResult={(job) => {
              if (job.result?.text) {
                setResult({
                  success: true,
                  text: job.result.text,
                  metadata: job.result
                    .metadata as unknown as ProcessingMetadata,
                });
                setDocumentTitle(job.file_name.replace(/\.[^/.]+$/, ""));
                setSavedToRag(false);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
