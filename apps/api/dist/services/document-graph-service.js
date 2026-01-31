import { supabase } from "../lib/supabase.js";
// Wzorce regex do wykrywania referencji
const REFERENCE_PATTERNS = {
    druk: /druk(?:u|iem|owi)?\s*n?r?\.?\s*(\d+)/gi,
    uchwala: /uchwa[łl][aęy]\s+([IVXLCDM]+[/-]\d+[/-]\d+)/gi,
    protokol: /protoko[łl]\s+(?:z|nr\.?)\s*([^,.]{5,50})/gi,
    zalacznik: /za[łl][aą]cznik\s+n?r?\.?\s*(\d+)/gi,
    sesja: /sesj[aęi]\s+([IVXLCDM]+|\d+)/gi,
};
// Wzorce do wykrywania relacji prawnych (zmienia/uchyla/wykonuje)
const LEGAL_RELATION_PATTERNS = {
    // Zmienia uchwałę
    amends: [
        /zmienia(?:jąc[aąey]?)?\s+uchwa[łl][ęę]?\s+(?:Nr\.?\s*)?([IVXLCDM\d]+[/.-]\d+[/.-]\d+)/gi,
        /w\s+sprawie\s+zmiany\s+uchwa[łl]y\s+(?:Nr\.?\s*)?([IVXLCDM\d]+[/.-]\d+[/.-]\d+)/gi,
        /nowelizuj[ąe]\s+uchwa[łl][ęę]?\s+(?:Nr\.?\s*)?([IVXLCDM\d]+[/.-]\d+[/.-]\d+)/gi,
    ],
    // Uchyla uchwałę
    supersedes: [
        /uchyla(?:jąc[aąey]?)?\s+uchwa[łl][ęę]?\s+(?:Nr\.?\s*)?([IVXLCDM\d]+[/.-]\d+[/.-]\d+)/gi,
        /traci\s+moc\s+uchwa[łl]a\s+(?:Nr\.?\s*)?([IVXLCDM\d]+[/.-]\d+[/.-]\d+)/gi,
        /w\s+sprawie\s+uchylenia\s+uchwa[łl]y\s+(?:Nr\.?\s*)?([IVXLCDM\d]+[/.-]\d+[/.-]\d+)/gi,
    ],
    // Wykonuje uchwałę / ustawę
    implements: [
        /wykonuj[ąe]\s+uchwa[łl][ęę]?\s+(?:Nr\.?\s*)?([IVXLCDM\d]+[/.-]\d+[/.-]\d+)/gi,
        /na\s+podstawie\s+(?:art\.\s*\d+\s+)?uchwa[łl]y\s+(?:Nr\.?\s*)?([IVXLCDM\d]+[/.-]\d+[/.-]\d+)/gi,
        /w\s+wykonaniu\s+uchwa[łl]y\s+(?:Nr\.?\s*)?([IVXLCDM\d]+[/.-]\d+[/.-]\d+)/gi,
        /realizuj[ąe]\s+uchwa[łl][ęę]?\s+(?:Nr\.?\s*)?([IVXLCDM\d]+[/.-]\d+[/.-]\d+)/gi,
    ],
    // Puste tablice dla pozostałych typów (nieużywane tutaj)
    references: [],
    contains: [],
    attachment: [],
    related: [],
    responds_to: [],
    derived_from: [],
};
export class DocumentGraphService {
    /**
     * Pobierz wszystkie dokumenty powiązane z danym dokumentem
     */
    async getRelatedDocuments(documentId, maxDepth = 3, minStrength = 0.3) {
        const { data, error } = await supabase.rpc("get_related_documents", {
            p_document_id: documentId,
            p_max_depth: maxDepth,
            p_min_strength: minStrength,
        });
        if (error) {
            console.error("[DocumentGraph] Error getting related documents:", error);
            throw new Error(`Failed to get related documents: ${error.message}`);
        }
        // Pobierz szczegóły dokumentów
        if (data && data.length > 0) {
            const docIds = data.map((r) => r.document_id);
            const { data: docs } = await supabase
                .from("documents")
                .select("id, title, document_type, publish_date, summary, filename")
                .in("id", docIds);
            if (docs) {
                const docsMap = new Map(docs.map((d) => [d.id, d]));
                return data.map((r) => ({
                    ...r,
                    document: docsMap.get(r.document_id),
                }));
            }
        }
        return data || [];
    }
    /**
     * Znajdź najkrótszą ścieżkę między dwoma dokumentami
     */
    async findPath(sourceId, targetId, maxDepth = 5) {
        const { data, error } = await supabase.rpc("find_document_path", {
            p_source_id: sourceId,
            p_target_id: targetId,
            p_max_depth: maxDepth,
        });
        if (error) {
            console.error("[DocumentGraph] Error finding path:", error);
            return null;
        }
        return data?.[0] || null;
    }
    /**
     * Dodaj relację między dokumentami
     */
    async addRelation(sourceId, targetId, relationType, options) {
        const { data, error } = await supabase
            .from("document_relations")
            .upsert({
            source_document_id: sourceId,
            target_document_id: targetId,
            relation_type: relationType,
            strength: options?.strength ?? 1.0,
            context: options?.context,
            reference_text: options?.referenceText,
            detected_automatically: options?.detectedAutomatically ?? true,
        }, {
            onConflict: "source_document_id,target_document_id,relation_type",
        })
            .select()
            .single();
        if (error) {
            console.error("[DocumentGraph] Error adding relation:", error);
            return null;
        }
        return data;
    }
    /**
     * Pobierz bezpośrednie relacje dokumentu
     */
    async getDirectRelations(documentId) {
        const [outgoingResult, incomingResult] = await Promise.all([
            supabase
                .from("document_relations")
                .select("*")
                .eq("source_document_id", documentId)
                .order("strength", { ascending: false }),
            supabase
                .from("document_relations")
                .select("*")
                .eq("target_document_id", documentId)
                .order("strength", { ascending: false }),
        ]);
        return {
            outgoing: outgoingResult.data || [],
            incoming: incomingResult.data || [],
        };
    }
    /**
     * Wykryj referencje w treści dokumentu i dodaj relacje
     */
    async detectAndAddReferences(documentId) {
        // Pobierz treść dokumentu
        const { data: doc } = await supabase
            .from("documents")
            .select("id, title, content")
            .eq("id", documentId)
            .single();
        if (!doc?.content) {
            return 0;
        }
        let addedCount = 0;
        const content = doc.content;
        // Wykryj referencje do druków
        const drukMatches = [...content.matchAll(REFERENCE_PATTERNS.druk)];
        for (const match of drukMatches) {
            const drukNr = match[1];
            const { data: targets } = await supabase
                .from("documents")
                .select("id")
                .ilike("title", `%druk%${drukNr}%`)
                .neq("id", documentId)
                .limit(5);
            for (const target of targets || []) {
                const result = await this.addRelation(documentId, target.id, "references", {
                    referenceText: match[0],
                    strength: 0.9,
                });
                if (result)
                    addedCount++;
            }
        }
        // Wykryj referencje do uchwał
        const uchwalaMatches = [...content.matchAll(REFERENCE_PATTERNS.uchwala)];
        for (const match of uchwalaMatches) {
            const uchwalaRef = match[1];
            const { data: targets } = await supabase
                .from("documents")
                .select("id")
                .ilike("title", `%${uchwalaRef}%`)
                .neq("id", documentId)
                .limit(5);
            for (const target of targets || []) {
                const result = await this.addRelation(documentId, target.id, "references", {
                    referenceText: match[0],
                    strength: 0.95,
                });
                if (result)
                    addedCount++;
            }
        }
        // Wykryj referencje do protokołów
        const protokolMatches = [...content.matchAll(REFERENCE_PATTERNS.protokol)];
        for (const match of protokolMatches) {
            const protokolRef = match[1].trim();
            const { data: targets } = await supabase
                .from("documents")
                .select("id")
                .ilike("title", `%protokół%${protokolRef}%`)
                .neq("id", documentId)
                .limit(3);
            for (const target of targets || []) {
                const result = await this.addRelation(documentId, target.id, "references", {
                    referenceText: match[0],
                    strength: 0.8,
                });
                if (result)
                    addedCount++;
            }
        }
        // Wykryj relacje prawne (zmienia/uchyla/wykonuje)
        addedCount += await this.detectLegalRelations(documentId, content);
        console.log(`[DocumentGraph] Detected ${addedCount} references for document ${documentId}`);
        return addedCount;
    }
    /**
     * Wykryj relacje prawne w treści dokumentu (zmienia/uchyla/wykonuje)
     */
    async detectLegalRelations(documentId, content) {
        let addedCount = 0;
        const relationsToCheck = [
            "amends",
            "supersedes",
            "implements",
        ];
        for (const relationType of relationsToCheck) {
            const patterns = LEGAL_RELATION_PATTERNS[relationType];
            if (!patterns || patterns.length === 0)
                continue;
            for (const pattern of patterns) {
                // Reset regex lastIndex
                pattern.lastIndex = 0;
                const matches = [...content.matchAll(pattern)];
                for (const match of matches) {
                    const uchwalaRef = match[1];
                    if (!uchwalaRef)
                        continue;
                    // Szukaj dokumentu po numerze uchwały
                    const { data: targets } = await supabase
                        .from("documents")
                        .select("id")
                        .or(`title.ilike.%${uchwalaRef}%,metadata->>resolution_number.ilike.%${uchwalaRef}%`)
                        .neq("id", documentId)
                        .limit(5);
                    for (const target of targets || []) {
                        const result = await this.addRelation(documentId, target.id, relationType, {
                            referenceText: match[0],
                            strength: 1.0, // Relacje prawne mają najwyższą siłę
                            context: `Dokument ${relationType === "amends" ? "zmienia" : relationType === "supersedes" ? "uchyla" : "wykonuje"} uchwałę ${uchwalaRef}`,
                        });
                        if (result) {
                            addedCount++;
                            console.log(`[DocumentGraph] Found ${relationType} relation: ${documentId} -> ${target.id} (${uchwalaRef})`);
                        }
                    }
                }
            }
        }
        return addedCount;
    }
    /**
     * Utwórz klaster dokumentów powiązanych
     */
    async createCluster(name, rootDocumentId, options) {
        // Pobierz powiązane dokumenty
        const related = await this.getRelatedDocuments(rootDocumentId, options?.maxDepth ?? 3);
        // Utwórz klaster
        const { data: cluster, error } = await supabase
            .from("document_clusters")
            .insert({
            name,
            description: options?.description,
            cluster_type: options?.clusterType ?? "auto",
            root_document_id: rootDocumentId,
            document_count: related.length + 1,
            total_strength: related.reduce((sum, r) => sum + r.total_strength, 0),
        })
            .select()
            .single();
        if (error || !cluster) {
            console.error("[DocumentGraph] Error creating cluster:", error);
            return null;
        }
        // Dodaj dokumenty do klastra
        const members = [
            { cluster_id: cluster.id, document_id: rootDocumentId, depth: 0 },
            ...related.map((r) => ({
                cluster_id: cluster.id,
                document_id: r.document_id,
                depth: r.depth,
                parent_document_id: r.path[r.path.length - 2] || null,
            })),
        ];
        await supabase.from("document_cluster_members").insert(members);
        return { ...cluster, documents: related };
    }
    /**
     * Pobierz statystyki grafu
     */
    async getGraphStats() {
        const { data, error } = await supabase
            .from("document_graph_stats")
            .select("*")
            .single();
        if (error) {
            console.error("[DocumentGraph] Error getting stats:", error);
            return null;
        }
        return data;
    }
    /**
     * Grupuj dokumenty według powiązań (dla UI grupowania)
     */
    async groupByRelations(documentIds) {
        const clusters = [];
        const processed = new Set();
        for (const docId of documentIds) {
            if (processed.has(docId))
                continue;
            // Pobierz powiązane dokumenty
            const related = await this.getRelatedDocuments(docId, 2, 0.5);
            const clusterDocs = related.filter((r) => documentIds.includes(r.document_id));
            if (clusterDocs.length > 0) {
                // Pobierz tytuł głównego dokumentu
                const { data: rootDoc } = await supabase
                    .from("documents")
                    .select("title")
                    .eq("id", docId)
                    .single();
                clusters.push({
                    id: `cluster-${docId}`,
                    name: rootDoc?.title || "Klaster dokumentów",
                    cluster_type: "relation",
                    root_document_id: docId,
                    document_count: clusterDocs.length + 1,
                    total_strength: clusterDocs.reduce((sum, r) => sum + r.total_strength, 0),
                    documents: [
                        {
                            document_id: docId,
                            depth: 0,
                            path: [docId],
                            total_strength: 1,
                            relation_types: [],
                        },
                        ...clusterDocs,
                    ],
                });
                // Oznacz jako przetworzone
                processed.add(docId);
                clusterDocs.forEach((r) => processed.add(r.document_id));
            }
        }
        return clusters;
    }
    /**
     * Zweryfikuj relację (przez użytkownika)
     */
    async verifyRelation(relationId, verified) {
        const { error } = await supabase
            .from("document_relations")
            .update({ verified_by_user: verified })
            .eq("id", relationId);
        return !error;
    }
    /**
     * Usuń relację
     */
    async removeRelation(relationId) {
        const { error } = await supabase
            .from("document_relations")
            .delete()
            .eq("id", relationId);
        return !error;
    }
}
export const documentGraphService = new DocumentGraphService();
//# sourceMappingURL=document-graph-service.js.map