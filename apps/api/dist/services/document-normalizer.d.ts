/**
 * Document Normalizer Service
 *
 * Inteligentna normalizacja chaotycznych danych źródłowych do ustandaryzowanego formatu.
 * LLM analizuje surowe dane i wyodrębnia strukturalne metadane.
 *
 * FILOZOFIA: Uporządkuj chaos NA WEJŚCIU, nie walcz z nim NA WYJŚCIU.
 */
/**
 * Znormalizowane metadane dokumentu - JEDNOLITY FORMAT dla wszystkich źródeł
 */
export interface NormalizedDocumentMetadata {
    documentType: DocumentType;
    documentSubtype?: string;
    hierarchyLevel: 1 | 2 | 3 | 4 | 5;
    sessionInfo?: {
        sessionNumber: number;
        sessionType?: SessionType;
        sessionDate?: string;
    };
    documentNumber?: string;
    publishDate?: string;
    effectiveDate?: string;
    topics: string[];
    keywords: string[];
    people?: {
        authors?: string[];
        speakers?: string[];
        mentioned?: string[];
    };
    source: {
        origin: string;
        url?: string;
        scrapedAt: string;
    };
    confidence: {
        overall: number;
        sessionNumber?: number;
        documentType?: number;
    };
    extra?: Record<string, unknown>;
}
export type DocumentType = "budget_act" | "resolution" | "session_order" | "resolution_project" | "protocol" | "interpellation" | "transcription" | "video" | "committee_opinion" | "justification" | "session_materials" | "order" | "announcement" | "attachment" | "reference_material" | "news" | "report" | "opinion" | "motion" | "other";
export type SessionType = "ordinary" | "extraordinary" | "budget" | "constituent";
export declare class DocumentNormalizer {
    private llmClient;
    private modelName;
    private userId;
    constructor(userId: string);
    initialize(): Promise<void>;
    /**
     * Główna metoda - normalizuje surowe dane dokumentu
     */
    normalize(rawDocument: {
        title: string;
        content?: string;
        url?: string;
        sourceType: string;
        rawMetadata?: Record<string, unknown>;
    }): Promise<NormalizedDocumentMetadata>;
    /**
     * LLM wyodrębnia strukturalne metadane z chaotycznych danych
     */
    private extractMetadataWithLLM;
    /**
     * Fallback - podstawowa ekstrakcja bez LLM
     */
    private fallbackExtraction;
    /**
     * Walidacja i wzbogacenie metadanych
     */
    private validateAndEnrich;
    /**
     * Konwersja numerów rzymskich na arabskie
     */
    private romanToArabic;
}
/**
 * Przykład normalizacji dokumentu z różnych źródeł
 */
export declare function exampleUsage(): Promise<void>;
//# sourceMappingURL=document-normalizer.d.ts.map