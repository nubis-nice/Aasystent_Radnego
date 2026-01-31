export type DocumentRelationType = "references" | "amends" | "supersedes" | "implements" | "contains" | "attachment" | "related" | "responds_to" | "derived_from";
export interface DocumentRelation {
    id: string;
    source_document_id: string;
    target_document_id: string;
    relation_type: DocumentRelationType;
    strength: number;
    context?: string;
    reference_text?: string;
    detected_automatically: boolean;
    verified_by_user: boolean;
    created_at: string;
}
export interface RelatedDocument {
    document_id: string;
    depth: number;
    path: string[];
    total_strength: number;
    relation_types: DocumentRelationType[];
    document?: {
        id: string;
        title: string;
        document_type: string;
        publish_date: string | null;
        summary: string | null;
        filename?: string;
    };
}
export interface DocumentCluster {
    id: string;
    name: string;
    description?: string;
    cluster_type: string;
    root_document_id?: string;
    document_count: number;
    total_strength: number;
    documents?: RelatedDocument[];
}
export interface GraphStats {
    total_documents: number;
    total_relations: number;
    total_clusters: number;
    documents_with_outgoing: number;
    documents_with_incoming: number;
    avg_relation_strength: number;
}
export declare class DocumentGraphService {
    /**
     * Pobierz wszystkie dokumenty powiązane z danym dokumentem
     */
    getRelatedDocuments(documentId: string, maxDepth?: number, minStrength?: number): Promise<RelatedDocument[]>;
    /**
     * Znajdź najkrótszą ścieżkę między dwoma dokumentami
     */
    findPath(sourceId: string, targetId: string, maxDepth?: number): Promise<{
        path: string[];
        depth: number;
        relation_types: DocumentRelationType[];
        total_strength: number;
    } | null>;
    /**
     * Dodaj relację między dokumentami
     */
    addRelation(sourceId: string, targetId: string, relationType: DocumentRelationType, options?: {
        strength?: number;
        context?: string;
        referenceText?: string;
        detectedAutomatically?: boolean;
    }): Promise<DocumentRelation | null>;
    /**
     * Pobierz bezpośrednie relacje dokumentu
     */
    getDirectRelations(documentId: string): Promise<{
        outgoing: DocumentRelation[];
        incoming: DocumentRelation[];
    }>;
    /**
     * Wykryj referencje w treści dokumentu i dodaj relacje
     */
    detectAndAddReferences(documentId: string): Promise<number>;
    /**
     * Wykryj relacje prawne w treści dokumentu (zmienia/uchyla/wykonuje)
     */
    detectLegalRelations(documentId: string, content: string): Promise<number>;
    /**
     * Utwórz klaster dokumentów powiązanych
     */
    createCluster(name: string, rootDocumentId: string, options?: {
        description?: string;
        clusterType?: string;
        maxDepth?: number;
    }): Promise<DocumentCluster | null>;
    /**
     * Pobierz statystyki grafu
     */
    getGraphStats(): Promise<GraphStats | null>;
    /**
     * Grupuj dokumenty według powiązań (dla UI grupowania)
     */
    groupByRelations(documentIds: string[]): Promise<DocumentCluster[]>;
    /**
     * Zweryfikuj relację (przez użytkownika)
     */
    verifyRelation(relationId: string, verified: boolean): Promise<boolean>;
    /**
     * Usuń relację
     */
    removeRelation(relationId: string): Promise<boolean>;
}
export declare const documentGraphService: DocumentGraphService;
//# sourceMappingURL=document-graph-service.d.ts.map