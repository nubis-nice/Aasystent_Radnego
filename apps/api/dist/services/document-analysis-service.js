import { createClient } from "@supabase/supabase-js";
import { DeepResearchService } from "./deep-research-service.js";
import { DocumentProcessor } from "./document-processor.js";
import * as cheerio from "cheerio";
import { getLLMClient, getEmbeddingsClient, getAIConfig } from "../ai/index.js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
export class DocumentAnalysisService {
    llmClient = null;
    embeddingsClient = null;
    embeddingModel = "nomic-embed-text";
    async initialize(userId) {
        // Pobierz klientów AI z fabryki
        this.llmClient = await getLLMClient(userId);
        this.embeddingsClient = await getEmbeddingsClient(userId);
        const embConfig = await getAIConfig(userId, "embeddings");
        this.embeddingModel = embConfig.modelName;
        console.log(`[DocumentAnalysisService] Initialized for user ${userId.substring(0, 8)}...`);
    }
    // Wykryj wszystkie referencje do druków i załączników w dokumencie
    extractReferences(content) {
        const references = [];
        // Wzorce dla różnych typów referencji
        const patterns = {
            druk: /(?:druk(?:i)?\s*(?:nr|numer)?\s*)([\d,\s]+)/gi,
            drukSingle: /\(\s*druk\s*(?:nr|numer)?\s*(\d+)\s*\)/gi,
            resolution: /(?:uchwał[ay]?\s*(?:nr|numer)?\s*)([IVXLCDM]+\/\d+\/\d+|\d+\/\d+\/\d+)/gi,
            protocol: /(?:protokoł?u?\s*(?:nr|numer|z sesji)?\s*)([IVXLCDM]+|\d+)/gi,
            attachment: /(?:załącznik(?:i)?\s*(?:nr|numer)?\s*)([\d,\s]+)/gi,
            pdfFile: /([^()\s]+\.pdf)/gi,
        };
        // Wyodrębnij numery druków
        let match;
        while ((match = patterns.druk.exec(content)) !== null) {
            const numbers = match[1].split(/[,\s]+/).filter((n) => n.trim());
            numbers.forEach((num) => {
                if (num &&
                    !references.find((r) => r.type === "druk" && r.number === num.trim())) {
                    references.push({
                        type: "druk",
                        number: num.trim(),
                        found: false,
                    });
                }
            });
        }
        // Pojedyncze druki w nawiasach
        while ((match = patterns.drukSingle.exec(content)) !== null) {
            const num = match[1].trim();
            if (!references.find((r) => r.type === "druk" && r.number === num)) {
                references.push({
                    type: "druk",
                    number: num,
                    found: false,
                });
            }
        }
        // Uchwały
        while ((match = patterns.resolution.exec(content)) !== null) {
            const num = match[1].trim();
            if (!references.find((r) => r.type === "resolution" && r.number === num)) {
                references.push({
                    type: "resolution",
                    number: num,
                    found: false,
                });
            }
        }
        // Załączniki
        while ((match = patterns.attachment.exec(content)) !== null) {
            const numbers = match[1].split(/[,\s]+/).filter((n) => n.trim());
            numbers.forEach((num) => {
                if (num &&
                    !references.find((r) => r.type === "attachment" && r.number === num.trim())) {
                    references.push({
                        type: "attachment",
                        number: num.trim(),
                        found: false,
                    });
                }
            });
        }
        return references;
    }
    // Szukaj referencji w RAG
    async searchReferencesInRAG(userId, references) {
        if (!this.embeddingsClient) {
            console.log("[DocumentAnalysis] No embeddings client - skipping RAG search");
            return references;
        }
        console.log(`[DocumentAnalysis] Starting RAG search for ${references.length} references`);
        // Debug: sprawdź ile dokumentów jest w bazie dla tego użytkownika
        const { count } = await supabase
            .from("processed_documents")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);
        console.log(`[DocumentAnalysis] User has ${count} documents in RAG database`);
        const updatedRefs = [...references];
        for (const ref of updatedRefs) {
            try {
                // Buduj zapytanie wyszukiwania
                const searchQuery = this.buildSearchQuery(ref);
                console.log(`[DocumentAnalysis] RAG search query for ${ref.type} ${ref.number}: "${searchQuery}"`);
                // Generuj embedding dla zapytania
                const embeddingResponse = await this.embeddingsClient.embeddings.create({
                    model: this.embeddingModel,
                    input: searchQuery,
                });
                const queryEmbedding = embeddingResponse.data[0].embedding;
                // Szukaj w RAG
                const { data: results, error } = await supabase.rpc("search_processed_documents", {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.5,
                    match_count: 3,
                    filter_user_id: userId,
                    filter_types: null,
                });
                if (error) {
                    console.error(`[DocumentAnalysis] RAG search error for ${ref.type} ${ref.number}:`, error);
                    continue;
                }
                console.log(`[DocumentAnalysis] RAG results for ${ref.type} ${ref.number}: ${results?.length || 0} found`);
                if (results && results.length > 0) {
                    // Log top results for debugging
                    results
                        .slice(0, 3)
                        .forEach((r, i) => {
                        console.log(`[DocumentAnalysis]   ${i + 1}. "${r.title}" (similarity: ${r.similarity.toFixed(3)})`);
                    });
                    // Sprawdź czy wynik pasuje do referencji
                    const bestMatch = results.find((r) => this.matchesReference(r, ref)) || results[0];
                    const matchesRef = this.matchesReference(bestMatch, ref);
                    console.log(`[DocumentAnalysis] Best match: "${bestMatch.title}" sim=${bestMatch.similarity.toFixed(3)}, matchesRef=${matchesRef}`);
                    if (bestMatch && bestMatch.similarity > 0.6) {
                        ref.found = true;
                        ref.title = bestMatch.title;
                        ref.content = bestMatch.content?.substring(0, 2000); // Pierwsze 2000 znaków
                        ref.sourceUrl = bestMatch.source_url;
                        console.log(`[DocumentAnalysis] ✓ Found ${ref.type} ${ref.number} in RAG`);
                    }
                    else {
                        console.log(`[DocumentAnalysis] ✗ ${ref.type} ${ref.number} not found (similarity ${bestMatch.similarity.toFixed(3)} < 0.6 or no match)`);
                    }
                }
                else {
                    console.log(`[DocumentAnalysis] ✗ No RAG results for ${ref.type} ${ref.number}`);
                }
            }
            catch (err) {
                console.error(`[DocumentAnalysis] Error searching for ${ref.type} ${ref.number}:`, err);
            }
        }
        return updatedRefs;
    }
    buildSearchQuery(ref) {
        switch (ref.type) {
            case "druk":
                return `druk numer ${ref.number} projekt uchwały załącznik`;
            case "resolution":
                return `uchwała numer ${ref.number}`;
            case "protocol":
                return `protokół sesji numer ${ref.number}`;
            case "attachment":
                return `załącznik numer ${ref.number}`;
            default:
                return `${ref.type} ${ref.number}`;
        }
    }
    matchesReference(doc, ref) {
        const title = (doc.title || "").toLowerCase();
        const content = (doc.content || "").toLowerCase();
        const num = ref.number.toLowerCase();
        switch (ref.type) {
            case "druk":
                return (title.includes(`druk ${num}`) ||
                    title.includes(`druk nr ${num}`) ||
                    content.includes(`druk ${num}`) ||
                    content.includes(`druk nr ${num}`));
            case "resolution":
                return title.includes(num) || content.includes(num);
            default:
                return title.includes(num) || content.includes(num);
        }
    }
    // Pobierz dokument główny z RAG
    async getDocument(userId, documentId) {
        const { data, error } = await supabase
            .from("processed_documents")
            .select("*")
            .eq("id", documentId)
            .eq("user_id", userId)
            .single();
        if (error || !data) {
            console.error("[DocumentAnalysis] Document not found:", error);
            return null;
        }
        return data;
    }
    // ============================================================================
    // NOWA FAZA: Przeszukaj stronę źródłową dokumentu w poszukiwaniu załączników
    // ============================================================================
    async searchSourcePageForAttachments(userId, sourceUrl, references) {
        const missingRefs = references.filter((r) => !r.found);
        if (missingRefs.length === 0 || !sourceUrl)
            return references;
        console.log(`[DocumentAnalysis] Searching source page for ${missingRefs.length} missing attachments: ${sourceUrl}`);
        try {
            // Pobierz stronę źródłową
            const baseUrl = new URL(sourceUrl).origin;
            const visitedUrls = new Set();
            const foundAttachments = new Map();
            // Głębokie przeszukiwanie strony źródłowej (bez limitu głębokości)
            await this.crawlSourcePageDeep(sourceUrl, baseUrl, visitedUrls, foundAttachments, missingRefs, 0, 10 // max depth
            );
            console.log(`[DocumentAnalysis] Source page crawl found ${foundAttachments.size} potential attachments`);
            // Dopasuj znalezione załączniki do referencji
            for (const ref of missingRefs) {
                const matchKey = this.findMatchingAttachment(ref, foundAttachments);
                if (matchKey) {
                    const attachment = foundAttachments.get(matchKey);
                    console.log(`[DocumentAnalysis] Found ${ref.type} ${ref.number} on source page: ${attachment.url}`);
                    // Pobierz i przetwórz załącznik
                    const content = await this.fetchAndProcessAttachment(userId, attachment.url, ref);
                    if (content) {
                        ref.found = true;
                        ref.title = attachment.title;
                        ref.content = content;
                        ref.sourceUrl = attachment.url;
                    }
                }
            }
        }
        catch (error) {
            console.error(`[DocumentAnalysis] Source page search error:`, error instanceof Error ? error.message : error);
        }
        return references;
    }
    async crawlSourcePageDeep(url, baseUrl, visitedUrls, foundAttachments, targetRefs, depth, maxDepth) {
        if (depth > maxDepth || visitedUrls.has(url))
            return;
        visitedUrls.add(url);
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(15000),
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; AsystentRadnego/1.0)",
                },
            });
            if (!response.ok)
                return;
            const contentType = response.headers.get("content-type") || "";
            // Jeśli to PDF - dodaj do znalezionych
            if (contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
                const title = url.split("/").pop() || "document.pdf";
                foundAttachments.set(url, { url, title });
                return;
            }
            // Jeśli to HTML - parsuj i szukaj linków
            if (!contentType.includes("html"))
                return;
            const html = await response.text();
            const $ = cheerio.load(html);
            // Szukaj linków do załączników (PDF, DOC, etc.)
            $("a[href]").each((_, el) => {
                const href = $(el).attr("href");
                const linkText = $(el).text().trim();
                if (!href)
                    return;
                try {
                    const absoluteUrl = new URL(href, url).href;
                    // Sprawdź czy to link do dokumentu
                    const isDocument = absoluteUrl.toLowerCase().endsWith(".pdf") ||
                        absoluteUrl.toLowerCase().endsWith(".doc") ||
                        absoluteUrl.toLowerCase().endsWith(".docx") ||
                        absoluteUrl.toLowerCase().endsWith(".xls") ||
                        absoluteUrl.toLowerCase().endsWith(".xlsx") ||
                        absoluteUrl.toLowerCase().endsWith(".odt");
                    // Sprawdź czy tekst linku zawiera szukane referencje
                    const linkTextLower = linkText.toLowerCase();
                    const isRelevant = targetRefs.some((ref) => {
                        const num = ref.number.toLowerCase();
                        return (linkTextLower.includes(`druk ${num}`) ||
                            linkTextLower.includes(`druk nr ${num}`) ||
                            linkTextLower.includes(`załącznik ${num}`) ||
                            linkTextLower.includes(`załącznik nr ${num}`) ||
                            linkTextLower.includes(`projekt ${num}`) ||
                            linkTextLower.includes(`uchwała ${num}`));
                    });
                    if (isDocument || isRelevant) {
                        foundAttachments.set(absoluteUrl, {
                            url: absoluteUrl,
                            title: linkText || absoluteUrl.split("/").pop() || "document",
                        });
                    }
                    // Kontynuuj crawling dla stron HTML z tej samej domeny
                    if (absoluteUrl.startsWith(baseUrl) &&
                        !visitedUrls.has(absoluteUrl) &&
                        !isDocument) {
                        // Priorytetyzuj strony z "druk", "załącznik", "materiały", "sesja"
                        const urlLower = absoluteUrl.toLowerCase();
                        const isPriority = urlLower.includes("druk") ||
                            urlLower.includes("zalacznik") ||
                            urlLower.includes("materialy") ||
                            urlLower.includes("sesja") ||
                            urlLower.includes("uchwala") ||
                            urlLower.includes("projekt");
                        if (isPriority || depth < 3) {
                            // Rekurencyjne przeszukiwanie
                            this.crawlSourcePageDeep(absoluteUrl, baseUrl, visitedUrls, foundAttachments, targetRefs, depth + 1, maxDepth);
                        }
                    }
                }
                catch {
                    // Ignoruj nieprawidłowe URLe
                }
            });
        }
        catch (error) {
            console.error(`[DocumentAnalysis] Crawl error for ${url}:`, error instanceof Error ? error.message : error);
        }
    }
    findMatchingAttachment(ref, attachments) {
        const num = ref.number.toLowerCase();
        for (const [key, attachment] of attachments) {
            const titleLower = attachment.title.toLowerCase();
            const urlLower = attachment.url.toLowerCase();
            // Dopasowanie po numerze w tytule lub URL
            const patterns = [
                `druk ${num}`,
                `druk_${num}`,
                `druk-${num}`,
                `druk${num}`,
                `załącznik ${num}`,
                `zalacznik_${num}`,
                `załącznik_${num}`,
                `projekt ${num}`,
                `projekt_${num}`,
                `nr ${num}`,
                `nr_${num}`,
                `_${num}.`,
                `-${num}.`,
                `(${num})`,
            ];
            for (const pattern of patterns) {
                if (titleLower.includes(pattern) || urlLower.includes(pattern)) {
                    return key;
                }
            }
        }
        return null;
    }
    async fetchAndProcessAttachment(userId, url, ref) {
        try {
            console.log(`[DocumentAnalysis] Fetching attachment: ${url}`);
            const response = await fetch(url, {
                signal: AbortSignal.timeout(30000),
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; AsystentRadnego/1.0)",
                },
            });
            if (!response.ok) {
                console.error(`[DocumentAnalysis] Failed to fetch ${url}: ${response.status}`);
                return null;
            }
            const contentType = response.headers.get("content-type") || "";
            const buffer = Buffer.from(await response.arrayBuffer());
            // Użyj DocumentProcessor do przetworzenia dokumentu
            const processor = new DocumentProcessor();
            await processor.initializeWithUserConfig(userId);
            const result = await processor.processFile(buffer, url.split("/").pop() || "document", contentType);
            if (result.success && result.text) {
                console.log(`[DocumentAnalysis] Successfully processed ${ref.type} ${ref.number}: ${result.text.length} chars`);
                return result.text.substring(0, 3000); // Pierwsze 3000 znaków
            }
            return null;
        }
        catch (error) {
            console.error(`[DocumentAnalysis] Attachment processing error:`, error instanceof Error ? error.message : error);
            return null;
        }
    }
    // ============================================================================
    // Szukaj brakujących druków przez Deep Research (po przeszukaniu strony źródłowej)
    // ============================================================================
    async searchMissingWithDeepResearch(userId, references) {
        const missingRefs = references.filter((r) => !r.found);
        if (missingRefs.length === 0)
            return references;
        console.log(`[DocumentAnalysis] Searching ${missingRefs.length} missing references with Deep Research (Exa)`);
        try {
            const deepResearch = new DeepResearchService(userId);
            for (const ref of missingRefs) {
                try {
                    // Buduj zapytanie wyszukiwania
                    const query = `${ref.type === "druk" ? "druk projekt uchwały" : ref.type} numer ${ref.number} rada miejska gmina`;
                    const report = await deepResearch.research({
                        query,
                        researchType: "general",
                        depth: "quick",
                        maxResults: 3,
                    });
                    if (report.results && report.results.length > 0) {
                        const bestResult = report.results[0];
                        ref.found = true;
                        ref.title = bestResult.title;
                        ref.content =
                            bestResult.excerpt?.substring(0, 1500) ||
                                report.summary?.substring(0, 1500);
                        ref.sourceUrl = bestResult.url;
                        console.log(`[DocumentAnalysis] Found ${ref.type} ${ref.number} via Deep Research`);
                    }
                }
                catch (err) {
                    console.error(`[DocumentAnalysis] Deep Research error for ${ref.type} ${ref.number}:`, err);
                }
            }
        }
        catch (err) {
            console.error("[DocumentAnalysis] Deep Research service error:", err);
        }
        return references;
    }
    // Generuj pełny kontekst analizy
    async buildAnalysisContext(userId, documentId, useDeepResearch = true) {
        // Pobierz dokument główny
        const mainDoc = await this.getDocument(userId, documentId);
        if (!mainDoc) {
            return null;
        }
        // Wyodrębnij referencje
        const references = this.extractReferences(mainDoc.content || "");
        console.log(`[DocumentAnalysis] Found ${references.length} references in document`);
        // FAZA 1: Szukaj referencji w RAG
        let updatedRefs = await this.searchReferencesInRAG(userId, references);
        // FAZA 2: Jeśli są brakujące referencje - przeszukaj stronę źródłową dokumentu
        let missingCount = updatedRefs.filter((r) => !r.found).length;
        if (missingCount > 0 && mainDoc.source_url) {
            console.log(`[DocumentAnalysis] ${missingCount} references not found in RAG, searching source page: ${mainDoc.source_url}`);
            updatedRefs = await this.searchSourcePageForAttachments(userId, mainDoc.source_url, updatedRefs);
        }
        // FAZA 3: Jeśli nadal są brakujące referencje i włączony Deep Research - szukaj przez Exa
        missingCount = updatedRefs.filter((r) => !r.found).length;
        if (useDeepResearch && missingCount > 0) {
            console.log(`[DocumentAnalysis] ${missingCount} references still missing after source page search, trying Deep Research (Exa)...`);
            updatedRefs = await this.searchMissingWithDeepResearch(userId, updatedRefs);
        }
        // Zbierz brakujące referencje (po wszystkich wyszukiwaniach)
        const missingRefs = updatedRefs
            .filter((r) => !r.found)
            .map((r) => `${r.type} nr ${r.number}`);
        // Zbierz dodatkowy kontekst z znalezionych referencji
        const additionalContext = updatedRefs
            .filter((r) => r.found && r.content)
            .map((r) => `### ${r.type.toUpperCase()} ${r.number}${r.title ? ` - ${r.title}` : ""}\n${r.content}`);
        return {
            mainDocument: {
                id: mainDoc.id,
                title: mainDoc.title,
                content: mainDoc.content,
                documentType: mainDoc.document_type,
                publishDate: mainDoc.publish_date,
                sourceUrl: mainDoc.source_url,
                summary: mainDoc.summary,
                keywords: mainDoc.keywords,
            },
            references: updatedRefs,
            additionalContext,
            missingReferences: missingRefs,
        };
    }
    // Generuj prompt analizy
    generateAnalysisPrompt(context) {
        const { mainDocument, additionalContext, missingReferences } = context;
        // System prompt dla profesjonalnej analizy
        const systemPrompt = `Jesteś profesjonalnym analitykiem dokumentów samorządowych z wieloletnim doświadczeniem. Twoja analiza musi być:
- DOKŁADNA - analizuj każdy punkt dokumentu szczegółowo
- KOMPLETNA - uwzględnij wszystkie druki, załączniki i referencje
- KRYTYCZNA - wskazuj wady, zalety i potencjalne zagrożenia
- PROFESJONALNA - używaj właściwej terminologii prawnej i administracyjnej
- PRAKTYCZNA - dawaj konkretne rekomendacje do działania

WAŻNE ZASADY:
1. Analizuj CAŁY dokument, punkt po punkcie, nie pomijaj żadnego
2. Dla każdego druku/załącznika wskazuj jego znaczenie i konsekwencje
3. Jeśli brakuje treści druku - zaznacz to wyraźnie jako BRAK DANYCH
4. Uwzględniaj kontekst prawny, procedury samorządowe i możliwe konsekwencje
5. Zwracaj uwagę na terminy, kwoty, osoby odpowiedzialne
6. Identyfikuj potencjalne zagrożenia, ryzyka i korzyści
7. Proponuj konkretne rozwiązania i usprawnienia

FORMAT ODPOWIEDZI (OBOWIĄZKOWY):
## 1. Streszczenie wykonawcze
[2-3 zdania z najważniejszymi punktami]

## 2. Analiza szczegółowa
[Każdy punkt porządku obrad/dokumentu osobno z numeracją]

## 3. Druki i załączniki
[Omów znaczenie każdego druku, jego cel i konsekwencje]

## 4. Analiza zagrożeń - wady i zalety
[Identyfikuj ryzyka, korzyści, potencjalne problemy]

## 5. Wnioski i rekomendacje
[Co można zrobić lepiej, konkretne propozycje rozwiązań]

## 6. Podsumowanie
[Końcowa synteza dokumentu]`;
        // Buduj prompt użytkownika
        let userPrompt = `## 📄 ANALIZA DOKUMENTU: "${mainDocument.title}"

### Informacje podstawowe:
- **Typ dokumentu:** ${mainDocument.documentType}
- **Data publikacji:** ${mainDocument.publishDate || "brak danych"}
- **Źródło:** ${mainDocument.sourceUrl || "brak"}

### Treść dokumentu do analizy:
\`\`\`
${mainDocument.content}
\`\`\`

`;
        // Dodaj znalezione referencje
        if (additionalContext.length > 0) {
            userPrompt += `### Znalezione druki i załączniki (kontekst):
${additionalContext.join("\n\n")}

`;
        }
        // Zaznacz brakujące referencje
        if (missingReferences.length > 0) {
            userPrompt += `### ⚠️ UWAGA - Brakujące dokumenty:
Następujące druki/załączniki wymienione w dokumencie NIE zostały znalezione w bazie:
${missingReferences.map((r) => `- ${r}`).join("\n")}

Proszę o analizę z zaznaczeniem, że pełny kontekst tych druków nie jest dostępny.

`;
        }
        // Instrukcje końcowe
        userPrompt += `### Zadanie:
Przeprowadź **profesjonalną, wyczerpującą analizę** tego dokumentu zgodnie z wymaganym formatem:

1. **Streszczenie wykonawcze** - najważniejsze punkty w 2-3 zdaniach
2. **Analiza szczegółowa** - każdy punkt porządku obrad/dokumentu osobno (nie pomijaj żadnego!)
3. **Druki i załączniki** - omów znaczenie, cel i konsekwencje każdego druku
4. **Analiza zagrożeń - wady i zalety** - zidentyfikuj ryzyka, korzyści, potencjalne problemy
5. **Wnioski i rekomendacje** - co można zrobić lepiej, zaproponuj konkretne rozwiązania
6. **Podsumowanie** - końcowa synteza dokumentu

WAŻNE: Odpowiedź musi być w języku polskim, profesjonalna, wyczerpująca i zawierać WSZYSTKIE 6 sekcji.`;
        return {
            context,
            prompt: userPrompt,
            systemPrompt,
        };
    }
}
export const documentAnalysisService = new DocumentAnalysisService();
//# sourceMappingURL=document-analysis-service.js.map