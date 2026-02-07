/**
 * ePUAP Service
 * Integracja z elektroniczną Platformą Usług Administracji Publicznej
 *
 * ePUAP używa SOAP/WSDL - ten serwis obsługuje:
 * - Odbieranie dokumentów ze skrzynki podawczej
 * - Wysyłanie dokumentów
 * - Webhooki dla powiadomień o nowych dokumentach
 *
 * Dokumentacja: https://epuap.gov.pl/wps/wcm/connect/epuap2/pl/strefa%20urzednika_pomoc/dla%20intergratorow/
 */
export interface EPUAPMessage {
    id: string;
    messageId: string;
    sender: string;
    senderName: string;
    recipient: string;
    subject: string;
    content?: string;
    attachments: EPUAPAttachment[];
    receivedAt: string;
    status: "new" | "read" | "processed" | "archived";
    documentType?: string;
    caseNumber?: string;
    metadata: Record<string, unknown>;
}
export interface EPUAPAttachment {
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    downloadUrl?: string;
}
export interface EPUAPConfig {
    espAddress: string;
    certificatePath?: string;
    certificatePassword?: string;
    wsdlUrl: string;
    testMode: boolean;
}
export interface EPUAPSearchParams {
    status?: EPUAPMessage["status"];
    sender?: string;
    dateFrom?: string;
    dateTo?: string;
    documentType?: string;
    limit?: number;
    offset?: number;
}
export interface EPUAPSearchResult {
    count: number;
    totalCount: number;
    offset: number;
    items: EPUAPMessage[];
}
export interface EPUAPWebhookPayload {
    eventType: "new_message" | "message_read" | "message_sent" | "error";
    messageId: string;
    timestamp: string;
    data: Record<string, unknown>;
}
export declare class EPUAPService {
    private config;
    private supabase;
    private userId;
    constructor(config?: Partial<EPUAPConfig>);
    /**
     * Inicjalizuj serwis dla użytkownika
     */
    initialize(userId: string): Promise<void>;
    /**
     * Sprawdź czy integracja jest skonfigurowana
     */
    isConfigured(): boolean;
    /**
     * Pobierz wiadomości ze skrzynki podawczej
     */
    getMessages(params?: EPUAPSearchParams): Promise<EPUAPSearchResult>;
    /**
     * Pobierz szczegóły wiadomości
     */
    getMessage(messageId: string): Promise<EPUAPMessage | null>;
    /**
     * Oznacz wiadomość jako przeczytaną
     */
    markAsRead(messageId: string): Promise<void>;
    /**
     * Oznacz wiadomość jako przetworzoną
     */
    markAsProcessed(messageId: string, caseNumber?: string): Promise<void>;
    /**
     * Synchronizuj wiadomości z ePUAP
     * UWAGA: Wymaga aktywnego certyfikatu i konfiguracji SOAP
     */
    syncMessages(): Promise<{
        synced: number;
        errors: string[];
    }>;
    /**
     * Obsłuż webhook od ePUAP
     */
    handleWebhook(payload: EPUAPWebhookPayload): Promise<void>;
    /**
     * Zapisz konfigurację integracji
     */
    saveConfig(config: Partial<EPUAPConfig>): Promise<void>;
    /**
     * Pobierz statystyki
     */
    getStats(): Promise<{
        total: number;
        new: number;
        read: number;
        processed: number;
        lastSync?: string;
    }>;
    private mapDBToMessage;
}
//# sourceMappingURL=epuap-service.d.ts.map