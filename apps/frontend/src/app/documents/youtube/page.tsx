"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Youtube,
  Loader2,
  FileText,
  Download,
  Play,
  Clock,
  ExternalLink,
  RefreshCw,
  Search,
  SortDesc,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Database,
  CheckCircle,
  Zap,
  X,
  Link2,
} from "lucide-react";
import Link from "next/link";
import {
  getYouTubeSessions,
  transcribeYouTubeVideo,
  startAsyncTranscription,
  getTranscriptionJobs,
  type YouTubeVideo,
  type YouTubeTranscriptionResult,
  type TranscriptionJob,
} from "@/lib/api/youtube-sessions";

export default function YouTubeTranscriptionPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<YouTubeVideo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<YouTubeVideo | null>(
    null
  );
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState("");
  const [transcriptionResult, setTranscriptionResult] =
    useState<YouTubeTranscriptionResult | null>(null);

  // Opcje transkrypcji
  const [includeSentiment, setIncludeSentiment] = useState(true);
  const [identifySpeakers, setIdentifySpeakers] = useState(true);
  const [useAsyncMode, setUseAsyncMode] = useState(true);

  // Zadania asynchroniczne
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [showJobsPanel, setShowJobsPanel] = useState(false);

  // Paginacja i filtrowanie
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const ITEMS_PER_PAGE = 5;

  // Rozwijanie sesji (minimalizacja)
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    null
  );

  // Modal powiązań dla RAG
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingRAGSession, setPendingRAGSession] =
    useState<YouTubeVideo | null>(null);
  const [relatedDocumentId, setRelatedDocumentId] = useState<string>("");
  const [detectedRelation, setDetectedRelation] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
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
        const result = await getTranscriptionJobs();
        setJobs(result.jobs);
      } catch (e) {
        console.error("Error polling jobs:", e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobs]);

  const loadJobs = async () => {
    try {
      const result = await getTranscriptionJobs();
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

  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getYouTubeSessions();
      setSessions(result.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd ładowania sesji");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSession = (session: YouTubeVideo) => {
    setSelectedSession(session);
    setTranscriptionResult(null);
  };

  const handleTranscribe = async () => {
    if (!selectedSession) return;

    setIsTranscribing(true);
    setError(null);
    setTranscriptionResult(null);

    try {
      if (useAsyncMode) {
        // Tryb asynchroniczny - zadanie w tle z zapisem do RAG
        setTranscriptionProgress("Tworzenie zadania transkrypcji...");

        const jobResult = await startAsyncTranscription(
          selectedSession.url,
          selectedSession.title,
          {
            includeSentiment,
            identifySpeakers,
          }
        );

        if (jobResult.success) {
          setTranscriptionProgress("");
          setShowJobsPanel(true);
          await loadJobs();
          setSelectedSession(null);
          // Pokaż komunikat sukcesu
          alert(
            "✅ Zadanie transkrypcji zostało utworzone!\n\n" +
              "Transkrypcja będzie przetwarzana w tle i automatycznie zapisana do bazy wiedzy.\n" +
              "Możesz kontynuować pracę - status zadania znajdziesz w panelu po prawej stronie."
          );
        } else {
          setError("Błąd tworzenia zadania");
        }
      } else {
        // Tryb synchroniczny - czekaj na wynik
        setTranscriptionProgress("Pobieranie audio z YouTube...");

        const result = await transcribeYouTubeVideo(
          selectedSession.url,
          selectedSession.title,
          includeSentiment
        );

        setTranscriptionProgress("Transkrypcja zakończona!");

        if (result.success && result.formattedTranscript) {
          setTranscriptionResult(result);
        } else {
          setError(result.error || "Błąd transkrypcji");
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Błąd transkrypcji";

      if (errorMsg.includes("yt-dlp")) {
        setError(
          "yt-dlp nie jest zainstalowany na serwerze. " +
            "Administrator musi wykonać: pip install yt-dlp"
        );
      } else {
        setError(errorMsg);
      }
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress("");
    }
  };

  const handleExportMarkdown = () => {
    if (!transcriptionResult) return;

    const safeTitle = transcriptionResult.metadata.videoTitle
      .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 50);

    const filename = `transkrypcja_${safeTitle}_${new Date()
      .toISOString()
      .slice(0, 10)}.md`;

    const blob = new Blob([transcriptionResult.formattedTranscript], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Wykryj numer sesji z tytułu
  const detectSessionNumber = (title: string): string | null => {
    // Wzorce: "XXIII Sesja", "Sesja nr 23", "23 sesja", "sesji XXIII"
    const romanPattern = /\b(X{0,3})(IX|IV|V?I{0,3})\s*(sesj|Sesj)/i;
    const arabicPattern = /\b(\d+)\s*(sesj|Sesj)/i;
    const sessionRomanPattern =
      /(sesj|Sesj)\w*\s*(nr\s*)?(X{0,3})(IX|IV|V?I{0,3})\b/i;
    const sessionArabicPattern = /(sesj|Sesj)\w*\s*(nr\s*)?(\d+)\b/i;

    let match = title.match(romanPattern);
    if (match) return match[1] + match[2];

    match = title.match(sessionRomanPattern);
    if (match) return match[3] + match[4];

    match = title.match(arabicPattern);
    if (match) return match[1];

    match = title.match(sessionArabicPattern);
    if (match) return match[3];

    return null;
  };

  // Dodaj do kontekstu chata (localStorage)
  const handleAddToContext = (session: YouTubeVideo) => {
    const contextData = {
      type: "youtube_session",
      id: session.id,
      title: session.title,
      url: session.url,
      publishedAt: session.publishedAt,
      addedAt: new Date().toISOString(),
    };

    // Pobierz istniejący kontekst
    const existing = localStorage.getItem("chat_context_items");
    const items = existing ? JSON.parse(existing) : [];

    // Sprawdź czy już istnieje
    if (!items.find((i: { id: string }) => i.id === session.id)) {
      items.push(contextData);
      localStorage.setItem("chat_context_items", JSON.stringify(items));
    }

    alert(
      `✅ Sesja "${session.title}" dodana do kontekstu chata!\n\nPrzejdź do chata aby użyć jej w rozmowie.`
    );
  };

  // Przygotuj dodanie do RAG z wykryciem powiązań
  const handlePrepareAddToRAG = (session: YouTubeVideo) => {
    const sessionNumber = detectSessionNumber(session.title);
    if (sessionNumber) {
      setDetectedRelation(`Sesja ${sessionNumber}`);
    } else {
      setDetectedRelation(null);
    }
    setPendingRAGSession(session);
    setShowLinkModal(true);
  };

  // Potwierdź dodanie do RAG
  const handleConfirmAddToRAG = async () => {
    if (!pendingRAGSession) return;

    try {
      setError(null);
      const token = localStorage.getItem("supabase_access_token");

      const response = await fetch("/api/youtube/rag/add-youtube-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session: pendingRAGSession,
          relatedDocumentId: relatedDocumentId || null,
          detectedRelation: detectedRelation,
        }),
      });

      if (!response.ok) {
        throw new Error("Błąd dodawania do RAG");
      }

      alert(`✅ Sesja "${pendingRAGSession.title}" dodana do bazy RAG!`);
      setShowLinkModal(false);
      setPendingRAGSession(null);
      setRelatedDocumentId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd dodawania do RAG");
    }
  };

  const handleAddToRAG = async () => {
    if (!transcriptionResult) return;

    try {
      setError(null);
      const response = await fetch("/api/rag/add-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptionResult.formattedTranscript,
          metadata: transcriptionResult.metadata,
        }),
      });

      if (!response.ok) {
        throw new Error("Błąd dodawania do RAG");
      }

      alert("Scenogram został dodany do bazy RAG!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd dodawania do RAG");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
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
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg">
                <Youtube className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800">
                  Transkrypcja YouTube
                </h1>
                <p className="text-slate-600">
                  Transkrybuj sesje Rady Miejskiej z YouTube
                </p>
              </div>
            </div>
            <button
              onClick={loadSessions}
              disabled={isLoading}
              className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
              title="Odśwież listę"
            >
              <RefreshCw
                className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lista sesji */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">
              Sesje Rady na YouTube
            </h2>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-red-500 mb-4" />
                <p className="text-text-secondary">Ładowanie listy sesji...</p>
              </div>
            ) : error && !transcriptionResult ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-danger mb-4">{error}</p>
                <button
                  onClick={loadSessions}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  Spróbuj ponownie
                </button>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Youtube className="h-12 w-12 text-text-secondary mb-4" />
                <p className="text-text-secondary">
                  Nie znaleziono sesji rady na kanale YouTube.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Filtrowanie i sortowanie */}
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                    <input
                      type="text"
                      placeholder="Szukaj sesji..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-9 pr-4 py-2 border border-secondary-200 rounded-lg text-sm focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    />
                  </div>
                  <button
                    onClick={() =>
                      setSortOrder(sortOrder === "newest" ? "oldest" : "newest")
                    }
                    className="flex items-center gap-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm hover:bg-secondary-50 transition-colors"
                  >
                    <SortDesc className="h-4 w-4" />
                    {sortOrder === "newest" ? "Najnowsze" : "Najstarsze"}
                  </button>
                </div>

                {/* Info o lokalizacji */}
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  <MapPin className="h-4 w-4" />
                  <span>
                    Wyszukiwanie sesji rady dla: <strong>Drawno</strong>
                  </span>
                </div>

                {/* Lista sesji */}
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {(() => {
                    let filteredSessions = sessions.filter(
                      (session) =>
                        searchQuery === "" ||
                        session.title
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                        session.description
                          ?.toLowerCase()
                          .includes(searchQuery.toLowerCase())
                    );

                    filteredSessions = [...filteredSessions].sort((a, b) => {
                      const dateA = new Date(a.publishedAt || 0).getTime();
                      const dateB = new Date(b.publishedAt || 0).getTime();
                      return sortOrder === "newest"
                        ? dateB - dateA
                        : dateA - dateB;
                    });

                    const totalPages = Math.ceil(
                      filteredSessions.length / ITEMS_PER_PAGE
                    );
                    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                    const paginatedSessions = filteredSessions.slice(
                      startIndex,
                      startIndex + ITEMS_PER_PAGE
                    );

                    return (
                      <>
                        {paginatedSessions.length === 0 ? (
                          <div className="text-center py-8 text-text-secondary">
                            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>
                              Nie znaleziono sesji pasujących do wyszukiwania
                            </p>
                          </div>
                        ) : (
                          paginatedSessions.map((session) => (
                            <div
                              key={session.id}
                              className={`rounded-xl border-2 transition-all overflow-hidden ${
                                selectedSession?.id === session.id
                                  ? "border-red-500 bg-red-50"
                                  : expandedSessionId === session.id
                                  ? "border-blue-400 bg-blue-50/50"
                                  : "border-secondary-200 hover:border-red-300"
                              }`}
                            >
                              {/* Nagłówek - zawsze widoczny, klikalny do rozwinięcia */}
                              <button
                                onClick={() =>
                                  setExpandedSessionId(
                                    expandedSessionId === session.id
                                      ? null
                                      : session.id
                                  )
                                }
                                className="w-full flex items-center gap-3 p-3 text-left hover:bg-red-50/30 transition-colors"
                              >
                                <ChevronRight
                                  className={`h-4 w-4 flex-shrink-0 transition-transform ${
                                    expandedSessionId === session.id
                                      ? "rotate-90"
                                      : ""
                                  }`}
                                />
                                <img
                                  src={session.thumbnailUrl}
                                  alt={session.title}
                                  className="w-16 h-10 object-cover rounded flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium text-sm line-clamp-1">
                                    {session.title}
                                  </h3>
                                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                                    {session.publishedAt && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {session.publishedAt}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>

                              {/* Rozwinięta zawartość */}
                              {expandedSessionId === session.id && (
                                <div className="px-4 pb-4 pt-2 border-t border-secondary-200 space-y-3">
                                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                                    {session.duration && (
                                      <span className="flex items-center gap-1">
                                        <Play className="h-3 w-3" />
                                        {session.duration}
                                      </span>
                                    )}
                                    <a
                                      href={session.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-red-600 hover:underline"
                                    >
                                      Otwórz na YouTube{" "}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </div>

                                  {/* Przyciski akcji */}
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() =>
                                        handleSelectSession(session)
                                      }
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors"
                                    >
                                      <FileText className="h-3 w-3" />
                                      Transkrybuj
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleAddToContext(session)
                                      }
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition-colors"
                                    >
                                      <Zap className="h-3 w-3" />
                                      Do kontekstu
                                    </button>
                                    <button
                                      onClick={() =>
                                        handlePrepareAddToRAG(session)
                                      }
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 transition-colors"
                                    >
                                      <Database className="h-3 w-3" />
                                      Do RAG
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}

                        {filteredSessions.length > ITEMS_PER_PAGE && (
                          <div className="flex items-center justify-between pt-4 border-t border-secondary-200">
                            <span className="text-xs text-text-secondary">
                              Strona {currentPage} z {totalPages}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  setCurrentPage((p) => Math.max(1, p - 1))
                                }
                                disabled={currentPage === 1}
                                className="p-2 border border-secondary-200 rounded-lg hover:bg-secondary-50 disabled:opacity-50"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setCurrentPage((p) =>
                                    Math.min(totalPages, p + 1)
                                  )
                                }
                                disabled={currentPage === totalPages}
                                className="p-2 border border-secondary-200 rounded-lg hover:bg-secondary-50 disabled:opacity-50"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Panel transkrypcji */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">
              Transkrypcja
            </h2>

            {!selectedSession ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-text-secondary mb-4" />
                <p className="text-text-secondary">
                  Wybierz sesję z listy aby rozpocząć transkrypcję
                </p>
              </div>
            ) : !transcriptionResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <h3 className="font-medium text-sm mb-2">
                    {selectedSession.title}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-text-secondary">
                    {selectedSession.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {selectedSession.publishedAt}
                      </span>
                    )}
                    {selectedSession.duration && (
                      <span className="flex items-center gap-1">
                        <Play className="h-3 w-3" />
                        {selectedSession.duration}
                      </span>
                    )}
                  </div>
                </div>

                {/* Opcje transkrypcji */}
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-3">
                  <h4 className="font-semibold text-sm text-blue-800 mb-3">
                    Opcje transkrypcji
                  </h4>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useAsyncMode}
                      onChange={(e) => setUseAsyncMode(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-blue-900">
                        🚀 Tryb asynchroniczny (zalecany)
                      </span>
                      <p className="text-xs text-blue-700 mt-1">
                        Przetwarzanie w tle - możesz kontynuować pracę.
                        Transkrypcja zostanie automatycznie zapisana do bazy
                        RAG.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={identifySpeakers}
                      onChange={(e) => setIdentifySpeakers(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-blue-900">
                        👤 Identyfikacja mówców
                      </span>
                      <p className="text-xs text-blue-700 mt-1">
                        Rozpoznaj radnych po imieniu i nazwisku na podstawie
                        kontekstu wypowiedzi
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSentiment}
                      onChange={(e) => setIncludeSentiment(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-blue-900">
                        🎭 Analiza sentymentu
                      </span>
                      <p className="text-xs text-blue-700 mt-1">
                        Dodaj analizę emocji, napięcia i wiarygodności dla
                        każdego segmentu
                      </p>
                    </div>
                  </label>
                </div>

                {transcriptionProgress && (
                  <div className="p-4 rounded-xl bg-primary-50 border border-primary-200">
                    <p className="text-sm text-primary-700">
                      {transcriptionProgress}
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 text-white font-semibold shadow-lg hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Przetwarzanie...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="h-5 w-5" />
                      <span>Transkrybuj</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Sukces */}
                <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-green-800">
                      Transkrypcja zakończona!
                    </h3>
                  </div>
                  <p className="text-sm text-green-700">
                    {transcriptionResult.metadata.videoTitle}
                  </p>
                </div>

                {/* Podsumowanie */}
                {includeSentiment && transcriptionResult.summary && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h4 className="font-semibold text-sm mb-3">Podsumowanie</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-text-secondary">
                          Czas trwania:
                        </span>
                        <p className="font-medium">
                          {transcriptionResult.summary.duration}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Mówcy:</span>
                        <p className="font-medium">
                          {transcriptionResult.summary.speakerCount}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Sentyment:</span>
                        <p className="font-medium">
                          {transcriptionResult.summary.dominantSentiment}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Napięcie:</span>
                        <p className="font-medium">
                          {transcriptionResult.summary.averageTension.toFixed(
                            1
                          )}
                          /10
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Akcje */}
                <div className="space-y-2">
                  <button
                    onClick={handleExportMarkdown}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold"
                  >
                    <Download className="h-5 w-5" />
                    Pobierz Markdown
                  </button>
                  <button
                    onClick={handleAddToRAG}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-semibold"
                  >
                    <Database className="h-5 w-5" />
                    Dodaj do RAG jako scenogram
                  </button>
                  <button
                    onClick={() => {
                      setTranscriptionResult(null);
                      setSelectedSession(null);
                    }}
                    className="w-full px-4 py-3 bg-secondary-200 text-secondary-700 rounded-xl hover:bg-secondary-300 transition-colors font-semibold"
                  >
                    Nowa transkrypcja
                  </button>
                </div>

                {/* Podgląd transkrypcji */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 max-h-96 overflow-y-auto">
                  <h4 className="font-semibold text-sm mb-3">Podgląd</h4>
                  <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {transcriptionResult.formattedTranscript.slice(0, 1000)}
                    {transcriptionResult.formattedTranscript.length > 1000 &&
                      "..."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel zadań asynchronicznych */}
        {showJobsPanel && jobs.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Loader2 className="h-5 w-5" />
                Zadania transkrypcji
              </h2>
              <button
                onClick={() => setShowJobsPanel(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className={`p-4 rounded-xl border ${
                    job.status === "completed"
                      ? "bg-green-50 border-green-200"
                      : job.status === "failed"
                      ? "bg-red-50 border-red-200"
                      : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm truncate flex-1">
                      {job.videoTitle}
                    </h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        job.status === "completed"
                          ? "bg-green-200 text-green-800"
                          : job.status === "failed"
                          ? "bg-red-200 text-red-800"
                          : "bg-blue-200 text-blue-800"
                      }`}
                    >
                      {job.status === "completed"
                        ? "✅ Zakończone"
                        : job.status === "failed"
                        ? "❌ Błąd"
                        : job.status === "downloading"
                        ? "📥 Pobieranie"
                        : job.status === "transcribing"
                        ? "🎤 Transkrypcja"
                        : job.status === "analyzing"
                        ? "🔍 Analiza"
                        : job.status === "saving"
                        ? "💾 Zapisywanie"
                        : "⏳ Oczekuje"}
                    </span>
                  </div>

                  {!["completed", "failed"].includes(job.status) && (
                    <div className="mb-2">
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-slate-600">
                          {job.progressMessage}
                        </p>
                        {job.progress > 0 && job.progress < 100 && (
                          <p className="text-xs text-slate-500 font-medium">
                            ~
                            {(() => {
                              const elapsed =
                                (Date.now() -
                                  new Date(job.createdAt).getTime()) /
                                1000;
                              const estimatedTotal =
                                elapsed / (job.progress / 100);
                              const remaining = Math.max(
                                0,
                                estimatedTotal - elapsed
                              );
                              if (remaining < 60)
                                return `${Math.ceil(remaining)}s`;
                              if (remaining < 3600)
                                return `${Math.ceil(remaining / 60)} min`;
                              return `${Math.floor(
                                remaining / 3600
                              )}h ${Math.ceil((remaining % 3600) / 60)}min`;
                            })()}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {job.status === "completed" && job.resultDocumentId && (
                    <p className="text-xs text-green-700">
                      ✅ Zapisano do bazy RAG (kategoria: transkrypcje)
                    </p>
                  )}

                  {job.status === "failed" && job.error && (
                    <p className="text-xs text-red-700">{job.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal powiązań RAG */}
        {showLinkModal && pendingRAGSession && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-green-600" />
                  Dodaj do RAG
                </h3>
                <button
                  onClick={() => {
                    setShowLinkModal(false);
                    setPendingRAGSession(null);
                  }}
                  className="p-1 hover:bg-secondary-100 rounded"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-secondary-50 rounded-lg">
                  <p className="text-sm font-medium">
                    {pendingRAGSession.title}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">
                    {pendingRAGSession.publishedAt}
                  </p>
                </div>

                {detectedRelation ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>Wykryto powiązanie:</strong> {detectedRelation}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Transkrypcja zostanie automatycznie powiązana z
                      dokumentami tej sesji.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>Nie wykryto powiązania</strong>
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      Podaj ID dokumentu do powiązania lub pozostaw puste.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">
                    ID powiązanego dokumentu (opcjonalne)
                  </label>
                  <input
                    type="text"
                    value={relatedDocumentId}
                    onChange={(e) => setRelatedDocumentId(e.target.value)}
                    placeholder="np. uuid dokumentu lub numer sesji"
                    className="w-full px-3 py-2 border border-secondary-200 rounded-lg text-sm focus:ring-2 focus:ring-green-200 focus:border-green-400"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowLinkModal(false);
                      setPendingRAGSession(null);
                    }}
                    className="flex-1 px-4 py-2 border border-secondary-200 rounded-lg text-sm hover:bg-secondary-50"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={handleConfirmAddToRAG}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 flex items-center justify-center gap-2"
                  >
                    <Database className="h-4 w-4" />
                    Dodaj do RAG
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
