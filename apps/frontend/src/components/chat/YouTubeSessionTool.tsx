"use client";

import { useState, useEffect } from "react";
import {
  Youtube,
  Loader2,
  Play,
  X,
  Mic,
  Clock,
  ExternalLink,
  RefreshCw,
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
  SortDesc,
  MapPin,
} from "lucide-react";
import {
  getYouTubeSessions,
  transcribeYouTubeVideo,
  type YouTubeVideo,
} from "@/lib/api/youtube-sessions";

interface YouTubeSessionToolProps {
  onTranscriptionComplete?: (transcription: string, videoTitle: string) => void;
  onClose?: () => void;
}

export function YouTubeSessionTool({
  onTranscriptionComplete,
  onClose,
}: YouTubeSessionToolProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<YouTubeVideo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<YouTubeVideo | null>(
    null
  );
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState("");
  const [transcriptionResult, setTranscriptionResult] = useState<{
    formattedTranscript: string;
    videoTitle: string;
  } | null>(null);

  // Paginacja i filtrowanie
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    loadSessions();
  }, []);

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
  };

  const handleTranscribe = async () => {
    if (!selectedSession) return;

    setIsTranscribing(true);
    setError(null);
    setTranscriptionResult(null);

    try {
      setTranscriptionProgress("Pobieranie audio z YouTube...");

      // Call API to download and transcribe
      const result = await transcribeYouTubeVideo(
        selectedSession.url,
        selectedSession.title
      );

      setTranscriptionProgress("Transkrypcja zakończona!");

      if (result.success && result.formattedTranscript) {
        // Save result for export
        setTranscriptionResult({
          formattedTranscript: result.formattedTranscript,
          videoTitle: selectedSession.title,
        });

        onTranscriptionComplete?.(
          result.formattedTranscript,
          selectedSession.title
        );
      } else {
        setError(result.error || "Błąd transkrypcji");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Błąd transkrypcji";

      // Check if it's yt-dlp not installed error
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

    // Create safe filename from title
    const safeTitle = transcriptionResult.videoTitle
      .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 50);

    const filename = `transkrypcja_${safeTitle}_${new Date()
      .toISOString()
      .slice(0, 10)}.md`;

    // Create blob and download
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Youtube className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Sesje Rady na YouTube</h2>
              <p className="text-xs text-text-secondary">
                Wybierz sesję do transkrypcji
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-red-500 mb-4" />
              <p className="text-text-secondary">Ładowanie listy sesji...</p>
            </div>
          ) : error ? (
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
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                  <input
                    type="text"
                    placeholder="Szukaj sesji (np. Drawno, komisja)..."
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
              <div className="space-y-3">
                {(() => {
                  // Filtrowanie
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

                  // Sortowanie
                  filteredSessions = [...filteredSessions].sort((a, b) => {
                    const dateA = new Date(a.publishedAt || 0).getTime();
                    const dateB = new Date(b.publishedAt || 0).getTime();
                    return sortOrder === "newest"
                      ? dateB - dateA
                      : dateA - dateB;
                  });

                  // Paginacja
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
                          <p>Nie znaleziono sesji pasujących do wyszukiwania</p>
                        </div>
                      ) : (
                        paginatedSessions.map((session) => (
                          <button
                            key={session.id}
                            onClick={() => handleSelectSession(session)}
                            className={`w-full flex items-start gap-4 p-3 rounded-xl border-2 transition-all text-left ${
                              selectedSession?.id === session.id
                                ? "border-red-500 bg-red-50"
                                : "border-secondary-200 hover:border-red-300 hover:bg-red-50/50"
                            }`}
                          >
                            <img
                              src={session.thumbnailUrl}
                              alt={session.title}
                              className="w-32 h-20 object-cover rounded-lg flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm line-clamp-2 mb-1">
                                {session.title}
                              </h3>
                              <div className="flex items-center gap-3 text-xs text-text-secondary">
                                {session.publishedAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {session.publishedAt}
                                  </span>
                                )}
                                {session.duration && (
                                  <span className="flex items-center gap-1">
                                    <Play className="h-3 w-3" />
                                    {session.duration}
                                  </span>
                                )}
                              </div>
                              <a
                                href={session.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline mt-2"
                              >
                                Otwórz w YouTube{" "}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                            {selectedSession?.id === session.id && (
                              <div className="flex-shrink-0">
                                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                                  <Play className="h-3 w-3 text-white" />
                                </div>
                              </div>
                            )}
                          </button>
                        ))
                      )}

                      {/* Paginacja */}
                      {filteredSessions.length > ITEMS_PER_PAGE && (
                        <div className="flex items-center justify-between pt-4 border-t border-secondary-200">
                          <span className="text-xs text-text-secondary">
                            Strona {currentPage} z {totalPages} (
                            {filteredSessions.length} sesji)
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                setCurrentPage((p) => Math.max(1, p - 1))
                              }
                              disabled={currentPage === 1}
                              className="p-2 border border-secondary-200 rounded-lg hover:bg-secondary-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                              className="p-2 border border-secondary-200 rounded-lg hover:bg-secondary-50 disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Footer - Transcription Result */}
        {transcriptionResult && (
          <div className="p-4 border-t border-secondary-200 bg-green-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 rounded-full">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">
                  Transkrypcja zakończona!
                </p>
                <p className="text-xs text-green-600">
                  {transcriptionResult.videoTitle}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportMarkdown}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Pobierz Markdown
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-secondary-200 text-secondary-700 rounded-lg hover:bg-secondary-300 transition-colors"
              >
                Zamknij
              </button>
            </div>
          </div>
        )}

        {/* Footer - Session Selected */}
        {selectedSession && !transcriptionResult && (
          <div className="p-4 border-t border-secondary-200 bg-secondary-50">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-sm font-medium truncate">
                  {selectedSession.title}
                </p>
                {transcriptionProgress && (
                  <p className="text-xs text-primary-600 mt-1">
                    {transcriptionProgress}
                  </p>
                )}
              </div>
              <button
                onClick={handleTranscribe}
                disabled={isTranscribing}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Przetwarzanie...
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    Transkrybuj
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
