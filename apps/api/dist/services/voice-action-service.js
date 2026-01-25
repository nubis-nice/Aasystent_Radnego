/**
 * VoiceActionService - Serwis obsługujący akcje głosowe Stefana
 *
 * Obsługuje:
 * - Kalendarz (dodawanie/edycja wydarzeń)
 * - Zadania (tworzenie/zarządzanie)
 * - Alerty (powiadomienia)
 * - QuickTools (szybkie narzędzia)
 * - Dokumenty (wyszukiwanie/otwieranie)
 * - Nawigacja w aplikacji
 */
import { getLLMClient, getAIConfig } from "../ai/index.js";
import { supabase } from "../lib/supabase.js";
// Prompt do wykrywania akcji głosowych
const VOICE_ACTION_PROMPT = `Jesteś asystentem głosowym Stefan. Analizujesz polecenia użytkownika i wykrywasz jaką akcję chce wykonać.

# DOSTĘPNE AKCJE:

## KALENDARZ:
- **calendar_add** → "dodaj do kalendarza", "zaplanuj spotkanie", "wpisz wydarzenie"
- **calendar_list** → "pokaż kalendarz", "co mam zaplanowane", "jakie mam spotkania"
- **calendar_edit** → "zmień termin", "przesuń spotkanie"
- **calendar_delete** → "usuń z kalendarza", "odwołaj spotkanie"

## ZADANIA:
- **task_add** → "dodaj zadanie", "zanotuj do zrobienia", "przypomnij mi o"
- **task_list** → "pokaż zadania", "co mam do zrobienia", "lista zadań"
- **task_complete** → "oznacz jako zrobione", "ukończ zadanie"
- **task_delete** → "usuń zadanie", "wykreśl"

## ALERTY:
- **alert_check** → "sprawdź alerty", "czy są jakieś powiadomienia", "co nowego"
- **alert_dismiss** → "odrzuć alert", "zamknij powiadomienie"

## DOKUMENTY:
- **document_search** → "znajdź dokument", "szukaj w dokumentach", "pokaż uchwały"
- **document_open** → "otwórz dokument", "pokaż mi [nazwa]"

## SZYBKIE NARZĘDZIA:
- **quick_tool** → "utwórz interpelację", "napisz pismo", "generuj protokół", "analiza budżetu", "przygotuj wystąpienie", "projekt uchwały", "raport"

Dla quick_tool ZAWSZE wyciągnij:
- toolName: typ narzędzia (interpelacja/pismo/protokół/budżet/wystąpienie/uchwała/raport)
- toolTopic: temat/przedmiot (np. "remont ul. Głównej")
- toolContext: dodatkowy kontekst z rozmowy
- toolRecipient: adresat jeśli wspomniany

## NAWIGACJA:
- **navigate** → "przejdź do", "otwórz stronę", "pokaż pulpit/dokumenty/chat/ustawienia"

## SPECJALNE:
- **execute_pending** → "wykonaj", "tak", "potwierdź", "zrób to"
- **clarification_needed** → gdy brakuje informacji do wykonania akcji

# REGUŁY:

1. Jeśli polecenie jest NIEKOMPLETNE (np. "dodaj spotkanie" bez daty/godziny), użyj **clarification_needed** i zapytaj o brakujące dane.

2. Dla DESTRUKCYJNYCH akcji (delete) zawsze używaj **confirmation_needed**.

3. Wyciągnij wszystkie ENCJE z polecenia:
   - eventTitle, eventDate, eventTime, eventLocation (kalendarz)
   - taskTitle, taskPriority, taskDueDate (zadania)
   - documentQuery, documentType (dokumenty)
   - toolName (szybkie narzędzia)
   - targetPage (nawigacja)

4. Jeśli użytkownik mówi "wykonaj", "tak", "potwierdź" → **execute_pending**

5. WAŻNE dla dat:
   - Parsuj KAŻDĄ datę do formatu DD-MM-YYYY (np. "03-02-2026")
   - Przykłady:
     * "jutro" → oblicz datę i zwróć "25-01-2026"
     * "wtorek przyszły tydzień" → oblicz datę i zwróć "03-02-2026"
     * "3 luty 2026" → "03-02-2026"
     * "15 stycznia" → "15-01-2026"
   - Jeśli użytkownik nie podał roku, użyj 2026
   - Jeśli nie możesz obliczyć daty, zwróć null i dodaj do missingInfo

# ODPOWIEDŹ (TYLKO JSON):

{
  "actionType": "action_name",
  "confidence": 0.95,
  "entities": {
    "eventTitle": "tytuł wydarzenia",
    "eventDate": "DD-MM-YYYY (np. '03-02-2026', '25-01-2026')",
    "eventTime": "HH:mm lub null",
    "eventLocation": "miejsce lub null",
    "taskTitle": "opcjonalnie",
    "documentQuery": "opcjonalnie",
    "toolName": "typ narzędzia",
    "toolTopic": "temat/przedmiot",
    "toolContext": "kontekst z rozmowy",
    "toolRecipient": "adresat jeśli wspomniany",
    "targetPage": "opcjonalnie"
  },
  "missingInfo": ["lista brakujących informacji"],
  "clarificationQuestion": "pytanie do użytkownika jeśli brakuje info",
  "userFriendlyDescription": "Co zamierzam zrobić"
}`;
/**
 * Parsuje datę z formatu DD-MM-YYYY
 * LLM już przetwarza naturalne daty, tutaj tylko konwersja do Date
 */
