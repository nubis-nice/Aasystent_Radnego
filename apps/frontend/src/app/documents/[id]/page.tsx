"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  ArrowLeft,
  Calendar,
  Tag,
  ExternalLink,
  Brain,
  Loader2,
  Clock,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import {
  getDocument,
  analyzeDocument,
  type Document,
} from "@/lib/api/documents-list";
import { supabase } from "@/lib/supabase/client";

type DocumentPriority = "critical" | "high" | "medium" | "low";

// Komponent formatujący treść dokumentu
function FormattedDocumentContent({ content }: { content: string }) {
  if (!content) {
    return <p className="text-slate-500 italic">Brak treści dokumentu</p>;
  }

  // Najpierw podziel tekst na sekcje używając wzorców
  const parseDocument = (text: string) => {
    const elements: React.ReactNode[] = [];

    // Wzorce do rozpoznawania struktury
    const patterns = {
      sessionHeader: /Sesja\s+Nr\s+[IVXLCDM]+/gi,
      dateSection: /Data\s+posiedzenia\s+[\d\-.,]+(?:,?\s*godz\.?\s*[\d:]+)?/gi,
      placeSection:
        /Miejsce\s+posiedzenia\s+[^0-9]+?(?=\s*(?:Porządek|Data|\d+\.))/gi,
      agendaHeader: /Porządek\s+obrad/gi,
      numberedItem:
        /(\d+[a-z]?)\.\s+(.+?)(?=\s*(?:\d+[a-z]?\.|Informacja|Sprawozdanie|Projekt|$))/gi,
      pdfLink: /\(PDF,?\s*[\d.,]+\s*[KMG]?[bB]?\)/gi,
      druk: /\(\s*druk[i]?\s*(?:nr|numer)?\s*[\d,\s]+\)/gi,
    };

    // Wyodrębnij nagłówek sesji
    const sessionMatch = text.match(patterns.sessionHeader);
    if (sessionMatch) {
      elements.push(
        <div
          key="session-header"
          className="mb-6 p-4 rounded-xl bg-gradient-to-r from-primary-50 to-primary-100 border-2 border-primary-200"
        >
          <h2 className="text-2xl font-bold text-primary-800 flex items-center gap-2">
            🏛️ {sessionMatch[0]}
          </h2>
        </div>
      );
    }

    // Wyodrębnij datę
    const dateMatch = text.match(patterns.dateSection);
    if (dateMatch) {
      elements.push(
        <div
          key="date-section"
          className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border-l-4 border-blue-400 mb-3"
        >
          <span className="text-2xl">📅</span>
          <div>
            <span className="text-sm text-blue-600 font-medium">
              Data i godzina
            </span>
            <p className="text-blue-900 font-semibold">
              {dateMatch[0].replace(/Data\s+posiedzenia\s*/i, "")}
            </p>
          </div>
        </div>
      );
    }

    // Wyodrębnij miejsce
    const placeMatch = text.match(patterns.placeSection);
    if (placeMatch) {
      elements.push(
        <div
          key="place-section"
          className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border-l-4 border-green-400 mb-3"
        >
          <span className="text-2xl">📍</span>
          <div>
            <span className="text-sm text-green-600 font-medium">Miejsce</span>
            <p className="text-green-900 font-semibold">
              {placeMatch[0].replace(/Miejsce\s+posiedzenia\s*/i, "").trim()}
            </p>
          </div>
        </div>
      );
    }

    // Wyodrębnij punkty porządku obrad
    const agendaMatch = text.match(patterns.agendaHeader);
    if (agendaMatch) {
      elements.push(
        <h3
          key="agenda-header"
          className="text-xl font-bold text-slate-800 mt-6 mb-4 flex items-center gap-2 pb-2 border-b-2 border-slate-200"
        >
          📋 Porządek obrad
        </h3>
      );
    }

    // Wyodrębnij punkty numerowane - użyj split i regex bez flagi 's'
    const itemPattern = /(\d+[a-z]?)\.\s+/g;
    const matches: { num: string; content: string }[] = [];
    let match;

    // Znajdź pozycje wszystkich numerów punktów
    const positions: { num: string; start: number; end: number }[] = [];
    while ((match = itemPattern.exec(text)) !== null) {
      positions.push({
        num: match[1],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    // Wyodrębnij treść między punktami
    for (let i = 0; i < positions.length; i++) {
      const current = positions[i];
      const next = positions[i + 1];
      const contentEnd = next ? next.start : text.length;
      const content = text.substring(current.end, contentEnd).trim();
      matches.push({ num: current.num, content });
    }

    if (matches.length > 0) {
      const items = matches;

      elements.push(
        <div key="agenda-items" className="space-y-3">
          {items.map((item, idx) => {
            const hasPdf = patterns.pdfLink.test(item.content);
            const hasDruk = patterns.druk.test(item.content);

            // Formatuj treść punktu
            let formattedContent = item.content;

            // Zamień PDF linki na badge
            formattedContent = formattedContent.replace(
              patterns.pdfLink,
              "⟦PDF⟧$&⟦/PDF⟧"
            );
            // Zamień druki na badge
            formattedContent = formattedContent.replace(
              patterns.druk,
              "⟦DRUK⟧$&⟦/DRUK⟧"
            );

            // Rozdziel i renderuj
            const parts = formattedContent.split(/⟦(PDF|DRUK|\/PDF|\/DRUK)⟧/);
            let inPdf = false,
              inDruk = false;

            const renderedParts = parts
              .map((part, partIdx) => {
                if (part === "PDF") {
                  inPdf = true;
                  return null;
                }
                if (part === "/PDF") {
                  inPdf = false;
                  return null;
                }
                if (part === "DRUK") {
                  inDruk = true;
                  return null;
                }
                if (part === "/DRUK") {
                  inDruk = false;
                  return null;
                }

                if (inPdf) {
                  return (
                    <span
                      key={partIdx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 mx-1 rounded bg-red-100 text-red-700 text-xs font-medium whitespace-nowrap"
                    >
                      📎 {part}
                    </span>
                  );
                }
                if (inDruk) {
                  return (
                    <span
                      key={partIdx}
                      className="inline-flex items-center px-2 py-0.5 mx-1 rounded bg-purple-100 text-purple-700 text-xs font-medium whitespace-nowrap"
                    >
                      {part}
                    </span>
                  );
                }
                return <span key={partIdx}>{part}</span>;
              })
              .filter(Boolean);

            // Określ typ punktu
            const isInfo = /^(Informacja|Sprawozdanie)/i.test(item.content);
            const isResolution = /^(Podjęcie uchwał|zmian|uchwał)/i.test(
              item.content
            );
            const isProtocol = /^(Przyjęcie protokołu|Projekt protokołu)/i.test(
              item.content
            );

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border-l-4 ${
                  isResolution
                    ? "bg-amber-50 border-amber-400"
                    : isInfo
                    ? "bg-blue-50 border-blue-400"
                    : isProtocol
                    ? "bg-green-50 border-green-400"
                    : "bg-slate-50 border-slate-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isResolution
                        ? "bg-amber-200 text-amber-800"
                        : isInfo
                        ? "bg-blue-200 text-blue-800"
                        : isProtocol
                        ? "bg-green-200 text-green-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {item.num}
                  </span>
                  <div className="flex-1">
                    <p className="text-slate-700 leading-relaxed">
                      {renderedParts}
                    </p>
                    {(hasPdf || hasDruk) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {hasPdf && (
                          <span className="text-xs text-red-600">
                            📄 Zawiera załącznik PDF
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    } else {
      // Fallback - jeśli nie znaleziono punktów, wyświetl jako tekst
      elements.push(
        <div key="content-fallback" className="prose prose-slate max-w-none">
          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
            {text}
          </p>
        </div>
      );
    }

    return elements;
  };

  return (
    <div className="document-content space-y-4">{parseDocument(content)}</div>
  );
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchDocument() {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const doc = await getDocument(documentId);
        setDocument(doc);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Błąd pobierania dokumentu"
        );
      } finally {
        setLoading(false);
      }
    }

    if (documentId) {
      fetchDocument();
    }
  }, [documentId, router]);

  const handleAnalyze = async () => {
    if (!document) return;

    try {
      setAnalyzing(true);
      const result = await analyzeDocument(document.id);

      // Zapisz do localStorage i przekieruj do chatu
      localStorage.setItem(
        "pendingAnalysis",
        JSON.stringify({
          prompt: result.analysisPrompt,
          context: result.chatContext,
          document: result.document,
        })
      );

      router.push("/chat?analysis=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd analizy");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCopyContent = async () => {
    if (!document?.content) return;
    await navigator.clipboard.writeText(document.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPriorityStyles = (p: DocumentPriority | undefined) => {
    switch (p) {
      case "critical":
        return { bg: "bg-red-100", text: "text-red-700", label: "🔴 Pilne" };
      case "high":
        return {
          bg: "bg-amber-100",
          text: "text-amber-700",
          label: "🟠 Ważne",
        };
      case "medium":
        return {
          bg: "bg-blue-100",
          text: "text-blue-700",
          label: "🔵 Standardowe",
        };
      default:
        return {
          bg: "bg-gray-100",
          text: "text-gray-700",
          label: "⚪ Archiwalne",
        };
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      resolution: "📜 Uchwała",
      protocol: "📋 Protokół",
      session: "🏛️ Sesja rady",
      news: "📰 Aktualność",
      announcement: "📢 Ogłoszenie",
      article: "📄 Artykuł",
      pdf_attachment: "📎 Załącznik PDF",
      uploaded: "📁 Dokument",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-700 mb-2">
            {error || "Dokument nie został znaleziony"}
          </h2>
          <Link
            href="/documents"
            className="inline-flex items-center gap-2 mt-4 text-red-600 hover:text-red-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Wróć do listy dokumentów
          </Link>
        </div>
      </div>
    );
  }

  const priorityStyle = getPriorityStyles(document.score?.priority);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/documents"
          className="p-2 rounded-xl bg-white border border-border hover:bg-secondary-50 transition-colors flex-shrink-0 mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text">{document.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${priorityStyle.bg} ${priorityStyle.text}`}
            >
              {priorityStyle.label}
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
              {getDocumentTypeLabel(document.document_type)}
            </span>
            {document.score && (
              <span className="px-2 py-1 rounded-lg bg-white border text-xs font-mono text-slate-600">
                Score: {document.score.totalScore} pts
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold shadow-lg hover:from-purple-600 hover:to-purple-700 transition-all disabled:opacity-50"
        >
          {analyzing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Brain className="h-5 w-5" />
          )}
          Analizuj przez AI
        </button>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {document.publish_date && (
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-text-secondary mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">Data publikacji</span>
            </div>
            <p className="text-lg font-bold">
              {new Date(document.publish_date).toLocaleDateString("pl-PL", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-text-secondary mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Przetworzono</span>
          </div>
          <p className="text-lg font-bold">
            {new Date(document.processed_at).toLocaleDateString("pl-PL", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {document.source_url && (
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-text-secondary mb-1">
              <ExternalLink className="h-4 w-4" />
              <span className="text-sm font-medium">Źródło</span>
            </div>
            <a
              href={document.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 font-medium truncate block"
            >
              Otwórz oryginał →
            </a>
          </div>
        )}
      </div>

      {/* Summary */}
      {document.summary && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6">
          <h2 className="text-lg font-bold text-blue-800 mb-2">
            📝 Streszczenie
          </h2>
          <p className="text-blue-900">{document.summary}</p>
        </div>
      )}

      {/* Keywords */}
      {document.keywords && document.keywords.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="h-5 w-5 text-text-secondary" />
            <h2 className="text-lg font-bold">Słowa kluczowe</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {document.keywords.map((keyword, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-full bg-secondary-100 text-secondary-700 text-sm font-medium"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-text-secondary" />
            <h2 className="text-lg font-bold">Treść dokumentu</h2>
          </div>
          <button
            onClick={handleCopyContent}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary-100 text-secondary-700 text-sm font-medium hover:bg-secondary-200 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Skopiowano!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Kopiuj
              </>
            )}
          </button>
        </div>

        <div className="prose prose-slate max-w-none">
          <FormattedDocumentContent content={document.content || ""} />
        </div>
      </div>

      {/* Score details */}
      {document.score && (
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="text-lg font-bold mb-4">📊 Szczegóły scoringu</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 rounded-xl bg-blue-50">
              <div className="text-2xl font-bold text-blue-700">
                {document.score.typeScore}
              </div>
              <div className="text-sm text-blue-600">Typ dokumentu</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-green-50">
              <div className="text-2xl font-bold text-green-700">
                {document.score.relevanceScore}
              </div>
              <div className="text-sm text-green-600">Relewancja</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-amber-50">
              <div className="text-2xl font-bold text-amber-700">
                {document.score.urgencyScore}
              </div>
              <div className="text-sm text-amber-600">Pilność</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-purple-50">
              <div className="text-2xl font-bold text-purple-700">
                {document.score.recencyScore}
              </div>
              <div className="text-sm text-purple-600">Aktualność</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
