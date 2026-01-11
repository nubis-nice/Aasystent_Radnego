/**
 * Context Compressor Service
 *
 * Optymalizuje kontekst dla AI poprzez:
 * 1. Estymację tokenów (bez zewnętrznych bibliotek)
 * 2. Kompresję długich dokumentów
 * 3. Summaryzację historii konwersacji
 * 4. Priorytetyzację kontekstu według relevance
 */

// ============================================================================
// TOKEN ESTIMATION - przybliżona estymacja bez tiktoken
// ============================================================================

/**
 * Szacuje liczbę tokenów w tekście
 * Reguła: ~4 znaki = 1 token dla angielskiego, ~2.5 znaki dla polskiego
 * Polski tekst ma więcej znaków diakrytycznych i dłuższe słowa
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Podstawowa estymacja: 1 token ≈ 2.5 znaku dla polskiego tekstu (bardziej konserwatywna)
  const baseTokens = Math.ceil(text.length / 2.5);

  // Dodatkowe tokeny za:
  // - Nowe linie (każda to osobny token)
  const newlines = (text.match(/\n/g) || []).length;
  // - Znaki specjalne i interpunkcja
  const specialChars = (text.match(/[^\w\s\u0080-\uFFFF]/g) || []).length * 0.5;
  // - Nagłówki markdown
  const headers = (text.match(/^#+\s/gm) || []).length * 2;
  // - Polskie znaki diakrytyczne (często tokenizowane osobno)
  const polishChars = (text.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length * 0.3;

  return Math.ceil(
    baseTokens + newlines + specialChars + headers + polishChars
  );
}

/**
 * Szacuje tokeny dla tablicy wiadomości OpenAI
 */
export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string }>
): number {
  let total = 0;

  for (const msg of messages) {
    // Każda wiadomość ma overhead ~4 tokeny (role, separatory)
    total += 4;
    total += estimateTokens(msg.content);
  }

  // Overhead na całą konwersację
  total += 3;

  return total;
}

// ============================================================================
// CONTENT COMPRESSION - kompresja treści dokumentów
// ============================================================================

export interface CompressionOptions {
  maxTokens: number; // Maksymalna liczba tokenów
  preserveStructure: boolean; // Zachowaj nagłówki i strukturę
  extractKeyPoints: boolean; // Wyciągnij kluczowe punkty
}

const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  maxTokens: 2000,
  preserveStructure: true,
  extractKeyPoints: true,
};

/**
 * Kompresuje długi tekst do określonej liczby tokenów
 */
export function compressText(
  text: string,
  options: Partial<CompressionOptions> = {}
): string {
  const opts = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };
  const currentTokens = estimateTokens(text);

  if (currentTokens <= opts.maxTokens) {
    return text;
  }

  // Strategia kompresji:
  // 1. Usuń nadmiarowe białe znaki
  let compressed = text
    .replace(/\n{3,}/g, "\n\n") // Max 2 nowe linie
    .replace(/[ \t]{2,}/g, " ") // Max 1 spacja
    .replace(/^\s+$/gm, ""); // Usuń puste linie ze spacjami

  // 2. Jeśli nadal za długi - skróć akapity
  if (estimateTokens(compressed) > opts.maxTokens) {
    compressed = truncateParagraphs(
      compressed,
      opts.maxTokens,
      opts.preserveStructure
    );
  }

  // 3. Jeśli nadal za długi - twarde cięcie z elipsą
  if (estimateTokens(compressed) > opts.maxTokens) {
    const targetChars = opts.maxTokens * 3.5;
    compressed =
      compressed.substring(0, Math.floor(targetChars)) +
      "\n\n[...treść skrócona...]";
  }

  return compressed;
}

/**
 * Skraca akapity zachowując strukturę
 */
function truncateParagraphs(
  text: string,
  maxTokens: number,
  preserveStructure: boolean
): string {
  const paragraphs = text.split(/\n\n+/);
  const result: string[] = [];
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    // Zawsze zachowaj nagłówki jeśli preserveStructure
    const isHeader =
      /^#+\s/.test(para) ||
      /^[A-ZŻŹĆĄŚĘŁÓŃ][A-ZŻŹĆĄŚĘŁÓŃ\s]{2,}:?$/.test(para.trim());

    if (preserveStructure && isHeader) {
      result.push(para);
      currentTokens += paraTokens;
      continue;
    }

    if (currentTokens + paraTokens <= maxTokens) {
      result.push(para);
      currentTokens += paraTokens;
    } else if (currentTokens < maxTokens * 0.8) {
      // Skróć ostatni akapit
      const remainingTokens = maxTokens - currentTokens - 10;
      const truncated = truncateToTokens(para, remainingTokens);
      if (truncated.length > 50) {
        result.push(truncated + "...");
      }
      break;
    } else {
      break;
    }
  }

  return result.join("\n\n");
}

