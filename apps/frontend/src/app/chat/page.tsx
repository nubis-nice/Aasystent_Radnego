"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Send,
  Bot,
  User,
  FileText,
  Sparkles,
  Loader2,
  Download,
  FileDown,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Search,
  TrendingUp,
  ExternalLink,
  Zap,
} from "lucide-react";
import { sendMessage, getConversation } from "@/lib/api/chat";
import { performResearch } from "@/lib/api/deep-research";
import { supabase } from "@/lib/supabase/client";
import type { ResearchResult } from "@shared/types/deep-research";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import {
  exportToPDF,
  exportConversationToPDF,
} from "@/lib/export/pdf-exporter";
import {
  exportToDOCX,
  exportConversationToDOCX,
} from "@/lib/export/docx-exporter";
import {
  exportToRTF,
  exportConversationToRTF,
} from "@/lib/export/rtf-exporter";
import { DocumentUploadButton } from "@/components/chat/DocumentUploadButton";
import { YouTubeSessionTool } from "@/components/chat/YouTubeSessionTool";
import { SystemStatus } from "@/components/chat/SystemStatus";
import { VoiceButton } from "@/components/voice/VoiceButton";
import { useVoice } from "@/contexts/VoiceContext";
import { useToolMode } from "@/hooks/useToolMode";
import { ToolPanel } from "@/components/chat/tools/ToolPanel";
import { isValidToolType, type ToolType } from "@/config/tools-config";
import { useRouter } from "next/navigation";

interface Citation {
  documentId?: string;
  documentTitle: string;
  page?: number;
  text: string;
  relevanceScore?: number;
}

interface AnalysisCategory {
  type: "legal" | "search" | "budget";
  label: string;
  confidence: number;
}

interface LegalBasis {
  title: string;
  reference: string;
  url?: string;
  excerpt?: string;
  jurisdiction?: string;
}

interface ResearchExpansion {
  summary: string;
  keyFindings: string[];
  legalBases: LegalBasis[];
  sources: { name: string; url: string; relevance: number }[];
  confidence: number;
}

// Sugestie następnych kroków
interface NextStepSuggestion {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  category: "legal" | "financial" | "report" | "search" | "action" | "calendar";
  isPrimary?: boolean; // Czy to główna sugestia (z propozycji w tekście)
  toolType?: ToolType; // Typ narzędzia do otwarcia modalu
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  categories?: AnalysisCategory[];
  expansion?: ResearchExpansion;
  isExpanding?: boolean;
  nextSteps?: NextStepSuggestion[];
}

