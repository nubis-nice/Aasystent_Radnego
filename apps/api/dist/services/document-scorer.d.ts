/**
 * Document Scorer Service
 * Algorytm inteligentnego scoringu dokumentów dla radnego
 */
export type DocumentPriority = "critical" | "high" | "medium" | "low";
export interface DocumentScore {
    relevanceScore: number;
    urgencyScore: number;
    typeScore: number;
    recencyScore: number;
    totalScore: number;
    priority: DocumentPriority;
    scoringDetails: {
        typeBonus: number;
        keywordBonus: number;
        sessionBonus: number;
        recencyBonus: number;
    };
}
export interface ScoredDocument {
    id: string;
    title: string;
    document_type: string;
    content: string;
    summary: string | null;
    keywords: string[];
    publish_date: string | null;
    source_url: string | null;
    processed_at: string;
    metadata: Record<string, unknown>;
    score: DocumentScore;
    session_number?: number;
    normalized_publish_date?: string;
}
export declare class DocumentScorer {
    private councilLocation;
    constructor(councilLocation?: string);
    /**
     * Oblicz score dla pojedynczego dokumentu
     */
    calculateScore(doc: {
        title: string;
        content: string;
        document_type: string;
        keywords?: string[];
        publish_date?: string | null;
        processed_at?: string;
        metadata?: Record<string, unknown>;
    }): DocumentScore;
    /**
     * Wykryj numer sesji z zapytania
     */
    private extractSessionNumber;
    private romanToArabic;
    private arabicToRoman;
    /**
     * Pobierz dokumenty z bazy i oblicz score dla każdego
     */
    getDocumentsWithScores(userId: string, options?: {
        search?: string;
        documentType?: string;
        dateFrom?: string;
        dateTo?: string;
        priority?: DocumentPriority;
        sortBy?: "score" | "date" | "title";
        sortOrder?: "asc" | "desc";
        limit?: number;
        offset?: number;
    }): Promise<{
        documents: ScoredDocument[];
        total: number;
    }>;
    /**
     * Aktualizuj score dokumentu w bazie (opcjonalne - cache)
     */
    updateDocumentScore(documentId: string): Promise<DocumentScore | null>;
    /**
     * Normalizacja tytułu dokumentu
     * - Usuwa śmieci (| Urząd Miejski..., System Rada...)
     * - Zamienia angielskie nazwy na polskie
     */
    private normalizeTitle;
}
export declare const documentScorer: DocumentScorer;
//# sourceMappingURL=document-scorer.d.ts.map