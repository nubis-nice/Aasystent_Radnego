/**
 * Document Scorer Service
 * Algorytm inteligentnego scoringu dokumentów dla radnego
 */
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
// Wagi bazowe dla typów dokumentów
const TYPE_WEIGHTS = {
    // Poziom 1: Akty Prawne i Decyzje (Krytyczne)
    budget_act: 100,
    resolution: 95,
    session_order: 90,
    // Poziom 2: Zapis Przebiegu i Narzędzia Kontrolne (Wysoka ważność)
    resolution_project: 85,
    protocol: 80,
    interpellation: 75,
    transcription: 70,
    // Poziom 3: Materiały Merytoryczne i Opinie (Średni priorytet)
    video: 65,
    committee_opinion: 60,
    justification: 55,
    session: 50, // alias dla session_materials
    session_materials: 50,
    // Poziom 4: Dokumentacja Administracyjna (Niska ważność)
    order: 40,
    announcement: 30,
    // Poziom 5: Załączniki i Dane Referencyjne (Tło)
    attachment: 20,
    pdf_attachment: 20, // alias
    reference_material: 15,
    other: 10,
    news: 10,
    article: 10,
};
// Słowa kluczowe zwiększające priorytet dla radnego
const PRIORITY_KEYWORDS = [
    "sesja rady",
    "sesji rady",
    "posiedzenie",
    "głosowanie",
    "uchwała",
    "projekt uchwały",
    "budżet",
    "komisja",
    "interpelacja",
    "wniosek",
    "radny",
    "radnego",
    "rada miejska",
    "rada gminy",
    "burmistrz",
    "wójt",
    "zarządzenie",
    "porządek obrad",
    "terminy",
    "sesja nadzwyczajna",
    "zwołanie sesji",
];
// Słowa wskazujące na pilność
const URGENCY_KEYWORDS = [
    "pilne",
    "nadzwyczajn",
    "termin",
    "do dnia",
    "najpóźniej",
    "natychmiast",
    "bezzwłoczn",
    "deadline",
];
export class DocumentScorer {
    councilLocation;
    constructor(councilLocation = "Drawno") {
        this.councilLocation = councilLocation;
    }
    /**
     * Oblicz score dla pojedynczego dokumentu
     */
    calculateScore(doc) {
        const titleLower = doc.title.toLowerCase();
        const contentLower = (doc.content || "").toLowerCase().substring(0, 5000);
        const combinedText = `${titleLower} ${contentLower}`;
        // 1. Type Score - bazowa punktacja na podstawie typu
        const typeScore = TYPE_WEIGHTS[doc.document_type] ?? TYPE_WEIGHTS.other ?? 30;
        // 2. Relevance Score - dopasowanie do słów kluczowych radnego
        let keywordBonus = 0;
        for (const keyword of PRIORITY_KEYWORDS) {
            if (combinedText.includes(keyword.toLowerCase())) {
                keywordBonus += 5;
            }
        }
        // Bonus za lokalizację rady
        if (combinedText.includes(this.councilLocation.toLowerCase())) {
            keywordBonus += 15;
        }
        const relevanceScore = Math.min(100, keywordBonus);
        // 3. Urgency Score - pilność
        let urgencyBonus = 0;
        for (const keyword of URGENCY_KEYWORDS) {
            if (combinedText.includes(keyword.toLowerCase())) {
                urgencyBonus += 10;
            }
        }
        // Bonus za nadchodzącą sesję (jeśli w tytule jest data w najbliższych 7 dniach)
        let sessionBonus = 0;
        const sessionMatch = combinedText.match(/sesj[ai].*?(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/i);
        if (sessionMatch) {
            try {
                const day = parseInt(sessionMatch[1] || "0");
                const month = parseInt(sessionMatch[2] || "1") - 1;
                let year = parseInt(sessionMatch[3] || "2000");
                if (year < 100)
                    year += 2000;
                const sessionDate = new Date(year, month, day);
                const now = new Date();
                const diffDays = Math.ceil((sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays <= 7) {
                    sessionBonus = 30;
                }
                else if (diffDays > 7 && diffDays <= 14) {
                    sessionBonus = 20;
                }
            }
            catch {
                // Ignore date parsing errors
            }
        }
        const urgencyScore = Math.min(100, urgencyBonus + sessionBonus);
        // 4. Recency Score - aktualność dokumentu
        let recencyBonus = 0;
        const docDate = doc.publish_date || doc.processed_at;
        if (docDate) {
            const date = new Date(docDate);
            const now = new Date();
            const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
            if (diffHours <= 24) {
                recencyBonus = 25;
            }
            else if (diffHours <= 72) {
                recencyBonus = 20;
            }
            else if (diffHours <= 168) {
                // 7 dni
                recencyBonus = 15;
            }
            else if (diffHours <= 720) {
                // 30 dni
                recencyBonus = 10;
            }
            else if (diffHours <= 2160) {
                // 90 dni
                recencyBonus = 5;
            }
        }
        const recencyScore = recencyBonus;
        // Oblicz total score z wagami
        const totalScore = Math.round(typeScore * 0.3 +
            relevanceScore * 0.35 +
            urgencyScore * 0.2 +
            recencyScore * 0.15);
        // Określ priorytet na podstawie total score
        let priority;
        if (totalScore >= 70 || urgencyScore >= 50) {
            priority = "critical";
        }
        else if (totalScore >= 50) {
            priority = "high";
        }
        else if (totalScore >= 30) {
            priority = "medium";
        }
        else {
            priority = "low";
        }
        return {
            relevanceScore,
            urgencyScore,
            typeScore,
            recencyScore,
            totalScore,
            priority,
            scoringDetails: {
                typeBonus: typeScore,
                keywordBonus,
                sessionBonus,
                recencyBonus,
            },
        };
    }
    /**
     * Wykryj numer sesji z zapytania
     */
    extractSessionNumber(query) {
        // Wzorce dla numeru sesji
        const patterns = [
            /sesj[iaęy]\s+(?:nr\.?\s*)?(\d+)/i,
            /sesj[iaęy]\s+(?:nr\.?\s*)?([IVXLC]+)/i,
            /(\d+)\s*sesj/i,
            /([IVXLC]+)\s*sesj/i,
        ];
        for (const pattern of patterns) {
            const match = query.match(pattern);
            if (match && match[1]) {
                const value = match[1];
                // Jeśli to liczba arabska
                if (/^\d+$/.test(value)) {
                    const num = parseInt(value, 10);
                    if (num > 0 && num <= 200)
                        return num;
                }
                // Jeśli to liczba rzymska
                if (/^[IVXLC]+$/i.test(value)) {
                    const num = this.romanToArabic(value);
                    if (num > 0 && num <= 200)
                        return num;
                }
            }
        }
        return null;
    }
    romanToArabic(roman) {
        const values = { I: 1, V: 5, X: 10, L: 50, C: 100 };
        let result = 0, prev = 0;
        for (let i = roman.length - 1; i >= 0; i--) {
            const char = roman[i];
            const curr = char ? values[char.toUpperCase()] || 0 : 0;
            result += curr < prev ? -curr : curr;
            prev = curr;
        }
        return result;
    }
    arabicToRoman(num) {
        const map = [
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
        for (const [value, numeral] of map) {
            while (num >= value) {
                result += numeral;
                num -= value;
            }
        }
        return result;
    }
    /**
     * Pobierz dokumenty z bazy i oblicz score dla każdego
     */
    async getDocumentsWithScores(userId, options = {}) {
        const { search, documentType, dateFrom, dateTo, priority, sortBy = "score", sortOrder = "desc", limit = 20, offset = 0, } = options;
        // Wykryj numer sesji z zapytania
        const sessionNumber = search ? this.extractSessionNumber(search) : null;
        // Buduj query
        let query = supabase
            .from("processed_documents")
            .select("*", { count: "exact" })
            .eq("user_id", userId);
        // ═══════════════════════════════════════════════════════════════════════
        // INTELIGENTNE WYSZUKIWANIE
        // Wykorzystuje znormalizowane pola: session_number, normalized_title
        // ═══════════════════════════════════════════════════════════════════════
        if (search) {
            const normalizedSearch = search.trim();
            console.log(`[DocumentScorer] Search query: "${normalizedSearch}", sessionNumber: ${sessionNumber}`);
            if (sessionNumber) {
                // PRIORYTET 1: Szukaj po znormalizowanym polu session_number (najszybsze)
                console.log(`[DocumentScorer] Using session_number filter: ${sessionNumber}`);
                // Szukaj po session_number LUB tradycyjnie po tytule (dla starych dokumentów)
                const romanNum = this.arabicToRoman(sessionNumber);
                query = query.or(`session_number.eq.${sessionNumber},` +
                    `title.ilike.%sesja ${sessionNumber}%,` +
                    `title.ilike.%sesja nr ${sessionNumber}%,` +
                    `title.ilike.%sesja ${romanNum}%,` +
                    `title.ilike.%nr ${romanNum}%,` +
                    `normalized_title.ilike.%Sesja ${sessionNumber}%`);
            }
            else {
                // Standardowe wyszukiwanie - szukaj w tytule i znormalizowanym tytule
                query = query.or(`title.ilike.%${normalizedSearch}%,` +
                    `normalized_title.ilike.%${normalizedSearch}%,` +
                    `content.ilike.%${normalizedSearch}%`);
            }
        }
        // Filtr typu
        if (documentType) {
            query = query.eq("document_type", documentType);
        }
        // ═══════════════════════════════════════════════════════════════════════
        // FILTR DAT - priorytetowo używa normalized_publish_date
        // ═══════════════════════════════════════════════════════════════════════
        if (dateFrom) {
            // Szukaj w normalized_publish_date, publish_date LUB processed_at
            query = query.or(`normalized_publish_date.gte.${dateFrom},publish_date.gte.${dateFrom},processed_at.gte.${dateFrom}`);
        }
        if (dateTo) {
            // Dla processed_at dodajemy czas do końca dnia, aby objąć cały dzień
            const dateToEndOfDay = `${dateTo}T23:59:59`;
            query = query.or(`normalized_publish_date.lte.${dateTo},publish_date.lte.${dateTo},processed_at.lte.${dateToEndOfDay}`);
        }
        // Wykonaj query
        const { data: documents, count, error } = await query;
        if (error) {
            console.error("[DocumentScorer] Error fetching documents:", error);
            throw new Error("Błąd pobierania dokumentów");
        }
        if (!documents) {
            return { documents: [], total: 0 };
        }
        // Deduplikacja - usuń duplikaty po ID (mogą powstać z zapytań OR)
        const seenIds = new Set();
        const uniqueDocuments = documents.filter((doc) => {
            if (seenIds.has(doc.id)) {
                console.log(`[DocumentScorer] Removing duplicate document: ${doc.id}`);
                return false;
            }
            seenIds.add(doc.id);
            return true;
        });
        console.log(`[DocumentScorer] After deduplication: ${uniqueDocuments.length} unique docs (was ${documents.length})`);
        // Oblicz score dla każdego dokumentu i znormalizuj tytuły
        const scoredDocuments = uniqueDocuments.map((doc) => ({
            ...doc,
            // Normalizacja tytułu - usuń śmieci i zamień angielskie nazwy na polskie
            title: this.normalizeTitle(doc.title),
            score: this.calculateScore(doc),
        }));
        // Filtruj po priorytecie (po obliczeniu score)
        let filteredDocuments = scoredDocuments;
        if (priority) {
            filteredDocuments = scoredDocuments.filter((doc) => doc.score.priority === priority);
        }
        // Sortuj
        console.log(`[DocumentScorer] Sorting ${filteredDocuments.length} docs by: ${sortBy} (${sortOrder})`);
        filteredDocuments.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case "score":
                    comparison = b.score.totalScore - a.score.totalScore;
                    break;
                case "date": {
                    // Sortowanie chronologiczne - używaj publish_date lub processed_at
                    const dateA = a.publish_date
                        ? new Date(a.publish_date).getTime()
                        : new Date(a.processed_at).getTime();
                    const dateB = b.publish_date
                        ? new Date(b.publish_date).getTime()
                        : new Date(b.processed_at).getTime();
                    // Domyślnie desc = najnowsze pierwsze
                    comparison = dateB - dateA;
                    break;
                }
                case "title":
                    comparison = (a.title || "").localeCompare(b.title || "", "pl");
                    break;
            }
            // Dla asc odwróć porównanie
            return sortOrder === "asc" ? -comparison : comparison;
        });
        console.log(`[DocumentScorer] After sort, first doc: ${filteredDocuments[0]?.title?.substring(0, 50)}...`);
        // Paginacja
        const paginatedDocuments = filteredDocuments.slice(offset, offset + limit);
        return {
            documents: paginatedDocuments,
            total: priority ? filteredDocuments.length : count || 0,
        };
    }
    /**
     * Aktualizuj score dokumentu w bazie (opcjonalne - cache)
     */
    async updateDocumentScore(documentId) {
        const { data: doc, error } = await supabase
            .from("processed_documents")
            .select("*")
            .eq("id", documentId)
            .single();
        if (error || !doc) {
            return null;
        }
        const score = this.calculateScore(doc);
        // Zapisz score w metadata dokumentu
        await supabase
            .from("processed_documents")
            .update({
            metadata: {
                ...doc.metadata,
                score: score,
                scored_at: new Date().toISOString(),
            },
        })
            .eq("id", documentId);
        return score;
    }
    /**
     * Normalizacja tytułu dokumentu
     * - Usuwa śmieci (| Urząd Miejski..., System Rada...)
     * - Zamienia angielskie nazwy na polskie
     */
    normalizeTitle(title) {
        if (!title)
            return "Bez tytułu";
        return (title
            // Usuń śmieci z tytułu
            .replace(/\s*\|.*$/g, "") // Usuń " | Urząd Miejski..."
            .replace(/\s*-?\s*System\s+Rada.*$/gi, "") // Usuń "System Rada"
            .replace(/\s*-?\s*BIP\s*.*$/gi, "") // Usuń "BIP..."
            // Zamień angielskie nazwy dokumentów na polskie
            .replace(/\bresolution\s+nr\b/gi, "Uchwała nr")
            .replace(/\bresolution\b/gi, "Uchwała")
            .replace(/\bprotocol\s+nr\b/gi, "Protokół nr")
            .replace(/\bprotocol\b/gi, "Protokół")
            .replace(/\bdraft\s+nr\b/gi, "Projekt nr")
            .replace(/\bdraft\b/gi, "Projekt")
            .replace(/\battachment\b/gi, "Załącznik")
            .replace(/\bsession\b/gi, "Sesja")
            .replace(/\bannouncement\b/gi, "Ogłoszenie")
            // Cleanup
            .replace(/\s+/g, " ")
            .trim());
    }
}
// Export singleton instance
export const documentScorer = new DocumentScorer();
//# sourceMappingURL=document-scorer.js.map