interface ApiError {
  message: string;
  code?: string;
  details?: string;
  billingUrl?: string;
  settingsUrl?: string;
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "# Witaj! 👋\n\nJestem **Asystentem Radnego**. Mogę pomóc Ci w:\n\n- 📄 Analizie dokumentów i uchwał\n- 📝 Tworzeniu protokołów i dokumentacji\n- 🏛️ Odpowiadaniu na pytania o sprawy samorządowe\n- 📊 Przygotowywaniu raportów i podsumowań\n\n**Jak mogę Ci dzisiaj pomóc?**",
      citations: [],
    },
  ]);
  const searchParams = useSearchParams();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [showYouTubeTool, setShowYouTubeTool] = useState(false);
  const router = useRouter();

  // Hook do zarządzania narzędziami
  const toolMode = useToolMode();

  // Funkcja ładowania konwersacji (dostępna przed efektami, aby uniknąć odwołania przed inicjalizacją)
  async function loadConversation(id: string) {
    try {
      setLoading(true);
      const data = await getConversation(id);

      // Załaduj wiadomości z konwersacji
      const loadedMessages: Message[] = data.conversation.messages.map(
        (msg) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          citations: msg.citations || [],
        }),
      );

      setMessages(loadedMessages);
      setConversationId(id);
    } catch (err) {
      console.error("Error loading conversation:", err);
      setError({
        message: "Nie udało się załadować konwersacji",
      });
    } finally {
      setLoading(false);
    }
  }

  // Globalny kontekst głosowy
  const voiceContext = useVoice();
  const { pendingMessage, clearPendingMessage } = voiceContext;
  const [showSidebar, setShowSidebar] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chatSidebarVisible");
      return saved !== null ? saved === "true" : false;
    }
    return false;
  });

  // Opcje kontekstu (domyślnie włączone)
  const [includeDocuments] = useState(true);
  const [includeMunicipalData] = useState(true);

  // Elementy kontekstu z localStorage (np. sesje YouTube)
  interface ContextItem {
    type: string;
    id: string;
    title: string;
    url?: string;
    publishedAt?: string;
    addedAt: string;
  }
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);

  // Ładuj kontekst z localStorage
  useEffect(() => {
    const loadContext = () => {
      const saved = localStorage.getItem("chat_context_items");
      if (saved) {
        setContextItems(JSON.parse(saved));
      }
    };
    loadContext();
    // Nasłuchuj zmian w localStorage
    window.addEventListener("storage", loadContext);
    return () => window.removeEventListener("storage", loadContext);
  }, []);

  // Nasłuch na zdarzenie presetów z dashboardu (chat-preset)
  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      const preset = customEvent.detail?.message;
      if (preset) {
        setMessage(preset + " ");
        // auto-fokus na polu input (jeśli istnieje)
        const input = document.querySelector<HTMLInputElement>(
          "textarea, input[type='text']",
        );
        input?.focus();
      }
    };

    window.addEventListener("chat-preset", handler as EventListener);
    return () =>
      window.removeEventListener("chat-preset", handler as EventListener);
  }, []);

  // Wczytaj konwersację przekazaną w URL (?conversation=<id>)
  useEffect(() => {
    const convId = searchParams.get("conversation");
    if (convId) {
      loadConversation(convId);
    }
  }, [searchParams]);

  // Obsługa parametru ?tool= z URL (aktywacja narzędzia)
  useEffect(() => {
    const toolParam = searchParams.get("tool");
    // Sprawdź czy narzędzie nie jest już aktywne (zapobiega nieskończonej pętli)
    if (toolParam && isValidToolType(toolParam) && !toolMode.state.isActive) {
      toolMode.activateTool(toolParam as ToolType);
      // Wyczyść parametr z URL bez przeładowania strony
      router.replace("/chat", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Obsługa wiadomości głosowych z VoiceContext (gdy użytkownik przychodzi z innej strony)
  useEffect(() => {
    if (pendingMessage && pendingMessage.transcription) {
      // Automatycznie wstaw transkrypcję do pola wiadomości
      setMessage(pendingMessage.transcription);
      clearPendingMessage();
    }
  }, [pendingMessage, clearPendingMessage]);

  // Usuń element z kontekstu
  const removeContextItem = (id: string) => {
    const updated = contextItems.filter((item) => item.id !== id);
    setContextItems(updated);
    localStorage.setItem("chat_context_items", JSON.stringify(updated));
  };

  // Wyczyść cały kontekst
  const clearContext = () => {
    setContextItems([]);
    localStorage.removeItem("chat_context_items");
  };

  // Modal dokumentu źródłowego
  const [documentModal, setDocumentModal] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
    url?: string;
    type: "rag" | "web";
  }>({ isOpen: false, title: "", content: "", type: "rag" });

  // Otwórz modal z dokumentem po ID
  const openDocumentById = async (documentId: string, title?: string) => {
    setDocumentModal({
      isOpen: true,
      title: title || "Dokument",
      content: "Ładowanie treści...",
      url: undefined,
      type: "rag",
    });

    try {
      const token = localStorage.getItem("supabase_access_token");
      const response = await fetch(`/api/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDocumentModal({
          isOpen: true,
          title: data.title || title || "Dokument",
          content: data.content || "Brak treści",
          url: data.sourceUrl,
          type: "rag",
        });
      } else {
        setDocumentModal((prev) => ({
          ...prev,
          content: "Nie udało się załadować dokumentu.",
        }));
      }
    } catch (e) {
      console.error("Error loading document:", e);
      setDocumentModal((prev) => ({
        ...prev,
        content: "Błąd podczas ładowania dokumentu.",
      }));
    }
  };

  // Custom components dla ReactMarkdown
  const markdownComponents = {
    // Ulepszone tabele z responsywnym scrollem i lepszym stylem
    table: ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
      <div className="my-4 overflow-x-auto rounded-lg border border-secondary-200 shadow-sm">
        <table className="min-w-full divide-y divide-secondary-200" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLTableSectionElement>) => (
      <thead className="bg-secondary-100" {...props}>
        {children}
      </thead>
    ),
    th: ({
      children,
      ...props
    }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
      <th
        className="px-4 py-3 text-left text-xs font-semibold text-secondary-700 uppercase tracking-wider border-b border-secondary-200"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({
      children,
      ...props
    }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
      <td
        className="px-4 py-3 text-sm text-text border-b border-secondary-100 whitespace-normal"
        {...props}
      >
        {children}
      </td>
    ),
    tr: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
      <tr className="hover:bg-secondary-50 transition-colors" {...props}>
        {children}
      </tr>
    ),
    // Linki - sprawdź czy to link do dokumentu i otwórz w modalu
    a: ({
      href,
      children,
      ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      // Sprawdź czy to link do dokumentu (pattern: /documents/UUID lub doc:UUID)
      const docMatch = href?.match(/(?:\/documents\/|doc:)([a-f0-9-]{36})/i);

      if (docMatch) {
        const documentId = docMatch[1];
        return (
          <button
            onClick={() => openDocumentById(documentId, String(children))}
            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 underline underline-offset-2 font-medium cursor-pointer"
            title="Otwórz dokument"
          >
            <FileText className="h-3 w-3" />
            {children}
          </button>
        );
      }

      // Zwykły link zewnętrzny
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 hover:text-primary-800 underline underline-offset-2"
          {...props}
        >
          {children}
          <ExternalLink className="inline h-3 w-3 ml-1" />
        </a>
      );
    },
  };

  // Otwórz modal z dokumentem
  const openDocumentModal = async (citation: Citation) => {
    setDocumentModal({
      isOpen: true,
      title: citation.documentTitle,
      content: citation.text || "Ładowanie treści...",
      url: undefined,
      type: "rag",
    });

    // Jeśli mamy documentId, pobierz pełną treść
    if (citation.documentId) {
      try {
        const token = localStorage.getItem("supabase_access_token");
        const response = await fetch(`/api/documents/${citation.documentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setDocumentModal((prev) => ({
            ...prev,
            content: data.content || citation.text,
            url: data.sourceUrl,
          }));
        }
      } catch (e) {
        console.error("Error loading document:", e);
      }
    }
  };

  // Generuj sugestie następnych kroków na podstawie kontekstu
  const generateNextSteps = (
    content: string,
    _categories?: AnalysisCategory[],
  ): { primary: NextStepSuggestion[]; secondary: NextStepSuggestion[] } => {
    const primarySuggestions: NextStepSuggestion[] = [];
    const secondarySuggestions: NextStepSuggestion[] = [];
    const contentLower = content.toLowerCase();
    const categoryTypes = new Set<string>(
      (_categories || []).map((category) => category.type),
    );

    // ═══════════════════════════════════════════════════════════════════════
    // GŁÓWNE SUGESTIE - bazowane na propozycjach z tekstu AI
    // ═══════════════════════════════════════════════════════════════════════

    // Projekt uchwały - jeśli wspomniany w tekście
    if (
      contentLower.includes("projekt uchwały") ||
      contentLower.includes("projektu uchwały") ||
      contentLower.includes("uchwał")
    ) {
      primarySuggestions.push({
        id: "resolution-draft",
        label: "Projekt uchwały",
        icon: "📝",
        prompt:
          "Przygotuj projekt uchwały w tej sprawie. Uwzględnij: tytuł, podstawę prawną, treść merytoryczną i uzasadnienie.",
        category: "legal",
        isPrimary: true,
        toolType: "resolution",
      });
    }

    // Szablon raportu - jeśli wspomniany w tekście
    if (
      contentLower.includes("szablon raportu") ||
      contentLower.includes("raport") ||
      contentLower.includes("kontroli") ||
      contentLower.includes("komisji rewizyjnej")
    ) {
      primarySuggestions.push({
        id: "report-template",
        label: "Szablon raportu",
        icon: "📋",
        prompt:
          "Wygeneruj szablon raportu kontroli zawierający: nagłówek, zakres kontroli, ustalenia, wnioski i rekomendacje.",
        category: "report",
        isPrimary: true,
        toolType: "report",
      });
    }

    // Przypomnienie w kalendarzu - jeśli wspomniane terminy
    if (
      contentLower.includes("kalendarz") ||
      contentLower.includes("termin") ||
      contentLower.includes("przypomni") ||
      contentLower.includes("data") ||
      contentLower.match(/\d{1,2}[./]\d{1,2}[./]\d{4}/) ||
      contentLower.match(
        /styczeń|luty|marzec|kwiecień|maj|czerwiec|lipiec|sierpień|wrzesień|październik|listopad|grudzień/i,
      )
    ) {
      primarySuggestions.push({
        id: "calendar-reminder",
        label: "Przypomnienie w kalendarzu",
        icon: "📅",
        prompt:
          "Dodaj przypomnienia o kluczowych terminach z powyższego dokumentu do mojego kalendarza.",
        category: "calendar",
        isPrimary: true,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DODATKOWE SUGESTIE - kontekstowe narzędzia
    // ═══════════════════════════════════════════════════════════════════════

    // Analiza prawna
    if (
      contentLower.includes("uchwał") ||
      contentLower.includes("sesj") ||
      contentLower.includes("rada") ||
      categoryTypes.has("legal")
    ) {
      secondarySuggestions.push({
        id: "legal-analysis",
        label: "Analiza prawna uchwały",
        icon: "⚖️",
        prompt:
          "Przeprowadź szczegółową analizę prawną tej uchwały, sprawdź zgodność z obowiązującymi przepisami i wskaż potencjalne ryzyka prawne.",
        category: "legal",
        toolType: "resolution",
      });
    }

    // Kontrola budżetowa
    if (
      contentLower.includes("budżet") ||
      contentLower.includes("wydatk") ||
      contentLower.includes("finans") ||
      categoryTypes.has("budget")
    ) {
      secondarySuggestions.push({
        id: "budget-control",
        label: "Kontrola rozliczeń budżetowych",
        icon: "💰",
        prompt:
          "Wykonaj szczegółową kontrolę rozliczeń budżetowych. Sprawdź zgodność wydatków z planem, przeanalizuj odchylenia i wskaż nieprawidłowości.",
        category: "financial",
        toolType: "budget",
      });
    }

    // Pełny raport
    if (
      contentLower.includes("dokument") ||
      contentLower.includes("protokół") ||
      categoryTypes.has("report")
    ) {
      secondarySuggestions.push({
        id: "full-report",
        label: "Pełny raport analizy",
        icon: "📊",
        prompt:
          "Przygotuj pełny, profesjonalny raport analizy zawierający: streszczenie wykonawcze, szczegółowe ustalenia, rekomendacje i wnioski końcowe.",
        category: "report",
        toolType: "report",
      });
    }

    // Interpelacja
    if (
      contentLower.includes("interpelacj") ||
      contentLower.includes("zapytani") ||
      contentLower.includes("wnios")
    ) {
      secondarySuggestions.push({
        id: "interpellation",
        label: "Przygotuj interpelację",
        icon: "✍️",
        prompt:
          "Przygotuj projekt interpelacji lub zapytania radnego w tej sprawie.",
        category: "legal",
        toolType: "interpelation",
      });
    }

    // Pogłębione wyszukiwanie
    secondarySuggestions.push({
      id: "deep-search",
      label: "Pogłębione wyszukiwanie",
      icon: "🔍",
      prompt:
        "Przeprowadź pogłębione wyszukiwanie w dostępnych dokumentach i bazach danych.",
      category: "search",
    });

    // Zweryfikowane wyszukiwanie internetowe
    secondarySuggestions.push({
      id: "verified-search",
      label: "Zweryfikuj w internecie",
      icon: "✅",
      prompt:
        "Zweryfikuj tę informację w internecie. Sprawdź wiarygodność źródeł i wykryj potencjalne fake newsy.",
      category: "search",
    });

    // Plan działania
    secondarySuggestions.push({
      id: "action-plan",
      label: "Plan działania radnego",
      icon: "📋",
      prompt:
        "Przygotuj konkretny plan działania radnego: kroki do wykonania, terminy i sposób monitorowania.",
      category: "action",
    });

    // Wystąpienie na sesji
    secondarySuggestions.push({
      id: "session-speech",
      label: "Wystąpienie na sesji",
      icon: "🎤",
      prompt:
        "Przygotuj projekt wystąpienia radnego na sesji Rady w tej sprawie.",
      category: "report",
      toolType: "speech",
    });

    // Podstawa prawna
    secondarySuggestions.push({
      id: "legal-basis",
      label: "Podstawa prawna",
      icon: "📜",
      prompt:
        "Wskaż podstawę prawną w tej sprawie: właściwe ustawy, rozporządzenia i uchwały.",
      category: "legal",
    });

    // Usuń duplikaty z secondary które są już w primary
    const primaryIds = new Set(primarySuggestions.map((s) => s.id));
    const filteredSecondary = secondarySuggestions.filter(
      (s) => !primaryIds.has(s.id),
    );

    // Jeśli brak głównych sugestii, przenieś pierwsze 3 z dodatkowych
    if (primarySuggestions.length === 0) {
      return {
        primary: filteredSecondary.slice(0, 3),
        secondary: filteredSecondary.slice(3),
      };
    }

    return {
      primary: primarySuggestions.slice(0, 3),
      secondary: filteredSecondary.slice(0, 6),
    };
  };

  // Stan dla rozwijanej listy dodatkowych narzędzi
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // Buduje kontekstowy prompt na podstawie narzędzia i kontekstu rozmowy
  const buildContextualPrompt = (
    step: NextStepSuggestion,
    conversationContext: string,
    userQuestion?: string,
  ): string => {
    // Wyciągnij kluczowe informacje z kontekstu (np. numer sesji, uchwały)
    const sessionMatch = conversationContext.match(
      /sesj[aięy]\s*(?:nr|numer)?\s*\.?\s*([IVXLCDM]+|\d+)/i,
    );
    const resolutionMatch = conversationContext.match(
      /uchwa[łl][ayę]?\s*(?:nr|numer)?\s*\.?\s*([IVXLCDM\/\d]+)/i,
    );
    const topicMatch = conversationContext.match(
      /(?:w\s+sprawie|dotyczy|temat)[:.]?\s*([^.]+)/i,
    );

    // Zbuduj kontekst
    const contextParts: string[] = [];
    if (sessionMatch) contextParts.push(`sesji nr ${sessionMatch[1]}`);
    if (resolutionMatch) contextParts.push(`uchwały nr ${resolutionMatch[1]}`);
    if (topicMatch) contextParts.push(`sprawy: ${topicMatch[1].trim()}`);

    const contextSummary =
      contextParts.length > 0
        ? `Kontekst: ${contextParts.join(", ")}. `
        : userQuestion
          ? `Na podstawie pytania: "${userQuestion}". `
          : "";

    // Dostosuj prompt narzędzia do kontekstu
    switch (step.id) {
      case "resolution-draft":
        return `${contextSummary}Przygotuj projekt uchwały${sessionMatch ? ` dla sesji ${sessionMatch[1]}` : ""}. Uwzględnij: tytuł, podstawę prawną, treść merytoryczną i uzasadnienie.`;

      case "report-template":
        return `${contextSummary}Wygeneruj szablon raportu kontroli zawierający: nagłówek, zakres kontroli, ustalenia, wnioski i rekomendacje.`;

      case "calendar-reminder":
        return `${contextSummary}Dodaj przypomnienia o kluczowych terminach do kalendarza.`;

      case "legal-analysis":
        return `${contextSummary}Przeprowadź szczegółową analizę prawną${resolutionMatch ? ` uchwały ${resolutionMatch[1]}` : ""}, sprawdź zgodność z obowiązującymi przepisami i wskaż potencjalne ryzyka prawne.`;

      case "budget-control":
        return `${contextSummary}Wykonaj szczegółową kontrolę rozliczeń budżetowych. Sprawdź zgodność wydatków z planem, przeanalizuj odchylenia i wskaż nieprawidłowości.`;

      case "full-report":
        return `${contextSummary}Przygotuj pełny, profesjonalny raport analizy zawierający: streszczenie wykonawcze, szczegółowe ustalenia, rekomendacje i wnioski końcowe.`;

      case "interpellation":
        return `${contextSummary}Przygotuj projekt interpelacji lub zapytania radnego w tej sprawie.`;

      case "deep-search":
        return `${contextSummary}Przeprowadź pogłębione wyszukiwanie w dostępnych dokumentach i bazach danych.`;

      case "verified-search":
        return `${contextSummary}Zweryfikuj tę informację w internecie. Sprawdź wiarygodność źródeł, wykryj potencjalne fake newsy i porównaj informacje z wielu źródeł.`;

      case "action-plan":
        return `${contextSummary}Przygotuj konkretny plan działania radnego: kroki do wykonania, terminy i sposób monitorowania.`;

      case "session-speech":
        return `${contextSummary}Przygotuj projekt wystąpienia radnego na sesji Rady${sessionMatch ? ` nr ${sessionMatch[1]}` : ""}.`;

      case "legal-basis":
        return `${contextSummary}Wskaż podstawę prawną: właściwe ustawy, rozporządzenia i uchwały.`;

      default:
        return `${contextSummary}${step.prompt}`;
    }
  };

  // Znajdź ostatnie pytanie użytkownika przed daną wiadomością
  const getLastUserQuestion = (beforeMessageId: string): string | undefined => {
    const msgIndex = messages.findIndex((m) => m.id === beforeMessageId);
    if (msgIndex <= 0) return undefined;

    // Szukaj wstecz ostatniej wiadomości użytkownika
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        return messages[i].content;
      }
    }
    return undefined;
  };

  // Eksport
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Zwijanie źródeł - domyślnie zwinięte
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(),
  );

  // Zwijanie długich wiadomości - domyślnie zwinięte
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set(),
  );

  const toggleSources = (messageId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const toggleMessageExpand = (messageId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  // Sprawdź czy wiadomość jest długa (>8 linii)
  const isLongMessage = (content: string): boolean => {
    const lines = content.split("\n").length;
    const chars = content.length;
    return lines > 8 || chars > 800;
  };

  // Skróć wiadomość do pierwszych 8 linii
  const truncateMessage = (content: string): string => {
    const lines = content.split("\n");
    if (lines.length > 8) {
      return lines.slice(0, 8).join("\n") + "\n...";
    }
    if (content.length > 800) {
      return content.slice(0, 800) + "...";
    }
    return content;
  };

  // Funkcja wykrywania kategorii analizy na podstawie zapytania
  const detectCategories = (query: string): AnalysisCategory[] => {
    const categories: AnalysisCategory[] = [];
    const lowerQuery = query.toLowerCase();

    // Wykrywanie analizy prawnej
    const legalKeywords = [
      "prawo",
      "prawne",
      "ustaw",
      "uchwał",
      "legaln",
      "zgodn",
      "przepis",
      "regulac",
      "rozporządz",
    ];
    const legalScore = legalKeywords.filter((k) =>
      lowerQuery.includes(k),
    ).length;
    if (legalScore > 0) {
      categories.push({
        type: "legal",
        label: "Analiza prawna",
        confidence: Math.min(legalScore * 0.3, 1),
      });
    }

    // Wykrywanie wyszukiwania
    const searchKeywords = [
      "znajdź",
      "wyszukaj",
      "pokaż",
      "jakie",
      "gdzie",
      "kiedy",
      "kto",
      "dokumenty",
      "lista",
    ];
    const searchScore = searchKeywords.filter((k) =>
      lowerQuery.includes(k),
    ).length;
    if (searchScore > 0) {
      categories.push({
        type: "search",
        label: "Wyszukiwanie",
        confidence: Math.min(searchScore * 0.25, 1),
      });
    }

    // Wykrywanie analizy budżetowej
    const budgetKeywords = [
      "budżet",
      "finans",
      "wydatk",
      "dochod",
      "środk",
      "kwot",
      "koszt",
      "wpf",
      "wielolet",
    ];
    const budgetScore = budgetKeywords.filter((k) =>
      lowerQuery.includes(k),
    ).length;
    if (budgetScore > 0) {
      categories.push({
        type: "budget",
        label: "Analiza budżetowa",
        confidence: Math.min(budgetScore * 0.3, 1),
      });
    }

    return categories.sort((a, b) => b.confidence - a.confidence);
  };

  // Funkcja rozbudowy odpowiedzi z Deep Research
  const expandWithResearch = async (messageId: string, query: string) => {
    // Oznacz wiadomość jako rozbudowywaną
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isExpanding: true } : msg,
      ),
    );

    try {
      // Pobierz token autoryzacji
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Brak autoryzacji");
      }

      // Wykonaj Deep Research
      const report = await performResearch(
        {
          query: `Podstawy prawne i weryfikacja: ${query}`,
          researchType: "legal",
          depth: "standard",
          maxResults: 10,
        },
        session.access_token,
      );

      // Wyodrębnij podstawy prawne z wyników
      const legalBases: LegalBasis[] = report.results
        .filter(
          (r: ResearchResult) =>
            r.metadata?.documentType === "legal" ||
            r.url?.includes("prawo") ||
            r.url?.includes("lex") ||
            r.url?.includes("isap"),
        )
        .slice(0, 5)
        .map((r: ResearchResult) => ({
          title: r.title,
          reference: r.metadata?.legalScope?.[0] || r.title,
          url: r.url,
          excerpt: r.excerpt,
          jurisdiction: r.metadata?.jurisdiction || "Polska",
        }));

      // Utwórz rozszerzenie
      const expansion: ResearchExpansion = {
        summary: report.summary,
        keyFindings: report.keyFindings,
        legalBases,
        sources: report.results.slice(0, 8).map((r: ResearchResult) => ({
          name: r.title,
          url: r.url,
          relevance: r.relevanceScore,
        })),
        confidence: report.confidence,
      };

      // Zaktualizuj wiadomość z rozszerzeniem
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, expansion, isExpanding: false }
            : msg,
        ),
      );
    } catch (err) {
      console.error("Błąd rozbudowy odpowiedzi:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, isExpanding: false } : msg,
        ),
      );
      setError({
        message:
          err instanceof Error
            ? err.message
            : "Nie udało się rozbudować odpowiedzi",
      });
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll do nowych wiadomości
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Obsługa profesjonalnej analizy dokumentu z localStorage (przekierowanie z /documents)
  useEffect(() => {
    const checkPendingAnalysis = async () => {
      const pendingAnalysis = localStorage.getItem("pendingAnalysis");
      if (!pendingAnalysis) return;

      try {
        const analysis = JSON.parse(pendingAnalysis);
        localStorage.removeItem("pendingAnalysis");

        // Buduj informację o referencjach
        let referencesInfo = "";
        if (analysis.references) {
          const foundCount = analysis.references.found || 0;
          const missingCount = analysis.references.missing || 0;

          if (foundCount > 0 || missingCount > 0) {
            referencesInfo = `\n\n### 📎 Referencje w dokumencie:\n`;
            if (foundCount > 0) {
              referencesInfo += `- ✅ **Znaleziono w bazie:** ${foundCount} druków/załączników\n`;
            }
            if (missingCount > 0) {
              referencesInfo += `- ⚠️ **Brak w bazie:** ${missingCount} druków (analiza może być niepełna)\n`;
              if (analysis.context?.missingReferences?.length > 0) {
                referencesInfo += `  - Brakujące: ${analysis.context.missingReferences.join(
                  ", ",
                )}\n`;
              }
            }
          }
        }

        // Dodaj wiadomość powiadomienia o dokumencie
        const notificationMessage: Message = {
          id: `doc-notify-${Date.now()}`,
          role: "assistant",
          content: `## 📄 Profesjonalna Analiza Dokumentu\n\n**Dokument:** "${
            analysis.document?.title || "Nieznany dokument"
          }"\n**Typ:** ${
            analysis.document?.document_type || "nieznany"
          }\n**Data:** ${
            analysis.document?.publish_date || "brak daty"
          }${referencesInfo}\n\n⏳ *Rozpoczynam szczegółową analizę z pełnym kontekstem RAG...*`,
          citations: [],
        };

        setMessages((prev) => [...prev, notificationMessage]);

        // Poczekaj chwilę i wyślij prompt analizy bezpośrednio (bez ustawiania w input)
        setTimeout(async () => {
          const promptText =
            typeof analysis.prompt === "string" ? analysis.prompt.trim() : "";
          if (promptText.length > 0) {
            // Wyślij wiadomość bezpośrednio do API bez ustawiania w polu input
            setLoading(true);

            const tempUserMessage: Message = {
              id: `temp-analysis-${Date.now()}`,
              role: "user",
              content: promptText,
              citations: [],
            };
            setMessages((prev) => [...prev, tempUserMessage]);

            try {
              const response = await sendMessage({
                message: promptText,
                conversationId: undefined,
                includeDocuments: true,
                includeMunicipalData: true,
              });

              if (response.conversationId) {
                setConversationId(response.conversationId);
              }

              const aiMessage: Message = {
                id: response.message?.id || `ai-${Date.now()}`,
                role: "assistant",
                content: response.message?.content || "Brak odpowiedzi",
                citations: response.message?.citations || [],
              };
              setMessages((prev) => [...prev, aiMessage]);
            } catch (err) {
              console.error("Error sending analysis:", err);
              setError({
                message: err instanceof Error ? err.message : "Błąd analizy",
              });
            } finally {
              setLoading(false);
            }
          }
        }, 800);
      } catch (err) {
        console.error("Error processing pending analysis:", err);
      }
    };

    // Sprawdź czy URL zawiera ?analysis=true
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("analysis=true")
    ) {
      checkPendingAnalysis();
      // Wyczyść parametr z URL
      window.history.replaceState({}, "", "/chat");
    }
  }, []);

  // Toggle sidebar i zapisz w localStorage
  const toggleSidebar = () => {
    setShowSidebar((prev) => {
      const newValue = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("chatSidebarVisible", String(newValue));
      }
      return newValue;
    });
  };

  // Funkcja rozpoczęcia nowej konwersacji
  const startNewConversation = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "# Witaj! 👋\n\nJestem **Asystentem Radnego**. Mogę pomóc Ci w:\n\n- 📄 Analizie dokumentów i uchwał\n- 📝 Tworzeniu protokołów i dokumentacji\n- 🏛️ Odpowiadaniu na pytania o sprawy samorządowe\n- 📊 Przygotowywaniu raportów i podsumowań\n\n**Jak mogę Ci dzisiaj pomóc?**",
        citations: [],
      },
    ]);
    setConversationId(undefined);
    setError(null);
  };

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    const userMessageContent = message;
    setMessage("");
    setError(null);

    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessageContent,
      citations: [],
    };

    setMessages((prev) => [...prev, tempUserMessage]);
    setLoading(true);

    try {
      const response = await sendMessage({
        message: userMessageContent,
        conversationId,
        includeDocuments,
        includeMunicipalData,
      });

      if (!conversationId) {
        setConversationId(response.conversationId);
      }

      // Wykryj kategorie na podstawie zapytania użytkownika
      const detectedCategories = detectCategories(userMessageContent);

      const aiMessage: Message = {
        id: response.message.id,
        role: "assistant",
        content: response.message.content,
        citations: response.message.citations || [],
        categories:
          detectedCategories.length > 0 ? detectedCategories : undefined,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Obsłuż akcje UI z orchestratora (np. odświeżenie kalendarza, nawigacja do narzędzia)
      const uiActions = (
        response as {
          uiActions?: Array<{ type: string; target?: string; data?: unknown }>;
        }
      ).uiActions;
      if (uiActions && uiActions.length > 0) {
        for (const action of uiActions) {
          if (action.type === "refresh" && action.target === "calendar") {
            // Wyemituj zdarzenie odświeżenia kalendarza
            window.dispatchEvent(new CustomEvent("calendar-refresh"));
            console.log("[Chat] Dispatched calendar-refresh event");
          }
          // Obsługa nawigacji do narzędzia (quick_tool)
          if (action.type === "navigate" && action.target?.includes("?tool=")) {
            try {
              const url = new URL(action.target, window.location.origin);
              const toolParam = url.searchParams.get("tool");
              if (toolParam && isValidToolType(toolParam)) {
                toolMode.activateTool(toolParam as ToolType);
                console.log("[Chat] Activated tool from uiAction:", toolParam);
              }
            } catch (e) {
              console.error("[Chat] Error parsing tool URL:", e);
            }
          }
          // Obsługa otwarcia narzędzia z danymi z kontekstu rozmowy
          if (action.type === "open_tool_with_data" && action.target) {
            const toolType = action.target as ToolType;
            if (isValidToolType(toolType)) {
              const actionData = action.data as {
                formData?: Record<string, string>;
                topic?: string;
                context?: string;
              };
              // Aktywuj narzędzie z wstępnymi danymi
              toolMode.activateToolWithData(
                toolType,
                actionData?.formData || {},
              );
              console.log(
                "[Chat] Activated tool with data:",
                toolType,
                actionData?.formData,
              );
            }
          }
        }
      }
    } catch (err: unknown) {
      console.error("Error sending message:", err);

      // Obsługa rozszerzonego błędu API
      const apiErr = err as {
        message?: string;
        code?: string;
        details?: string;
        billingUrl?: string;
        settingsUrl?: string;
      };

      setError({
        message:
          apiErr.message ||
          (err instanceof Error
            ? err.message
            : "Nie udało się wysłać wiadomości"),
        code: apiErr.code,
        details: apiErr.details,
        billingUrl: apiErr.billingUrl,
        settingsUrl: apiErr.settingsUrl,
      });

      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
      setMessage(userMessageContent);
    } finally {
      setLoading(false);
    }
  };

  // Kopiowanie do schowka
  const copyToClipboard = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Eksport do Markdown
  const exportToMarkdown = (content: string, title: string = "dokument") => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Eksport całej konwersacji
  const exportConversation = (format: "md" | "txt") => {
    let content = "# Konwersacja z Asystentem Radnego\n\n";
    content += `Data: ${new Date().toLocaleString("pl-PL")}\n\n---\n\n`;

    messages.forEach((msg) => {
      if (msg.id === "welcome") return;
      const role = msg.role === "user" ? "**Użytkownik:**" : "**Asystent:**";
      content += `${role}\n\n${msg.content}\n\n---\n\n`;
    });

    const blob = new Blob([content], {
      type: format === "md" ? "text/markdown" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `konwersacja_${
      new Date().toISOString().split("T")[0]
    }.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex relative">
      {/* Sidebar z animacją */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          showSidebar ? "w-80 opacity-100" : "w-0 opacity-0 overflow-hidden"
        }`}
      >
        {showSidebar && (
          <ConversationSidebar
            activeConversationId={conversationId}
            onSelectConversation={loadConversation}
            onNewConversation={startNewConversation}
          />
        )}
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header - kompaktowy */}
        <div className="bg-white rounded-xl border border-border px-4 py-2 shadow-sm mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-secondary-100 transition-colors"
              title={showSidebar ? "Ukryj historię" : "Pokaż historię"}
            >
              {showSidebar ? (
                <PanelLeftClose className="h-4 w-4 text-text-secondary" />
              ) : (
                <PanelLeftOpen className="h-4 w-4 text-text-secondary" />
              )}
            </button>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
              Asystent AI
            </h1>
          </div>
        </div>

        {/* Panel narzędzia (gdy aktywne) */}
        {toolMode.state.isActive && toolMode.state.toolConfig && (
          <div className="mb-3">
            <ToolPanel
              config={toolMode.state.toolConfig}
              formData={toolMode.state.formData}
              generatedContent={toolMode.state.generatedContent}
              isGenerating={toolMode.state.isGenerating}
              onFieldChange={toolMode.updateFormField}
              onGenerate={async () => {
                const prompt = toolMode.buildPrompt();
                if (!prompt) return;

                toolMode.setIsGenerating(true);
                try {
                  const response = await sendMessage({
                    message: prompt,
                    conversationId,
                    includeDocuments: true,
                    includeMunicipalData: true,
                  });

                  if (response.conversationId && !conversationId) {
                    setConversationId(response.conversationId);
                  }

                  toolMode.setGeneratedContent(
                    response.message?.content || "Brak odpowiedzi",
                  );

                  // Dodaj wiadomości do historii czatu
                  const userMsg: Message = {
                    id: `tool-user-${Date.now()}`,
                    role: "user",
                    content: prompt,
                    citations: [],
                  };
                  const aiMsg: Message = {
                    id: response.message?.id || `tool-ai-${Date.now()}`,
                    role: "assistant",
                    content: response.message?.content || "Brak odpowiedzi",
                    citations: response.message?.citations || [],
                  };
                  setMessages((prev) => [...prev, userMsg, aiMsg]);
                } catch (err) {
                  console.error("[ToolPanel] Error generating:", err);
                  setError({
                    message:
                      err instanceof Error ? err.message : "Błąd generowania",
                  });
                } finally {
                  toolMode.setIsGenerating(false);
                }
              }}
              onReset={toolMode.resetForm}
              onClose={toolMode.deactivateTool}
              onExportPDF={() => {
                if (toolMode.state.generatedContent) {
                  exportToPDF(toolMode.state.generatedContent, [], {
                    title: toolMode.state.toolConfig?.name || "dokument",
                  });
                }
              }}
              onExportDOCX={() => {
                if (toolMode.state.generatedContent) {
                  exportToDOCX(toolMode.state.generatedContent, [], {
                    title: toolMode.state.toolConfig?.name || "dokument",
                  });
                }
              }}
            />
          </div>
        )}

        {/* Chat messages */}
        <div className="flex-1 bg-white rounded-2xl border border-border shadow-md overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-secondary-300 to-secondary-400"
                      : "bg-gradient-to-br from-primary-500 to-primary-600"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-5 w-5 text-white" />
                  ) : (
                    <Bot className="h-5 w-5 text-white" />
                  )}
                </div>

                {/* Message content */}
                <div
                  className={`flex-1 ${
                    msg.role === "user" ? "text-right" : "text-left"
                  }`}
                >
                  <div
                    className={`text-left transition-all duration-200 ${
                      msg.role === "user"
                        ? "rounded-2xl px-6 py-5 inline-block max-w-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md"
                        : `w-full max-w-4xl ${
                            msg.expansion ? "ring-2 ring-amber-200/50" : ""
                          }`
                    }`}
                  >
                    {/* Renderowanie odpowiedzi AI w stylu DocumentDetailPage */}
                    {msg.role === "assistant" ? (
                      <div className="space-y-4">
                        {/* Nagłówek "Analiza" - tylko dla wiadomości nie-powitalnych */}
                        {msg.id !== "welcome" && (
                          <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl border border-primary-200 p-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                                <Sparkles className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <h2 className="text-lg font-bold text-primary-800">
                                  🔍 Analiza AI
                                </h2>
                                <p className="text-xs text-primary-600">
                                  Asystent Radnego
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Treść odpowiedzi */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                          <div
                            className="prose prose-base max-w-none 
                            prose-headings:text-slate-800 prose-headings:font-bold prose-headings:tracking-tight
                            prose-h1:text-xl prose-h1:mb-4 prose-h1:pb-2 prose-h1:border-b prose-h1:border-slate-200
                            prose-h2:text-lg prose-h2:mt-5 prose-h2:mb-3 prose-h2:text-slate-700
                            prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-slate-600
                            prose-p:text-slate-700 prose-p:leading-7 prose-p:mb-3
                            prose-ul:my-2 prose-ul:pl-1 prose-ol:my-2 prose-ol:pl-1
                            prose-li:my-1 prose-li:leading-6 prose-li:marker:text-primary-500 prose-li:text-slate-700
                            prose-strong:text-slate-800 prose-strong:font-semibold
                            prose-em:text-slate-600 prose-em:italic
                            prose-code:bg-slate-100 prose-code:text-primary-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:text-sm
                            prose-pre:bg-slate-800 prose-pre:text-slate-100 prose-pre:rounded-xl prose-pre:shadow-inner
                            prose-blockquote:border-l-4 prose-blockquote:border-primary-400 prose-blockquote:bg-primary-50/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:italic
                            prose-a:text-primary-600 prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-primary-800
                            prose-table:border-collapse prose-th:bg-slate-100 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-slate-200
                            prose-hr:border-slate-200 prose-hr:my-5"
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>

                          {/* Przyciski akcji - wewnątrz karty */}
                          {msg.id !== "welcome" && (
                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200">
                              <button
                                onClick={() =>
                                  copyToClipboard(msg.content, msg.id)
                                }
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                title="Kopiuj do schowka"
                              >
                                {copiedId === msg.id ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-green-500" />
                                    Skopiowano
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" /> Kopiuj
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() =>
                                  exportToMarkdown(msg.content, "odpowiedz_ai")
                                }
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                title="Pobierz jako Markdown"
                              >
                                <FileDown className="h-3.5 w-3.5" /> .md
                              </button>
                              <button
                                onClick={() =>
                                  exportToPDF(msg.content, msg.citations, {
                                    title: "Odpowiedz_AI",
                                  })
                                }
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Pobierz jako PDF"
                              >
                                <FileDown className="h-3.5 w-3.5" /> PDF
                              </button>
                              <button
                                onClick={() =>
                                  exportToDOCX(msg.content, msg.citations, {
                                    title: "Odpowiedz_AI",
                                  })
                                }
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Pobierz jako DOCX"
                              >
                                <FileDown className="h-3.5 w-3.5" /> DOCX
                              </button>
                              <button
                                onClick={() =>
                                  exportToRTF(msg.content, msg.citations, {
                                    title: "Odpowiedz_AI",
                                  })
                                }
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Pobierz jako RTF"
                              >
                                <FileDown className="h-3.5 w-3.5" /> RTF
                              </button>

                              {/* Przycisk rozbudowy odpowiedzi */}
                              {!msg.expansion && !msg.isExpanding && (
                                <button
                                  onClick={() => {
                                    const msgIndex = messages.findIndex(
                                      (m) => m.id === msg.id,
                                    );
                                    const userQuery =
                                      msgIndex > 0
                                        ? messages[msgIndex - 1]?.content
                                        : msg.content;
                                    expandWithResearch(msg.id, userQuery);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors ml-auto"
                                  title="Rozbuduj odpowiedź o podstawy prawne"
                                >
                                  <Zap className="h-3.5 w-3.5" /> Rozbuduj
                                </button>
                              )}
                              {msg.isExpanding && (
                                <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-600 ml-auto">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                                  Weryfikuję...
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Wiadomości użytkownika - z zwijaniem dla długich i formatowaniem Markdown */
                      <div className="text-sm leading-relaxed">
                        {isLongMessage(msg.content) &&
                        !expandedMessages.has(msg.id) ? (
                          <>
                            <div
                              className="prose prose-sm prose-invert max-w-none
                              prose-headings:text-white prose-headings:font-semibold
                              prose-h2:text-base prose-h3:text-sm
                              prose-p:text-white/90 prose-p:my-1
                              prose-strong:text-white prose-strong:font-semibold
                              prose-ul:my-1 prose-li:my-0.5 prose-li:text-white/90
                              prose-code:bg-white/20 prose-code:text-white prose-code:px-1 prose-code:rounded
                              prose-pre:bg-black/30 prose-pre:text-white/90 prose-pre:text-xs prose-pre:max-h-32 prose-pre:overflow-hidden"
                            >
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {truncateMessage(msg.content)}
                              </ReactMarkdown>
                            </div>
                            <button
                              onClick={() => toggleMessageExpand(msg.id)}
                              className="mt-2 flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors"
                            >
                              <ChevronDown className="h-3 w-3" />
                              Rozwiń wiadomość ({
                                msg.content.split("\n").length
                              }{" "}
                              linii)
                            </button>
                          </>
                        ) : (
                          <>
                            <div
                              className="prose prose-sm prose-invert max-w-none
                              prose-headings:text-white prose-headings:font-semibold
                              prose-h2:text-base prose-h3:text-sm
                              prose-p:text-white/90 prose-p:my-1
                              prose-strong:text-white prose-strong:font-semibold
                              prose-ul:my-1 prose-li:my-0.5 prose-li:text-white/90
                              prose-code:bg-white/20 prose-code:text-white prose-code:px-1 prose-code:rounded
                              prose-pre:bg-black/30 prose-pre:text-white/90 prose-pre:text-xs prose-pre:max-h-96 prose-pre:overflow-auto"
                            >
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                            {isLongMessage(msg.content) && (
                              <button
                                onClick={() => toggleMessageExpand(msg.id)}
                                className="mt-2 flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors"
                              >
                                <ChevronRight className="h-3 w-3" />
                                Zwiń wiadomość
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Rozbudowana odpowiedź z Deep Research */}
                    {msg.expansion && (
                      <div className="mt-6 pt-5 border-t-2 border-amber-200 space-y-5 bg-gradient-to-b from-amber-50/30 to-transparent rounded-b-xl -mx-2 px-4 pb-2">
                        {/* Nagłówek rozbudowy */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🔍</span>
                            <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide">
                              Rozszerzona Analiza
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1 bg-amber-100 rounded-full">
                            <span className="text-xs font-medium text-amber-700">
                              📊 Pewność:{" "}
                              {Math.round(msg.expansion.confidence * 100)}%
                            </span>
                          </div>
                        </div>

                        {/* Podsumowanie */}
                        {msg.expansion.summary && (
                          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">💡</span>
                              <div>
                                <h4 className="text-xs font-bold text-amber-800 uppercase mb-2">
                                  Podsumowanie
                                </h4>
                                <p className="text-sm text-amber-900 leading-relaxed">
                                  {msg.expansion.summary}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Kluczowe ustalenia */}
                        {msg.expansion.keyFindings.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-emerald-700 uppercase flex items-center gap-2">
                              <span className="text-lg">📋</span> Kluczowe
                              ustalenia
                            </h4>
                            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-200">
                              <ul className="space-y-2">
                                {msg.expansion.keyFindings.map(
                                  (finding, idx) => (
                                    <li
                                      key={idx}
                                      className="flex items-start gap-3 text-sm text-text"
                                    >
                                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                        {idx + 1}
                                      </span>
                                      <span className="leading-relaxed pt-0.5">
                                        {finding}
                                      </span>
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Podstawy prawne */}
                        {msg.expansion.legalBases.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-purple-700 uppercase flex items-center gap-2">
                              <span className="text-lg">⚖️</span> Podstawy
                              prawne
                            </h4>
                            <div className="space-y-3">
                              {msg.expansion.legalBases.map((legal, idx) => (
                                <div
                                  key={idx}
                                  className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200 shadow-sm hover:shadow-md transition-shadow"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg">📜</span>
                                        <p className="text-sm font-bold text-purple-900">
                                          {legal.title}
                                        </p>
                                      </div>
                                      <p className="text-xs text-purple-600 ml-7">
                                        📍 {legal.reference}
                                        {legal.jurisdiction &&
                                          ` • 🇵🇱 ${legal.jurisdiction}`}
                                      </p>
                                    </div>
                                    {legal.url && (
                                      <a
                                        href={legal.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-xs font-medium transition-colors"
                                        title="Otwórz źródło"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        Źródło
                                      </a>
                                    )}
                                  </div>
                                  {legal.excerpt && (
                                    <div className="mt-3 ml-7 pl-3 border-l-2 border-purple-300">
                                      <p className="text-xs text-purple-800 italic leading-relaxed">
                                        &quot;{legal.excerpt}&quot;
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Źródła internetowe */}
                        {msg.expansion.sources.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-blue-700 uppercase flex items-center gap-2">
                              <span className="text-lg">🌐</span> Źródła
                              internetowe ({msg.expansion.sources.length})
                            </h4>
                            <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200">
                              <div className="flex flex-wrap gap-2">
                                {msg.expansion.sources.map((source, idx) => (
                                  <a
                                    key={idx}
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-3 py-2 text-xs bg-white text-blue-700 rounded-lg hover:bg-blue-100 transition-all shadow-sm hover:shadow border border-blue-200"
                                    title={`🎯 Trafność: ${Math.round(
                                      source.relevance * 100,
                                    )}%`}
                                  >
                                    <span>🔗</span>
                                    <span className="truncate max-w-40 font-medium">
                                      {source.name}
                                    </span>
                                    <span className="text-blue-400 text-[10px]">
                                      {Math.round(source.relevance * 100)}%
                                    </span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Citations */}
                    {/* Dynamiczne kategorie analizy */}
                    {msg.categories && msg.categories.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-secondary-200">
                        <div className="flex flex-wrap gap-2">
                          {msg.categories.map((cat, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                                cat.type === "legal"
                                  ? "bg-purple-100 text-purple-700 border border-purple-200"
                                  : cat.type === "search"
                                    ? "bg-blue-100 text-blue-700 border border-blue-200"
                                    : "bg-green-100 text-green-700 border border-green-200"
                              }`}
                            >
                              {cat.type === "legal" && (
                                <Scale className="h-3 w-3" />
                              )}
                              {cat.type === "search" && (
                                <Search className="h-3 w-3" />
                              )}
                              {cat.type === "budget" && (
                                <TrendingUp className="h-3 w-3" />
                              )}
                              {cat.label}
                              <span className="opacity-60">
                                {Math.round(cat.confidence * 100)}%
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Zwijane źródła - domyślnie zwinięte */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-secondary-200">
                        <button
                          onClick={() => toggleSources(msg.id)}
                          className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase hover:text-primary-600 transition-colors w-full"
                        >
                          {expandedSources.has(msg.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          📚 Źródła ({msg.citations.length})
                        </button>

                        {expandedSources.has(msg.id) && (
                          <div className="mt-2 space-y-2">
                            {msg.citations.map((citation, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 text-xs bg-white rounded-lg p-3 border border-border group hover:border-primary-300 transition-colors cursor-pointer"
                                onClick={() => openDocumentModal(citation)}
                              >
                                <FileText className="h-4 w-4 text-primary-500 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="font-semibold text-text flex items-center gap-2">
                                    {citation.documentTitle}
                                    {citation.page &&
                                      ` (str. ${citation.page})`}
                                    {citation.relevanceScore && (
                                      <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                        {Math.round(
                                          citation.relevanceScore * 100,
                                        )}
                                        % trafności
                                      </span>
                                    )}
                                    <ExternalLink className="h-3 w-3 text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </p>
                                  <p className="text-text-secondary mt-1 italic line-clamp-2">
                                    &quot;{citation.text}&quot;
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sekcja następnych kroków - tylko dla odpowiedzi asystenta */}
                    {msg.role === "assistant" &&
                      msg.id !== "welcome" &&
                      (() => {
                        const { primary, secondary } = generateNextSteps(
                          msg.content,
                          msg.categories,
                        );
                        const isExpanded = expandedTools.has(msg.id);

                        const getCategoryStyle = (category: string) => {
                          switch (category) {
                            case "legal":
                              return "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100";
                            case "financial":
                              return "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100";
                            case "report":
                              return "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100";
                            case "search":
                              return "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100";
                            case "calendar":
                              return "bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100";
                            default:
                              return "bg-secondary-50 border-secondary-200 text-secondary-700 hover:bg-secondary-100";
                          }
                        };

                        return (
                          <div className="mt-5 pt-5 border-t border-secondary-200">
                            <p className="text-xs font-semibold text-secondary-600 uppercase mb-3 flex items-center gap-2">
                              <Sparkles className="h-3.5 w-3.5 text-primary-500" />
                              Co chciałbyś zrobić w następnym kroku?
                            </p>

                            {/* Główne sugestie - zawsze widoczne */}
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              {primary.map((step) => (
                                <button
                                  key={step.id}
                                  onClick={() => {
                                    // Jeśli ma toolType, otwórz modal narzędzia
                                    if (step.toolType) {
                                      toolMode.activateTool(step.toolType);
                                      return;
                                    }
                                    // W przeciwnym razie wstaw prompt do pola wiadomości
                                    const userQ = getLastUserQuestion(msg.id);
                                    const contextPrompt = buildContextualPrompt(
                                      step,
                                      msg.content,
                                      userQ,
                                    );
                                    setMessage(contextPrompt);
                                  }}
                                  className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium rounded-xl border transition-all hover:shadow-md text-left ${getCategoryStyle(step.category)}`}
                                >
                                  <span className="text-base">{step.icon}</span>
                                  <span className="truncate">{step.label}</span>
                                </button>
                              ))}
                            </div>

                            {/* Lista rozwijana z dodatkowymi narzędziami */}
                            {secondary.length > 0 && (
                              <div className="mt-2">
                                <button
                                  onClick={() => {
                                    setExpandedTools((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(msg.id)) {
                                        next.delete(msg.id);
                                      } else {
                                        next.add(msg.id);
                                      }
                                      return next;
                                    });
                                  }}
                                  className="flex items-center gap-1.5 text-xs text-secondary-500 hover:text-secondary-700 transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                  <span>
                                    Więcej narzędzi ({secondary.length})
                                  </span>
                                </button>

                                {isExpanded && (
                                  <div className="grid grid-cols-2 gap-2 mt-2 animate-in slide-in-from-top-2 duration-200">
                                    {secondary.map((step) => (
                                      <button
                                        key={step.id}
                                        onClick={() => {
                                          // Jeśli ma toolType, otwórz modal narzędzia
                                          if (step.toolType) {
                                            toolMode.activateTool(
                                              step.toolType,
                                            );
                                            return;
                                          }
                                          const userQ = getLastUserQuestion(
                                            msg.id,
                                          );
                                          const contextPrompt =
                                            buildContextualPrompt(
                                              step,
                                              msg.content,
                                              userQ,
                                            );
                                          setMessage(contextPrompt);
                                        }}
                                        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-all hover:shadow-sm text-left opacity-90 ${getCategoryStyle(step.category)}`}
                                      >
                                        <span className="text-sm">
                                          {step.icon}
                                        </span>
                                        <span className="truncate">
                                          {step.label}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border p-6 bg-secondary-50">
            {/* Kontekst sesji YouTube */}
            {contextItems.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-800 flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Kontekst rozmowy ({contextItems.length})
                  </span>
                  <button
                    onClick={clearContext}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Wyczyść
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {contextItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-1.5 px-2 py-1 bg-white border border-blue-200 rounded-lg text-xs"
                    >
                      <span className="text-blue-600">
                        {item.type === "youtube_session" ? "🎬" : "📄"}
                      </span>
                      <span
                        className="max-w-[150px] truncate"
                        title={item.title}
                      >
                        {item.title}
                      </span>
                      <button
                        onClick={() => removeContextItem(item.id)}
                        className="text-secondary-400 hover:text-red-500 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div
                className={`mb-4 p-4 rounded-xl border ${
                  error.code === "QUOTA_EXCEEDED"
                    ? "bg-orange-50 border-orange-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      error.code === "QUOTA_EXCEEDED"
                        ? "bg-orange-100"
                        : "bg-red-100"
                    }`}
                  >
                    {error.code === "QUOTA_EXCEEDED" ? "💳" : "⚠️"}
                  </div>
                  <div className="flex-1">
                    <h4
                      className={`font-semibold ${
                        error.code === "QUOTA_EXCEEDED"
                          ? "text-orange-800"
                          : "text-red-800"
                      }`}
                    >
                      {error.message}
                    </h4>
                    {error.details && (
                      <p className="text-sm text-text-secondary mt-1">
                        {error.details}
                      </p>
                    )}
                    <div className="flex gap-3 mt-3">
                      {error.billingUrl && (
                        <a
                          href={error.billingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
                        >
                          💳 Doładuj konto OpenAI
                        </a>
                      )}
                      {error.settingsUrl && (
                        <a
                          href={error.settingsUrl}
                          className="inline-flex items-center gap-2 px-4 py-2 border border-secondary-300 text-text rounded-lg text-sm font-medium hover:bg-secondary-100 transition-colors"
                        >
                          ⚙️ Zmień klucz API
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="text-secondary-400 hover:text-secondary-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              {/* Upload dokumentu z OCR */}
              <DocumentUploadButton
                onTextExtracted={(text, action) => {
                  if (action === "chat") {
                    setMessage(
                      text.slice(0, 500) + (text.length > 500 ? "..." : ""),
                    );
                  } else {
                    setMessage(text);
                    handleSend();
                  }
                }}
                onError={(err) => setError({ message: err })}
              />

              {/* System Status */}
              <SystemStatus apiError={error} />

              {/* Eksport konwersacji */}
              <div className="relative group">
                <button
                  className="h-full px-3 rounded-xl border-2 border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  title="Eksportuj konwersację"
                >
                  <Download className="h-4 w-4 text-text-secondary" />
                </button>
                <div className="absolute left-0 bottom-full mb-2 bg-white rounded-xl border border-border shadow-xl py-2 z-50 w-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <button
                    onClick={() => exportConversation("md")}
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-secondary-50 flex items-center gap-2"
                  >
                    <FileDown className="h-3 w-3" /> Markdown
                  </button>
                  <button
                    onClick={() =>
                      exportConversationToPDF(
                        messages.filter((m) => m.id !== "welcome"),
                        "Konwersacja",
                      )
                    }
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
                  >
                    <FileDown className="h-3 w-3" /> PDF
                  </button>
                  <button
                    onClick={() =>
                      exportConversationToDOCX(
                        messages.filter((m) => m.id !== "welcome"),
                        "Konwersacja",
                      )
                    }
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 text-blue-600 flex items-center gap-2"
                  >
                    <FileDown className="h-3 w-3" /> Word
                  </button>
                  <button
                    onClick={() =>
                      exportConversationToRTF(
                        messages.filter((m) => m.id !== "welcome"),
                        "Konwersacja",
                      )
                    }
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-purple-50 text-purple-600 flex items-center gap-2"
                  >
                    <FileDown className="h-3 w-3" /> RTF
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSend()
                }
                placeholder="Np. Przygotuj protokół z sesji rady..."
                disabled={loading}
                className="flex-1 rounded-xl border-2 border-secondary-200 bg-white px-4 py-2.5 text-sm font-medium text-text transition-all duration-200 placeholder:text-secondary-400 hover:border-secondary-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <VoiceButton
                variant="inline"
                size="md"
                onTranscription={(text) => {
                  setMessage(text);
                }}
                onCommand={(cmd) => {
                  const command = cmd as {
                    action?: { type?: string; message?: string };
                  };
                  if (
                    command.action?.type === "chat" &&
                    command.action?.message
                  ) {
                    setMessage(command.action.message);
                    handleSend();
                  }
                }}
              />
              <button
                data-send-button
                onClick={handleSend}
                disabled={loading || !message.trim()}
                className="rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-2.5 text-white font-semibold shadow-lg shadow-primary-500/30 hover:from-primary-600 hover:to-primary-700 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-text-secondary mt-3 text-center">
              {loading
                ? "🔍 Przeszukuję dokumenty i przygotowuję odpowiedź..."
                : "💡 Tip: Możesz poprosić o przygotowanie protokołu, streszczenia lub analizy dokumentów"}
            </p>
          </div>
        </div>
      </div>

      {/* YouTube Session Tool Modal */}
      {showYouTubeTool && (
        <YouTubeSessionTool
          onTranscriptionComplete={() => {
            // Transcription complete - user can download markdown from modal
            // Don't set message - transcript is too long for chat input
          }}
          onClose={() => setShowYouTubeTool(false)}
        />
      )}

      {/* Modal dokumentu źródłowego */}
      {documentModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200 bg-gradient-to-r from-primary-50 to-secondary-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 rounded-xl">
                  <FileText className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-bold text-text text-lg">
                    {documentModal.title}
                  </h3>
                  <p className="text-xs text-secondary-500">
                    {documentModal.type === "rag"
                      ? "📚 Dokument z bazy RAG"
                      : "🌐 Źródło internetowe"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {documentModal.url && (
                  <a
                    href={documentModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Otwórz źródło
                  </a>
                )}
                <button
                  onClick={() =>
                    setDocumentModal((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="p-2 hover:bg-secondary-100 rounded-xl transition-colors"
                >
                  <span className="text-xl text-secondary-500">✕</span>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-sm max-w-none prose-headings:text-text prose-p:text-text prose-p:leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {documentModal.content}
                </ReactMarkdown>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-secondary-200 bg-secondary-50 flex items-center justify-between">
              <p className="text-xs text-secondary-500">
                💡 Kliknij &quot;Otwórz źródło&quot; aby zobaczyć oryginalny
                dokument
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(documentModal.content);
                  alert("Treść skopiowana do schowka!");
                }}
                className="flex items-center gap-2 px-4 py-2 border border-secondary-300 text-secondary-700 rounded-xl text-sm font-medium hover:bg-secondary-100 transition-colors"
              >
                <Copy className="h-4 w-4" />
                Kopiuj treść
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
