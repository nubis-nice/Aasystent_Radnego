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
export type VoiceActionType = "calendar_add" | "calendar_list" | "calendar_edit" | "calendar_delete" | "task_add" | "task_list" | "task_complete" | "task_delete" | "alert_check" | "alert_dismiss" | "document_search" | "document_open" | "quick_tool" | "navigate" | "confirmation_needed" | "clarification_needed" | "execute_pending";
export interface PendingAction {
    id: string;
    type: VoiceActionType;
    params: Record<string, unknown>;
    description: string;
    createdAt: Date;
    expiresAt: Date;
}
export interface VoiceActionResult {
    success: boolean;
    actionType: VoiceActionType;
    message: string;
    data?: unknown;
    requiresConfirmation?: boolean;
    pendingAction?: PendingAction;
    navigationTarget?: string;
    uiAction?: {
        type: "open_modal" | "show_toast" | "navigate" | "refresh";
        target?: string;
        data?: unknown;
    };
}
export declare class VoiceActionService {
    private userId;
    private llmClient;
    private model;
    private pendingActions;
    constructor(userId: string);
    private initialize;
    /**
     * Główna metoda - przetwarza polecenie głosowe
     */
    processVoiceCommand(command: string, context?: {
        pendingActionId?: string;
    }): Promise<VoiceActionResult>;
    /**
     * Wykryj czy to polecenie potwierdzenia
     */
    private isConfirmationCommand;
    /**
     * Wykryj typ akcji z polecenia
     */
    private detectAction;
    /**
     * Wykonaj lub zaplanuj akcję
     */
    private executeAction;
    /**
     * Wykonaj oczekującą akcję
     */
    private executePendingAction;
    /**
     * Dodaj wydarzenie do kalendarza
     */
    private handleCalendarAdd;
    /**
     * Pokaż listę wydarzeń
     */
    private handleCalendarList;
    /**
     * Dodaj zadanie
     */
    private handleTaskAdd;
    /**
     * Pokaż listę zadań
     */
    private handleTaskList;
    /**
     * Oznacz zadanie jako ukończone
     */
    private handleTaskComplete;
    /**
     * Sprawdź alerty
     */
    private handleAlertCheck;
    /**
     * Wyszukaj dokument
     */
    private handleDocumentSearch;
    /**
     * Uruchom szybkie narzędzie
     */
    private handleQuickTool;
    /**
     * Nawigacja w aplikacji
     */
    private handleNavigation;
    private formatDate;
    /**
     * Zapisz oczekującą akcję (czeka na "wykonaj")
     */
    storePendingAction(type: VoiceActionType, params: Record<string, unknown>, description: string): PendingAction;
    /**
     * Pobierz oczekującą akcję
     */
    getPendingAction(id?: string): PendingAction | undefined;
    /**
     * Wyczyść przeterminowane akcje
     */
    cleanupExpiredActions(): void;
}
//# sourceMappingURL=voice-action-service.d.ts.map