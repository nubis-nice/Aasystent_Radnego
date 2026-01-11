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
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
// ============================================================================
// DOCUMENT QUERY SERVICE
// ============================================================================
export class DocumentQueryService {
    openai = null;
    userId;
    embeddingModel = "text-embedding-3-small";
    constructor(userId) {
        this.userId = userId;
    }
    async initialize() {
        const { data: apiConfig } = await supabase
            .from("api_configurations")
            .select("*")
            .eq("user_id", this.userId)
            .eq("is_default", true)
            .eq("is_active", true)
            .single();
        if (apiConfig) {
            const decodedApiKey = Buffer.from(apiConfig.api_key_encrypted, "base64").toString("utf-8");
            this.openai = new OpenAI({
                apiKey: decodedApiKey,
                baseURL: apiConfig.base_url || undefined,
            });
            this.embeddingModel =
                apiConfig.embedding_model || "text-embedding-3-small";
        }
        else if (process.env.OPENAI_API_KEY) {
            this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        }
    }
    // ============================================================================
    // PHASE 1: WYKRYWANIE REFERENCJI W WIADOMOŚCI
    // ============================================================================
    /**
     * Wykrywa referencje do dokumentów w wiadomości użytkownika
     */
    detectDocumentReferences(message) {
        const references = [];
        // UUID pattern (ID dokumentu)
        const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
        let match;
        while ((match = uuidPattern.exec(message)) !== null) {
            references.push({
                type: "id",
                value: match[0],
                originalText: match[0],
            });
        }
        // Druk nr X
        const drukPattern = /druk(?:u|i)?\s*(?:nr|numer)?\s*(\d+)/gi;
        while ((match = drukPattern.exec(message)) !== null) {
            references.push({
                type: "druk",
                value: match[1],
                originalText: match[0],
            });
        }
        // Uchwała nr X/Y/Z
        const uchwalPattern = /uchwał[aęy]\s*(?:nr|numer)?\s*([IVXLCDM]+\/\d+\/\d+|\d+\/\d+\/\d+)/gi;
        while ((match = uchwalPattern.exec(message)) !== null) {
            references.push({
                type: "uchwala",
                value: match[1],
                originalText: match[0],
            });
        }
        // Protokół z sesji X
        const protokolPattern = /protokoł?u?\s*(?:z\s*)?(?:sesji\s*)?(?:nr\s*)?([IVXLCDM]+|\d+)/gi;
        while ((match = protokolPattern.exec(message)) !== null) {
            references.push({
                type: "protokol",
                value: match[1],
                originalText: match[0],
            });
        }
        // Sesja nr X / X sesja
        const sesjaPattern = /(?:sesj[aię]\s*(?:nr\s*)?|(\d+)\s*sesj[aię])([IVXLCDM]+|\d+)?/gi;
        while ((match = sesjaPattern.exec(message)) !== null) {
            const value = match[2] || match[1];
            if (value) {
                references.push({
                    type: "sesja",
                    value: value,
                    originalText: match[0],
                });
            }
        }
        // Charakterystyczne nazwy dokumentów (cudzysłowy)
        const quotedPattern = /"([^"]+)"|„([^"]+)"/g;
        while ((match = quotedPattern.exec(message)) !== null) {
            const title = match[1] || match[2];
            if (title && title.length > 5) {
                references.push({
                    type: "title",
                    value: title,
                    originalText: match[0],
                });
            }
        }
        return references;
    }
    // ============================================================================
    // PHASE 2: WYSZUKIWANIE W RAG
    // ============================================================================
    /**
     * Szuka dokumentu po ID (dokładne dopasowanie)
     */
    async findDocumentById(documentId) {
        const { data, error } = await supabase
            .from("processed_documents")
            .select("id, title, document_type, publish_date, summary, source_url")
            .eq("id", documentId)
            .eq("user_id", this.userId)
            .single();
        if (error || !data) {
            return null;
        }
        return {
            id: data.id,
            title: data.title,
            documentType: data.document_type,
            publishDate: data.publish_date,
            summary: data.summary,
            sourceUrl: data.source_url,
            similarity: 1.0,
        };
    }
    /**
     * Szuka dokumentów po nazwie/tytule (fulltext search)
     */
    async findDocumentsByTitle(title) {
        const { data, error } = await supabase
            .from("processed_documents")
            .select("id, title, document_type, publish_date, summary, source_url")
            .eq("user_id", this.userId)
            .ilike("title", `%${title}%`)
            .limit(5);
        if (error || !data) {
            return [];
        }
        return data.map((doc) => ({
            id: doc.id,
            title: doc.title,
            documentType: doc.document_type,
            publishDate: doc.publish_date,
            summary: doc.summary,
            sourceUrl: doc.source_url,
            similarity: 0.8, // Fulltext match
        }));
    }
    /**
     * Szuka dokumentów semantycznie (embedding similarity)
     */
    async findDocumentsSemantic(query, limit = 5) {
        if (!this.openai) {
            console.log("[DocumentQuery] No OpenAI client - skipping semantic search");
            return [];
        }
        try {
            // Generuj embedding
            const embeddingResponse = await this.openai.embeddings.create({
                model: this.embeddingModel,
                input: query,
            });
            const queryEmbedding = embeddingResponse.data[0].embedding;
            // Szukaj w RAG
            const { data, error } = await supabase.rpc("search_processed_documents", {
                query_embedding: queryEmbedding,
                match_threshold: 0.5,
                match_count: limit,
                filter_user_id: this.userId,
                filter_types: null,
            });
            if (error || !data) {
                console.error("[DocumentQuery] Semantic search error:", error);
                return [];
            }
            return data.map((doc) => ({
                id: doc.id,
                title: doc.title,
                documentType: doc.document_type,
                publishDate: doc.publish_date,
                summary: doc.summary,
                sourceUrl: doc.source_url,
                similarity: doc.similarity,
            }));
        }
        catch (err) {
            console.error("[DocumentQuery] Semantic search error:", err);
            return [];
        }
    }
    // ============================================================================
    // PHASE 3: GŁÓWNA LOGIKA WYSZUKIWANIA
    // ============================================================================
    /**
     * Przetwarza wiadomość i szuka dokumentów
     */
    async queryDocuments(message) {
        const references = this.detectDocumentReferences(message);
        console.log(`[DocumentQuery] Detected ${references.length} references in message`);
        // Jeśli nie wykryto referencji - semantic search po całej wiadomości
        if (references.length === 0) {
            const semanticMatches = await this.findDocumentsSemantic(message, 3);
            if (semanticMatches.length > 0 && semanticMatches[0].similarity > 0.7) {
                return {
                    found: true,
                    matches: semanticMatches,
                    query: message,
                    searchMethod: "semantic",
                    needsConfirmation: true,
                    confirmationMessage: this.buildConfirmationMessage(semanticMatches),
                };
            }
            return {
                found: false,
                matches: [],
                query: message,
                searchMethod: "semantic",
                needsConfirmation: false,
                fallbackSuggested: "exa",
            };
        }
        // Przetwórz wykryte referencje
        const allMatches = [];
        for (const ref of references) {
            let matches = [];
            if (ref.type === "id") {
                const byId = await this.findDocumentById(ref.value);
                if (byId)
                    matches = [byId];
            }
            else if (ref.type === "title") {
                matches = await this.findDocumentsByTitle(ref.value);
            }
            else {
                // druk, uchwala, protokol, sesja - szukaj semantycznie
                const searchQuery = `${ref.type} ${ref.value}`;
                matches = await this.findDocumentsSemantic(searchQuery, 3);
            }
            allMatches.push(...matches);
        }
        // Deduplikacja
        const uniqueMatches = this.deduplicateMatches(allMatches);
        if (uniqueMatches.length === 0) {
            return {
                found: false,
                matches: [],
                query: references.map((r) => r.originalText).join(", "),
                searchMethod: "semantic",
                needsConfirmation: false,
                fallbackSuggested: "scraping",
            };
        }
        // Jeśli dokładne dopasowanie (ID) - nie pytaj o potwierdzenie
        const hasExactMatch = references.some((r) => r.type === "id") &&
            uniqueMatches.some((m) => m.similarity === 1.0);
        return {
            found: true,
            matches: uniqueMatches,
            query: references.map((r) => r.originalText).join(", "),
            searchMethod: hasExactMatch ? "id" : "semantic",
            needsConfirmation: !hasExactMatch,
            confirmationMessage: hasExactMatch
                ? undefined
                : this.buildConfirmationMessage(uniqueMatches),
        };
    }
    // ============================================================================
    // PHASE 4: POBIERANIE KONTEKSTU DOKUMENTU (BEZ PEŁNEJ TREŚCI)
    // ============================================================================
    /**
     * Pobiera kontekst dokumentu do analizy
     * WAŻNE: Zwraca tylko relevantne chunki, nie pełną treść!
     */
    async getDocumentContext(documentId, queryForChunks) {
        // Pobierz metadane dokumentu
        const doc = await this.findDocumentById(documentId);
        if (!doc) {
            return null;
        }
        // Pobierz relevantne chunki (nie całą treść!)
        let relevantChunks = [];
        if (queryForChunks && this.openai) {
            try {
                const embeddingResponse = await this.openai.embeddings.create({
                    model: this.embeddingModel,
                    input: queryForChunks,
                });
                const queryEmbedding = embeddingResponse.data[0].embedding;
                // Szukaj chunków tego dokumentu
                const { data: chunks } = await supabase.rpc("search_processed_documents", {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.4,
                    match_count: 10,
                    filter_user_id: this.userId,
                    filter_types: null,
                });
                if (chunks) {
                    // Filtruj tylko chunki z tego dokumentu
                    relevantChunks = chunks
                        .filter((c) => c.id === documentId || c.id.startsWith(documentId))
                        .slice(0, 5)
                        .map((c) => ({
                        content: c.content?.substring(0, 1000) || "", // Max 1000 znaków per chunk
                        similarity: c.similarity,
                    }));
                }
            }
            catch (err) {
                console.error("[DocumentQuery] Error fetching chunks:", err);
            }
        }
        // Pobierz powiązane dokumenty z Document Graph
        const relatedDocuments = await this.getRelatedDocuments(documentId);
        // Pobierz załączniki
        const attachments = await this.getAttachments(documentId);
        return {
            documentId,
            title: doc.title,
            documentType: doc.documentType,
            relevantChunks,
            relatedDocuments,
            attachments,
        };
    }
    /**
     * Pobiera powiązane dokumenty z Document Graph
     */
    async getRelatedDocuments(documentId) {
        try {
            const { data, error } = await supabase.rpc("get_related_documents", {
                p_document_id: documentId,
                p_max_depth: 2,
                p_min_strength: 0.3,
            });
            if (error || !data) {
                return [];
            }
            return data
                .slice(0, 5)
                .map((doc) => ({
                id: doc.id,
                title: doc.title,
                documentType: doc.document_type,
                publishDate: doc.publish_date,
                similarity: doc.relation_strength,
            }));
        }
        catch {
            return [];
        }
    }
    /**
     * Pobiera załączniki dokumentu
     */
    async getAttachments(documentId) {
        try {
            const { data, error } = await supabase
                .from("document_relations")
                .select(`
          target_document:target_document_id (
            id, title, document_type, publish_date
          )
        `)
                .eq("source_document_id", documentId)
                .eq("relation_type", "attachment");
            if (error || !data) {
                return [];
            }
            return data
                .filter((r) => r.target_document)
                .map((r) => ({
                id: r.target_document.id,
                title: r.target_document.title,
                documentType: r.target_document.document_type,
                publishDate: r.target_document.publish_date,
                similarity: 1.0,
            }));
        }
        catch {
            return [];
        }
    }
    // ============================================================================
    // HELPERS
    // ============================================================================
    deduplicateMatches(matches) {
        const seen = new Set();
        return matches.filter((m) => {
            if (seen.has(m.id))
                return false;
            seen.add(m.id);
            return true;
        });
    }
    buildConfirmationMessage(matches) {
        if (matches.length === 1) {
            const m = matches[0];
            return `Znalazłem dokument: **"${m.title}"** (${m.documentType}${m.publishDate ? `, ${m.publishDate}` : ""}). Czy to ten dokument, który chcesz przeanalizować?`;
        }
        const list = matches
            .slice(0, 3)
            .map((m, i) => `${i + 1}. "${m.title}" (${m.documentType})`)
            .join("\n");
        return `Znalazłem ${matches.length} dokumentów pasujących do zapytania:\n${list}\n\nKtóry dokument chcesz przeanalizować? Podaj numer lub nazwę.`;
    }
}
export default DocumentQueryService;
//# sourceMappingURL=document-query-service.js.map