"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Download,
  Clock,
  Search,
  SortDesc,
  ChevronLeft,
  ChevronRight,
  Database,
  CheckCircle,
  XCircle,
  Mic,
  FileImage,
  File,
  Trash2,
  BarChart3,
  RefreshCw,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  getProcessedDocuments,
  getProcessingJobs,
  addDocumentToRag,
  analyzeSentiment,
  deleteProcessedDocument,
  type ProcessedDocument,
  type ProcessingJob,
} from "@/lib/api/document-processing";
import { useDataCounts } from "@/lib/hooks/useDataCounts";

export default function DocumentHistoryPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] =
    useState<ProcessedDocument | null>(null);

  // Zadania asynchroniczne
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [showJobsPanel, setShowJobsPanel] = useState(false);

  // Liczniki w czasie rzeczywistym
  const { counts, refresh: refreshCounts } = useDataCounts({
    refreshInterval: 10000,
  });

  // Paginacja i filtrowanie
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [filterType, setFilterType] = useState<"all" | "ocr" | "transcription">(
    "all"
  );
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    loadDocuments();
    loadJobs();
  }, []);

  // Polling dla aktywnych zadań
  useEffect(() => {
    const activeJobs = jobs.filter(
      (j) => !["completed", "failed"].includes(j.status)
    );
    if (activeJobs.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const result = await getProcessingJobs();
        setJobs(result.jobs);
        // Odśwież dokumenty gdy zadanie się zakończy
        const completedNow = result.jobs.filter(
          (j) => j.status === "completed"
        );
        if (completedNow.length > 0) {
          loadDocuments();
        }
      } catch (e) {
        console.error("Error polling jobs:", e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobs]);

  const loadJobs = async () => {
    try {
      const result = await getProcessingJobs();
      setJobs(result.jobs);
      if (
        result.jobs.some((j) => !["completed", "failed"].includes(j.status))
      ) {
        setShowJobsPanel(true);
      }
    } catch (e) {
      console.error("Error loading jobs:", e);
    }
  };

  const loadDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getProcessedDocuments();
      setDocuments(result.documents || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Błąd ładowania dokumentów"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToRag = async (doc: ProcessedDocument) => {
    try {
      await addDocumentToRag(doc.id);
      await loadDocuments();
      alert("✅ Dokument dodany do bazy wiedzy RAG");
    } catch (err) {
      alert(
        "❌ Błąd: " + (err instanceof Error ? err.message : "Nieznany błąd")
      );
    }
  };

  const handleAnalyzeSentiment = async (doc: ProcessedDocument) => {
    try {
      const result = await analyzeSentiment(doc.id);
      await loadDocuments();
      alert(
        `✅ Analiza sentymentu zakończona\n\nWynik: ${
          result.sentiment.overall
        } (${(result.sentiment.score * 100).toFixed(0)}%)`
      );
    } catch (err) {
      alert(
        "❌ Błąd: " + (err instanceof Error ? err.message : "Nieznany błąd")
      );
    }
  };

  const handleDelete = async (doc: ProcessedDocument) => {
    if (!confirm(`Czy na pewno chcesz usunąć "${doc.title}"?`)) return;

    try {
      await deleteProcessedDocument(doc.id);
      await loadDocuments();
      if (selectedDocument?.id === doc.id) {
        setSelectedDocument(null);
      }
    } catch (err) {
      alert(
        "❌ Błąd: " + (err instanceof Error ? err.message : "Nieznany błąd")
      );
    }
  };

  const handleExportMarkdown = (doc: ProcessedDocument) => {
    const content = doc.formattedContent || doc.content;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filtrowanie i sortowanie
  const filteredDocuments = documents
    .filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        filterType === "all" ||
        (filterType === "ocr" && doc.documentType === "ocr") ||
        (filterType === "transcription" &&
          doc.documentType === "transcription");
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

  const totalPages = Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE);
  const paginatedDocuments = filteredDocuments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case "transcription":
        return <Mic className="h-5 w-5 text-purple-500" />;
      case "ocr":
        return <FileImage className="h-5 w-5 text-blue-500" />;
      default:
        return <File className="h-5 w-5 text-slate-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Oczekuje",
      preprocessing: "Preprocessing",
      processing: "Przetwarzanie",
      analyzing: "Analiza",
      saving: "Zapisywanie",
      completed: "Zakończone",
      failed: "Błąd",
    };
    return labels[status] || status;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl ml-0">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/documents"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Powrót do dokumentów</span>
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800">
                  Historia Dokumentów
                </h1>
                <p className="text-slate-600">
                  Przetwórzone dokumenty OCR i transkrypcje audio
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  loadDocuments();
                  refreshCounts();
                }}
                className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
                title="Odśwież"
              >
                <RefreshCw className="h-5 w-5 text-slate-600" />
              </button>
              <button
                onClick={() => setShowJobsPanel(!showJobsPanel)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  showJobsPanel
                    ? "bg-primary-100 text-primary-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Zadania ({counts.activeJobs})
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 mb-6">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Szukaj dokumentów..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none"
                    />
                  </div>
                </div>
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(
                      e.target.value as "all" | "ocr" | "transcription"
                    );
                    setCurrentPage(1);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 focus:border-primary-400 outline-none"
                >
                  <option value="all">Wszystkie typy</option>
                  <option value="ocr">OCR (dokumenty)</option>
                  <option value="transcription">Transkrypcje</option>
                </select>
                <button
                  onClick={() =>
                    setSortOrder(sortOrder === "newest" ? "oldest" : "newest")
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  <SortDesc className="h-4 w-4" />
                  <span>
                    {sortOrder === "newest" ? "Najnowsze" : "Najstarsze"}
                  </span>
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 mb-6">
                {error}
              </div>
            )}

            {/* Documents List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              </div>
            ) : paginatedDocuments.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                {searchQuery || filterType !== "all"
                  ? "Brak dokumentów spełniających kryteria"
                  : "Brak przetworzonych dokumentów"}
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className={`bg-white rounded-xl border p-4 transition-all cursor-pointer ${
                      selectedDocument?.id === doc.id
                        ? "border-primary-400 shadow-lg"
                        : "border-slate-200 hover:border-slate-300 hover:shadow"
                    }`}
                    onClick={() => setSelectedDocument(doc)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-slate-100">
                        {getDocumentIcon(doc.documentType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-800 truncate">
                            {doc.title}
                          </h3>
                          {doc.savedToRag && (
                            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                              RAG
                            </span>
                          )}
                          {doc.metadata?.sentiment && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                doc.metadata.sentiment.overall === "positive"
                                  ? "bg-green-100 text-green-700"
                                  : doc.metadata.sentiment.overall ===
                                    "negative"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {doc.metadata.sentiment.overall}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 line-clamp-2 mb-2">
                          {doc.content.substring(0, 200)}...
                        </p>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(doc.createdAt).toLocaleDateString(
                              "pl-PL",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                          <span>{doc.sourceFileName}</span>
                          <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportMarkdown(doc);
                          }}
                          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Eksportuj MD"
                        >
                          <Download className="h-4 w-4 text-slate-500" />
                        </button>
                        {!doc.savedToRag && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToRag(doc);
                            }}
                            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Dodaj do RAG"
                          >
                            <Database className="h-4 w-4 text-slate-500" />
                          </button>
                        )}
                        {doc.documentType === "transcription" &&
                          !doc.metadata?.sentiment && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAnalyzeSentiment(doc);
                              }}
                              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                              title="Analiza sentymentu"
                            >
                              <BarChart3 className="h-4 w-4 text-slate-500" />
                            </button>
                          )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(doc);
                          }}
                          className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Usuń"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="px-4 py-2 text-sm text-slate-600">
                  Strona {currentPage} z {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Jobs Panel */}
          {showJobsPanel && (
            <div className="w-[280px] bg-white rounded-2xl shadow-xl border border-slate-200 p-4 sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">Zadania</h2>
                <button
                  onClick={() => setShowJobsPanel(false)}
                  className="p-1 rounded-lg hover:bg-slate-100"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              {jobs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  Brak aktywnych zadań
                </p>
              ) : (
                <div className="space-y-3">
                  {jobs.slice(0, 10).map((job) => (
                    <div
                      key={job.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(job.status)}
                        <span
                          className="text-xs font-medium text-slate-700 truncate flex-1"
                          title={job.fileName}
                        >
                          {job.fileName.length > 25
                            ? job.fileName.slice(0, 22) + "..."
                            : job.fileName}
                        </span>
                      </div>
                      <div
                        className="text-xs text-slate-500 mb-2 truncate"
                        title={job.progressMessage}
                      >
                        {getStatusLabel(job.status)}
                        {job.progressMessage && ` - ${job.progressMessage}`}
                      </div>
                      {!["completed", "failed"].includes(job.status) && (
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                          <div
                            className="bg-primary-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      )}
                      {job.error && (
                        <div className="text-xs text-red-600 mt-2">
                          {job.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Document Preview Modal */}
      {selectedDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedDocument(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getDocumentIcon(selectedDocument.documentType)}
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      {selectedDocument.title}
                    </h2>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-medium">
                        {selectedDocument.documentType === "transcription"
                          ? "🎵 Transkrypcja audio"
                          : "📄 OCR"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(
                          selectedDocument.createdAt
                        ).toLocaleDateString("pl-PL", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {selectedDocument.savedToRag && (
                        <span className="flex items-center gap-1 text-green-600 font-medium">
                          <CheckCircle className="h-3.5 w-3.5" /> W bazie RAG
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                {/* Metadata Sidebar */}
                <div className="lg:col-span-1 bg-slate-50 p-4 border-r border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">
                    Metadane
                  </h3>

                  {/* File Info */}
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-slate-500 text-xs">
                        Plik źródłowy
                      </span>
                      <p
                        className="font-medium text-slate-700 truncate"
                        title={selectedDocument.sourceFileName}
                      >
                        {selectedDocument.sourceFileName}
                      </p>
                    </div>

                    {/* Sentiment */}
                    {selectedDocument.metadata?.sentiment && (
                      <div>
                        <span className="text-slate-500 text-xs">
                          Sentyment
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-2 py-1 rounded-lg text-sm font-medium ${
                              selectedDocument.metadata.sentiment.overall ===
                              "positive"
                                ? "bg-green-100 text-green-700"
                                : selectedDocument.metadata.sentiment
                                    .overall === "negative"
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {selectedDocument.metadata.sentiment.overall ===
                            "positive"
                              ? "😊 Pozytywny"
                              : selectedDocument.metadata.sentiment.overall ===
                                "negative"
                              ? "😟 Negatywny"
                              : "😐 Neutralny"}
                          </span>
                          <span className="text-slate-500">
                            {(
                              selectedDocument.metadata.sentiment.score * 100
                            ).toFixed(0)}
                            %
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Duration */}
                    {typeof selectedDocument.metadata?.duration ===
                      "number" && (
                      <div>
                        <span className="text-slate-500 text-xs">
                          Czas trwania
                        </span>
                        <p className="font-medium text-slate-700">
                          {Math.floor(selectedDocument.metadata.duration / 60)}:
                          {String(
                            Math.floor(selectedDocument.metadata.duration % 60)
                          ).padStart(2, "0")}
                        </p>
                      </div>
                    )}

                    {/* Speakers */}
                    {selectedDocument.metadata?.speakers &&
                      selectedDocument.metadata.speakers.length > 0 && (
                        <div>
                          <span className="text-slate-500 text-xs">
                            Mówcy ({selectedDocument.metadata.speakers.length})
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedDocument.metadata.speakers.map(
                              (speaker, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs"
                                >
                                  {speaker}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Topics */}
                    {selectedDocument.metadata?.topics &&
                      selectedDocument.metadata.topics.length > 0 && (
                        <div>
                          <span className="text-slate-500 text-xs">Tematy</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedDocument.metadata.topics.map(
                              (topic, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs"
                                >
                                  {topic}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                {/* Content */}
                <div className="lg:col-span-2 p-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">
                    Treść dokumentu
                  </h3>
                  <div className="bg-slate-50 rounded-xl p-4 max-h-[50vh] overflow-y-auto">
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {selectedDocument.formattedContent ||
                        selectedDocument.content ||
                        "Brak treści"}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => {
                  selectedDocument && handleDelete(selectedDocument);
                  setSelectedDocument(null);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Usuń dokument
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    selectedDocument && handleExportMarkdown(selectedDocument)
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Eksportuj MD
                </button>
                {!selectedDocument.savedToRag ? (
                  <button
                    onClick={() => {
                      selectedDocument && handleAddToRag(selectedDocument);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
                  >
                    <Database className="h-4 w-4" />
                    Dodaj do RAG
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      selectedDocument &&
                      handleAnalyzeSentiment(selectedDocument)
                    }
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-medium transition-colors"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Analizuj sentyment
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
