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
  ChevronDown,
} from "lucide-react";
import {
  getDocument,
  analyzeDocument,
  getRelatedDocuments,
  type Document,
  type RelatedDocument,
} from "@/lib/api/documents-list";
import { supabase } from "@/lib/supabase/client";

type DocumentPriority = "critical" | "high" | "medium" | "low";

/**
 * Konwersja numeru arabskiego na rzymski
 */
function arabicToRoman(num: number): string {
  const romanNumerals: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let result = "";
  let remaining = num;
  for (const [value, numeral] of romanNumerals) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
}

/**
 * Komponent formatujący treść dokumentu - używa danych z AI (llmAnalysis)
 * Dane sesji (data, godzina, miejsce) pochodzą z metadata.llmAnalysis lub sessionInfo
 */
function FormattedDocumentContent({ document: doc }: { document: Document }) {
  const content = doc.content;
  const llmAnalysis = doc.metadata?.llmAnalysis;
  const sessionInfo = doc.metadata?.sessionInfo;

  if (!content) {
    return <p className="text-slate-500 italic">Brak treści dokumentu</p>;
  }

  // Wyodrębnij dane z AI (priorytet: sessionInfo > llmAnalysis > document fields)
  const sessionNumber = doc.session_number || sessionInfo?.sessionNumber;
  const extractedDates = llmAnalysis?.extractedDates || [];
  const extractedEntities = llmAnalysis?.extractedEntities || [];

  // Data sesji: sessionInfo > pierwsza data z AI > normalized_publish_date
  const sessionDate =
    sessionInfo?.sessionDate ||
    extractedDates[0] ||
    doc.normalized_publish_date;
  const sessionTime = sessionInfo?.sessionTime;

  // Lokalizacja: sessionInfo > encja z AI zawierająca "sala/urząd/ośrodek"
  const sessionLocation =
    sessionInfo?.sessionLocation ||
    extractedEntities.find(
      (e) =>
        e.toLowerCase().includes("sala") ||
        e.toLowerCase().includes("urząd") ||
        e.toLowerCase().includes("ośrodek") ||
        e.toLowerCase().includes("budynek")
    );

  // Formatuj datę do czytelnej postaci
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Buduj sekcje dokumentu z danych AI
  const elements: React.ReactNode[] = [];

  // Nagłówek sesji (z numeru sesji z bazy)
  if (sessionNumber) {
    const romanNum = arabicToRoman(sessionNumber);
    elements.push(
      <div
        key="session-header"
        className="mb-6 p-4 rounded-xl bg-gradient-to-r from-primary-50 to-primary-100 border-2 border-primary-200"
      >
        <h2 className="text-2xl font-bold text-primary-800 flex items-center gap-2">
          🏛️ Sesja Nr {romanNum}
        </h2>
        {llmAnalysis?.summary && (
          <p className="mt-2 text-primary-700 text-sm">{llmAnalysis.summary}</p>
        )}
      </div>
    );
  }

  // Data i godzina (z AI)
  if (sessionDate || sessionTime) {
    const dateDisplay = formatDate(sessionDate);
    const timeDisplay = sessionTime ? `, godz. ${sessionTime}` : "";
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
            {dateDisplay}
            {timeDisplay}
          </p>
          <span className="text-xs text-blue-500">Źródło: analiza AI</span>
        </div>
      </div>
    );
  }

  // Miejsce (z AI)
  if (sessionLocation) {
    elements.push(
      <div
        key="place-section"
        className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border-l-4 border-green-400 mb-3"
      >
        <span className="text-2xl">📍</span>
        <div>
          <span className="text-sm text-green-600 font-medium">Miejsce</span>
          <p className="text-green-900 font-semibold">{sessionLocation}</p>
          <span className="text-xs text-green-500">Źródło: analiza AI</span>
        </div>
      </div>
    );
  }

  // Kluczowe tematy z AI
  if (llmAnalysis?.keyTopics && llmAnalysis.keyTopics.length > 0) {
    elements.push(
      <div key="topics" className="mb-4">
        <h3 className="text-sm font-medium text-slate-600 mb-2">
          🏷️ Kluczowe tematy (AI)
        </h3>
        <div className="flex flex-wrap gap-2">
          {llmAnalysis.keyTopics.map((topic, idx) => (
            <span
              key={idx}
              className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium"
            >
              {topic}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Wszystkie daty wyodrębnione przez AI
  if (extractedDates.length > 1) {
    elements.push(
      <div
        key="all-dates"
        className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200"
      >
        <h3 className="text-sm font-medium text-slate-600 mb-2">
          📆 Daty w dokumencie (AI)
        </h3>
        <div className="flex flex-wrap gap-2">
          {extractedDates.map((date, idx) => (
            <span
              key={idx}
              className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-xs font-mono"
            >
              {formatDate(date)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Treść dokumentu - prosty format bez regex parsowania
  elements.push(
    <div key="content" className="mt-6">
      <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-slate-200">
        📄 Treść dokumentu
      </h3>
      <div className="prose prose-slate max-w-none">
        {formatPlainText(content)}
      </div>
    </div>
  );

  return (
    <div className="document-content space-y-4 font-serif">{elements}</div>
  );
}

/**
 * Wzorce regex do FORMATOWANIA treści dokumentu (stylizacja, nie ekstrakcja danych)
 * Te regexy służą wyłącznie do wizualnego wyróżnienia elementów w tekście
 */
const FORMATTING_PATTERNS = {
  // Linki PDF z rozmiarem - kolorowanie na niebieski
  pdfLink: /\(PDF,?\s*[\d.,]+\s*[KMG]?[bB]?\)/gi,
  // Druki - kolorowanie na fioletowy
  druk: /\(\s*druk[i]?\s*(?:nr|numer)?\s*[\d,\s]+\)/gi,
  // Uchwały - kolorowanie na zielony
  uchwalaNumer: /Uchwała\s+Nr\s+[IVXLCDM]+\/\d+\/\d+/gi,
  // Projekt uchwały - etykieta
  projektUchwaly: /Projekt\s+uchwały:/gi,
  // Załączniki - kolorowanie
  zalacznik: /Załącznik[i]?\s+(?:nr|numer)?\s*[\d\-,\s]+/gi,
  // Numerowane punkty porządku obrad - pogrubienie
  numberedItem: /^(\d+[a-z]?)\.\s+/gm,
  // Separator stron
  pageSeparator: /---\s*Strona\s*\d+\s*---/gi,
};

/**
 * Funkcja formatująca fragment tekstu z kolorowaniem elementów
 */
function formatTextWithHighlights(text: string, key: string): React.ReactNode {
  // Tablica elementów do renderowania
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;

  // Znajdź wszystkie dopasowania i posortuj według pozycji
  const allMatches: Array<{
    start: number;
    end: number;
    text: string;
    type: string;
  }> = [];

  // PDF links
  let match;
  const pdfRegex = new RegExp(FORMATTING_PATTERNS.pdfLink.source, "gi");
  while ((match = pdfRegex.exec(text)) !== null) {
    allMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      type: "pdf",
    });
  }

  // Druki
  const drukRegex = new RegExp(FORMATTING_PATTERNS.druk.source, "gi");
  while ((match = drukRegex.exec(text)) !== null) {
    allMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      type: "druk",
    });
  }

  // Uchwały
  const uchwalaRegex = new RegExp(
    FORMATTING_PATTERNS.uchwalaNumer.source,
    "gi"
  );
  while ((match = uchwalaRegex.exec(text)) !== null) {
    allMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      type: "uchwala",
    });
  }

  // Projekt uchwały
  const projektRegex = new RegExp(
    FORMATTING_PATTERNS.projektUchwaly.source,
    "gi"
  );
  while ((match = projektRegex.exec(text)) !== null) {
    allMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      type: "projekt",
    });
  }

  // Załączniki
  const zalacznikRegex = new RegExp(FORMATTING_PATTERNS.zalacznik.source, "gi");
  while ((match = zalacznikRegex.exec(text)) !== null) {
    allMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      type: "zalacznik",
    });
  }

  // Sortuj według pozycji
  allMatches.sort((a, b) => a.start - b.start);

  // Usuń nakładające się dopasowania
  const filteredMatches: typeof allMatches = [];
  for (const m of allMatches) {
    const last = filteredMatches[filteredMatches.length - 1];
    if (!last || m.start >= last.end) {
      filteredMatches.push(m);
    }
  }

  // Zbuduj elementy
  for (const m of filteredMatches) {
    // Tekst przed dopasowaniem
    if (m.start > lastIndex) {
      elements.push(text.slice(lastIndex, m.start));
    }

    // Sformatowane dopasowanie
    const matchKey = `${key}-${matchIndex++}`;
    switch (m.type) {
      case "pdf":
        elements.push(
          <span
            key={matchKey}
            className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-sm font-medium mx-1"
            title="Załącznik PDF"
          >
            📄 {m.text}
          </span>
        );
        break;
      case "druk":
        elements.push(
          <span
            key={matchKey}
            className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-sm font-medium mx-1"
            title="Numer druku"
          >
            📋 {m.text}
          </span>
        );
        break;
      case "uchwala":
        elements.push(
          <span
            key={matchKey}
            className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 text-sm font-semibold mx-1"
            title="Numer uchwały"
          >
            📜 {m.text}
          </span>
        );
        break;
      case "projekt":
        elements.push(
          <span
            key={matchKey}
            className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-sm font-semibold mr-1"
          >
            📝 {m.text}
          </span>
        );
        break;
      case "zalacznik":
        elements.push(
          <span
            key={matchKey}
            className="inline-flex items-center px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 text-sm font-medium mx-1"
            title="Załącznik"
          >
            📎 {m.text}
          </span>
        );
        break;
      default:
        elements.push(m.text);
    }

    lastIndex = m.end;
  }

  // Pozostały tekst
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements.length > 0 ? elements : text;
}

