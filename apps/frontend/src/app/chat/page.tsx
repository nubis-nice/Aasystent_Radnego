"use client";

import { useState, useRef, useEffect } from "react";
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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  categories?: AnalysisCategory[];
  expansion?: ResearchExpansion;
  isExpanding?: boolean;
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
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [showYouTubeTool, setShowYouTubeTool] = useState(false);
  const [showSidebar, setShowSidebar] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chatSidebarVisible");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  // Opcje kontekstu (domyślnie włączone)
  const [includeDocuments] = useState(true);
  const [includeMunicipalData] = useState(true);

  // Eksport
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Zwijanie źródeł - domyślnie zwinięte
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set()
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
      lowerQuery.includes(k)
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
      lowerQuery.includes(k)
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
      lowerQuery.includes(k)
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
        msg.id === messageId ? { ...msg, isExpanding: true } : msg
      )
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
        session.access_token
      );

      // Wyodrębnij podstawy prawne z wyników
      const legalBases: LegalBasis[] = report.results
        .filter(
          (r: ResearchResult) =>
            r.metadata?.documentType === "legal" ||
            r.url?.includes("prawo") ||
            r.url?.includes("lex") ||
            r.url?.includes("isap")
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
          msg.id === messageId ? { ...msg, expansion, isExpanding: false } : msg
        )
      );
    } catch (err) {
      console.error("Błąd rozbudowy odpowiedzi:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, isExpanding: false } : msg
        )
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
                  ", "
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

        // Poczekaj chwilę i wyślij prompt analizy
        setTimeout(async () => {
          if (analysis.prompt) {
            setMessage(analysis.prompt);
            // Auto-wyślij po krótkim opóźnieniu
            const sendBtn = document.querySelector(
              "[data-send-button]"
            ) as HTMLButtonElement;
            if (sendBtn) {
              sendBtn.click();
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

  // Funkcja ładowania konwersacji
  const loadConversation = async (id: string) => {
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
        })
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
  };

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
    <div className="h-[calc(100vh-8rem)] flex relative">
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
                    className={`rounded-2xl px-6 py-5 text-left transition-all duration-200 ${
                      msg.role === "user"
                        ? "inline-block max-w-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md"
                        : `w-[90%] bg-gradient-to-br from-secondary-50 to-white text-text shadow-sm border border-secondary-100 ${
                            msg.expansion ? "ring-2 ring-amber-200/50" : ""
                          }`
                    }`}
                  >
                    {/* Renderowanie Markdown dla odpowiedzi AI */}
                    {msg.role === "assistant" ? (
                      <div
                        className="prose prose-base max-w-none 
                        prose-headings:text-text prose-headings:font-bold prose-headings:tracking-tight
                        prose-h1:text-2xl prose-h1:mb-4 prose-h1:pb-2 prose-h1:border-b prose-h1:border-secondary-200
                        prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-h2:text-primary-700
                        prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-secondary-700
                        prose-p:text-text prose-p:leading-7 prose-p:mb-4
                        prose-ul:my-3 prose-ul:pl-1 prose-ol:my-3 prose-ol:pl-1
                        prose-li:my-1.5 prose-li:leading-6 prose-li:marker:text-primary-500
                        prose-strong:text-primary-700 prose-strong:font-semibold
                        prose-em:text-secondary-600 prose-em:italic
                        prose-code:bg-secondary-100 prose-code:text-primary-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:text-sm
                        prose-pre:bg-secondary-800 prose-pre:text-secondary-100 prose-pre:rounded-xl prose-pre:shadow-inner
                        prose-blockquote:border-l-4 prose-blockquote:border-primary-400 prose-blockquote:bg-primary-50/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:italic
                        prose-a:text-primary-600 prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-primary-800
                        prose-table:border-collapse prose-th:bg-secondary-100 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-secondary-200
                        prose-hr:border-secondary-200 prose-hr:my-6"
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    )}

                    {/* Przyciski akcji dla odpowiedzi AI */}
                    {msg.role === "assistant" && msg.id !== "welcome" && (
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-secondary-200">
                        <button
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="Kopiuj do schowka"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="h-3 w-3 text-green-500" />{" "}
                              Skopiowano
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> Kopiuj
                            </>
                          )}
                        </button>
                        <button
                          onClick={() =>
                            exportToMarkdown(msg.content, "odpowiedz_ai")
                          }
                          className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="Pobierz jako Markdown"
                        >
                          <FileDown className="h-3 w-3" /> .md
                        </button>
                        <button
                          onClick={() =>
                            exportToPDF(msg.content, msg.citations, {
                              title: "Odpowiedz_AI",
                            })
                          }
                          className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Pobierz jako PDF"
                        >
                          <FileDown className="h-3 w-3" /> PDF
                        </button>
                        <button
                          onClick={() =>
                            exportToDOCX(msg.content, msg.citations, {
                              title: "Odpowiedz_AI",
                            })
                          }
                          className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Pobierz jako DOCX"
                        >
                          <FileDown className="h-3 w-3" /> DOCX
                        </button>
                        <button
                          onClick={() =>
                            exportToRTF(msg.content, msg.citations, {
                              title: "Odpowiedz_AI",
                            })
                          }
                          className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                          title="Pobierz jako RTF"
                        >
                          <FileDown className="h-3 w-3" /> RTF
                        </button>

                        {/* Przycisk rozbudowy odpowiedzi */}
                        {!msg.expansion && !msg.isExpanding && (
                          <button
                            onClick={() => {
                              // Znajdź poprzednią wiadomość użytkownika jako kontekst
                              const msgIndex = messages.findIndex(
                                (m) => m.id === msg.id
                              );
                              const userQuery =
                                msgIndex > 0
                                  ? messages[msgIndex - 1]?.content
                                  : msg.content;
                              expandWithResearch(msg.id, userQuery);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-amber-600 hover:bg-amber-50 rounded transition-colors ml-auto"
                            title="Rozbuduj odpowiedź o podstawy prawne"
                          >
                            <Zap className="h-3 w-3" /> Rozbuduj
                          </button>
                        )}
                        {msg.isExpanding && (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 ml-auto">
                            <Loader2 className="h-3 w-3 animate-spin" />{" "}
                            Weryfikuję...
                          </span>
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
                                  )
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
                                      source.relevance * 100
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
                                className="flex items-start gap-2 text-xs bg-white rounded-lg p-3 border border-border"
                              >
                                <FileText className="h-4 w-4 text-primary-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-semibold text-text">
                                    {citation.documentTitle}
                                    {citation.page &&
                                      ` (str. ${citation.page})`}
                                    {citation.relevanceScore && (
                                      <span className="ml-2 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                        {Math.round(
                                          citation.relevanceScore * 100
                                        )}
                                        % trafności
                                      </span>
                                    )}
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
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border p-6 bg-secondary-50">
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
                      text.slice(0, 500) + (text.length > 500 ? "..." : "")
                    );
                  } else {
                    setMessage(text);
                    handleSend();
                  }
                }}
                onError={(err) => setError({ message: err })}
              />

              {/* YouTube Sesje Rady */}
              <button
                onClick={() => setShowYouTubeTool(true)}
                className="h-full px-3 rounded-xl border-2 border-secondary-200 hover:border-red-300 hover:bg-red-50 transition-colors"
                title="Sesje Rady (YouTube)"
              >
                <svg
                  className="h-4 w-4 text-red-600"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </button>

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
                        "Konwersacja"
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
                        "Konwersacja"
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
                        "Konwersacja"
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
    </div>
  );
}
