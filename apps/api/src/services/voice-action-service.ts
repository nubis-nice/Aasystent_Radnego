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

import OpenAI from "openai";
import { getLLMClient, getAIConfig } from "../ai/index.js";
import { supabase } from "../lib/supabase.js";

// Typy akcji głosowych
export type VoiceActionType =
  | "calendar_add"
  | "calendar_list"
  | "calendar_edit"
  | "calendar_delete"
  | "task_add"
  | "task_list"
  | "task_complete"
  | "task_delete"
  | "alert_check"
  | "alert_dismiss"
  | "document_search"
  | "document_open"
  | "quick_tool"
  | "navigate"
  | "confirmation_needed"
  | "clarification_needed"
  | "execute_pending";

// Stan oczekującej akcji (czeka na "wykonaj")
export interface PendingAction {
  id: string;
  type: VoiceActionType;
  params: Record<string, unknown>;
  description: string;
  createdAt: Date;
  expiresAt: Date;
}

// Wynik akcji głosowej
export interface VoiceActionResult {
  success: boolean;
  actionType: VoiceActionType;
  message: string;
  data?: unknown;
  requiresConfirmation?: boolean;
  pendingAction?: PendingAction;
  navigationTarget?: string;
  uiAction?: {
    type:
      | "open_modal"
      | "show_toast"
      | "navigate"
      | "refresh"
      | "open_tool_with_data";
    target?: string;
    data?: unknown;
  };
}

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

## SZYBKIE NARZĘDZIA (TYLKO gdy użytkownik chce UTWORZYĆ/WYGENEROWAĆ dokument):
- **quick_tool** → WYMAGA słów akcji: "utwórz", "napisz", "generuj", "przygotuj", "stwórz"
  Przykłady: "utwórz interpelację", "napisz pismo", "generuj protokół", "przygotuj wystąpienie", "stwórz projekt uchwały", "napisz scenopis na rolkę", "generuj scenariusz TikTok"

⚠️ UWAGA: Jeśli użytkownik pyta o "posiedzenie", "komisja", "sesja", "relacja", "artykuł", "gazeta", "Drawnowiny" BEZ słów akcji → to jest **document_search**, NIE quick_tool!
  - "posiedzenie komisji budżetowej" → document_search (szuka dokumentów)
  - "co było na komisji" → document_search
  - "protokół z sesji" → document_search (szuka istniejącego protokołu)
  - "relacja z sesji" → document_search (szuka relacji/artykułu)
  - "Drawnowiny relacja z sesji" → document_search (szuka artykułu w gazecie)
  - "generuj protokół z sesji" → quick_tool (tworzy nowy protokół)
  
⚠️ SŁOWA WYKLUCZAJĄCE quick_tool (wskazują na WYSZUKIWANIE):
  - "relacja", "artykuł", "gazeta", "Drawnowiny", "informacja o", "co było", "znajdź", "szukaj", "pokaż"

