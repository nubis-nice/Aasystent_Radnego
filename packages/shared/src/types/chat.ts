import { z } from "zod";

// ============================================================================
// Chat Message Types
// ============================================================================

export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const CitationSchema = z.object({
  documentId: z.string().uuid().optional(),
  documentTitle: z.string(),
  page: z.number().optional(),
  chunkIndex: z.number().optional(),
  text: z.string(),
  relevanceScore: z.number().optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  citations: z.array(CitationSchema).default([]),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
});
export type Message = z.infer<typeof MessageSchema>;

// ============================================================================
// Conversation Types
// ============================================================================

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const ConversationWithMessagesSchema = ConversationSchema.extend({
  messages: z.array(MessageSchema),
});
export type ConversationWithMessages = z.infer<
  typeof ConversationWithMessagesSchema
>;

// ============================================================================
// Chat Request/Response Types
// ============================================================================

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(50000), // Zwiększony limit dla analizy dokumentów
  conversationId: z.string().uuid().optional(),
  includeDocuments: z.boolean().default(true),
  includeMunicipalData: z.boolean().default(true),
  temperature: z.number().min(0).max(2).default(0.7),
  systemPrompt: z.string().max(100000).optional(), // Opcjonalny system prompt dla kontekstu analizy
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  conversationId: z.string().uuid(),
  message: MessageSchema,
  relatedDocuments: z
    .array(
      z.object({
        id: z.string().uuid(),
        title: z.string(),
        relevanceScore: z.number(),
      })
    )
    .optional(),
  suggestedActions: z
    .array(
      z.object({
        type: z.string(),
        label: z.string(),
        data: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// ============================================================================
// Municipal Data Types
// ============================================================================

export const MunicipalDataTypeSchema = z.enum([
  "meeting",
  "resolution",
  "announcement",
  "news",
]);
export type MunicipalDataType = z.infer<typeof MunicipalDataTypeSchema>;

export const MunicipalDataSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  dataType: MunicipalDataTypeSchema,
  title: z.string(),
  content: z.string().nullable(),
  sourceUrl: z.string().url().nullable(),
  meetingDate: z.string().datetime().nullable(),
  scrapedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});
export type MunicipalData = z.infer<typeof MunicipalDataSchema>;

// ============================================================================
// Municipal Settings Types
// ============================================================================

export const MunicipalityTypeSchema = z.enum(["gmina", "miasto", "powiat"]);
export type MunicipalityType = z.infer<typeof MunicipalityTypeSchema>;

export const ScrapingFrequencySchema = z.enum(["daily", "weekly"]);
export type ScrapingFrequency = z.infer<typeof ScrapingFrequencySchema>;

export const MunicipalSettingsSchema = z.object({
  municipalityName: z.string().min(1).max(200),
  municipalityType: MunicipalityTypeSchema,
  bipUrl: z.string().url(),
  councilPageUrl: z.string().url().optional(),
  scrapingEnabled: z.boolean().default(false),
  scrapingFrequency: ScrapingFrequencySchema.default("daily"),
});
export type MunicipalSettings = z.infer<typeof MunicipalSettingsSchema>;

// ============================================================================
// Calendar Event Types
// ============================================================================

export const CalendarEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  googleEventId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().nullable(),
  attendees: z.array(z.string()).default([]),
  syncedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CreateCalendarEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().max(200).optional(),
  attendees: z.array(z.string().email()).optional(),
});
export type CreateCalendarEvent = z.infer<typeof CreateCalendarEventSchema>;

// ============================================================================
// AI System Prompts
// ============================================================================

export interface SystemPromptContext {
  municipalityName?: string;
  municipalityType?: MunicipalityType;
  userName?: string;
  userPosition?: string;
  recentDocuments?: Array<{
    title: string;
    type: string;
    date: string;
  }>;
  upcomingMeetings?: Array<{
    title: string;
    date: string;
  }>;
}

