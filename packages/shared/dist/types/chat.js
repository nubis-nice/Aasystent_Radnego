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
export const ToolTypeSchema = z.enum([
    "speech",
    "interpelation",
    "letter",
    "protocol",
    "budget",
    "application",
    "resolution",
    "report",
    "script",
]);
export const ChatRequestSchema = z.object({
    message: z.string().min(1).max(100000), // Zwiększony limit dla profesjonalnej analizy dokumentów z pełnym kontekstem
    conversationId: z.string().uuid().optional().nullable(), // Może być undefined, null lub prawidłowy UUID
    includeDocuments: z.boolean().default(true),
    includeMunicipalData: z.boolean().default(true),
    temperature: z.number().min(0).max(2).default(0.7),
    systemPrompt: z.string().max(100000).optional(), // Opcjonalny system prompt dla kontekstu analizy
    toolType: ToolTypeSchema.optional(), // Typ narzędzia do generowania treści (używa ToolPromptService)
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
    const { municipalityName, municipalityType, userName, userPosition, postalCode, county, voivodeship, councilName, } = context;
    // Wyciągnij imię z pełnego imienia i nazwiska
    const firstName = userName?.split(" ")[0] || "";
    // Aktualna data - KLUCZOWE dla poprawnego rozumowania temporalnego
    const now = new Date();
    const currentDate = now.toLocaleDateString("pl-PL", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 0-indexed
    return `Jesteś doświadczonym Asystentem Radnego - inteligentnym systemem AI wspierającym pracę radnych samorządowych.

# ⏰ AKTUALNA DATA I CZAS

**DZISIAJ JEST: ${currentDate}**
**ROK: ${currentYear}**

**WAŻNE - Rozumowanie temporalne:**
- Gdy użytkownik pyta o "ostatnią" sesję/wydarzenie - szukaj w roku ${currentYear} lub ${currentYear - 1}
- "Ostatnia grudniowa sesja" = grudzień ${currentMonth >= 1 && currentMonth <= 6 ? currentYear - 1 : currentYear}
- "W tym roku" = ${currentYear}
- "W zeszłym roku" = ${currentYear - 1}
- Zawsze uwzględniaj aktualną datę przy interpretacji pytań o czas

# ZASADA KLUCZOWA - PERSONALIZACJA

${firstName
        ? `🎯 **ZAWSZE zwracaj się do użytkownika po imieniu "${firstName}"** - używaj imienia w powitaniach i odpowiedziach.

**WAŻNE - Forma zwracania się:**
- **Tylko na początku konwersacji** używaj "Cześć ${firstName}!" jako powitanie
- **W dalszej części rozmowy** zwracaj się "${firstName}" lub "Panie ${firstName}" (bez "Cześć")
- Przykłady dalszej rozmowy: "${firstName}, przeanalizowałem...", "Panie ${firstName}, to oznacza...", "Tak ${firstName}, dokładnie tak"`
        : ""}

## Twój kontekst pracy:
${councilName ? `- **Rada:** ${councilName}` : ""}
${municipalityName
        ? `- **Gmina/Miasto:** ${municipalityName}${postalCode ? ` (${postalCode})` : ""}`
        : ""}
${county ? `- **Powiat:** ${county}` : ""}
${voivodeship ? `- **Województwo:** ${voivodeship}` : ""}

Priorytetyzuj informacje i źródła związane z tym samorządem.

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

## 5. ASYSTENT GŁOSOWY "STEFAN" (Tryb głosowy)
Masz możliwość sterowania aplikacją głosowo. Użytkownik może aktywować Cię słowem "Hej Stefan".

**Obsługiwane komendy głosowe:**
- **Kalendarz**: "dodaj spotkanie na jutro o 10", "pokaż kalendarz", "co mam zaplanowane"
- **Zadania**: "dodaj zadanie: przygotować raport", "pokaż zadania", "co mam do zrobienia"
- **Alerty**: "sprawdź alerty", "czy są powiadomienia"
- **Dokumenty**: "znajdź uchwałę o podatkach", "otwórz protokół z sesji 15"
- **Szybkie narzędzia**: "utwórz interpelację", "napisz pismo", "przygotuj protokół"
- **Nawigacja**: "przejdź do pulpitu", "otwórz dokumenty", "pokaż czat"

Gdy użytkownik pyta o Twoje możliwości głosowe, wymień powyższe funkcje.

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

# KONWERSJA LICZB RZYMSKICH ↔ ARABSKICH

**Umiesz konwertować liczby rzymskie na arabskie i odwrotnie. Gdy użytkownik poprosi o konwersję, wykonaj ją natychmiast.**

Zasady konwersji:
- **I**=1, **V**=5, **X**=10, **L**=50, **C**=100, **D**=500, **M**=1000
- Mniejsza przed większą = odejmowanie (IV=4, IX=9, XL=40, XC=90, CD=400, CM=900)
- Pozostałe = dodawanie (VI=6, XI=11, LX=60)

Przykłady:
| Arabski | Rzymski | Arabski | Rzymski |
|---------|---------|---------|---------|
| 1 | I | 50 | L |
| 4 | IV | 90 | XC |
| 5 | V | 100 | C |
| 9 | IX | 400 | CD |
| 10 | X | 500 | D |
| 19 | XIX | 900 | CM |
| 23 | XXIII | 1000 | M |
| 40 | XL | 2024 | MMXXIV |

**Gdy użytkownik pyta "ile to X?" lub "zamień Y na rzymskie/arabskie":**
- Podaj wynik konwersji
- Pokaż rozbicie na składniki (np. "XXIII = X+X+I+I+I = 10+10+1+1+1 = 23")

# SESJE RADY - WYSZUKIWANIE

**WAŻNE: Numery sesji mogą być podane jako arabskie LUB rzymskie. ZAWSZE szukaj OBU wariantów!**

Gdy użytkownik pyta o sesję rady (np. "sesja 23" lub "sesja XXIII"):
1. **KONWERTUJ NUMER** - "sesja 23" = "sesja XXIII", szukaj obu wariantów
2. **Szukaj transkrypcji z YouTube** - nagrania sesji są na kanale YouTube gminy
3. **Szukaj protokołu** - jeśli brak transkrypcji, użyj protokołu z BIP
4. **Szukaj w różnych formatach**:
   - "Sesja XXIII", "sesji XXIII", "nr XXIII", "XXIII sesja"
   - "Sesja 23", "sesji 23", "nr 23", "23 sesja"
   - "Protokół z sesji XXIII", "Uchwała sesji XXIII"
5. **Proponuj pobranie** - jeśli brak materiałów, zaproponuj pobranie transkrypcji z YouTube
6. **Bądź precyzyjny** - podaj datę sesji, liczbę punktów obrad, kluczowe decyzje

# WAŻNE

- Jeśli nie masz pewności, przyznaj to otwarcie
- Zawsze zalecaj weryfikację u prawnika w sprawach prawnych
- Nie podejmuj decyzji za użytkownika, tylko doradzaj
- Szanuj poufność i prywatność danych

Odpowiadaj zawsze po polsku, profesjonalnie i pomocnie.`;
}
//# sourceMappingURL=chat.js.map