Dla quick_tool ZAWSZE wyciągnij:
- toolName: typ narzędzia (interpelacja/pismo/protokół/budżet/wystąpienie/uchwała/raport/scenopis)
- toolTopic: temat/przedmiot (np. "remont ul. Głównej", "sesja rady o budżecie")
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
function parseNaturalDate(dateStr: string): Date | null {
  if (!dateStr) return null;

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
  private userId: string;
  private llmClient: OpenAI | null = null;
  private model: string = "gpt-4o-mini";
  private pendingActions: Map<string, PendingAction> = new Map();

  constructor(userId: string) {
    this.userId = userId;
  }

  private async initialize(): Promise<void> {
    if (this.llmClient) return;
    this.llmClient = await getLLMClient(this.userId);
    const config = await getAIConfig(this.userId, "llm");
    this.model = config.modelName;
  }

  /**
   * Główna metoda - przetwarza polecenie głosowe
   */
  async processVoiceCommand(
    command: string,
    context?: { pendingActionId?: string },
  ): Promise<VoiceActionResult> {
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
        message:
          detection.clarificationQuestion ||
          "Potrzebuję więcej informacji. Co dokładnie mam zrobić?",
      };
    }

    // Wykonaj lub zaplanuj akcję
    return this.executeAction(detection);
  }

  /**
   * Wykryj czy to polecenie potwierdzenia
   */
  private isConfirmationCommand(command: string): boolean {
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
  private async detectAction(command: string): Promise<{
    actionType: VoiceActionType;
    confidence: number;
    entities: Record<string, unknown>;
    missingInfo: string[];
    clarificationQuestion?: string;
    description: string;
  }> {
    if (!this.llmClient) throw new Error("LLM not initialized");

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
        description:
          result.userFriendlyDescription || "Przetwarzam polecenie...",
      };
    } catch (error) {
      console.error("[VoiceActionService] Detection error:", error);
      return {
        actionType: "clarification_needed",
        confidence: 0,
        entities: {},
        missingInfo: ["wszystko"],
        clarificationQuestion:
          "Przepraszam, nie zrozumiałem. Czy możesz powtórzyć?",
        description: "Błąd rozpoznawania",
      };
    }
  }

  /**
   * Wykonaj lub zaplanuj akcję
   */
  private async executeAction(detection: {
    actionType: VoiceActionType;
    entities: Record<string, unknown>;
    missingInfo: string[];
    clarificationQuestion?: string;
    description: string;
  }): Promise<VoiceActionResult> {
    const { actionType, entities, missingInfo } = detection;

    // Jeśli brakuje kluczowych informacji
    if (
      missingInfo.length > 0 &&
      actionType !== "navigate" &&
      actionType !== "alert_check"
    ) {
      return {
        success: true,
        actionType: "clarification_needed",
        message:
          detection.clarificationQuestion ||
          `Potrzebuję dodatkowych informacji: ${missingInfo.join(", ")}`,
      };
    }

    // Wykonaj akcję w zależności od typu
    switch (actionType) {
      case "calendar_add":
        return this.handleCalendarAdd(entities);
      case "calendar_list":
        return this.handleCalendarList();
      case "calendar_edit":
        return this.handleCalendarEdit(entities);
      case "calendar_delete":
        return this.handleCalendarDelete(entities);
      case "task_add":
        return this.handleTaskAdd(entities);
      case "task_list":
        return this.handleTaskList();
      case "task_complete":
        return this.handleTaskComplete(entities);
      case "task_delete":
        return this.handleTaskDelete(entities);
      case "alert_check":
        return this.handleAlertCheck();
      case "alert_dismiss":
        return this.handleAlertDismiss(entities);
      case "document_search":
        return this.handleDocumentSearch(entities);
      case "document_open":
        return this.handleDocumentOpen(entities);
      case "quick_tool":
        return this.handleQuickTool(entities);
      case "navigate":
        return this.handleNavigation(entities);
      case "execute_pending":
        return this.executePendingAction();
      case "confirmation_needed":
      case "clarification_needed":
        return {
          success: true,
          actionType,
          message: String(
            entities.clarificationQuestion || "Potrzebuję więcej informacji.",
          ),
        };
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
  private async executePendingAction(
    actionId?: string,
  ): Promise<VoiceActionResult> {
    // Znajdź ostatnią oczekującą akcję
    let pending: PendingAction | undefined;

    if (actionId) {
      pending = this.pendingActions.get(actionId);
    } else {
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
  private async handleCalendarAdd(
    entities: Record<string, unknown>,
  ): Promise<VoiceActionResult> {
    const title = entities.eventTitle as string;
    const date = entities.eventDate as string;
    const time = entities.eventTime as string;
    const location = entities.eventLocation as string;

    if (!title || !date) {
      return {
        success: true,
        actionType: "clarification_needed",
        message:
          "Podaj tytuł i datę wydarzenia. Na przykład: 'Dodaj spotkanie z burmistrzem na jutro o 10:00'",
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
      } else {
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
          end_date: new Date(
            eventDate.getTime() + 60 * 60 * 1000,
          ).toISOString(), // +1h
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

      console.log(
        `[VoiceAction] ✅ Event created: "${title}" on ${eventDate.toISOString()} for user ${this.userId}`,
      );

      return {
        success: true,
        actionType: "calendar_add",
        message: `Dodałem do kalendarza: "${title}" na ${this.formatDate(
          eventDate,
        )}${time ? ` o ${time}` : ""}`,
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
    } catch (error) {
      console.error("[VoiceAction] Calendar add error:", error);
      return {
        success: false,
        actionType: "calendar_add",
        message:
          "Nie udało się dodać wydarzenia do kalendarza. Spróbuj ponownie.",
      };
    }
  }

  /**
   * Pokaż listę wydarzeń
   */
  private async handleCalendarList(): Promise<VoiceActionResult> {
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

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          success: true,
          actionType: "calendar_list",
          message:
            "Nie masz żadnych zaplanowanych wydarzeń w najbliższym tygodniu.",
          data: [],
        };
      }

      const eventList = data
        .map((e) => {
          const date = new Date(e.start_date);
          return `• ${e.title} - ${this.formatDate(
            date,
          )} o ${date.toLocaleTimeString("pl-PL", {
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
    } catch (error) {
      console.error("[VoiceAction] Calendar list error:", error);
      return {
        success: false,
        actionType: "calendar_list",
        message: "Nie udało się pobrać kalendarza.",
      };
    }
  }

  /**
   * Edytuj wydarzenie w kalendarzu (zmień termin, tytuł, lokalizację)
   */
  private async handleCalendarEdit(
    entities: Record<string, unknown>,
  ): Promise<VoiceActionResult> {
    const eventTitle = entities.eventTitle as string;
    const newDate = entities.eventDate as string;
    const newTime = entities.eventTime as string;
    const newLocation = entities.eventLocation as string;
    const eventId = entities.eventId as string;

    // Jeśli nie podano tytułu ani ID, pokaż listę wydarzeń do wyboru
    if (!eventTitle && !eventId) {
      const listResult = await this.handleCalendarList();
      return {
        ...listResult,
        actionType: "clarification_needed",
        message:
          "Które wydarzenie chcesz zmienić?\n" + (listResult.message || ""),
      };
    }

    try {
      // Znajdź wydarzenie po tytule lub ID
      let query = supabase
        .from("user_calendar_events")
        .select("*")
        .eq("user_id", this.userId);

      if (eventId) {
        query = query.eq("id", eventId);
      } else if (eventTitle) {
        query = query.ilike("title", `%${eventTitle}%`);
      }

      const { data: events, error: findError } = await query.limit(5);

      if (findError) throw findError;

      if (!events || events.length === 0) {
        return {
          success: false,
          actionType: "calendar_edit",
          message: `Nie znalazłem wydarzenia "${eventTitle || eventId}".`,
        };
      }

      // Jeśli znaleziono więcej niż 1, poproś o uściślenie
      if (events.length > 1 && !eventId) {
        const eventList = events
          .map((e) => {
            const date = new Date(e.start_date);
            return `• "${e.title}" - ${this.formatDate(date)}`;
          })
          .join("\n");
        return {
          success: true,
          actionType: "clarification_needed",
          message: `Znalazłem ${events.length} wydarzeń pasujących do "${eventTitle}":\n${eventList}\n\nPodaj dokładniejszy tytuł lub datę.`,
          data: events,
        };
      }

      const event = events[0];
      const updateData: Record<string, unknown> = {};

      // Przygotuj dane do aktualizacji
      if (newDate) {
        let eventDate = parseNaturalDate(newDate);
        if (eventDate) {
          // Zachowaj oryginalną godzinę jeśli nie podano nowej
          if (newTime) {
            const [hours, minutes] = newTime.split(":").map(Number);
            eventDate.setHours(hours, minutes || 0, 0, 0);
          } else {
            const originalDate = new Date(event.start_date);
            eventDate.setHours(
              originalDate.getHours(),
              originalDate.getMinutes(),
              0,
              0,
            );
          }
          updateData.start_date = eventDate.toISOString();
          updateData.end_date = new Date(
            eventDate.getTime() + 60 * 60 * 1000,
          ).toISOString();
        }
      } else if (newTime) {
        // Tylko zmiana godziny, bez zmiany daty
        const eventDate = new Date(event.start_date);
        const [hours, minutes] = newTime.split(":").map(Number);
        eventDate.setHours(hours, minutes || 0, 0, 0);
        updateData.start_date = eventDate.toISOString();
        updateData.end_date = new Date(
          eventDate.getTime() + 60 * 60 * 1000,
        ).toISOString();
      }

      if (newLocation) {
        updateData.location = newLocation;
      }

      // Jeśli nie ma nic do aktualizacji
      if (Object.keys(updateData).length === 0) {
        return {
          success: true,
          actionType: "clarification_needed",
          message: `Co chcesz zmienić w wydarzeniu "${event.title}"? Podaj nową datę, godzinę lub miejsce.`,
        };
      }

      // Wykonaj aktualizację
      const { data: updatedEvent, error: updateError } = await supabase
        .from("user_calendar_events")
        .update(updateData)
        .eq("id", event.id)
        .eq("user_id", this.userId)
        .select()
        .single();

      if (updateError) throw updateError;

      const changes: string[] = [];
      if (updateData.start_date) {
        const newDateObj = new Date(updateData.start_date as string);
        changes.push(
          `termin na ${this.formatDate(newDateObj)} o ${newDateObj.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`,
        );
      }
      if (updateData.location) {
        changes.push(`miejsce na "${updateData.location}"`);
      }

      console.log(
        `[VoiceAction] ✅ Event updated: "${event.title}" - ${changes.join(", ")}`,
      );

      return {
        success: true,
        actionType: "calendar_edit",
        message: `Zaktualizowałem wydarzenie "${event.title}": zmieniono ${changes.join(", ")}.`,
        data: updatedEvent,
        uiAction: {
          type: "refresh",
          target: "calendar",
          data: {
            type: "success",
            message: `Wydarzenie "${event.title}" zostało zaktualizowane`,
          },
        },
      };
    } catch (error) {
      console.error("[VoiceAction] Calendar edit error:", error);
      return {
        success: false,
        actionType: "calendar_edit",
        message: "Nie udało się zaktualizować wydarzenia. Spróbuj ponownie.",
      };
    }
  }

  /**
   * Usuń wydarzenie z kalendarza
   */
  private async handleCalendarDelete(
    entities: Record<string, unknown>,
  ): Promise<VoiceActionResult> {
    const eventTitle = entities.eventTitle as string;
    const eventDate = entities.eventDate as string;
    const eventId = entities.eventId as string;

    // Jeśli nie podano tytułu ani ID, pokaż listę wydarzeń do wyboru
    if (!eventTitle && !eventId) {
      const listResult = await this.handleCalendarList();
      return {
        ...listResult,
        actionType: "clarification_needed",
        message:
          "Które wydarzenie chcesz usunąć?\n" + (listResult.message || ""),
      };
    }

    try {
      // Znajdź wydarzenie po tytule lub ID
      let query = supabase
        .from("user_calendar_events")
        .select("*")
        .eq("user_id", this.userId);

      if (eventId) {
        query = query.eq("id", eventId);
      } else if (eventTitle) {
        query = query.ilike("title", `%${eventTitle}%`);
      }

      // Jeśli podano datę, zawęź wyszukiwanie
      if (eventDate) {
        const parsedDate = parseNaturalDate(eventDate);
        if (parsedDate) {
          const dayStart = new Date(parsedDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(parsedDate);
          dayEnd.setHours(23, 59, 59, 999);
          query = query
            .gte("start_date", dayStart.toISOString())
            .lte("start_date", dayEnd.toISOString());
        }
      }

      const { data: events, error: findError } = await query.limit(5);

      if (findError) throw findError;

      if (!events || events.length === 0) {
        return {
          success: false,
          actionType: "calendar_delete",
          message: `Nie znalazłem wydarzenia "${eventTitle || eventId}"${eventDate ? ` na ${eventDate}` : ""}.`,
        };
      }

      // Jeśli znaleziono więcej niż 1, poproś o uściślenie
      if (events.length > 1 && !eventId) {
        const eventList = events
          .map((e) => {
            const date = new Date(e.start_date);
            return `• "${e.title}" - ${this.formatDate(date)}`;
          })
          .join("\n");
        return {
          success: true,
          actionType: "clarification_needed",
          message: `Znalazłem ${events.length} wydarzeń pasujących do "${eventTitle}":\n${eventList}\n\nPodaj dokładniejszy tytuł lub datę, które wydarzenie usunąć.`,
          data: events,
        };
      }

      const event = events[0];

      // Usuń wydarzenie
      const { error: deleteError } = await supabase
        .from("user_calendar_events")
        .delete()
        .eq("id", event.id)
        .eq("user_id", this.userId);

      if (deleteError) throw deleteError;

      const eventDateObj = new Date(event.start_date);
      console.log(
        `[VoiceAction] ✅ Event deleted: "${event.title}" on ${eventDateObj.toISOString()}`,
      );

      return {
        success: true,
        actionType: "calendar_delete",
        message: `Usunąłem wydarzenie "${event.title}" z ${this.formatDate(eventDateObj)}.`,
        data: { deletedEvent: event },
        uiAction: {
          type: "refresh",
          target: "calendar",
          data: {
            type: "success",
            message: `Wydarzenie "${event.title}" zostało usunięte`,
          },
        },
      };
    } catch (error) {
      console.error("[VoiceAction] Calendar delete error:", error);
      return {
        success: false,
        actionType: "calendar_delete",
        message: "Nie udało się usunąć wydarzenia. Spróbuj ponownie.",
      };
    }
  }

  /**
   * Dodaj zadanie
   */
  private async handleTaskAdd(
    entities: Record<string, unknown>,
  ): Promise<VoiceActionResult> {
    const title = entities.taskTitle as string;
    const priority = (entities.taskPriority as string) || "medium";
    const dueDate = entities.taskDueDate as string;

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

      if (error) throw error;

      return {
        success: true,
        actionType: "task_add",
        message: `Dodałem zadanie: "${title}"${
          dueDate ? ` z terminem na ${dueDate}` : ""
        }`,
        data,
        uiAction: {
          type: "show_toast",
          data: { type: "success", message: `Zadanie "${title}" dodane` },
        },
      };
    } catch (error) {
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
  private async handleTaskList(): Promise<VoiceActionResult> {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", this.userId)
        .eq("status", "todo")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

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
    } catch (error) {
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
  private async handleTaskComplete(
    entities: Record<string, unknown>,
  ): Promise<VoiceActionResult> {
    const taskTitle = entities.taskTitle as string;

    if (!taskTitle) {
      // Pokaż listę zadań do wyboru
      const listResult = await this.handleTaskList();
      return {
        ...listResult,
        message:
          "Które zadanie oznaczyć jako ukończone?\n" +
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
    } catch (error) {
      console.error("[VoiceAction] Task complete error:", error);
      return {
        success: false,
        actionType: "task_complete",
        message: "Nie udało się oznaczyć zadania jako ukończone.",
      };
    }
  }

  /**
   * Usuń zadanie
   */
  private async handleTaskDelete(
    entities: Record<string, unknown>,
  ): Promise<VoiceActionResult> {
    const taskTitle = entities.taskTitle as string;

    if (!taskTitle) {
      const listResult = await this.handleTaskList();
      return {
        ...listResult,
        actionType: "clarification_needed",
        message: "Które zadanie chcesz usunąć?\n" + (listResult.message || ""),
      };
    }

    try {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", this.userId)
        .ilike("title", `%${taskTitle}%`)
        .limit(5);

      if (!tasks || tasks.length === 0) {
        return {
          success: false,
          actionType: "task_delete",
          message: `Nie znalazłem zadania "${taskTitle}".`,
        };
      }

      if (tasks.length > 1) {
        const taskList = tasks.map((t) => `• "${t.title}"`).join("\n");
        return {
          success: true,
          actionType: "clarification_needed",
          message: `Znalazłem ${tasks.length} zadań pasujących do "${taskTitle}":\n${taskList}\n\nPodaj dokładniejszy tytuł.`,
          data: tasks,
        };
      }

      const task = tasks[0];
      await supabase.from("tasks").delete().eq("id", task.id);

      console.log(`[VoiceAction] ✅ Task deleted: "${task.title}"`);

      return {
        success: true,
        actionType: "task_delete",
        message: `Usunąłem zadanie: "${task.title}"`,
        uiAction: {
          type: "refresh",
          target: "tasks",
        },
      };
    } catch (error) {
      console.error("[VoiceAction] Task delete error:", error);
      return {
        success: false,
        actionType: "task_delete",
        message: "Nie udało się usunąć zadania.",
      };
    }
  }

  /**
   * Sprawdź alerty
   */
  private async handleAlertCheck(): Promise<VoiceActionResult> {
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
    } catch (error) {
      console.error("[VoiceAction] Alert check error:", error);
      return {
        success: false,
        actionType: "alert_check",
        message: "Nie udało się sprawdzić alertów.",
      };
    }
  }

  /**
   * Odrzuć/zamknij alert
   */
  private async handleAlertDismiss(
    entities: Record<string, unknown>,
  ): Promise<VoiceActionResult> {
    const alertId = entities.alertId as string;

    if (!alertId) {
      return {
        success: true,
        actionType: "clarification_needed",
        message:
          "Który alert chcesz odrzucić? Podaj ID lub otwórz panel alertów.",
        uiAction: {
          type: "navigate",
          target: "/dashboard",
        },
      };
    }

    try {
      await supabase
        .from("processing_logs")
        .update({ status: "dismissed" })
        .eq("id", alertId)
        .eq("user_id", this.userId);

      return {
        success: true,
        actionType: "alert_dismiss",
        message: "Alert został odrzucony.",
        uiAction: {
          type: "refresh",
          target: "alerts",
        },
      };
    } catch (error) {
      console.error("[VoiceAction] Alert dismiss error:", error);
      return {
        success: false,
        actionType: "alert_dismiss",
        message: "Nie udało się odrzucić alertu.",
      };
    }
  }

  /**
   * Wyszukaj dokument
   */
  private async handleDocumentSearch(
    entities: Record<string, unknown>,
  ): Promise<VoiceActionResult> {
    const query = entities.documentQuery as string;

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
   * Otwórz konkretny dokument
   */
  private async handleDocumentOpen(
    entities: Record<string, unknown>,
  ): Promise<VoiceActionResult> {
    const documentName = entities.documentName as string;
    const documentId = entities.documentId as string;

    if (documentId) {
      return {
        success: true,
        actionType: "document_open",
        message: `Otwieram dokument...`,
        uiAction: {
          type: "navigate",
          target: `/documents/${documentId}`,
        },
      };
    }

    if (!documentName) {
      return {
        success: true,
        actionType: "clarification_needed",
        message: "Który dokument chcesz otworzyć? Podaj nazwę lub ID.",
      };
    }

    // Szukaj dokumentu po nazwie
    try {
      const { data: docs } = await supabase
        .from("processed_documents")
        .select("id, title")
        .eq("user_id", this.userId)
        .ilike("title", `%${documentName}%`)
        .limit(5);

      if (!docs || docs.length === 0) {
        return {
          success: false,
          actionType: "document_open",
          message: `Nie znalazłem dokumentu "${documentName}".`,
        };
      }

      if (docs.length === 1) {
        return {
          success: true,
          actionType: "document_open",
          message: `Otwieram: "${docs[0].title}"`,
          uiAction: {
            type: "navigate",
            target: `/documents/${docs[0].id}`,
          },
        };
      }

      const docList = docs.map((d) => `• "${d.title}"`).join("\n");
      return {
        success: true,
        actionType: "clarification_needed",
        message: `Znalazłem ${docs.length} dokumentów:\n${docList}\n\nKtóry chcesz otworzyć?`,
        data: docs,
      };
    } catch (error) {
      console.error("[VoiceAction] Document open error:", error);
      return {
        success: false,
        actionType: "document_open",
        message: "Nie udało się otworzyć dokumentu.",
      };
    }
  }

  /**
   * Uruchom szybkie narzędzie
   */
  private async handleQuickTool(
    entities: Record<string, unknown>,
  ): Promise<VoiceActionResult> {
    const toolName = (entities.toolName as string)?.toLowerCase();

    const toolMap: Record<
      string,
      { name: string; path: string; description: string }
    > = {
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
      scenopis: {
        name: "Generator scenopisów",
        path: "/chat?tool=script",
        description: "Generator scenopisów na rolkę YouTube/TikTok",
      },
      scenariusz: {
        name: "Generator scenopisów",
        path: "/chat?tool=script",
        description: "Generator scenopisów na rolkę YouTube/TikTok",
      },
      rolka: {
        name: "Generator scenopisów",
        path: "/chat?tool=script",
        description: "Generator scenopisów na rolkę YouTube/TikTok",
      },
      tiktok: {
        name: "Generator scenopisów",
        path: "/chat?tool=script",
        description: "Generator scenopisów na rolkę YouTube/TikTok",
      },
      reels: {
        name: "Generator scenopisów",
        path: "/chat?tool=script",
        description: "Generator scenopisów na rolkę YouTube/TikTok",
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
      // Unikalne narzędzia (bez duplikatów aliasów)
      const uniqueTools = new Map<
        string,
        { name: string; path: string; description: string }
      >();
      for (const t of Object.values(toolMap)) {
        if (!uniqueTools.has(t.path)) {
          uniqueTools.set(t.path, t);
        }
      }
      const availableTools = Array.from(uniqueTools.values())
        .map((t) => `• ${t.name}`)
        .join("\n");
      return {
        success: true,
        actionType: "clarification_needed",
        message: `Dostępne narzędzia:\n${availableTools}\n\nKtóre narzędzie uruchomić?`,
      };
    }

    // Przygotuj dane formularza z kontekstu
    const formData: Record<string, string> = {};
    const toolTopic = entities.toolTopic as string;
    const toolContext = entities.toolContext as string;
    const toolRecipient = entities.toolRecipient as string;

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
  private async handleNavigation(
    entities: Record<string, unknown>,
  ): Promise<VoiceActionResult> {
    const target = (entities.targetPage as string)?.toLowerCase();

    const pageMap: Record<string, { name: string; path: string }> = {
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
        message:
          "Gdzie mam przejść? Dostępne: pulpit, dokumenty, czat, ustawienia, źródła.",
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

  private formatDate(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly.getTime() === today.getTime()) {
      return "dziś";
    } else if (dateOnly.getTime() === tomorrow.getTime()) {
      return "jutro";
    } else {
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
  storePendingAction(
    type: VoiceActionType,
    params: Record<string, unknown>,
    description: string,
  ): PendingAction {
    const action: PendingAction = {
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
  getPendingAction(id?: string): PendingAction | undefined {
    if (id) {
      return this.pendingActions.get(id);
    }
    const entries = Array.from(this.pendingActions.entries());
    return entries.length > 0 ? entries[entries.length - 1][1] : undefined;
  }

  /**
   * Wyczyść przeterminowane akcje
   */
  cleanupExpiredActions(): void {
    const now = new Date();
    for (const [id, action] of this.pendingActions.entries()) {
      if (now > action.expiresAt) {
        this.pendingActions.delete(id);
      }
    }
  }
}
