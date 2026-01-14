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
    session: 100,
    resolution: 90,
    protocol: 80,
    announcement: 60,
    news: 50,
    article: 40,
    pdf_attachment: 35,
    other: 30,
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
        // Inteligentny filtr tekstowy
        if (search) {
            const normalizedSearch = search.trim();
            console.log(`[DocumentScorer] Search query: "${normalizedSearch}", sessionNumber: ${sessionNumber}`);
            if (sessionNumber) {
                // Szukaj dokumentów powiązanych z sesją - precyzyjne wyszukiwanie
                const romanNum = this.arabicToRoman(sessionNumber);
                // Użyj precyzyjnych wzorców
                query = query.or(`title.ilike.%sesja ${sessionNumber}%,` +
                    `title.ilike.%sesji ${sessionNumber}%,` +
                    `title.ilike.%sesja nr ${sessionNumber}%,` +
                    `title.ilike.%sesji nr ${sessionNumber}%,` +
                    `title.ilike.%sesja ${romanNum}%,` +
                    `title.ilike.%sesji ${romanNum}%,` +
                    `title.ilike.%sesja nr ${romanNum}%,` +
                    `title.ilike.%nr ${romanNum}%,` +
                    `title.ilike.%${romanNum} sesj%,` +
                    `content.ilike.%sesja ${sessionNumber}%,` +
                    `content.ilike.%sesji ${sessionNumber}%,` +
                    `content.ilike.%sesja ${romanNum}%,` +
                    `content.ilike.%sesji ${romanNum}%`);
                console.log(`[DocumentScorer] Session search: ${sessionNumber} (Roman: ${romanNum})`);
            }
            else {
                // Standardowe wyszukiwanie - szukaj całej frazy lub słów
                // Najpierw próbuj dokładne dopasowanie
                query = query.or(`title.ilike.%${normalizedSearch}%,content.ilike.%${normalizedSearch}%`);
            }
        }
        // Filtr typu
        if (documentType) {
            query = query.eq("document_type", documentType);
        }
        // Filtr dat
        if (dateFrom) {
            query = query.gte("publish_date", dateFrom);
        }
        if (dateTo) {
            query = query.lte("publish_date", dateTo);
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
        // Oblicz score dla każdego dokumentu
        const scoredDocuments = documents.map((doc) => ({
            ...doc,
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
}
// Export singleton instance
export const documentScorer = new DocumentScorer();
//# sourceMappingURL=document-scorer.js.map