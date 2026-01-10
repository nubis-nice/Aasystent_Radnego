import { z } from "zod";
// ============================================================================
// Chat Message Types
// ============================================================================
export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);
export const CitationSchema = z.object({
    documentId: z.string().uuid().optional(),
    documentTitle: z.string(),
    page: z.number().optional(),
    chunkIndex: z.number().optional(),
    text: z.string(),
    relevanceScore: z.number().optional(),
});
export const MessageSchema = z.object({
    id: z.string().uuid(),
    conversationId: z.string().uuid(),
    role: MessageRoleSchema,
    content: z.string(),
    citations: z.array(CitationSchema).default([]),
    metadata: z.record(z.unknown()).optional(),
    createdAt: z.string().datetime(),
});
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
export const ConversationWithMessagesSchema = ConversationSchema.extend({
    messages: z.array(MessageSchema),
});
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
export const ChatResponseSchema = z.object({
    conversationId: z.string().uuid(),
    message: MessageSchema,
    relatedDocuments: z
        .array(z.object({
        id: z.string().uuid(),
        title: z.string(),
        relevanceScore: z.number(),
    }))
        .optional(),
    suggestedActions: z
        .array(z.object({
        type: z.string(),
        label: z.string(),
        data: z.record(z.unknown()).optional(),
    }))
        .optional(),
});
// ============================================================================
// Municipal Data Types
// ============================================================================
export const MunicipalDataTypeSchema = z.enum([
    "meeting",
    "resolution",
    "announcement",
    "news",
]);
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
// ============================================================================
// Municipal Settings Types
// ============================================================================
export const MunicipalityTypeSchema = z.enum(["gmina", "miasto", "powiat"]);
export const ScrapingFrequencySchema = z.enum(["daily", "weekly"]);
export const MunicipalSettingsSchema = z.object({
    municipalityName: z.string().min(1).max(200),
    municipalityType: MunicipalityTypeSchema,
    bipUrl: z.string().url(),
    councilPageUrl: z.string().url().optional(),
    scrapingEnabled: z.boolean().default(false),
    scrapingFrequency: ScrapingFrequencySchema.default("daily"),
});
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
export const CreateCalendarEventSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    location: z.string().max(200).optional(),
    attendees: z.array(z.string().email()).optional(),
});
export function buildSystemPrompt(context) {
    const { municipalityName, municipalityType, userName, userPosition } = context;
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
${municipalityName
        ? `- Pracujesz dla: ${municipalityName} (${municipalityType || "samorząd"})`
        : "- Wspierasz pracę samorządu lokalnego"}
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

# WAŻNE

- Jeśli nie masz pewności, przyznaj to otwarcie
- Zawsze zalecaj weryfikację u prawnika w sprawach prawnych
- Nie podejmuj decyzji za użytkownika, tylko doradzaj
- Szanuj poufność i prywatność danych

Odpowiadaj zawsze po polsku, profesjonalnie i pomocnie.`;
}
//# sourceMappingURL=chat.js.map