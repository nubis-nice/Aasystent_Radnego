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
import { createClient } from "@supabase/supabase-js";
import { getEmbeddingsClient, getAIConfig } from "../ai/index.js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
// ============================================================================
// UTILS: Konwersja numerów rzymskich
// ============================================================================
const ROMAN_VALUES = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
};
function romanToArabic(roman) {
    const upper = roman.toUpperCase();
    let result = 0;
    let prevValue = 0;
    for (let i = upper.length - 1; i >= 0; i--) {
        const char = upper[i];
        const currentValue = char ? ROMAN_VALUES[char] || 0 : 0;
        if (currentValue < prevValue) {
            result -= currentValue;
        }
        else {
            result += currentValue;
        }
        prevValue = currentValue;
    }
    return result;
}
function arabicToRoman(num) {
    const romanNumerals = [
        [1000, "M"],
        [900, "CM"],
        [500, "D"],
        [400, "CD"],
        [100, "C"],
        [90, "XC"],
        [50, "L"],
        [40, "XL"],
        [10, "X"],
        [9, "IX"],
        [5, "V"],
        [4, "IV"],
        [1, "I"],
    ];
    let result = "";
    let remaining = num;
    for (const [value, numeral] of romanNumerals) {
        while (remaining >= value) {
            result += numeral;
            remaining -= value;
        }
    }
    return result;
}
function parseSessionNumber(value) {
    // Sprawdź czy to numer arabski
    const arabicNum = parseInt(value, 10);
    if (!isNaN(arabicNum)) {
        // Walidacja: numery sesji rzadko przekraczają 200
        if (arabicNum > 0 && arabicNum <= 200) {
            return arabicNum;
        }
        return 0;
    }
    // Spróbuj jako numer rzymski
    // Tylko typowe numery sesji: I-CC (1-200)
    // Odrzuć pojedyncze litery D, C, L, M które dają nierealistyczne wartości
    if (/^[IVXLC]+$/i.test(value) && value.length >= 1) {
        const romanNum = romanToArabic(value);
        // Walidacja: numery sesji rzadko przekraczają 200
        if (romanNum > 0 && romanNum <= 200) {
            return romanNum;
        }
    }
    return 0;
}
// ============================================================================
// DOCUMENT QUERY SERVICE
// ============================================================================
export class DocumentQueryService {
    embeddingsClient = null;
    userId;
    embeddingModel = "nomic-embed-text";
    constructor(userId) {
        this.userId = userId;
    }
    async initialize() {
        try {
            this.embeddingsClient = await getEmbeddingsClient(this.userId);
            const embConfig = await getAIConfig(this.userId, "embeddings");
            this.embeddingModel = embConfig.modelName;
            console.log(`[DocumentQueryService] Initialized: provider=${embConfig.provider}, model=${this.embeddingModel}`);
        }
        catch (error) {
            console.warn("[DocumentQueryService] Failed to initialize embeddings client:", error);
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
    /**
     * Wykrywa intencję zapytania o sesję rady
     * Rozpoznaje numer sesji i typ żądania (streszczenie, protokół, głosowania, itp.)
     */
    detectSessionIntent(message) {
        const lowerMessage = message.toLowerCase();
        // Wzorce wykrywania numeru sesji
        const sessionPatterns = [
            /sesj[aięy]\s*(?:nr|numer|rady)?\s*\.?\s*([IVXLCDM]+|\d+)/i,
            /([IVXLCDM]+|\d+)\s*sesj[aięy]/i,
            /streszcz(?:enie)?\s*(?:.*?)sesj[aięy]\s*(?:nr)?\s*\.?\s*([IVXLCDM]+|\d+)/i,
            /sesj[aięy]\s*(?:rady\s*(?:miejskiej|gminnej|gminy|miasta)?)?\s*(?:nr)?\s*\.?\s*([IVXLCDM]+|\d+)/i,
        ];
        let sessionNumber = 0;
        for (const pattern of sessionPatterns) {
            const match = message.match(pattern);
            if (match) {
                const value = match[1];
                if (value) {
                    sessionNumber = parseSessionNumber(value);
                    if (sessionNumber > 0)
                        break;
                }
            }
        }
        if (sessionNumber === 0) {
            return null;
        }
        // Wykryj typ żądania
        let requestType = "ogolne";
        if (/streszcz|podsumow|co\s*się\s*działo|omów|opowiedz/i.test(lowerMessage)) {
            requestType = "streszczenie";
        }
        else if (/protokoł|protokół/i.test(lowerMessage)) {
            requestType = "protokol";
        }
        else if (/głosow|wynik|jak\s*głosow/i.test(lowerMessage)) {
            requestType = "glosowania";
        }
        else if (/transkryp|zapis|stenogram/i.test(lowerMessage)) {
            requestType = "transkrypcja";
        }
        else if (/wideo|video|nagran|obejrz|film/i.test(lowerMessage)) {
            requestType = "wideo";
        }
        console.log(`[DocumentQuery] Detected session intent: session=${sessionNumber}, type=${requestType}`);
        return {
            sessionNumber,
            requestType,
            originalQuery: message,
        };
    }
    /**
     * Szuka dokumentów związanych z konkretną sesją rady
     * Przeszukuje różne warianty numeracji (arabskie i rzymskie)
     */
    async findSessionDocuments(sessionNumber) {
        const romanNumber = arabicToRoman(sessionNumber);
        const arabicNumber = sessionNumber.toString();
        // Wzorce do wyszukiwania
        const searchPatterns = [
            `Sesja Nr ${romanNumber}`,
            `Sesja nr ${romanNumber}`,
            `sesja ${romanNumber}`,
            `Sesja Nr ${arabicNumber}`,
            `Sesja nr ${arabicNumber}`,
            `sesja ${arabicNumber}`,
            `${romanNumber} sesja`,
            `${arabicNumber} sesja`,
        ];
        console.log(`[DocumentQuery] Searching for session ${sessionNumber} (${romanNumber}) documents`);
        // Szukaj w bazie - PRIORYTET: tytuł przed treścią
        const allMatches = [];
        for (const pattern of searchPatterns) {
            // KROK 1: Szukaj w tytule (wyższy priorytet)
            const { data: titleMatches } = await supabase
                .from("processed_documents")
                .select("id, title, document_type, publish_date, summary, source_url, content")
                .eq("user_id", this.userId)
                .ilike("title", `%${pattern}%`)
                .limit(10);
            if (titleMatches) {
                for (const doc of titleMatches) {
                    if (!allMatches.some((m) => m.id === doc.id)) {
                        allMatches.push({
                            id: doc.id,
                            title: doc.title,
                            documentType: doc.document_type,
                            publishDate: doc.publish_date,
                            summary: doc.summary,
                            sourceUrl: doc.source_url,
                            content: doc.content,
                            similarity: 0.95, // Wyższy score dla dopasowania w tytule
                        });
                    }
                }
            }
            // KROK 2: Szukaj w treści (jeśli mało wyników z tytułu)
            if (allMatches.length < 5) {
                const { data: contentMatches } = await supabase
                    .from("processed_documents")
                    .select("id, title, document_type, publish_date, summary, source_url, content")
                    .eq("user_id", this.userId)
                    .ilike("content", `%${pattern}%`)
                    .limit(5);
                if (contentMatches) {
                    for (const doc of contentMatches) {
                        if (!allMatches.some((m) => m.id === doc.id)) {
                            allMatches.push({
                                id: doc.id,
                                title: doc.title,
                                documentType: doc.document_type,
                                publishDate: doc.publish_date,
                                summary: doc.summary,
                                sourceUrl: doc.source_url,
                                content: doc.content,
                                similarity: 0.85, // Niższy score dla dopasowania w treści
                            });
                        }
                    }
                }
            }
        }
        // Dodatkowo szukaj semantycznie
        if (this.embeddingsClient && allMatches.length < 3) {
            const semanticQuery = `Sesja rady miejskiej numer ${sessionNumber} ${romanNumber}`;
            const semanticMatches = await this.findDocumentsSemantic(semanticQuery, 5);
            for (const match of semanticMatches) {
                if (!allMatches.some((m) => m.id === match.id)) {
                    allMatches.push(match);
                }
            }
        }
        console.log(`[DocumentQuery] Found ${allMatches.length} documents for session ${sessionNumber}`);
        return allMatches;
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
        if (!this.embeddingsClient) {
            console.log("[DocumentQuery] No OpenAI client - skipping semantic search");
            return [];
        }
        try {
            // Generuj embedding
            const embeddingResponse = await this.embeddingsClient.embeddings.create({
                model: this.embeddingModel,
                input: query,
            });
            const queryEmbedding = embeddingResponse.data[0].embedding;
            // Szukaj w RAG
            const { data, error } = await supabase.rpc("search_processed_documents", {
                query_embedding: queryEmbedding,
                match_threshold: 0.3,
                match_count: Math.max(limit, 20),
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
        if (queryForChunks && this.embeddingsClient) {
            try {
                const embeddingResponse = await this.embeddingsClient.embeddings.create({
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
                .map((r) => {
                // Obsługa target_document jako tablicy (Supabase join) lub obiektu
                const target = Array.isArray(r.target_document)
                    ? r.target_document[0]
                    : r.target_document;
                if (!target)
                    return null;
                return {
                    id: target.id,
                    title: target.title,
                    documentType: target.document_type,
                    publishDate: target.publish_date,
                    similarity: 1.0,
                };
            })
                .filter(Boolean);
        }
        catch {
            return [];
        }
    }
    // ============================================================================
    // HELPERS
    // ============================================================================
    deduplicateMatches(matches) {
        const seenIds = new Set();
        const seenTitles = new Set();
        return matches.filter((m) => {
            // Deduplikacja po ID
            if (seenIds.has(m.id))
                return false;
            // Deduplikacja po znormalizowanym tytule (ignoruj wielkość liter i białe znaki)
            const normalizedTitle = m.title.toLowerCase().trim().replace(/\s+/g, " ");
            if (seenTitles.has(normalizedTitle)) {
                console.log(`[DocumentQuery] Removing duplicate by title: "${m.title}"`);
                return false;
            }
            seenIds.add(m.id);
            seenTitles.add(normalizedTitle);
            return true;
        });
    }
    buildConfirmationMessage(matches) {
        if (matches.length === 0) {
            return "Nie znalazłem dokumentów pasujących do zapytania.";
        }
        if (matches.length === 1) {
            const m = matches[0];
            if (!m)
                return "Nie znalazłem dokumentów pasujących do zapytania.";
            return `Znalazłem dokument: **"${m.title}"** (${m.documentType}${m.publishDate ? `, ${m.publishDate}` : ""}). Czy to ten dokument, który chcesz przeanalizować?`;
        }
        // Formatuj listę z unikalnym identyfikatorem dla każdego dokumentu
        const list = matches
            .slice(0, 5)
            .map((m, i) => {
            if (!m)
                return null;
            const identifier = m.publishDate ||
                m.sourceUrl?.split("/").pop() ||
                m.id.substring(0, 8);
            return `${i + 1}. **"${m.title}"** (${m.documentType}, ${identifier})`;
        })
            .filter(Boolean)
            .join("\n");
        const moreText = matches.length > 5 ? `\n\n_...i ${matches.length - 5} więcej_` : "";
        return `Znalazłem ${matches.length} dokumentów pasujących do zapytania:\n\n${list}${moreText}\n\nKtóry dokument chcesz przeanalizować? Podaj numer lub nazwę.`;
    }
}
export default DocumentQueryService;
//# sourceMappingURL=document-query-service.js.map