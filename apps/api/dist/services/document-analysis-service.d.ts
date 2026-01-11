export interface DocumentReference {
    type: "druk" | "attachment" | "resolution" | "protocol" | "report";
    number: string;
    title?: string;
    found: boolean;
    content?: string;
    sourceUrl?: string;
}
export interface AnalysisContext {
    mainDocument: {
        id: string;
        title: string;
        content: string;
        documentType: string;
        publishDate?: string;
        sourceUrl?: string;
        summary?: string;
        keywords?: string[];
    };
    references: DocumentReference[];
    additionalContext: string[];
    missingReferences: string[];
}
export interface AnalysisResult {
    context: AnalysisContext;
    prompt: string;
    systemPrompt: string;
}
export declare class DocumentAnalysisService {
    private openai;
    private embeddingModel;
    initialize(userId: string): Promise<void>;
    extractReferences(content: string): DocumentReference[];
    searchReferencesInRAG(userId: string, references: DocumentReference[]): Promise<DocumentReference[]>;
    private buildSearchQuery;
    private matchesReference;
    getDocument(userId: string, documentId: string): Promise<{
        id: string;
        title: string;
        content: string;
        document_type: string;
        publish_date?: string;
        source_url?: string;
        summary?: string;
        keywords?: string[];
    } | null>;
    searchSourcePageForAttachments(userId: string, sourceUrl: string | undefined, references: DocumentReference[]): Promise<DocumentReference[]>;
    private crawlSourcePageDeep;
    private findMatchingAttachment;
    private fetchAndProcessAttachment;
    searchMissingWithDeepResearch(userId: string, references: DocumentReference[]): Promise<DocumentReference[]>;
    buildAnalysisContext(userId: string, documentId: string, useDeepResearch?: boolean): Promise<AnalysisContext | null>;
    generateAnalysisPrompt(context: AnalysisContext): AnalysisResult;
}
export declare const documentAnalysisService: DocumentAnalysisService;
//# sourceMappingURL=document-analysis-service.d.ts.map