/**
 * Skraca tekst do określonej liczby tokenów
 */
function truncateToTokens(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) {
    return text;
  }

  // Przybliżona liczba znaków
  const targetChars = maxTokens * 3.5;

  // Znajdź najbliższy koniec zdania
  const truncated = text.substring(0, Math.floor(targetChars));
  const lastSentence = truncated.lastIndexOf(". ");

  if (lastSentence > targetChars * 0.5) {
    return truncated.substring(0, lastSentence + 1);
  }

  return truncated;
}

// ============================================================================
// DOCUMENT CONTEXT COMPRESSION - kompresja kontekstu RAG
// ============================================================================

export interface DocumentContext {
  id: string;
  title: string;
  content: string;
  relevanceScore: number;
  metadata?: Record<string, unknown>;
}

export interface CompressedRAGContext {
  documents: DocumentContext[];
  municipalData: DocumentContext[];
  totalTokens: number;
  compressionRatio: number;
}

/**
 * Kompresuje kontekst RAG do określonego budżetu tokenów
 */
export function compressRAGContext(
  documents: DocumentContext[],
  municipalData: DocumentContext[],
  maxTokens: number = 8000
): CompressedRAGContext {
  // Oblicz oryginalne tokeny
  const originalTokens =
    documents.reduce((sum, d) => sum + estimateTokens(d.content), 0) +
    municipalData.reduce((sum, d) => sum + estimateTokens(d.content), 0);

  // Sortuj według relevance (najważniejsze pierwsze)
  const sortedDocs = [...documents].sort(
    (a, b) => b.relevanceScore - a.relevanceScore
  );
  const sortedMunicipal = [...municipalData].sort(
    (a, b) => b.relevanceScore - a.relevanceScore
  );

  // Podziel budżet: 60% dokumenty, 40% dane gminne
  const docBudget = Math.floor(maxTokens * 0.6);
  const municipalBudget = Math.floor(maxTokens * 0.4);

  // Kompresuj dokumenty
  const compressedDocs = compressDocumentList(sortedDocs, docBudget);
  const compressedMunicipal = compressDocumentList(
    sortedMunicipal,
    municipalBudget
  );

  const totalTokens =
    compressedDocs.reduce((sum, d) => sum + estimateTokens(d.content), 0) +
    compressedMunicipal.reduce((sum, d) => sum + estimateTokens(d.content), 0);

  return {
    documents: compressedDocs,
    municipalData: compressedMunicipal,
    totalTokens,
    compressionRatio: originalTokens > 0 ? totalTokens / originalTokens : 1,
  };
}

/**
 * Kompresuje listę dokumentów do budżetu tokenów
 */
function compressDocumentList(
  docs: DocumentContext[],
  maxTokens: number
): DocumentContext[] {
  const result: DocumentContext[] = [];
  let currentTokens = 0;

  // Minimalne tokeny na dokument (tytuł + metadata)
  const minTokensPerDoc = 50;

  for (const doc of docs) {
    const docTokens = estimateTokens(doc.content);
    const titleTokens = estimateTokens(doc.title) + 10; // overhead

    if (currentTokens + titleTokens + minTokensPerDoc > maxTokens) {
      // Brak miejsca na więcej dokumentów
      break;
    }

    const availableTokens = Math.min(
      docTokens,
      maxTokens - currentTokens - titleTokens
    );

    // Kompresuj treść jeśli potrzeba
    const compressedContent = compressText(doc.content, {
      maxTokens: availableTokens,
      preserveStructure: true,
    });

    result.push({
      ...doc,
      content: compressedContent,
    });

    currentTokens += estimateTokens(compressedContent) + titleTokens;
  }

  return result;
}

// ============================================================================
// CONVERSATION HISTORY COMPRESSION - kompresja historii
// ============================================================================

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CompressedHistory {
  messages: ConversationMessage[];
  summary?: string;
  totalTokens: number;
  originalCount: number;
  keptCount: number;
}