/**
 * Profesjonalne formatowanie dokumentu urzędowego
 * Styl: czyste akapity, numerowane punkty, bez zbędnych nagłówków sekcji
 */
function formatPlainText(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];

  // Normalizuj tekst
  const normalizedText = text.replace(/\s+/g, " ").trim();

  // Wzorce dokumentu urzędowego
  const DOCUMENT_PATTERNS = {
    // Nagłówek sesji (Sesja Nr X)
    sessionHeader: /Sesja\s+Nr\s+[IVXLCDM]+/i,
    // Data posiedzenia
    dateInfo: /Data\s+posiedzenia\s+[\d\-.,]+(?:\s*,?\s*godz\.?\s*[\d:]+)?/i,
    // Miejsce posiedzenia
    placeInfo: /Miejsce\s+posiedzenia\s+[^0-9]+?(?=\s+(?:Porządek|1\.|$))/i,
    // Porządek obrad
    agendaHeader: /Porządek\s+obrad/i,
    // Numerowane punkty (1., 2., 6a., etc.)
    numberedPoint: /(\d+[a-z]?)\.\s+/g,
  };

  // Funkcja do kapitalizacji pierwszej litery
  const capitalizeFirst = (str: string): string => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Funkcja do podziału tekstu na logiczne bloki dokumentu
  const parseDocument = (txt: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    let remaining = txt;
    let keyIndex = 0;

    // 1. Wyodrębnij nagłówek sesji
    const sessionMatch = remaining.match(DOCUMENT_PATTERNS.sessionHeader);
    if (sessionMatch) {
      const sessionEnd =
        remaining.indexOf(sessionMatch[0]) + sessionMatch[0].length;
      const beforeSession = remaining
        .slice(0, remaining.indexOf(sessionMatch[0]))
        .trim();

      // Tekst przed sesją (jeśli jest)
      if (beforeSession && beforeSession.length > 10) {
        result.push(
          <p
            key={`pre-${keyIndex++}`}
            className="text-slate-600 text-sm mb-4 leading-relaxed"
          >
            {formatTextWithHighlights(beforeSession, `pre-${keyIndex}`)}
          </p>
        );
      }

      // Nagłówek sesji
      result.push(
        <div
          key={`session-${keyIndex++}`}
          className="text-center mb-6 pb-4 border-b border-slate-200"
        >
          <h3 className="text-xl font-bold text-slate-800 tracking-wide">
            {sessionMatch[0]}
          </h3>
        </div>
      );

      remaining = remaining.slice(sessionEnd).trim();
    }

    // 2. Wyodrębnij datę i miejsce
    const dateMatch = remaining.match(DOCUMENT_PATTERNS.dateInfo);
    const placeMatch = remaining.match(DOCUMENT_PATTERNS.placeInfo);

    if (dateMatch || placeMatch) {
      const metaItems: React.ReactNode[] = [];

      if (dateMatch) {
        metaItems.push(
          <div key="date" className="flex items-baseline gap-2">
            <span className="text-slate-500 text-sm min-w-[140px]">
              Data posiedzenia:
            </span>
            <span className="text-slate-800 font-medium">
              {dateMatch[0].replace(/Data\s+posiedzenia\s+/i, "")}
            </span>
          </div>
        );
        remaining = remaining.replace(dateMatch[0], "").trim();
      }

      if (placeMatch) {
        metaItems.push(
          <div key="place" className="flex items-baseline gap-2">
            <span className="text-slate-500 text-sm min-w-[140px]">
              Miejsce posiedzenia:
            </span>
            <span className="text-slate-800 font-medium">
              {placeMatch[0].replace(/Miejsce\s+posiedzenia\s+/i, "").trim()}
            </span>
          </div>
        );
        remaining = remaining.replace(placeMatch[0], "").trim();
      }

      if (metaItems.length > 0) {
        result.push(
          <div
            key={`meta-${keyIndex++}`}
            className="mb-6 pl-4 border-l-2 border-slate-300 space-y-1"
          >
            {metaItems}
          </div>
        );
      }
    }

    // 3. Wyodrębnij porządek obrad
    const agendaMatch = remaining.match(DOCUMENT_PATTERNS.agendaHeader);
    if (agendaMatch) {
      const agendaIndex = remaining.indexOf(agendaMatch[0]);

      // Tekst przed porządkiem
      const beforeAgenda = remaining.slice(0, agendaIndex).trim();
      if (beforeAgenda) {
        result.push(
          <p
            key={`before-agenda-${keyIndex++}`}
            className="text-slate-700 leading-7 mb-4"
          >
            {formatTextWithHighlights(
              capitalizeFirst(beforeAgenda),
              `ba-${keyIndex}`
            )}
          </p>
        );
      }

      // Nagłówek porządku obrad
      result.push(
        <h4
          key={`agenda-header-${keyIndex++}`}
          className="text-lg font-semibold text-slate-800 mt-6 mb-4"
        >
          Porządek obrad
        </h4>
      );

      remaining = remaining.slice(agendaIndex + agendaMatch[0].length).trim();
    }

    // 4. Przetwórz numerowane punkty
    const numberedRegex = /(\d+[a-z]?)\.\s+/g;
    const points: Array<{ num: string; content: string }> = [];
    let match;
    const matches: Array<{ index: number; num: string; length: number }> = [];

    // Znajdź wszystkie punkty
    while ((match = numberedRegex.exec(remaining)) !== null) {
      matches.push({
        index: match.index,
        num: match[1],
        length: match[0].length,
      });
    }

    // Wyodrębnij treść każdego punktu
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i].length;
      const end =
        i < matches.length - 1 ? matches[i + 1].index : remaining.length;
      const content = remaining.slice(start, end).trim();

      if (content) {
        points.push({ num: matches[i].num, content });
      }
    }

    // Tekst przed pierwszym punktem
    if (matches.length > 0 && matches[0].index > 0) {
      const beforeFirst = remaining.slice(0, matches[0].index).trim();
      if (beforeFirst) {
        result.push(
          <p
            key={`intro-${keyIndex++}`}
            className="text-slate-700 leading-7 mb-4"
          >
            {formatTextWithHighlights(
              capitalizeFirst(beforeFirst),
              `intro-${keyIndex}`
            )}
          </p>
        );
      }
    }

    // Renderuj punkty
    if (points.length > 0) {
      result.push(
        <ol key={`points-${keyIndex++}`} className="space-y-3 mb-6">
          {points.map((point, idx) => (
            <li key={`point-${idx}`} className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold flex items-center justify-center text-sm border border-slate-200">
                {point.num}
              </span>
              <div className="flex-1 text-slate-700 leading-relaxed pt-1">
                {formatTextWithHighlights(
                  capitalizeFirst(point.content),
                  `pt-${idx}`
                )}
              </div>
            </li>
          ))}
        </ol>
      );

      // Usuń przetworzone punkty
      if (matches.length > 0) {
        remaining = "";
      }
    }

    // 5. Pozostały tekst jako akapity
    if (remaining.trim()) {
      // Podziel na zdania i grupuj w akapity
      const sentences = remaining
        .split(/(?<=[.!?])\s+/)
        .filter((s) => s.trim());
      let currentParagraph: string[] = [];

      const flushParagraph = () => {
        if (currentParagraph.length > 0) {
          const text = currentParagraph.join(" ").trim();
          if (text) {
            result.push(
              <p
                key={`p-${keyIndex++}`}
                className="text-slate-700 leading-7 mb-4 text-justify"
              >
                {formatTextWithHighlights(
                  capitalizeFirst(text),
                  `p-${keyIndex}`
                )}
              </p>
            );
          }
          currentParagraph = [];
        }
      };

      for (const sentence of sentences) {
        if (currentParagraph.join(" ").length + sentence.length > 400) {
          flushParagraph();
        }
        currentParagraph.push(sentence);
      }
      flushParagraph();
    }

    return result;
  };

  // Przetwórz dokument
  const parsed = parseDocument(normalizedText);
  elements.push(...parsed);

  // Fallback - jeśli nic nie zostało sparsowane
  if (elements.length === 0 && normalizedText) {
    elements.push(
      <p key="fallback" className="text-slate-700 leading-7 text-justify">
        {formatTextWithHighlights(normalizedText, "fallback")}
      </p>
    );
  }

  return elements;
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [relatedDocs, setRelatedDocs] = useState<RelatedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [relatedDocsExpanded, setRelatedDocsExpanded] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);

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

        // Pobierz powiązane dokumenty
        const related = await getRelatedDocuments(documentId);
        setRelatedDocs(related);
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

      {/* Nagłówek dokumentu, miejsce i czas */}
      {(() => {
        const sessionInfo = document.metadata?.sessionInfo;
        const llmAnalysis = document.metadata?.llmAnalysis;
        const content = document.content || "";

        // Numer sesji
        const sessionNumber =
          document.session_number || sessionInfo?.sessionNumber;

        // Wyciągnij datę i godzinę z treści dokumentu (obsługa różnych formatów)
        const dateMatch = content.match(
          /Data\s+posiedzenia[:\s]*[\n\r\s]*(\d{1,2}[-./]\d{1,2}[-./]\d{4})/i
        );
        const timeMatch = content.match(/godz\.?\s*(\d{1,2}[:.]\d{2})/i);
        // Miejsce - wyciągnij adres, przytnij przy "Porządek obrad" lub numerze punktu
        const placeRaw = content.match(
          /Miejsce\s+posiedzenia[:\s]*[\n\r\s]*([^]+?)(?=\s*Porządek\s+obrad|\s*1\.\s+[A-Z])/i
        );
        const placeMatch = placeRaw
          ? [placeRaw[0], placeRaw[1].replace(/\s+/g, " ").trim()]
          : null;

        const sessionDate =
          sessionInfo?.sessionDate ||
          llmAnalysis?.extractedDates?.[0] ||
          (dateMatch ? dateMatch[1] : null) ||
          document.normalized_publish_date;

        const sessionTime =
          sessionInfo?.sessionTime || (timeMatch ? timeMatch[1] : null);

        const sessionLocation =
          sessionInfo?.sessionLocation ||
          (placeMatch ? placeMatch[1].trim() : null) ||
          llmAnalysis?.extractedEntities?.find(
            (e: string) =>
              e.toLowerCase().includes("sala") ||
              e.toLowerCase().includes("urząd") ||
              e.toLowerCase().includes("ośrodek")
          );

        return sessionNumber || sessionDate || sessionLocation ? (
          <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl border border-primary-200 p-5">
            {sessionNumber && (
              <h2 className="text-xl font-bold text-primary-800 mb-3">
                🏛️ Sesja Nr {arabicToRoman(sessionNumber)}
              </h2>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              {sessionDate && (
                <div className="flex items-center gap-2">
                  <span className="text-primary-600">📅</span>
                  <span className="text-primary-800 font-medium">
                    {(() => {
                      try {
                        return new Date(sessionDate).toLocaleDateString(
                          "pl-PL",
                          {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          }
                        );
                      } catch {
                        return sessionDate;
                      }
                    })()}
                    {sessionTime && `, godz. ${sessionTime}`}
                  </span>
                </div>
              )}
              {sessionLocation && (
                <div className="flex items-center gap-2">
                  <span className="text-primary-600">📍</span>
                  <span className="text-primary-800 font-medium">
                    {sessionLocation}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : null;
      })()}

      {/* Tematy porządku obrad */}
      {(() => {
        // Wyciągnij punkty porządku obrad z treści dokumentu
        const content = document.content || "";
        const points: Array<{
          num: string;
          title: string;
          isSubpoint: boolean;
        }> = [];

        // Funkcja do czyszczenia tytułu - tylko esencja tematu
        const cleanTitle = (raw: string): string => {
          let title = raw.trim();

          // Przytnij przy pierwszym wystąpieniu wzorców technicznych
          const cutPatterns = [
            /,?\s*📋/, // emoji druku
            /,?\s*📄/, // emoji PDF
            /,?\s*📝/, // emoji projektu
            /,?\s*📜/, // emoji uchwały
            /\s*\(druk/i, // (druk nr X)
            /\s*\(PDF/i, // (PDF, XXKb)
            /\s*Projekt\s+uchwały/i, // Projekt uchwały:
            /\s*Uchwała:/i, // Uchwała:
            /\s*Uchwała\s+Nr/i, // Uchwała Nr
          ];

          for (const pattern of cutPatterns) {
            const idx = title.search(pattern);
            if (idx > 10) {
              title = title.slice(0, idx);
              break;
            }
          }

          // Ogranicz długość
          if (title.length > 100) {
            title = title.slice(0, 100).trim() + "...";
          }

          return title.trim();
        };

        // Znajdź główne punkty (1., 2., 3., etc.)
        const mainRegex =
          /(?:^|\s)(\d+)\.\s+([A-ZĄĆĘŁŃÓŚŹŻ][^\d]{5,}?)(?=\s+\d+[a-z]?\.|\s*$)/g;
        let match;
        while ((match = mainRegex.exec(content)) !== null) {
          const title = cleanTitle(match[2]);
          if (title.length > 5) {
            points.push({ num: match[1], title, isSubpoint: false });
          }
        }

        // Znajdź podpunkty (3a., 3b., 3c., etc.) - to są tematy uchwał
        const subRegex =
          /(\d+[a-z])\.\s+([a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ][^,\n]{10,}?)(?:,|\s+\(druk)/gi;
        while ((match = subRegex.exec(content)) !== null) {
          const title = cleanTitle(match[2]);
          if (title.length > 10) {
            points.push({ num: match[1], title, isSubpoint: true });
          }
        }

        // Sortuj po numerze
        points.sort((a, b) => {
          const numA = parseFloat(
            a.num.replace(/[a-z]/g, (c) => "." + (c.charCodeAt(0) - 96))
          );
          const numB = parseFloat(
            b.num.replace(/[a-z]/g, (c) => "." + (c.charCodeAt(0) - 96))
          );
          return numA - numB;
        });

        // Filtruj duplikaty
        const uniquePoints = points
          .filter((p, idx) => points.findIndex((x) => x.num === p.num) === idx)
          .slice(0, 20);

        return uniquePoints.length > 0 ? (
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-5">
            <h2 className="text-base font-semibold text-slate-700 mb-3">
              📋 Porządek obrad — tematy
            </h2>
            <ol className="space-y-1.5 text-sm">
              {uniquePoints.map((point, idx) => (
                <li
                  key={idx}
                  className={`flex gap-2 text-slate-600 ${
                    point.isSubpoint ? "ml-6" : ""
                  }`}
                >
                  <span
                    className={`font-semibold min-w-[32px] ${
                      point.isSubpoint ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {point.num}.
                  </span>
                  <span>{point.title}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : document.summary ? (
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-5">
            <h2 className="text-base font-semibold text-slate-700 mb-2">
              📋 Kontekst dokumentu
            </h2>
            <p className="text-slate-600 leading-relaxed text-sm">
              {document.summary}
            </p>
          </div>
        ) : null;
      })()}

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

      {/* Related Documents */}
      {relatedDocs.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6">
          <button
            onClick={() => setRelatedDocsExpanded(!relatedDocsExpanded)}
            className="flex items-center gap-2 mb-4 w-full hover:opacity-80 transition-opacity"
          >
            <FileText className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-bold text-amber-800">
              📎 Powiązane dokumenty ({relatedDocs.length})
            </h2>
            <ChevronDown
              className={`h-5 w-5 text-amber-600 ml-auto transition-transform ${
                relatedDocsExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
          {relatedDocsExpanded && (
            <div className="space-y-3">
              {relatedDocs.map((rel) => (
                <Link
                  key={rel.document_id}
                  href={`/documents/${rel.document_id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-white border border-amber-200 hover:border-amber-400 hover:shadow-md transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate group-hover:text-amber-700">
                      {rel.document?.title || "Dokument"}
                    </div>
                    {rel.document?.filename && (
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        📄 {rel.document.filename}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                        {rel.relation_types[0] === "references" && "Referencja"}
                        {rel.relation_types[0] === "attachment" && "Załącznik"}
                        {rel.relation_types[0] === "amends" && "Zmienia"}
                        {rel.relation_types[0] === "supersedes" && "Zastępuje"}
                        {rel.relation_types[0] === "related" && "Powiązany"}
                        {![
                          "references",
                          "attachment",
                          "amends",
                          "supersedes",
                          "related",
                        ].includes(rel.relation_types[0]) &&
                          rel.relation_types[0]}
                      </span>
                      {rel.document?.document_type && (
                        <span className="text-slate-400">
                          {rel.document.document_type}
                        </span>
                      )}
                      <span className="text-slate-400">
                        Siła: {Math.round(rel.total_strength * 100)}%
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-amber-600 flex-shrink-0 ml-2" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content - zwijana sekcja */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <button
          onClick={() => setContentExpanded(!contentExpanded)}
          className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-text-secondary" />
            <h2 className="text-lg font-bold">Pełna treść dokumentu</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">
              {contentExpanded ? "Zwiń" : "Rozwiń"}
            </span>
            <ChevronDown
              className={`h-5 w-5 text-slate-500 transition-transform ${
                contentExpanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {contentExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex justify-end mb-3">
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
              <FormattedDocumentContent document={document} />
            </div>
          </div>
        )}
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
