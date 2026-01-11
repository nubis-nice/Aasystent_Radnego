/**
 * Document Query Service
 *
 * Inteligentne wykrywanie i wyszukiwanie dokumentów w wiadomościach użytkownika.
 *
 * Przepływ:
 * 1. Wykryj ID/nazwę dokumentu w wiadomości
 * 2. Szukaj w RAG (processed_documents)
 * 3. Jeśli znaleziono → zwróć metadane (nie pełną treść!)
 * 4. Jeśli nie → fallback do intelligent scraping → Exa
 * 5. Dodaj relacje do Document Graph
 */
export interface DocumentReference {
    type: "id" | "title" | "druk" | "uchwala" | "protokol" | "sesja";
    value: string;
    originalText: string;
}
export interface DocumentMatch {
    id: string;
    title: string;
    documentType: string;
    publishDate?: string;
    summary?: string;
    sourceUrl?: string;
    similarity: number;
}
export interface DocumentQueryResult {
    found: boolean;
    matches: DocumentMatch[];
    query: string;
    searchMethod: "id" | "semantic" | "fulltext";
    needsConfirmation: boolean;
    confirmationMessage?: string;
    fallbackSuggested?: "scraping" | "exa" | null;
}
export interface DocumentContext {
    documentId: string;
    title: string;
    documentType: string;
    relevantChunks: Array<{
        content: string;
        similarity: number;
    }>;
    relatedDocuments: DocumentMatch[];
    attachments: DocumentMatch[];
}
export declare class DocumentQueryService {
    private openai;
    private userId;
    private embeddingModel;
    constructor(userId: string);
    initialize(): Promise<void>;
    /**
     * Wykrywa referencje do dokumentów w wiadomości użytkownika
     */
    detectDocumentReferences(message: string): DocumentReference[];
    /**
     * Szuka dokumentu po ID (dokładne dopasowanie)
     */
    findDocumentById(documentId: string): Promise<DocumentMatch | null>;
    /**
     * Szuka dokumentów po nazwie/tytule (fulltext search)
     */
    findDocumentsByTitle(title: string): Promise<DocumentMatch[]>;
    /**
     * Szuka dokumentów semantycznie (embedding similarity)
     */
    findDocumentsSemantic(query: string, limit?: number): Promise<DocumentMatch[]>;
    /**
     * Przetwarza wiadomość i szuka dokumentów
     */
    queryDocuments(message: string): Promise<DocumentQueryResult>;
    /**
     * Pobiera kontekst dokumentu do analizy
     * WAŻNE: Zwraca tylko relevantne chunki, nie pełną treść!
     */
    getDocumentContext(documentId: string, queryForChunks?: string): Promise<DocumentContext | null>;
    /**
     * Pobiera powiązane dokumenty z Document Graph
     */
    private getRelatedDocuments;
    /**
     * Pobiera załączniki dokumentu
     */
    private getAttachments;
    private deduplicateMatches;
    private buildConfirmationMessage;
}
export default DocumentQueryService;
//# sourceMappingURL=document-query-service.d.ts.map