function parseNaturalDate(dateStr) {
    if (!dateStr)
        return null;
    // Format DD-MM-YYYY (główny format z LLM)
    const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
        const year = parseInt(ddmmyyyyMatch[3], 10);
        return new Date(year, month, day);
    }
    // Format DD.MM.YYYY (fallback)
    const dotMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dotMatch) {
        const day = parseInt(dotMatch[1], 10);
        const month = parseInt(dotMatch[2], 10) - 1;
        const year = parseInt(dotMatch[3], 10);
        return new Date(year, month, day);
    }
    // Format YYYY-MM-DD (fallback)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(dateStr + "T00:00:00");
    }
    return null;
}
export class VoiceActionService {
    userId;
    llmClient = null;
    model = "gpt-4o-mini";
    pendingActions = new Map();
    constructor(userId) {
        this.userId = userId;
    }
    async initialize() {
        if (this.llmClient)
            return;
        this.llmClient = await getLLMClient(this.userId);
        const config = await getAIConfig(this.userId, "llm");
        this.model = config.modelName;
    }
    /**
     * Główna metoda - przetwarza polecenie głosowe
     */
    async processVoiceCommand(command, context) {
        await this.initialize();
        // Sprawdź czy to potwierdzenie oczekującej akcji
        if (this.isConfirmationCommand(command)) {
            return this.executePendingAction(context?.pendingActionId);
        }
        // Wykryj typ akcji
        const detection = await this.detectAction(command);
        // Jeśli brakuje informacji, poproś o uzupełnienie
        if (detection.actionType === "clarification_needed") {
            return {
                success: true,
                actionType: "clarification_needed",
                message: detection.clarificationQuestion ||
                    "Potrzebuję więcej informacji. Co dokładnie mam zrobić?",
            };
        }
        // Wykonaj lub zaplanuj akcję
        return this.executeAction(detection);
    }
    /**
     * Wykryj czy to polecenie potwierdzenia
     */
    isConfirmationCommand(command) {
        const confirmPatterns = [
            /^(tak|yes|ok|okej|wykonaj|potwierdź|zrób to|dawaj|rób|jasne|zgoda)$/i,
            /^(tak,?\s*(proszę|wykonaj|zrób))$/i,
        ];
        const text = command.toLowerCase().trim();
        return confirmPatterns.some((p) => p.test(text));
    }
    /**
     * Wykryj typ akcji z polecenia
     */
    async detectAction(command) {
        if (!this.llmClient)
            throw new Error("LLM not initialized");
        try {
            const completion = await this.llmClient.chat.completions.create({
                model: this.model,
                messages: [
                    { role: "system", content: VOICE_ACTION_PROMPT },
                    { role: "user", content: command },
                ],
                temperature: 0.1,
                response_format: { type: "json_object" },
            });
            let jsonContent = completion.choices[0]?.message?.content || "{}";
            jsonContent = jsonContent
                .replace(/^```(?:json)?\s*/i, "")
                .replace(/\s*```$/i, "")
                .trim();
            const result = JSON.parse(jsonContent);
            return {
                actionType: result.actionType || "clarification_needed",
                confidence: result.confidence || 0.5,
                entities: result.entities || {},
                missingInfo: result.missingInfo || [],
                clarificationQuestion: result.clarificationQuestion,
                description: result.userFriendlyDescription || "Przetwarzam polecenie...",
            };
        }
        catch (error) {
            console.error("[VoiceActionService] Detection error:", error);
            return {
                actionType: "clarification_needed",
                confidence: 0,
                entities: {},
                missingInfo: ["wszystko"],
                clarificationQuestion: "Przepraszam, nie zrozumiałem. Czy możesz powtórzyć?",
                description: "Błąd rozpoznawania",
            };
        }
    }
    /**
     * Wykonaj lub zaplanuj akcję
     */
    async executeAction(detection) {
        const { actionType, entities, missingInfo } = detection;
        // Jeśli brakuje kluczowych informacji
        if (missingInfo.length > 0 &&
            actionType !== "navigate" &&
            actionType !== "alert_check") {
            return {
                success: true,
                actionType: "clarification_needed",
                message: detection.clarificationQuestion ||
                    `Potrzebuję dodatkowych informacji: ${missingInfo.join(", ")}`,
            };
        }
        // Wykonaj akcję w zależności od typu
        switch (actionType) {
            case "calendar_add":
                return this.handleCalendarAdd(entities);
            case "calendar_list":
                return this.handleCalendarList();
            case "task_add":
                return this.handleTaskAdd(entities);
            case "task_list":
                return this.handleTaskList();
            case "task_complete":
                return this.handleTaskComplete(entities);
            case "alert_check":
                return this.handleAlertCheck();
            case "document_search":
                return this.handleDocumentSearch(entities);
            case "quick_tool":
                return this.handleQuickTool(entities);
            case "navigate":
                return this.handleNavigation(entities);
            default:
                return {
                    success: false,
                    actionType,
                    message: `Nieobsługiwany typ akcji: ${actionType}`,
                };
        }
    }
    /**
     * Wykonaj oczekującą akcję
     */
    async executePendingAction(actionId) {
        // Znajdź ostatnią oczekującą akcję
        let pending;
        if (actionId) {
            pending = this.pendingActions.get(actionId);
        }
        else {
            // Weź ostatnią
            const entries = Array.from(this.pendingActions.entries());
            if (entries.length > 0) {
                pending = entries[entries.length - 1][1];
            }
        }
        if (!pending) {
            return {
                success: false,
                actionType: "execute_pending",
                message: "Nie mam żadnej oczekującej akcji do wykonania.",
            };
        }
        // Sprawdź czy nie wygasła
        if (new Date() > pending.expiresAt) {
            this.pendingActions.delete(pending.id);
            return {
                success: false,
                actionType: "execute_pending",
                message: "Ta akcja wygasła. Proszę, wydaj polecenie ponownie.",
            };
        }
        // Wykonaj akcję
        this.pendingActions.delete(pending.id);
        return this.executeAction({
            actionType: pending.type,
            entities: pending.params,
            missingInfo: [],
            description: pending.description,
        });
    }
    // ============ HANDLERY AKCJI ============
    /**
     * Dodaj wydarzenie do kalendarza
     */
    async handleCalendarAdd(entities) {
        const title = entities.eventTitle;
        const date = entities.eventDate;
        const time = entities.eventTime;
        const location = entities.eventLocation;
        if (!title || !date) {
            return {
                success: true,
                actionType: "clarification_needed",
                message: "Podaj tytuł i datę wydarzenia. Na przykład: 'Dodaj spotkanie z burmistrzem na jutro o 10:00'",
            };
        }
        try {
            // Parsuj datę z formatu DD-MM-YYYY (LLM już przetwarza naturalne daty)
            let eventDate = parseNaturalDate(date);
            if (!eventDate) {
                console.error(`[VoiceAction] Failed to parse date: "${date}"`);
                return {
                    success: false,
                    actionType: "calendar_add",
                    message: `Nie udało się przetworzyć daty "${date}". Spróbuj podać datę w innym formacie.`,
                };
            }
            // Ustaw godzinę
            if (time) {
                const [hours, minutes] = time.split(":").map(Number);
                eventDate.setHours(hours, minutes || 0, 0, 0);
            }
            else {
                // Domyślna godzina 10:00 jeśli nie podano
                eventDate.setHours(10, 0, 0, 0);
            }
            // Zapisz do bazy
            const { data, error } = await supabase
                .from("user_calendar_events")
                .insert({
                user_id: this.userId,
                title,
                start_date: eventDate.toISOString(),
                end_date: new Date(eventDate.getTime() + 60 * 60 * 1000).toISOString(), // +1h
                location: location || null,
                description: `Utworzone głosowo przez Stefana`,
                event_type: "meeting",
                all_day: false,
                color: "primary",
                reminder_minutes: [1440, 60], // Przypomnienie 24h i 1h przed
            })
                .select()
                .single();
            if (error) {
                console.error("[VoiceAction] Calendar insert error:", error);
                throw error;
            }
            console.log(`[VoiceAction] ✅ Event created: "${title}" on ${eventDate.toISOString()} for user ${this.userId}`);
            return {
                success: true,
                actionType: "calendar_add",
                message: `Dodałem do kalendarza: "${title}" na ${this.formatDate(eventDate)}${time ? ` o ${time}` : ""}`,
                data,
                uiAction: {
                    type: "refresh",
                    target: "calendar",
                    data: {
                        type: "success",
                        message: `Wydarzenie "${title}" dodane do kalendarza`,
                    },
                },
            };
        }
        catch (error) {
            console.error("[VoiceAction] Calendar add error:", error);
            return {
                success: false,
                actionType: "calendar_add",
                message: "Nie udało się dodać wydarzenia do kalendarza. Spróbuj ponownie.",
            };
        }
    }
    /**
     * Pokaż listę wydarzeń
     */
    async handleCalendarList() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const weekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
            const { data, error } = await supabase
                .from("user_calendar_events")
                .select("*")
                .eq("user_id", this.userId)
                .gte("start_date", today.toISOString())
                .lte("start_date", weekLater.toISOString())
                .order("start_date", { ascending: true })
                .limit(10);
            if (error)
                throw error;
            if (!data || data.length === 0) {
                return {
                    success: true,
                    actionType: "calendar_list",
                    message: "Nie masz żadnych zaplanowanych wydarzeń w najbliższym tygodniu.",
                    data: [],
                };
            }
            const eventList = data
                .map((e) => {
                const date = new Date(e.start_date);
                return `• ${e.title} - ${this.formatDate(date)} o ${date.toLocaleTimeString("pl-PL", {
                    hour: "2-digit",
                    minute: "2-digit",
                })}`;
            })
                .join("\n");
            return {
                success: true,
                actionType: "calendar_list",
                message: `Masz ${data.length} wydarzeń w najbliższym tygodniu:\n${eventList}`,
                data,
                uiAction: {
                    type: "navigate",
                    target: "/dashboard",
                },
            };
        }
        catch (error) {
            console.error("[VoiceAction] Calendar list error:", error);
            return {
                success: false,
                actionType: "calendar_list",
                message: "Nie udało się pobrać kalendarza.",
            };
        }
    }
    /**
     * Dodaj zadanie
     */
    async handleTaskAdd(entities) {
        const title = entities.taskTitle;
        const priority = entities.taskPriority || "medium";
        const dueDate = entities.taskDueDate;
        if (!title) {
            return {
                success: true,
                actionType: "clarification_needed",
                message: "Co mam dodać do zadań?",
            };
        }
        try {
            const { data, error } = await supabase
                .from("tasks")
                .insert({
                user_id: this.userId,
                title,
                priority,
                due_date: dueDate || null,
                status: "todo",
                created_at: new Date().toISOString(),
            })
                .select()
                .single();
            if (error)
                throw error;
            return {
                success: true,
                actionType: "task_add",
                message: `Dodałem zadanie: "${title}"${dueDate ? ` z terminem na ${dueDate}` : ""}`,
                data,
                uiAction: {
                    type: "show_toast",
                    data: { type: "success", message: `Zadanie "${title}" dodane` },
                },
            };
        }
        catch (error) {
            console.error("[VoiceAction] Task add error:", error);
            return {
                success: false,
                actionType: "task_add",
                message: "Nie udało się dodać zadania.",
            };
        }
    }
    /**
     * Pokaż listę zadań
     */
    async handleTaskList() {
        try {
            const { data, error } = await supabase
                .from("tasks")
                .select("*")
                .eq("user_id", this.userId)
                .eq("status", "todo")
                .order("created_at", { ascending: false })
                .limit(10);
            if (error)
                throw error;
            if (!data || data.length === 0) {
                return {
                    success: true,
                    actionType: "task_list",
                    message: "Nie masz żadnych zadań do zrobienia. Świetna robota!",
                    data: [],
                };
            }
            const taskList = data.map((t) => `• ${t.title}`).join("\n");
            return {
                success: true,
                actionType: "task_list",
                message: `Masz ${data.length} zadań do zrobienia:\n${taskList}`,
                data,
            };
        }
        catch (error) {
            console.error("[VoiceAction] Task list error:", error);
            return {
                success: false,
                actionType: "task_list",
                message: "Nie udało się pobrać listy zadań.",
            };
        }
    }
    /**
     * Oznacz zadanie jako ukończone
     */
    async handleTaskComplete(entities) {
        const taskTitle = entities.taskTitle;
        if (!taskTitle) {
            // Pokaż listę zadań do wyboru
            const listResult = await this.handleTaskList();
            return {
                ...listResult,
                message: "Które zadanie oznaczyć jako ukończone?\n" +
                    (listResult.message || ""),
            };
        }
        try {
            // Znajdź zadanie po tytule (fuzzy match)
            const { data: tasks } = await supabase
                .from("tasks")
                .select("*")
                .eq("user_id", this.userId)
                .eq("status", "todo")
                .ilike("title", `%${taskTitle}%`)
                .limit(1);
            if (!tasks || tasks.length === 0) {
                return {
                    success: false,
                    actionType: "task_complete",
                    message: `Nie znalazłem zadania "${taskTitle}".`,
                };
            }
            const task = tasks[0];
            await supabase
                .from("tasks")
                .update({ status: "completed", completed_at: new Date().toISOString() })
                .eq("id", task.id);
            return {
                success: true,
                actionType: "task_complete",
                message: `Oznaczyłem jako ukończone: "${task.title}"`,
                uiAction: {
                    type: "refresh",
                },
            };
        }
        catch (error) {
            console.error("[VoiceAction] Task complete error:", error);
            return {
                success: false,
                actionType: "task_complete",
                message: "Nie udało się oznaczyć zadania jako ukończone.",
            };
        }
    }
    /**
     * Sprawdź alerty
     */
    async handleAlertCheck() {
        try {
            // Pobierz aktywne alerty/logi z ostatnich 24h
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const { data: logs } = await supabase
                .from("processing_logs")
                .select("*")
                .eq("user_id", this.userId)
                .gte("created_at", yesterday.toISOString())
                .in("status", ["error", "warning"])
                .order("created_at", { ascending: false })
                .limit(5);
            if (!logs || logs.length === 0) {
                return {
                    success: true,
                    actionType: "alert_check",
                    message: "Nie masz żadnych alertów. Wszystko działa poprawnie!",
                    data: [],
                };
            }
            const alertList = logs
                .map((l) => `• ${l.status.toUpperCase()}: ${l.message || l.operation}`)
                .join("\n");
            return {
                success: true,
                actionType: "alert_check",
                message: `Masz ${logs.length} alertów:\n${alertList}`,
                data: logs,
                uiAction: {
                    type: "navigate",
                    target: "/dashboard",
                },
            };
        }
        catch (error) {
            console.error("[VoiceAction] Alert check error:", error);
            return {
                success: false,
                actionType: "alert_check",
                message: "Nie udało się sprawdzić alertów.",
            };
        }
    }
    /**
     * Wyszukaj dokument
     */
    async handleDocumentSearch(entities) {
        const query = entities.documentQuery;
        if (!query) {
            return {
                success: true,
                actionType: "clarification_needed",
                message: "Jakiego dokumentu szukasz?",
            };
        }
        return {
            success: true,
            actionType: "document_search",
            message: `Szukam dokumentów: "${query}"`,
            uiAction: {
                type: "navigate",
                target: `/documents?search=${encodeURIComponent(query)}`,
            },
        };
    }
    /**
     * Uruchom szybkie narzędzie
     */
    async handleQuickTool(entities) {
        const toolName = entities.toolName?.toLowerCase();
        const toolMap = {
            interpelacja: {
                name: "Nowa interpelacja",
                path: "/chat?tool=interpelation",
                description: "Kreator interpelacji radnego",
            },
            pismo: {
                name: "Nowe pismo",
                path: "/chat?tool=letter",
                description: "Generator pism urzędowych",
            },
            protokół: {
                name: "Protokół",
                path: "/chat?tool=protocol",
                description: "Generowanie protokołu z sesji",
            },
            budżet: {
                name: "Analiza budżetu",
                path: "/chat?tool=budget",
                description: "Analiza budżetu gminy",
            },
            wniosek: {
                name: "Wniosek",
                path: "/chat?tool=application",
                description: "Kreator wniosków",
            },
            uchwała: {
                name: "Projekt uchwały",
                path: "/chat?tool=resolution",
                description: "Generator projektów uchwał",
            },
            wystąpienie: {
                name: "Wystąpienie na sesji",
                path: "/chat?tool=speech",
                description: "Przygotuj projekt wystąpienia radnego na sesji",
            },
            wystapienie: {
                name: "Wystąpienie na sesji",
                path: "/chat?tool=speech",
                description: "Przygotuj projekt wystąpienia radnego na sesji",
            },
            przemówienie: {
                name: "Wystąpienie na sesji",
                path: "/chat?tool=speech",
                description: "Przygotuj projekt wystąpienia radnego na sesji",
            },
            speech: {
                name: "Wystąpienie na sesji",
                path: "/chat?tool=speech",
                description: "Przygotuj projekt wystąpienia radnego na sesji",
            },
            raport: {
                name: "Szablon raportu",
                path: "/chat?tool=report",
                description: "Generator szablonów raportów kontroli",
            },
            report: {
                name: "Szablon raportu",
                path: "/chat?tool=report",
                description: "Generator szablonów raportów kontroli",
            },
            szablon: {
                name: "Szablon raportu",
                path: "/chat?tool=report",
                description: "Generator szablonów raportów kontroli",
            },
        };
        // Znajdź pasujące narzędzie
        let tool = toolMap[toolName];
        if (!tool) {
            // Fuzzy match
            for (const [key, value] of Object.entries(toolMap)) {
                if (toolName?.includes(key) || key.includes(toolName || "")) {
                    tool = value;
                    break;
                }
            }
        }
        if (!tool) {
            const availableTools = Object.values(toolMap)
                .map((t) => `• ${t.name}`)
                .join("\n");
            return {
                success: true,
                actionType: "clarification_needed",
                message: `Dostępne narzędzia:\n${availableTools}\n\nKtóre narzędzie uruchomić?`,
            };
        }
        // Przygotuj dane formularza z kontekstu
        const formData = {};
        const toolTopic = entities.toolTopic;
        const toolContext = entities.toolContext;
        const toolRecipient = entities.toolRecipient;
        // Mapuj dane na pola formularza w zależności od narzędzia
        if (toolTopic) {
            // Uniwersalne pole "topic" lub "subject" lub "title"
            formData.topic = toolTopic;
            formData.subject = toolTopic;
            formData.title = toolTopic;
        }
        if (toolContext) {
            // Uniwersalne pole "context" lub "content" lub "justification"
            formData.context = toolContext;
            formData.content = toolContext;
            formData.justification = toolContext;
        }
        if (toolRecipient) {
            formData.recipient = toolRecipient;
        }
        // Wyciągnij typ narzędzia z path (np. "/chat?tool=interpelation" -> "interpelation")
        const toolType = tool.path.split("tool=")[1];
        return {
            success: true,
            actionType: "quick_tool",
            message: `Uruchamiam: ${tool.name}${toolTopic ? ` - "${toolTopic}"` : ""}`,
            uiAction: {
                type: "open_tool_with_data",
                target: toolType,
                data: {
                    toolType,
                    formData,
                    topic: toolTopic,
                    context: toolContext,
                },
            },
        };
    }
    /**
     * Nawigacja w aplikacji
     */
    async handleNavigation(entities) {
        const target = entities.targetPage?.toLowerCase();
        const pageMap = {
            pulpit: { name: "Pulpit", path: "/dashboard" },
            dashboard: { name: "Pulpit", path: "/dashboard" },
            dokumenty: { name: "Dokumenty", path: "/documents" },
            documents: { name: "Dokumenty", path: "/documents" },
            czat: { name: "Czat AI", path: "/chat" },
            chat: { name: "Czat AI", path: "/chat" },
            rozmowa: { name: "Czat AI", path: "/chat" },
            ustawienia: { name: "Ustawienia", path: "/settings" },
            settings: { name: "Ustawienia", path: "/settings" },
            źródła: { name: "Źródła danych", path: "/sources" },
            sources: { name: "Źródła danych", path: "/sources" },
            kalendarz: { name: "Kalendarz", path: "/dashboard" },
        };
        let page = pageMap[target || ""];
        if (!page) {
            // Fuzzy match
            for (const [key, value] of Object.entries(pageMap)) {
                if (target?.includes(key) || key.includes(target || "")) {
                    page = value;
                    break;
                }
            }
        }
        if (!page) {
            return {
                success: true,
                actionType: "clarification_needed",
                message: "Gdzie mam przejść? Dostępne: pulpit, dokumenty, czat, ustawienia, źródła.",
            };
        }
        return {
            success: true,
            actionType: "navigate",
            message: `Przechodzę do: ${page.name}`,
            navigationTarget: page.path,
            uiAction: {
                type: "navigate",
                target: page.path,
            },
        };
    }
    // ============ HELPERS ============
    formatDate(date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);
        if (dateOnly.getTime() === today.getTime()) {
            return "dziś";
        }
        else if (dateOnly.getTime() === tomorrow.getTime()) {
            return "jutro";
        }
        else {
            return date.toLocaleDateString("pl-PL", {
                weekday: "long",
                day: "numeric",
                month: "long",
            });
        }
    }
    /**
     * Zapisz oczekującą akcję (czeka na "wykonaj")
     */
    storePendingAction(type, params, description) {
        const action = {
            id: `pending_${Date.now()}`,
            type,
            params,
            description,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 60 * 1000), // 1 minuta ważności
        };
        this.pendingActions.set(action.id, action);
        return action;
    }
    /**
     * Pobierz oczekującą akcję
     */
    getPendingAction(id) {
        if (id) {
            return this.pendingActions.get(id);
        }
        const entries = Array.from(this.pendingActions.entries());
        return entries.length > 0 ? entries[entries.length - 1][1] : undefined;
    }
    /**
     * Wyczyść przeterminowane akcje
     */
    cleanupExpiredActions() {
        const now = new Date();
        for (const [id, action] of this.pendingActions.entries()) {
            if (now > action.expiresAt) {
                this.pendingActions.delete(id);
            }
        }
    }
}
//# sourceMappingURL=voice-action-service.js.map