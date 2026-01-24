/**
 * Auto-import wydarzeń do kalendarza z przetworzonych dokumentów
 * Automatycznie tworzy wydarzenia gdy scrapowane są dokumenty sesji/komisji
 * Używa AI do ekstrakcji daty, godziny i miejsca z treści dokumentu
 */
interface DocumentInfo {
    id: string;
    user_id: string;
    title: string;
    document_type: string;
    content?: string;
    session_number?: number;
    normalized_publish_date?: string;
    source_url?: string;
}
/**
 * Automatycznie tworzy wydarzenie w kalendarzu dla dokumentów sesji/komisji
 */
export declare function autoImportToCalendar(doc: DocumentInfo): Promise<void>;
/**
 * Batch import - importuj wszystkie istniejące dokumenty sesji/komisji do kalendarza
 */
export declare function batchImportExistingDocuments(userId: string): Promise<{
    imported: number;
    skipped: number;
    errors: number;
}>;
export {};
//# sourceMappingURL=calendar-auto-import.d.ts.map