/**
 * Kompresuje historię konwersacji
 * Strategia:
 * 1. Zawsze zachowaj ostatnie N wiadomości w pełni
 * 2. Starsze wiadomości -> podsumowanie
 */
export function compressConversationHistory(
  messages: ConversationMessage[],
  maxTokens: number = 2000,
  keepLastN: number = 4
): CompressedHistory {
  if (messages.length === 0) {
    return {
      messages: [],
      totalTokens: 0,
      originalCount: 0,
      keptCount: 0,
    };
  }

  const originalCount = messages.length;

  // Jeśli mało wiadomości - zachowaj wszystkie
  if (messages.length <= keepLastN) {
    const totalTokens = estimateMessagesTokens(messages);
    if (totalTokens <= maxTokens) {
      return {
        messages,
        totalTokens,
        originalCount,
        keptCount: messages.length,
      };
    }
  }

  // Podziel na ostatnie i starsze
  const recentMessages = messages.slice(-keepLastN);
  const olderMessages = messages.slice(0, -keepLastN);

  const recentTokens = estimateMessagesTokens(recentMessages);
  const summaryBudget = maxTokens - recentTokens - 100; // 100 tokenów na overhead

  let summary: string | undefined;

  if (olderMessages.length > 0 && summaryBudget > 100) {
    // Stwórz podsumowanie starszych wiadomości
    summary = createConversationSummary(olderMessages, summaryBudget);
  }

  const result: ConversationMessage[] = [];

  if (summary) {
    result.push({
      role: "system",
      content: `[Podsumowanie wcześniejszej rozmowy]\n${summary}`,
    });
  }

  result.push(...recentMessages);

  return {
    messages: result,
    summary,
    totalTokens: estimateMessagesTokens(result),
    originalCount,
    keptCount: recentMessages.length,
  };
}

/**
 * Tworzy podsumowanie konwersacji
 */
function createConversationSummary(
  messages: ConversationMessage[],
  maxTokens: number
): string {
  // Wyciągnij kluczowe punkty z każdej wiadomości
  const points: string[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      // Wyciągnij pytanie/temat
      const firstLine = (msg.content.split("\n")[0] || "").substring(0, 100);
      points.push(`- Pytanie: ${firstLine}`);
    } else if (msg.role === "assistant") {
      // Wyciągnij kluczową odpowiedź (pierwsze zdanie)
      const firstSentence = (msg.content.split(/[.!?]/)[0] || "").substring(
        0,
        150
      );
      if (firstSentence.length > 20) {
        points.push(`- Odpowiedź: ${firstSentence}`);
      }
    }
  }

  let summary = points.join("\n");

  // Skróć jeśli za długie
  if (estimateTokens(summary) > maxTokens) {
    summary = truncateToTokens(summary, maxTokens);
  }

  return summary;
}

// ============================================================================
// FULL CONTEXT OPTIMIZER - optymalizacja całego kontekstu
// ============================================================================

export interface ContextBudget {
  systemPrompt: number; // Tokeny na system prompt
  ragContext: number; // Tokeny na kontekst RAG
  history: number; // Tokeny na historię
  userMessage: number; // Tokeny na wiadomość użytkownika
  completion: number; // Zarezerwowane na odpowiedź
}

export interface OptimizedContext {
  systemPrompt: string;
  ragContextMessage?: string;
  historyMessages: ConversationMessage[];
  userMessage: string;
  totalTokens: number;
  budget: ContextBudget;
  savings: {
    originalTokens: number;
    compressedTokens: number;
    savedTokens: number;
    savingsPercent: number;
  };
}

/**
 * Domyślne budżety dla różnych modeli
 */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4-turbo": 128000,
  "gpt-4": 8192,
  "gpt-3.5-turbo": 16385,
  "gpt-3.5-turbo-16k": 16385,
  "claude-3-opus": 200000,
  "claude-3-sonnet": 200000,
  "claude-3-haiku": 200000,
  default: 8000,
};

/**
 * Optymalizuje cały kontekst dla wywołania AI
 */