export function buildSystemPrompt(context: SystemPromptContext): string {
  const { municipalityName, municipalityType, userName, userPosition } =
    context;

  return `Jesteś doświadczonym Asystentem Radnego - inteligentnym systemem AI wspierającym pracę radnych samorządowych.

# TWOJA ROLA I KOMPETENCJE

## 1. PRAWNIK SAMORZĄDOWY
- Znasz ustawy o samorządzie gminnym, powiatowym i wojewódzkim
- Jesteś ekspertem prawa administracyjnego i budżetowego
- Specjalizujesz się w procedurach uchwałodawczych
- Znasz orzecznictwo NSA i interpretacje prawne

## 2. ANALITYK DOKUMENTÓW
- Analizujesz projekty uchwał i ich skutki prawne i finansowe
- Identyfikujesz ryzyka i potencjalne problemy
- Porównujesz z wcześniejszymi decyzjami i praktyką
- Wyciągasz wnioski i rekomendacje

## 3. DZIAŁACZ LOKALNY
${
  municipalityName
    ? `- Pracujesz dla: ${municipalityName} (${municipalityType || "samorząd"})`
    : "- Wspierasz pracę samorządu lokalnego"
}
- Znasz specyfikę lokalnych problemów i potrzeb mieszkańców
- Pomagasz w komunikacji z wyborcami
- Doradzasz w sprawach społeczności lokalnej

## 4. ORGANIZATOR I DORADCA
- Pomagasz w przygotowaniu wystąpień i argumentacji
- Przypominasz o terminach i deadlinach
- Sugerujesz działania i rozwiązania
- Organizujesz wiedzę i dokumenty

# KONTEKST UŻYTKOWNIKA

${userName ? `Użytkownik: ${userName}` : "Użytkownik: Radny"}
${userPosition ? `Stanowisko: ${userPosition}` : ""}
${municipalityName ? `Teren działania: ${municipalityName}` : ""}

# ZASADY PRACY

1. **DOKŁADNOŚĆ**: Zawsze podawaj źródła i cytaty z dokumentów
2. **OBIEKTYWIZM**: Przedstawiaj różne perspektywy i argumenty
3. **PRAKTYCZNOŚĆ**: Dawaj konkretne, wykonalne rekomendacje
4. **PRZEJRZYSTOŚĆ**: Wyjaśniaj skomplikowane kwestie prostym językiem
5. **AKTUALNOŚĆ**: Uwzględniaj najnowsze przepisy i orzecznictwo

# FORMAT ODPOWIEDZI

- Używaj jasnego, zwięzłego języka
- Strukturyzuj odpowiedzi (punkty, nagłówki)
- Zawsze cytuj źródła i dokumenty
- Podkreślaj kluczowe informacje
- Sugeruj dalsze kroki jeśli to właściwe

# PREZENTACJA DOKUMENTÓW

Gdy prezentujesz listę znalezionych dokumentów:
- **NIGDY nie pokazuj duplikatów** - jeśli dwa dokumenty mają identyczny lub bardzo podobny tytuł, pokaż tylko jeden
- Rozróżniaj dokumenty przez: numer uchwały, datę, typ dokumentu
- Jeśli wyniki są zbyt podobne, połącz je w jedną pozycję z informacją o wersjach
- Format listy: "1. [Tytuł] (typ, data/numer)" - zawsze podaj unikalny identyfikator

# WAŻNE

- Jeśli nie masz pewności, przyznaj to otwarcie
- Zawsze zalecaj weryfikację u prawnika w sprawach prawnych
- Nie podejmuj decyzji za użytkownika, tylko doradzaj
- Szanuj poufność i prywatność danych

Odpowiadaj zawsze po polsku, profesjonalnie i pomocnie.`;
}

// ============================================================================
// RAG Context Types
// ============================================================================

export interface RAGContext {
  documents: Array<{
    id: string;
    title: string;
    content: string;
    relevanceScore: number;
    metadata?: Record<string, unknown>;
  }>;
  municipalData: Array<{
    id: string;
    title: string;
    content: string;
    dataType: MunicipalDataType;
    relevanceScore: number;
  }>;
}

export interface ChatContext {
  systemPrompt: string;
  conversationHistory: Array<{
    role: MessageRole;
    content: string;
  }>;
  ragContext?: RAGContext;
}
