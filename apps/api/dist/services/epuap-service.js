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
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Domyślna konfiguracja (środowisko testowe)
const DEFAULT_CONFIG = {
    espAddress: "",
    wsdlUrl: "https://int.epuap.gov.pl/ws/DokumentyService?wsdl",
    testMode: true,
};
export class EPUAPService {
    config;
    supabase;
    userId = null;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    }
    /**
     * Inicjalizuj serwis dla użytkownika
     */
    async initialize(userId) {
        this.userId = userId;
        // Pobierz konfigurację ePUAP użytkownika z bazy
        const { data } = await this.supabase
            .from("user_integrations")
            .select("config")
            .eq("user_id", userId)
            .eq("integration_type", "epuap")
            .maybeSingle();
        if (data?.config) {
            this.config = { ...this.config, ...data.config };
        }
    }
    /**
     * Sprawdź czy integracja jest skonfigurowana
     */
    isConfigured() {
        return Boolean(this.config.espAddress);
    }
    /**
     * Pobierz wiadomości ze skrzynki podawczej
     */
    async getMessages(params = {}) {
        if (!this.userId) {
            throw new Error("Serwis nie został zainicjalizowany");
        }
        // Pobierz z lokalnej bazy (zsynchronizowane wcześniej)
        let query = this.supabase
            .from("epuap_messages")
            .select("*", { count: "exact" })
            .eq("user_id", this.userId);
        if (params.status) {
            query = query.eq("status", params.status);
        }
        if (params.sender) {
            query = query.ilike("sender_name", `%${params.sender}%`);
        }
        if (params.dateFrom) {
            query = query.gte("received_at", params.dateFrom);
        }
        if (params.dateTo) {
            query = query.lte("received_at", params.dateTo);
        }
        if (params.documentType) {
            query = query.eq("document_type", params.documentType);
        }
        const limit = params.limit || 20;
        const offset = params.offset || 0;
        query = query
            .order("received_at", { ascending: false })
            .range(offset, offset + limit - 1);
        const { data, count, error } = await query;
        if (error) {
            console.error("[ePUAP] Error fetching messages:", error);
            throw new Error("Błąd pobierania wiadomości");
        }
        return {
            count: data?.length || 0,
            totalCount: count || 0,
            offset,
            items: (data || []).map(this.mapDBToMessage),
        };
    }
    /**
     * Pobierz szczegóły wiadomości
     */
    async getMessage(messageId) {
        if (!this.userId) {
            throw new Error("Serwis nie został zainicjalizowany");
        }
        const { data, error } = await this.supabase
            .from("epuap_messages")
            .select("*")
            .eq("user_id", this.userId)
            .eq("id", messageId)
            .maybeSingle();
        if (error || !data) {
            return null;
        }
        return this.mapDBToMessage(data);
    }
    /**
     * Oznacz wiadomość jako przeczytaną
     */
    async markAsRead(messageId) {
        if (!this.userId) {
            throw new Error("Serwis nie został zainicjalizowany");
        }
        await this.supabase
            .from("epuap_messages")
            .update({ status: "read", read_at: new Date().toISOString() })
            .eq("user_id", this.userId)
            .eq("id", messageId);
    }
    /**
     * Oznacz wiadomość jako przetworzoną
     */
    async markAsProcessed(messageId, caseNumber) {
        if (!this.userId) {
            throw new Error("Serwis nie został zainicjalizowany");
        }
        const updates = {
            status: "processed",
            processed_at: new Date().toISOString(),
        };
        if (caseNumber) {
            updates.case_number = caseNumber;
        }
        await this.supabase
            .from("epuap_messages")
            .update(updates)
            .eq("user_id", this.userId)
            .eq("id", messageId);
    }
    /**
     * Synchronizuj wiadomości z ePUAP
     * UWAGA: Wymaga aktywnego certyfikatu i konfiguracji SOAP
     */
    async syncMessages() {
        if (!this.isConfigured()) {
            return {
                synced: 0,
                errors: ["Integracja ePUAP nie jest skonfigurowana"],
            };
        }
        // TODO: Implementacja SOAP client dla ePUAP
        // Wymaga biblioteki soap (npm install soap)
        // oraz certyfikatu kwalifikowanego
        console.log("[ePUAP] Sync requested but SOAP client not implemented");
        return {
            synced: 0,
            errors: ["Synchronizacja SOAP nie jest jeszcze zaimplementowana"],
        };
    }
    /**
     * Obsłuż webhook od ePUAP
     */
    async handleWebhook(payload) {
        console.log("[ePUAP] Webhook received:", payload.eventType, payload.messageId);
        switch (payload.eventType) {
            case "new_message":
                // Pobierz nową wiadomość i zapisz do bazy
                await this.syncMessages();
                break;
            case "message_read":
                // Aktualizuj status
                if (this.userId && payload.messageId) {
                    await this.markAsRead(payload.messageId);
                }
                break;
            case "error":
                console.error("[ePUAP] Webhook error:", payload.data);
                break;
        }
    }
    /**
     * Zapisz konfigurację integracji
     */
    async saveConfig(config) {
        if (!this.userId) {
            throw new Error("Serwis nie został zainicjalizowany");
        }
        const { error } = await this.supabase.from("user_integrations").upsert({
            user_id: this.userId,
            integration_type: "epuap",
            config: { ...this.config, ...config },
            updated_at: new Date().toISOString(),
        }, {
            onConflict: "user_id,integration_type",
        });
        if (error) {
            throw new Error("Błąd zapisu konfiguracji: " + error.message);
        }
        this.config = { ...this.config, ...config };
    }
    /**
     * Pobierz statystyki
     */
    async getStats() {
        if (!this.userId) {
            throw new Error("Serwis nie został zainicjalizowany");
        }
        const { data } = await this.supabase
            .from("epuap_messages")
            .select("status")
            .eq("user_id", this.userId);
        const messages = data || [];
        return {
            total: messages.length,
            new: messages.filter((m) => m.status === "new").length,
            read: messages.filter((m) => m.status === "read").length,
            processed: messages.filter((m) => m.status === "processed").length,
        };
    }
    // Pomocnicze metody
    mapDBToMessage(row) {
        return {
            id: row.id,
            messageId: row.epuap_message_id,
            sender: row.sender,
            senderName: row.sender_name,
            recipient: row.recipient,
            subject: row.subject,
            content: row.content,
            attachments: row.attachments || [],
            receivedAt: row.received_at,
            status: row.status,
            documentType: row.document_type,
            caseNumber: row.case_number,
            metadata: row.metadata || {},
        };
    }
}
//# sourceMappingURL=epuap-service.js.map