export function optimizeContext(
  systemPrompt: string,
  ragDocuments: DocumentContext[],
  ragMunicipalData: DocumentContext[],
  conversationHistory: ConversationMessage[],
  userMessage: string,
  modelName: string = "default",
  maxCompletionTokens: number = 2000
): OptimizedContext {
  // Określ limit kontekstu dla modelu
  const modelLimit =
    MODEL_CONTEXT_LIMITS[modelName] ?? MODEL_CONTEXT_LIMITS["default"] ?? 8000;
  const availableTokens = modelLimit - maxCompletionTokens;

  // Oblicz oryginalne tokeny
  const originalSystemTokens = estimateTokens(systemPrompt);
  const originalRagTokens =
    ragDocuments.reduce(
      (sum, d) => sum + estimateTokens(d.content) + estimateTokens(d.title),
      0
    ) +
    ragMunicipalData.reduce(
      (sum, d) => sum + estimateTokens(d.content) + estimateTokens(d.title),
      0
    );
  const originalHistoryTokens = estimateMessagesTokens(conversationHistory);
  const userMessageTokens = estimateTokens(userMessage);

  const originalTotal =
    originalSystemTokens +
    originalRagTokens +
    originalHistoryTokens +
    userMessageTokens;

  // Przydziel budżet
  // System prompt: stały (nie kompresujemy)
  // User message: stały
  // Reszta: RAG 60%, Historia 40%
  // WAŻNE: Twardy limit 6000 tokenów dla bezpieczeństwa (niektóre API mają niższe limity)
  const safeAvailableTokens = Math.min(availableTokens, 6000);
  const fixedTokens = originalSystemTokens + userMessageTokens + 100; // 100 overhead
  const flexibleBudget = Math.max(0, safeAvailableTokens - fixedTokens);

  const budget: ContextBudget = {
    systemPrompt: originalSystemTokens,
    userMessage: userMessageTokens,
    ragContext: Math.floor(flexibleBudget * 0.65),
    history: Math.floor(flexibleBudget * 0.35),
    completion: maxCompletionTokens,
  };

  // Kompresuj RAG context
  const compressedRag = compressRAGContext(
    ragDocuments,
    ragMunicipalData,
    budget.ragContext
  );

  // Kompresuj historię
  const compressedHistory = compressConversationHistory(
    conversationHistory,
    budget.history
  );

  // Zbuduj wiadomość RAG
  let ragContextMessage: string | undefined;
  if (
    compressedRag.documents.length > 0 ||
    compressedRag.municipalData.length > 0
  ) {
    ragContextMessage = buildRAGMessage(compressedRag);
  }

  // Oblicz finalne tokeny
  const compressedTotal =
    originalSystemTokens +
    (ragContextMessage ? estimateTokens(ragContextMessage) : 0) +
    compressedHistory.totalTokens +
    userMessageTokens;

  return {
    systemPrompt,
    ragContextMessage,
    historyMessages: compressedHistory.messages,
    userMessage,
    totalTokens: compressedTotal,
    budget,
    savings: {
      originalTokens: originalTotal,
      compressedTokens: compressedTotal,
      savedTokens: originalTotal - compressedTotal,
      savingsPercent:
        originalTotal > 0
          ? Math.round((1 - compressedTotal / originalTotal) * 100)
          : 0,
    },
  };
}

/**
 * Buduje wiadomość RAG z skompresowanego kontekstu
 */
function buildRAGMessage(context: CompressedRAGContext): string {
  let message = "# KONTEKST DOKUMENTÓW\n\n";

  if (context.documents.length > 0) {
    message += "## Dokumenty:\n\n";
    context.documents.forEach((doc, idx) => {
      message += `### [${idx + 1}] ${doc.title}\n`;
      if (doc.metadata && doc.metadata.sourceUrl) {
        message += `Źródło: ${String(doc.metadata.sourceUrl)}\n`;
      }
      message += `${doc.content}\n\n`;
    });
  }

  if (context.municipalData.length > 0) {
    message += "## Dane samorządowe:\n\n";
    context.municipalData.forEach((item, idx) => {
      message += `### [${idx + 1}] ${item.title}\n${item.content}\n\n`;
    });
  }

  message += "_Wykorzystaj powyższy kontekst w odpowiedzi. Cytuj źródła._";

  return message;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ContextCompressor = {
  estimateTokens,
  estimateMessagesTokens,
  compressText,
  compressRAGContext,
  compressConversationHistory,
  optimizeContext,
  MODEL_CONTEXT_LIMITS,
};

export default ContextCompressor;
