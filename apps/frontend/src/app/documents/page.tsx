"use client";

import {
  FileText,
  Upload,
  Search,
  Filter,
  Calendar,
  Loader2,
  Brain,
  AlertTriangle,
  Clock,
  ArrowUpDown,
  ChevronDown,
  X,
  Paperclip,
  Database,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  getDocuments,
  analyzeDocument,
  type Document,
  type DocumentPriority,
} from "@/lib/api/documents-list";
import { supabase } from "@/lib/supabase/client";
import {
  groupDocuments,
  type GroupingScheme,
  GROUPING_SCHEME_LABELS,
} from "@/lib/documents/grouping";
import { DocumentGroupView } from "@/components/documents/DocumentGroupView";

interface UserPreferences {
  default_sort_by: string;
  default_sort_order: string;
  default_document_types: string[];
  show_only_my_committees: boolean;
  group_by_session: boolean;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [priority, setPriority] = useState<DocumentPriority | "">("");
  const [sortBy, setSortBy] = useState<"score" | "date" | "title" | "session">(
    "score"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [dateRange, setDateRange] = useState("");
  const [total, setTotal] = useState(0);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(null);
  const [showOnlyMyCommittees, setShowOnlyMyCommittees] = useState(false);
  const [userCommittees, setUserCommittees] = useState<string[]>([]);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [groupingScheme, setGroupingScheme] =
    useState<GroupingScheme>("cascade");

  // Załaduj preferencje użytkownika
  useEffect(() => {
    async function loadPreferences() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setPreferencesLoaded(true);
          return;
        }

        // Pobierz preferencje dokumentów
        const { data: prefs } = await supabase
          .from("user_document_preferences")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (prefs) {
          setUserPreferences(prefs);
          // Zastosuj domyślne sortowanie
          if (prefs.default_sort_by) {
            setSortBy(
              prefs.default_sort_by as "score" | "date" | "title" | "session"
            );
          }
          if (prefs.default_sort_order) {
            setSortOrder(prefs.default_sort_order as "asc" | "desc");
          }
          if (prefs.default_grouping_scheme) {
            setGroupingScheme(prefs.default_grouping_scheme as GroupingScheme);
          }
          setShowOnlyMyCommittees(prefs.show_only_my_committees || false);
        }

        // Pobierz komisje użytkownika z profilu
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("committees")
          .eq("id", user.id)
          .single();

        if (profile?.committees) {
          setUserCommittees(profile.committees);
        }
      } catch (err) {
        console.error("Error loading preferences:", err);
      } finally {
        setPreferencesLoaded(true);
      }
    }
    loadPreferences();
  }, []);

  // Funkcja kolorystyki według priorytetu
  const getPriorityStyles = (p: DocumentPriority | undefined) => {
    switch (p) {
      case "critical":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          badge: "bg-red-100 text-red-700",
          icon: "text-red-500",
          label: "🔴 Pilne",
        };
      case "high":
        return {
          bg: "bg-amber-50",
          border: "border-amber-200",
          badge: "bg-amber-100 text-amber-700",
          icon: "text-amber-500",
          label: "🟠 Ważne",
        };
      case "medium":
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          badge: "bg-blue-100 text-blue-700",
          icon: "text-blue-500",
          label: "🔵 Standardowe",
        };
      default:
        return {
          bg: "bg-gray-50",
          border: "border-gray-200",
          badge: "bg-gray-100 text-gray-700",
          icon: "text-gray-500",
          label: "⚪ Archiwalne",
        };
    }
  };

  // Funkcja analizy dokumentu - profesjonalna analiza z kontekstem RAG
  const handleAnalyze = async (docId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    try {
      setAnalyzingId(docId);
      const result = await analyzeDocument(docId);

      // Zapisz pełny kontekst analizy do localStorage
      localStorage.setItem(
        "pendingAnalysis",
        JSON.stringify({
          prompt: result.analysisPrompt,
          systemPrompt: result.systemPrompt,
          context: result.chatContext,
          document: result.document,
          references: result.references,
        })
      );

      router.push("/chat?analysis=true");
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : "Błąd analizy");
    } finally {
      setAnalyzingId(null);
    }
  };

  // Oblicz zakres dat
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case "week":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
      case "month":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
      case "year":
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
      default:
        return undefined;
    }
  };

  // Pobierz dokumenty z bazy - czekaj na załadowanie preferencji
  useEffect(() => {
    // Nie pobieraj dokumentów dopóki preferencje nie zostaną załadowane
    if (!preferencesLoaded) {
      return;
    }

    async function fetchDocuments() {
      try {
        setLoading(true);

        // NAJPIERW sprawdź czy użytkownik jest zalogowany
        // Używamy getUser() zamiast getSession() bo getUser() waliduje token z serwerem
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          console.log(
            "[Documents] No valid user, redirecting to login",
            userError?.message
          );
          // Brak sesji - przekieruj do logowania BEZ wywoływania API
          window.location.href = "/login";
          return;
        }

        console.log("[Documents] User authenticated:", user.id);
        console.log(
          "[Documents] Using sortBy:",
          sortBy,
          "sortOrder:",
          sortOrder
        );

        // Użytkownik zalogowany - pobierz dane
        // Mapowanie sortBy "session" na "date" dla API (session to sortowanie chronologiczne)
        const apiSortBy = sortBy === "session" ? "date" : sortBy;
        const response = await getDocuments({
          search: search || undefined,
          documentType: documentType || undefined,
          priority: priority || undefined,
          sortBy: apiSortBy,
          sortOrder,
          dateFrom: getDateRange(),
          limit: 50,
        });
        setDocuments(response.documents);
        setTotal(response.total);
        setError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Błąd pobierania dokumentów";
        setError(errorMessage);

        // Jeśli błąd autoryzacji, przekieruj do logowania
        if (
          errorMessage.includes("zalogowany") ||
          errorMessage.includes("authorization")
        ) {
          setTimeout(() => {
            window.location.href = "/login";
          }, 2000);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search,
    documentType,
    priority,
    sortBy,
    sortOrder,
    dateRange,
    preferencesLoaded,
  ]);

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      resolution: "Uchwała",
      protocol: "Protokół",
      news: "Aktualność",
      announcement: "Ogłoszenie",
      article: "Artykuł",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
            Dokumenty
          </h1>
          <p className="text-text-secondary mt-2 text-base font-medium">
            Zarządzaj dokumentami Rady Miejskiej i analizuj ich treść
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Przycisk transkrypcji YouTube */}
          <button
            onClick={() => router.push("/documents/youtube")}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 hover:border-red-300 hover:bg-red-50 transition-all duration-200"
            title="Transkrypcja sesji Rady (YouTube)"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <span>Transkrypcja YouTube</span>
          </button>

          {/* Przycisk OCR/przetwarzania dokumentów */}
          <button
            onClick={() => router.push("/documents/process")}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-primary-200 bg-white px-4 py-3 text-sm font-semibold text-primary-600 hover:border-primary-300 hover:bg-primary-50 transition-all duration-200"
            title="Przetwórz dokument (OCR) lub audio/video (transkrypcja)"
          >
            <Paperclip className="h-5 w-5" />
            <span>OCR / Transkrypcja</span>
          </button>

          {/* Przycisk pobierania dokumentacji do RAG */}
          <button
            onClick={() => router.push("/documents/fetch-rag")}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-amber-600 hover:border-amber-300 hover:bg-amber-50 transition-all duration-200"
            title="Pobierz dokumentację do zasilenia RAG"
          >
            <Database className="h-5 w-5" />
            <span className="flex items-center gap-1.5">
              Zasilanie RAG
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">
                BETA
              </span>
            </span>
          </button>

          {/* Przycisk dodawania dokumentu */}
          <Link
            href="/documents/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 hover:from-primary-600 hover:to-primary-700 transition-all duration-200"
          >
            <Upload className="h-5 w-5" />
            <span>Dodaj dokument</span>
          </Link>
        </div>
      </div>

      {/* Zaawansowane filtry i wyszukiwanie */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border-2 border-slate-200 p-6 shadow-lg">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Wyszukiwanie */}
          <div className="relative md:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Szukaj dokumentów..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-300 bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200 font-medium"
            />
          </div>

          {/* Typ dokumentu */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full pl-10 pr-8 py-3 rounded-xl border-2 border-slate-300 bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200 appearance-none font-medium cursor-pointer"
            >
              <option value="">Wszystkie typy</option>
              <option value="resolution">📜 Uchwała</option>
              <option value="protocol">📋 Protokół</option>
              <option value="session">🏛️ Sesja rady</option>
              <option value="news">📰 Aktualność</option>
              <option value="announcement">📢 Ogłoszenie</option>
              <option value="article">📄 Artykuł</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Priorytet */}
          <div className="relative">
            <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as DocumentPriority | "")
              }
              className="w-full pl-10 pr-8 py-3 rounded-xl border-2 border-slate-300 bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200 appearance-none font-medium cursor-pointer"
            >
              <option value="">Wszystkie priorytety</option>
              <option value="critical">🔴 Pilne</option>
              <option value="high">🟠 Ważne</option>
              <option value="medium">🔵 Standardowe</option>
              <option value="low">⚪ Archiwalne</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Zakres dat */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full pl-10 pr-8 py-3 rounded-xl border-2 border-slate-300 bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200 appearance-none font-medium cursor-pointer"
            >
              <option value="">Wszystkie daty</option>
              <option value="week">📅 Ostatni tydzień</option>
              <option value="month">📆 Ostatni miesiąc</option>
              <option value="year">🗓️ Ostatni rok</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Drugi wiersz - sortowanie i aktywne filtry */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-slate-200">
          {/* Sortowanie */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as "score" | "date" | "title" | "session"
                )
              }
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium cursor-pointer"
            >
              <option value="score">Wg ważności</option>
              <option value="date">Wg daty</option>
              <option value="session">📅 Chronologicznie (sesje)</option>
              <option value="title">Wg nazwy</option>
            </select>
            <button
              onClick={() =>
                setSortOrder(sortOrder === "desc" ? "asc" : "desc")
              }
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50"
            >
              {sortOrder === "desc" ? "↓ Malejąco" : "↑ Rosnąco"}
            </button>
          </div>

          {/* Schemat grupowania */}
          <div className="flex items-center gap-2">
            <select
              value={groupingScheme}
              onChange={(e) =>
                setGroupingScheme(e.target.value as GroupingScheme)
              }
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium cursor-pointer"
              title="Schemat wyświetlania dokumentów"
            >
              {Object.entries(GROUPING_SCHEME_LABELS).map(
                ([key, { label, icon }]) => (
                  <option key={key} value={key}>
                    {icon} {label}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Filtr Moje komisje */}
          {userCommittees.length > 0 && (
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={showOnlyMyCommittees}
                onChange={(e) => setShowOnlyMyCommittees(e.target.checked)}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span>🏛️ Moje komisje ({userCommittees.length})</span>
            </label>
          )}

          {/* Zapisz jako domyślne */}
          <button
            onClick={async () => {
              try {
                const {
                  data: { user },
                } = await supabase.auth.getUser();
                if (!user) return;

                await supabase.from("user_document_preferences").upsert(
                  {
                    user_id: user.id,
                    default_sort_by: sortBy,
                    default_sort_order: sortOrder,
                    default_grouping_scheme: groupingScheme,
                    show_only_my_committees: showOnlyMyCommittees,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "user_id" }
                );

                alert("Preferencje zapisane!");
              } catch (err) {
                console.error("Error saving preferences:", err);
              }
            }}
            className="px-3 py-2 rounded-lg border border-primary-300 bg-primary-50 text-primary-700 text-sm font-medium hover:bg-primary-100 transition-colors"
            title="Zapisz obecne ustawienia filtrów jako domyślne"
          >
            💾 Zapisz domyślne
          </button>

          {/* Aktywne filtry */}
          {(search || documentType || priority || dateRange) && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-slate-500">Aktywne filtry:</span>
              {search && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-medium">
                  &quot;{search}&quot;
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSearch("")}
                  />
                </span>
              )}
              {documentType && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                  {getDocumentTypeLabel(documentType)}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setDocumentType("")}
                  />
                </span>
              )}
              {priority && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                  {getPriorityStyles(priority).label}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setPriority("")}
                  />
                </span>
              )}
              {dateRange && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                  {dateRange === "week"
                    ? "Tydzień"
                    : dateRange === "month"
                    ? "Miesiąc"
                    : "Rok"}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setDateRange("")}
                  />
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lista dokumentów */}
      <div className="space-y-4">
        {loading || !preferencesLoaded ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-primary-200 animate-pulse"></div>
              <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-primary-500" />
            </div>
            <p className="mt-4 text-text-secondary font-medium animate-pulse">
              Ładowanie dokumentów...
            </p>
          </div>
        ) : error ? (
          <div className="bg-danger/10 border border-danger/30 rounded-2xl p-6 text-center">
            <p className="text-danger font-semibold">{error}</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-secondary-50 rounded-2xl p-12 text-center">
            <FileText className="h-16 w-16 text-secondary-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-text mb-2">
              Brak dokumentów
            </h3>
            <p className="text-text-secondary">
              {search || documentType
                ? "Nie znaleziono dokumentów pasujących do filtrów"
                : "Dodaj pierwszy dokument lub uruchom scraping źródeł danych"}
            </p>
          </div>
        ) : groupingScheme !== "flat" ? (
          <DocumentGroupView
            groupingResult={groupDocuments(
              documents,
              groupingScheme,
              sortBy,
              sortOrder
            )}
            onAnalyze={(id) => handleAnalyze(id)}
            analyzingId={analyzingId}
            getPriorityStyles={getPriorityStyles}
            getDocumentTypeLabel={getDocumentTypeLabel}
          />
        ) : (
          documents.map((doc, index) => {
            const priorityStyle = getPriorityStyles(doc.score?.priority);
            const isTopDocument = index < 5;

            // Ekstrakcja daty z treści dokumentu (dla top 5)
            const extractDateFromContent = (content: string | undefined) => {
              if (!content) return null;
              const datePatterns = [
                /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/,
                /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/,
                /(\d{1,2})\s+(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia)\s+(\d{4})/i,
              ];
              for (const pattern of datePatterns) {
                const match = content.substring(0, 500).match(pattern);
                if (match) return match[0];
              }
              return null;
            };

            // Ekstrakcja charakterystycznych szczegółów (dla top 5)
            const extractDetails = (
              content: string | undefined,
              summary: string | null
            ) => {
              const details: string[] = [];
              const text =
                (summary || "") + " " + (content?.substring(0, 2000) || "");

              // Szukaj kwot
              const amountMatch = text.match(
                /(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*(?:zł|PLN|złotych)/i
              );
              if (amountMatch) details.push(`💰 ${amountMatch[0]}`);

              // Szukaj numerów uchwał
              const resolutionMatch = text.match(
                /(?:uchwał[ay]?\s*(?:nr|numer)?\s*)([IVXLCDM]+\/\d+\/\d+|\d+\/\d+\/\d+)/i
              );
              if (resolutionMatch)
                details.push(`📜 Uchwała ${resolutionMatch[1]}`);

              // Szukaj terminów
              const deadlineMatch = text.match(
                /(?:termin|do dnia|najpóźniej)[:\s]+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})/i
              );
              if (deadlineMatch) details.push(`⏰ Termin: ${deadlineMatch[1]}`);

              // Szukaj lokalizacji
              const locationMatch = text.match(
                /(?:w |przy |ul\.|ulica)\s*([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+(?:\s+[A-ZĄĆĘŁŃÓŚŹŻ]?[a-ząćęłńóśźż]+)*)/
              );
              if (locationMatch) details.push(`📍 ${locationMatch[0].trim()}`);

              return details.slice(0, 3);
            };

            const contentDate = isTopDocument
              ? extractDateFromContent(doc.content)
              : null;
            const details = isTopDocument
              ? extractDetails(doc.content, doc.summary)
              : [];

            return (
              <div
                key={doc.id}
                className={`relative rounded-2xl border-2 ${
                  priorityStyle.border
                } ${priorityStyle.bg} ${
                  isTopDocument ? "p-6 pb-16" : "p-5 pb-14"
                } shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}
              >
                {/* Pasek priorytetu */}
                {doc.score && (
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-transparent via-current to-transparent opacity-50"
                    style={{
                      color:
                        doc.score.priority === "critical"
                          ? "#ef4444"
                          : doc.score.priority === "high"
                          ? "#f59e0b"
                          : doc.score.priority === "medium"
                          ? "#3b82f6"
                          : "#9ca3af",
                    }}
                  />
                )}

                {/* Tabliczka TOP 5 */}
                {isTopDocument && (
                  <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs font-bold shadow">
                    TOP {index + 1}
                  </div>
                )}

                <Link href={`/documents/${doc.id}`} className="block">
                  <div className="flex items-start gap-4">
                    <div
                      className={`${
                        isTopDocument ? "h-14 w-14" : "h-12 w-12"
                      } rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0 ${
                        priorityStyle.icon
                      }`}
                    >
                      <FileText
                        className={isTopDocument ? "h-7 w-7" : "h-6 w-6"}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <h3
                          className={`${
                            isTopDocument ? "text-xl" : "text-lg"
                          } font-bold text-text mb-2 pr-16`}
                        >
                          {doc.title}
                        </h3>
                        {/* Score badge */}
                        {doc.score && !isTopDocument && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`px-2 py-1 rounded-lg text-xs font-bold ${priorityStyle.badge}`}
                            >
                              {priorityStyle.label}
                            </span>
                            <span className="px-2 py-1 rounded-lg bg-white text-xs font-mono text-slate-600 shadow-sm">
                              {doc.score.totalScore}pts
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Tabliczka informacyjna dla TOP 5 */}
                      {isTopDocument && (
                        <div className="mb-3 p-3 rounded-xl bg-white/70 border border-white shadow-sm">
                          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                            {/* Data z dokumentu */}
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">📅 Data:</span>
                              <span className="font-semibold text-slate-700">
                                {contentDate ||
                                  (doc.publish_date
                                    ? new Date(
                                        doc.publish_date
                                      ).toLocaleDateString("pl-PL")
                                    : "brak daty")}
                              </span>
                            </div>
                            {/* Priorytet i score */}
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${priorityStyle.badge}`}
                              >
                                {priorityStyle.label}
                              </span>
                              <span className="text-xs font-mono text-slate-500">
                                {doc.score?.totalScore || 0} pkt
                              </span>
                            </div>
                            {/* Typ */}
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">Typ:</span>
                              <span className="font-medium">
                                {getDocumentTypeLabel(doc.document_type)}
                              </span>
                            </div>
                          </div>

                          {/* Szczegóły charakterystyczne */}
                          {details.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-200">
                              {details.map((detail, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                                >
                                  {detail}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {!isTopDocument && (
                        <div className="flex flex-wrap gap-3 text-sm text-text-secondary">
                          {doc.publish_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {new Date(doc.publish_date).toLocaleDateString(
                                "pl-PL"
                              )}
                            </span>
                          )}
                          <span className="px-3 py-1 rounded-full bg-white/80 text-slate-700 font-semibold shadow-sm">
                            {getDocumentTypeLabel(doc.document_type)}
                          </span>
                          {doc.metadata?.created_by === "ai_assistant" && (
                            <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold">
                              AI
                            </span>
                          )}
                        </div>
                      )}

                      {/* Streszczenie - rozszerzone dla TOP 5 */}
                      {doc.summary && (
                        <p
                          className={`text-sm text-text-secondary mt-2 ${
                            isTopDocument ? "line-clamp-4" : "line-clamp-2"
                          }`}
                        >
                          {doc.summary}
                        </p>
                      )}

                      {doc.keywords && doc.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {doc.keywords
                            .slice(0, isTopDocument ? 6 : 4)
                            .map((keyword, idx) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-1 rounded-full bg-white/80 text-slate-600 shadow-sm"
                              >
                                {keyword}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Przycisk analizy */}
                <div className="absolute bottom-4 right-4">
                  <button
                    onClick={(e) => handleAnalyze(doc.id, e)}
                    disabled={analyzingId === doc.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-semibold shadow-lg hover:from-purple-600 hover:to-purple-700 transition-all disabled:opacity-50"
                  >
                    {analyzingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Brain className="h-4 w-4" />
                    )}
                    Analizuj
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Informacja o liczbie dokumentów */}
      {!loading && !error && documents.length > 0 && (
        <div className="text-center text-sm text-text-secondary">
          Wyświetlono {documents.length} z {total} dokumentów
        </div>
      )}
    </div>
  );
}
