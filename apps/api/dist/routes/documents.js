import { z, ZodError } from "zod";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { DocumentProcessor } from "../services/document-processor.js";
import { AudioTranscriber } from "../services/audio-transcriber.js";
import { DocumentScorer, } from "../services/document-scorer.js";
import { DocumentAnalysisService } from "../services/document-analysis-service.js";
import { addDocumentProcessJob, getUserDocumentJobs, getDocumentJob, deleteDocumentJob, retryDocumentJob, getDocumentQueueStats, } from "../services/document-process-queue.js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/bmp",
    "image/webp",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    // Audio formats for transcription
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/ogg",
    "audio/webm",
    // Video formats for transcription
    "video/mp4",
    "video/webm",
    "video/ogg",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
// Schema dla wyszukiwania semantycznego
const SearchQuerySchema = z.object({
    query: z.string().min(1),
    documentType: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    maxResults: z.number().optional().default(10),
    includeRelated: z.boolean().optional().default(false),
    sessionNumber: z.number().optional(),
});
// Schema dla tworzenia dokumentu
const CreateDocumentSchema = z.object({
    title: z.string().min(1),
    content: z.string().optional(),
    documentType: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    metadata: z.record(z.unknown()).optional(),
});
// Schema dla aktualizacji dokumentu
const UpdateDocumentSchema = z.object({
    title: z.string().min(1).optional(),
    content: z.string().optional(),
    documentType: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
});
export const documentsRoutes = async (fastify) => {
    // GET /documents - Lista dokumentów z filtrowaniem, paginacją i scoringiem
    fastify.get("/documents", async (request, reply) => {
        const querySchema = z.object({
            search: z.string().optional(),
            documentType: z.string().optional(),
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
            priority: z.enum(["critical", "high", "medium", "low"]).optional(),
            sortBy: z
                .enum(["score", "date", "title", "session", "chronological"])
                .default("score"),
            sortOrder: z.enum(["asc", "desc"]).default("desc"),
            limit: z.coerce.number().int().positive().max(1000).default(20),
            offset: z.coerce.number().int().min(0).default(0),
        });
        try {
            const query = querySchema.parse(request.query);
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            // Użyj DocumentScorer do pobrania dokumentów ze scoringiem
            const scorer = new DocumentScorer();
            // Mapowanie "session" i "chronological" na "date" (sortowanie chronologiczne)
            const effectiveSortBy = query.sortBy === "session" || query.sortBy === "chronological"
                ? "date"
                : query.sortBy;
            const result = await scorer.getDocumentsWithScores(userId, {
                search: query.search,
                documentType: query.documentType,
                dateFrom: query.dateFrom,
                dateTo: query.dateTo,
                priority: query.priority,
                sortBy: effectiveSortBy,
                sortOrder: query.sortOrder,
                limit: query.limit,
                offset: query.offset,
            });
            return reply.send({
                documents: result.documents,
                total: result.total,
            });
        }
        catch (error) {
            if (error instanceof ZodError) {
                return reply
                    .status(400)
                    .send({ error: "Validation error", details: error.issues });
            }
            fastify.log.error(error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // GET /documents/:id - Szczegóły dokumentu
    fastify.get("/documents/:id", async (request, reply) => {
        const { id } = request.params;
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        try {
            const { data: document, error } = await supabase
                .from("processed_documents")
                .select("*")
                .eq("id", id)
                .eq("user_id", userId)
                .single();
            if (error || !document) {
                return reply.status(404).send({ error: "Document not found" });
            }
            return reply.send({ document });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // POST /documents - Upload nowego dokumentu
    fastify.post("/documents", async (request, reply) => {
        try {
            const createData = CreateDocumentSchema.parse(request.body);
            // TODO: Zapisz dokument do bazy
            // TODO: Dodaj job do kolejki dla ekstrakcji
            console.log(`[Documents] Create document:`, createData.title);
            return reply
                .status(201)
                .send({ message: "Document created successfully" });
        }
        catch (error) {
            if (error instanceof ZodError) {
                return reply
                    .status(400)
                    .send({ error: "Validation error", details: error.issues });
            }
            fastify.log.error(error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // PATCH /documents/:id - Aktualizacja dokumentu
    fastify.patch("/documents/:id", async (request, reply) => {
        const { id: docId } = request.params;
        try {
            const updateData = UpdateDocumentSchema.parse(request.body);
            // TODO: Aktualizuj dokument w bazie
            console.log(`[Documents] Update document ${docId}:`, updateData);
            return reply
                .status(200)
                .send({ message: "Document updated successfully" });
        }
        catch (error) {
            if (error instanceof ZodError) {
                return reply
                    .status(400)
                    .send({ error: "Validation error", details: error.issues });
            }
            fastify.log.error(error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // DELETE /documents/:id - Usunięcie dokumentu z RAG
    fastify.delete("/documents/:id", async (request, reply) => {
        const { id } = request.params;
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        try {
            // Sprawdź czy dokument istnieje i należy do użytkownika
            const { data: doc, error: checkError } = await supabase
                .from("processed_documents")
                .select("id, title")
                .eq("id", id)
                .eq("user_id", userId)
                .single();
            if (checkError || !doc) {
                return reply.status(404).send({ error: "Document not found" });
            }
            // Usuń dokument z processed_documents (cascade usunie też embeddingi)
            const { error: deleteError } = await supabase
                .from("processed_documents")
                .delete()
                .eq("id", id)
                .eq("user_id", userId);
            if (deleteError) {
                fastify.log.error("Delete error: " + String(deleteError?.message || deleteError));
                return reply.status(500).send({ error: "Failed to delete document" });
            }
            console.log(`[Documents] Deleted document: ${doc.title} (${id})`);
            return reply.status(200).send({
                success: true,
                message: `Dokument "${doc.title}" został usunięty`,
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // DELETE /documents/bulk - Usunięcie wielu dokumentów z RAG
    fastify.delete("/documents/bulk", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        const bodySchema = z.object({
            documentIds: z.array(z.string().uuid()).min(1).max(100),
        });
        try {
            const { documentIds } = bodySchema.parse(request.body);
            // Usuń dokumenty
            const { error: deleteError, count } = await supabase
                .from("processed_documents")
                .delete()
                .in("id", documentIds)
                .eq("user_id", userId);
            if (deleteError) {
                fastify.log.error("Bulk delete error: " + String(deleteError?.message || deleteError));
                return reply.status(500).send({ error: "Failed to delete documents" });
            }
            console.log(`[Documents] Bulk deleted ${count} documents`);
            return reply.status(200).send({
                success: true,
                deletedCount: count || documentIds.length,
                message: `Usunięto ${count || documentIds.length} dokumentów`,
            });
        }
        catch (error) {
            if (error instanceof ZodError) {
                return reply
                    .status(400)
                    .send({ error: "Validation error", details: error.issues });
            }
            fastify.log.error(error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // DELETE /documents/all - Usuń WSZYSTKIE dokumenty z RAG
    fastify.delete("/documents/all", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        try {
            // Policz ile dokumentów do usunięcia
            const { count: totalCount } = await supabase
                .from("processed_documents")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId);
            if (!totalCount || totalCount === 0) {
                return reply.send({
                    success: true,
                    deletedCount: 0,
                    message: "Brak dokumentów do usunięcia",
                });
            }
            // Usuń wszystkie dokumenty użytkownika
            const { error: deleteError } = await supabase
                .from("processed_documents")
                .delete()
                .eq("user_id", userId);
            if (deleteError) {
                fastify.log.error("Delete all error: " + String(deleteError?.message || deleteError));
                return reply
                    .status(500)
                    .send({ error: "Failed to delete all documents" });
            }
            console.log(`[Documents] Deleted ALL ${totalCount} documents for user ${userId}`);
            return reply.status(200).send({
                success: true,
                deletedCount: totalCount,
                message: `Usunięto wszystkie ${totalCount} dokumentów z bazy RAG`,
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // GET /documents/empty - Dokumenty bez treści (błędy OCR)
    fastify.get("/documents/empty", async (request, reply) => {
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        try {
            // Znajdź dokumenty z pustą lub bardzo krótką treścią
            const { data: emptyDocs, error } = await supabase
                .from("processed_documents")
                .select("id, title, document_type, source_url, processed_at, content")
                .eq("user_id", userId)
                .or("content.is.null,content.eq.")
                .order("processed_at", { ascending: false })
                .limit(1000);
            if (error) {
                fastify.log.error("Empty docs query error: " + String(error?.message || error));
                return reply
                    .status(500)
                    .send({ error: "Failed to fetch empty documents" });
            }
            // Dodatkowo znajdź dokumenty z bardzo krótką treścią (< 50 znaków)
            const { data: shortDocs, error: shortError } = await supabase
                .from("processed_documents")
                .select("id, title, document_type, source_url, processed_at, content")
                .eq("user_id", userId)
                .not("content", "is", null)
                .order("processed_at", { ascending: false })
                .limit(500);
            if (shortError) {
                fastify.log.error("Short docs query error: " +
                    String(shortError?.message || shortError));
            }
            // Filtruj dokumenty z treścią < 50 znaków
            const shortContentDocs = (shortDocs || []).filter((doc) => doc.content && doc.content.length < 50);
            const allEmptyDocs = [
                ...(emptyDocs || []).map((d) => ({ ...d, reason: "Brak treści" })),
                ...shortContentDocs.map((d) => ({
                    ...d,
                    reason: `Treść za krótka (${d.content?.length || 0} znaków)`,
                })),
            ];
            return reply.send({
                documents: allEmptyDocs,
                total: allEmptyDocs.length,
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // POST /documents/:id/repair - Napraw dokument (usuń i pobierz ponownie)
    fastify.post("/documents/:id/repair", async (request, reply) => {
        const { id } = request.params;
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        try {
            // Pobierz dokument z source_url
            const { data: doc, error: fetchError } = await supabase
                .from("processed_documents")
                .select("id, title, source_url, document_type")
                .eq("id", id)
                .eq("user_id", userId)
                .single();
            if (fetchError || !doc) {
                return reply.status(404).send({ error: "Document not found" });
            }
            if (!doc.source_url) {
                return reply.status(400).send({
                    error: "Brak source_url - nie można pobrać dokumentu ponownie",
                });
            }
            console.log(`[Documents] Repairing document: ${doc.title} from ${doc.source_url}`);
            // Usuń stary dokument
            const { error: deleteError } = await supabase
                .from("processed_documents")
                .delete()
                .eq("id", id)
                .eq("user_id", userId);
            if (deleteError) {
                fastify.log.error("Delete error during repair: " +
                    String(deleteError?.message || deleteError));
                return reply
                    .status(500)
                    .send({ error: "Failed to delete old document" });
            }
            // Pobierz dokument ponownie
            const processor = new DocumentProcessor();
            await processor.initializeWithUserConfig(userId);
            // Pobierz treść z URL
            const response = await fetch(doc.source_url);
            if (!response.ok) {
                return reply.status(502).send({
                    error: `Nie można pobrać dokumentu: HTTP ${response.status}`,
                });
            }
            const contentType = response.headers.get("content-type") || "";
            const buffer = Buffer.from(await response.arrayBuffer());
            // Określ typ pliku
            let fileName = doc.title || "document";
            if (contentType.includes("pdf")) {
                fileName += ".pdf";
            }
            else if (contentType.includes("html")) {
                // Dla HTML wyciągnij tekst
                const html = buffer.toString("utf-8");
                const textContent = html
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                if (textContent.length < 50) {
                    return reply.status(422).send({
                        success: false,
                        error: "Pobrana treść jest za krótka",
                        contentLength: textContent.length,
                    });
                }
                // Zapisz do RAG
                const saveResult = await processor.saveToRAG(userId, textContent, doc.title || "Dokument", doc.source_url || "unknown", doc.document_type || "uploaded");
                return reply.send({
                    success: true,
                    message: `Dokument naprawiony: ${textContent.length} znaków`,
                    documentId: saveResult.documentId,
                    contentLength: textContent.length,
                });
            }
            // Przetwórz plik (PDF, DOCX, itp.)
            const result = await processor.processFile(buffer, fileName, contentType);
            if (!result.success || result.text.length < 50) {
                return reply.status(422).send({
                    success: false,
                    error: result.error || "Nie udało się wyodrębnić treści",
                    contentLength: result.text?.length || 0,
                });
            }
            // Zapisz do RAG
            const saveResult = await processor.saveToRAG(userId, result.text, doc.title || "Dokument", doc.source_url || "unknown", doc.document_type || "uploaded");
            console.log(`[Documents] Repaired document: ${doc.title} (${result.text.length} chars)`);
            return reply.send({
                success: true,
                message: `Dokument naprawiony: ${result.text.length} znaków`,
                documentId: saveResult.documentId,
                contentLength: result.text.length,
            });
        }
        catch (error) {
            fastify.log.error("Repair error: " +
                String(error instanceof Error ? error.message : error));
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Internal server error",
            });
        }
    });
    // POST /documents/search - Wyszukiwanie semantyczne
    fastify.post("/documents/search", async (request, reply) => {
        try {
            const searchQuery = SearchQuerySchema.parse(request.body);
            // TODO: Wygeneruj embedding dla zapytania
            // TODO: Wykonaj wyszukiwanie semantyczne
            console.log(`[Documents] Search query:`, searchQuery.query);
            return reply
                .status(200)
                .send({ message: "Search results", query: searchQuery.query });
        }
        catch (error) {
            if (error instanceof ZodError) {
                return reply
                    .status(400)
                    .send({ error: "Validation error", details: error.issues });
            }
            fastify.log.error(error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // GET /documents/:id/analyses - Analizy dokumentu
    fastify.get("/documents/:id/analyses", async (request, reply) => {
        const { id: analysisDocId } = request.params;
        try {
            // TODO: Pobierz analizy dokumentu
            console.log(`[Documents] Get analyses for document:`, analysisDocId);
            return reply
                .status(501)
                .send({ error: "Not implemented yet", documentId: analysisDocId });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // POST /documents/:id/analyze - Profesjonalna analiza dokumentu z kontekstem RAG (ASYNC)
    fastify.post("/documents/:id/analyze", async (request, reply) => {
        const { id } = request.params;
        const userId = request.headers["x-user-id"];
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        const taskId = randomUUID();
        try {
            // Pobierz podstawowe info o dokumencie
            const { data: doc } = await supabase
                .from("processed_documents")
                .select("id, title, document_type, publish_date, summary")
                .eq("id", id)
                .eq("user_id", userId)
                .single();
            if (!doc) {
                return reply.status(404).send({ error: "Document not found" });
            }
            // Utwórz zadanie w tle
            await supabase.from("background_tasks").insert({
                id: taskId,
                user_id: userId,
                task_type: "analysis",
                status: "running",
                title: `Analiza: ${doc.title?.substring(0, 50) || "Dokument"}`,
                description: "Inicjalizacja analizy...",
                progress: 0,
                metadata: { documentId: id, documentTitle: doc.title },
            });
            // Zwróć natychmiast - przetwarzanie asynchroniczne
            reply.send({
                success: true,
                async: true,
                taskId,
                message: "Analiza rozpoczęta. Śledź postęp na Dashboard.",
                document: {
                    id: doc.id,
                    title: doc.title,
                    document_type: doc.document_type,
                    publish_date: doc.publish_date,
                },
            });
            // Uruchom analizę asynchronicznie
            void processAnalysisAsync(taskId, userId, id, fastify.log);
            return reply;
        }
        catch (error) {
            fastify.log.error(String(error));
            try {
                await supabase
                    .from("background_tasks")
                    .update({
                    status: "failed",
                    error_message: error instanceof Error ? error.message : "Unknown error",
                    completed_at: new Date().toISOString(),
                })
                    .eq("id", taskId);
            }
            catch {
                // Ignoruj błędy aktualizacji
            }
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // Asynchroniczna funkcja analizy dokumentu
    async function processAnalysisAsync(taskId, userId, documentId, log) {
        try {
            const analysisService = new DocumentAnalysisService();
            await analysisService.initialize(userId);
            await supabase
                .from("background_tasks")
                .update({ progress: 20, description: "Budowanie kontekstu RAG..." })
                .eq("id", taskId);
            const analysisContext = await analysisService.buildAnalysisContext(userId, documentId);
            if (!analysisContext) {
                await supabase
                    .from("background_tasks")
                    .update({
                    status: "failed",
                    error_message: "Nie znaleziono dokumentu",
                    completed_at: new Date().toISOString(),
                })
                    .eq("id", taskId);
                return;
            }
            await supabase
                .from("background_tasks")
                .update({ progress: 70, description: "Generowanie analizy..." })
                .eq("id", taskId);
            const scorer = new DocumentScorer();
            const { data: docForScore } = await supabase
                .from("processed_documents")
                .select("*")
                .eq("id", documentId)
                .eq("user_id", userId)
                .single();
            const score = docForScore ? scorer.calculateScore(docForScore) : null;
            const analysisResult = analysisService.generateAnalysisPrompt(analysisContext);
            await supabase
                .from("background_tasks")
                .update({
                status: "completed",
                progress: 100,
                description: `Analiza zakończona: ${analysisContext.mainDocument.title}`,
                completed_at: new Date().toISOString(),
                metadata: {
                    documentId,
                    documentTitle: analysisContext.mainDocument.title,
                    result: {
                        document: {
                            id: analysisContext.mainDocument.id,
                            title: analysisContext.mainDocument.title,
                            document_type: analysisContext.mainDocument.documentType,
                            publish_date: analysisContext.mainDocument.publishDate,
                            summary: analysisContext.mainDocument.summary,
                            contentPreview: analysisContext.mainDocument.content?.substring(0, 500) +
                                "...",
                        },
                        score,
                        references: {
                            found: analysisContext.references.filter((r) => r.found).length,
                            missing: analysisContext.missingReferences.length,
                            details: analysisContext.references,
                        },
                        analysisPrompt: analysisResult.prompt,
                        systemPrompt: analysisResult.systemPrompt,
                        chatContext: {
                            type: "document_analysis",
                            documentId: analysisContext.mainDocument.id,
                            documentTitle: analysisContext.mainDocument.title,
                            hasAdditionalContext: analysisContext.additionalContext.length > 0,
                            missingReferences: analysisContext.missingReferences,
                        },
                    },
                },
            })
                .eq("id", taskId);
            log.info(`[DocumentAnalysis] Completed task ${taskId} for document ${documentId}`);
        }
        catch (error) {
            log.error(`[DocumentAnalysis] Task ${taskId} failed: ${error instanceof Error ? error.message : String(error)}`);
            await supabase
                .from("background_tasks")
                .update({
                status: "failed",
                error_message: error instanceof Error ? error.message : "Unknown error",
                completed_at: new Date().toISOString(),
            })
                .eq("id", taskId);
        }
    }
    // POST /documents/process - Przetwarzanie pliku z OCR
    fastify.post("/documents/process", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            // Verify token and get user
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            // Get uploaded file
            const data = await request.file();
            if (!data) {
                return reply.status(400).send({ error: "Nie przesłano pliku" });
            }
            const { filename, mimetype } = data;
            const fileBuffer = await data.toBuffer();
            // Validate file
            if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
                return reply.status(400).send({
                    error: `Nieobsługiwany format pliku: ${mimetype}`,
                    allowedTypes: ALLOWED_MIME_TYPES,
                });
            }
            if (fileBuffer.length > MAX_FILE_SIZE) {
                return reply.status(400).send({
                    error: `Plik jest zbyt duży (${Math.round(fileBuffer.length / 1024 / 1024)}MB). Maksymalny rozmiar to 10MB.`,
                });
            }
            // Process file
            const processor = new DocumentProcessor();
            await processor.initializeWithUserConfig(user.id);
            const result = await processor.processFile(fileBuffer, filename, mimetype);
            if (!result.success) {
                return reply.status(422).send({
                    error: result.error,
                    metadata: result.metadata,
                });
            }
            return reply.send({
                success: true,
                text: result.text,
                metadata: result.metadata,
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd przetwarzania pliku",
            });
        }
    });
    // POST /documents/save-to-rag - Zapis przetworzonego tekstu do RAG
    fastify.post("/documents/save-to-rag", async (request, reply) => {
        const bodySchema = z.object({
            text: z.string().min(1),
            title: z.string().min(1),
            sourceFileName: z.string(),
            documentType: z.string().default("uploaded"),
        });
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            const body = bodySchema.parse(request.body);
            const processor = new DocumentProcessor();
            await processor.initializeWithUserConfig(user.id);
            const result = await processor.saveToRAG(user.id, body.text, body.title, body.sourceFileName, body.documentType);
            if (!result.success) {
                return reply.status(500).send({ error: result.error });
            }
            return reply.send({
                success: true,
                documentId: result.documentId,
                message: "Dokument został zapisany do bazy wiedzy",
            });
        }
        catch (error) {
            if (error instanceof ZodError) {
                return reply
                    .status(400)
                    .send({ error: "Validation error", details: error.issues });
            }
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd zapisu do bazy",
            });
        }
    });
    // POST /documents/transcribe - Transkrypcja audio/video z analizą
    fastify.post("/documents/transcribe", async (request, reply) => {
        const AUDIO_VIDEO_MIME_TYPES = [
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/wave",
            "audio/x-wav",
            "audio/ogg",
            "audio/x-m4a",
            "audio/m4a",
            "audio/flac",
            "audio/aac",
            "video/mp4",
            "video/webm",
            "video/x-matroska",
            "video/avi",
            "video/quicktime",
        ];
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            // Get uploaded file
            const data = await request.file();
            if (!data) {
                return reply.status(400).send({ error: "Nie przesłano pliku" });
            }
            const { filename, mimetype } = data;
            const fileBuffer = await data.toBuffer();
            // Validate file type
            if (!AUDIO_VIDEO_MIME_TYPES.includes(mimetype)) {
                return reply.status(400).send({
                    error: `Nieobsługiwany format pliku: ${mimetype}`,
                    allowedTypes: AUDIO_VIDEO_MIME_TYPES,
                });
            }
            // Validate file size (25MB for Whisper)
            const maxSize = 25 * 1024 * 1024;
            if (fileBuffer.length > maxSize) {
                return reply.status(400).send({
                    error: `Plik jest zbyt duży (${Math.round(fileBuffer.length / 1024 / 1024)}MB). Maksymalny rozmiar to 25MB.`,
                });
            }
            // Transcribe
            const transcriber = new AudioTranscriber();
            await transcriber.initializeWithUserConfig(user.id);
            const result = await transcriber.transcribe(fileBuffer, filename, mimetype);
            if (!result.success) {
                return reply.status(422).send({
                    error: result.error,
                    metadata: result.metadata,
                });
            }
            return reply.send({
                success: true,
                rawTranscript: result.rawTranscript,
                segments: result.segments,
                summary: result.summary,
                metadata: result.metadata,
                formattedTranscript: result.formattedTranscript,
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd transkrypcji",
            });
        }
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // HISTORIA PRZETWORZONYCH DOKUMENTÓW
    // ═══════════════════════════════════════════════════════════════════════════
    // GET /documents/processed - Lista przetworzonych dokumentów
    fastify.get("/documents/processed", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            const { data: documents, error } = await supabase
                .from("processed_documents")
                .select("*")
                .eq("user_id", user.id)
                .order("processed_at", { ascending: false })
                .limit(1000);
            if (error) {
                throw error;
            }
            // Mapuj do formatu frontendu
            const mappedDocuments = (documents || []).map((doc) => ({
                id: doc.id,
                title: doc.title,
                content: doc.content,
                formattedContent: doc.metadata?.formattedContent || null,
                documentType: doc.document_type === "transkrypcja"
                    ? "transcription"
                    : doc.document_type === "ocr"
                        ? "ocr"
                        : "other",
                sourceFileName: doc.source_url?.replace("file://", "") || doc.title,
                sourceUrl: doc.source_url,
                mimeType: doc.metadata?.mimeType || "application/octet-stream",
                fileSize: doc.metadata?.fileSize || 0,
                processingMethod: doc.metadata?.processingMethod || "unknown",
                createdAt: doc.processed_at,
                metadata: {
                    sttModel: doc.metadata?.sttModel,
                    ocrEngine: doc.metadata?.ocrEngine,
                    sentiment: doc.metadata?.sentiment,
                    speakers: doc.metadata?.speakers,
                    duration: doc.metadata?.duration,
                    audioIssues: doc.metadata?.audioIssues,
                },
                savedToRag: true, // Jeśli jest w processed_documents, to jest w RAG
                ragDocumentId: doc.id,
            }));
            return reply.send({
                success: true,
                documents: mappedDocuments,
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd pobierania dokumentów",
            });
        }
    });
    // GET /documents/processed/:id - Szczegóły przetworzonego dokumentu
    fastify.get("/documents/processed/:id", async (request, reply) => {
        const { id } = request.params;
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            const { data: doc, error } = await supabase
                .from("processed_documents")
                .select("*")
                .eq("id", id)
                .eq("user_id", user.id)
                .single();
            if (error || !doc) {
                return reply.status(404).send({ error: "Dokument nie znaleziony" });
            }
            return reply.send({
                success: true,
                document: {
                    id: doc.id,
                    title: doc.title,
                    content: doc.content,
                    formattedContent: doc.metadata?.formattedContent || null,
                    documentType: doc.document_type === "transkrypcja"
                        ? "transcription"
                        : doc.document_type === "ocr"
                            ? "ocr"
                            : "other",
                    sourceFileName: doc.source_url?.replace("file://", "") || doc.title,
                    sourceUrl: doc.source_url,
                    mimeType: doc.metadata?.mimeType || "application/octet-stream",
                    fileSize: doc.metadata?.fileSize || 0,
                    processingMethod: doc.metadata?.processingMethod || "unknown",
                    createdAt: doc.processed_at,
                    metadata: doc.metadata,
                    savedToRag: true,
                    ragDocumentId: doc.id,
                },
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error
                    ? error.message
                    : "Błąd pobierania dokumentu",
            });
        }
    });
    // DELETE /documents/processed/:id - Usuń przetworzony dokument
    fastify.delete("/documents/processed/:id", async (request, reply) => {
        const { id } = request.params;
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            const { error } = await supabase
                .from("processed_documents")
                .delete()
                .eq("id", id)
                .eq("user_id", user.id);
            if (error) {
                throw error;
            }
            return reply.send({ success: true });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd usuwania dokumentu",
            });
        }
    });
    // POST /documents/processed/:id/analyze-sentiment - Analiza sentymentu
    fastify.post("/documents/processed/:id/analyze-sentiment", async (request, reply) => {
        const { id } = request.params;
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            // Pobierz dokument
            const { data: doc, error: docError } = await supabase
                .from("processed_documents")
                .select("*")
                .eq("id", id)
                .eq("user_id", user.id)
                .single();
            if (docError || !doc) {
                return reply.status(404).send({ error: "Dokument nie znaleziony" });
            }
            // Analiza sentymentu przez LLM
            const { getLLMClient, getAIConfig } = await import("../ai/index.js");
            const llmClient = await getLLMClient(user.id);
            const llmConfig = await getAIConfig(user.id, "llm");
            const response = await llmClient.chat.completions.create({
                model: llmConfig.modelName,
                messages: [
                    {
                        role: "system",
                        content: `Jesteś ekspertem od analizy sentymentu. Przeanalizuj poniższy tekst i zwróć JSON z analizą.
              
Format odpowiedzi (tylko JSON, bez markdown):
{
  "overall": "positive" | "negative" | "neutral" | "mixed",
  "score": 0.0-1.0,
  "summary": "krótkie podsumowanie sentymentu"
}`,
                    },
                    {
                        role: "user",
                        content: doc.content.substring(0, 4000),
                    },
                ],
                temperature: 0.3,
            });
            const sentimentText = response.choices[0]?.message?.content || "{}";
            let sentiment;
            try {
                sentiment = JSON.parse(sentimentText.replace(/```json\n?|\n?```/g, ""));
            }
            catch {
                sentiment = {
                    overall: "neutral",
                    score: 0.5,
                    summary: "Nie udało się przeanalizować",
                };
            }
            // Zapisz wynik do metadanych
            const updatedMetadata = {
                ...doc.metadata,
                sentiment,
            };
            await supabase
                .from("processed_documents")
                .update({ metadata: updatedMetadata })
                .eq("id", id);
            return reply.send({
                success: true,
                sentiment,
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd analizy sentymentu",
            });
        }
    });
    // POST /documents/processed/:id/format - Profesjonalne formatowanie dokumentu
    fastify.post("/documents/processed/:id/format", async (request, reply) => {
        const { id } = request.params;
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            // Pobierz dokument
            const { data: doc, error: docError } = await supabase
                .from("processed_documents")
                .select("*")
                .eq("id", id)
                .eq("user_id", user.id)
                .single();
            if (docError || !doc) {
                return reply.status(404).send({ error: "Dokument nie znaleziony" });
            }
            // Formatowanie przez LLM
            const { getLLMClient, getAIConfig } = await import("../ai/index.js");
            const llmClient = await getLLMClient(user.id);
            const llmConfig = await getAIConfig(user.id, "llm");
            const isTranscription = doc.document_type === "transkrypcja";
            const response = await llmClient.chat.completions.create({
                model: llmConfig.modelName,
                messages: [
                    {
                        role: "system",
                        content: isTranscription
                            ? `Jesteś ekspertem od formatowania transkrypcji. Sformatuj poniższą transkrypcję jako profesjonalny protokół w Markdown.
                
Zawrzyj:
- Tytuł i datę
- Podsumowanie głównych punktów
- Sformatowaną treść z wyróżnieniem mówców
- Kluczowe wnioski`
                            : `Jesteś ekspertem od formatowania dokumentów. Sformatuj poniższy tekst OCR jako profesjonalny dokument w Markdown.
                
Zawrzyj:
- Tytuł dokumentu
- Poprawioną strukturę (nagłówki, akapity, listy)
- Poprawione błędy OCR
- Wyróżnione kluczowe informacje`,
                    },
                    {
                        role: "user",
                        content: doc.content.substring(0, 8000),
                    },
                ],
                temperature: 0.3,
            });
            const formattedContent = response.choices[0]?.message?.content || doc.content;
            // Zapisz sformatowaną treść do metadanych
            const updatedMetadata = {
                ...doc.metadata,
                formattedContent,
            };
            await supabase
                .from("processed_documents")
                .update({ metadata: updatedMetadata })
                .eq("id", id);
            return reply.send({
                success: true,
                formattedContent,
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error
                    ? error.message
                    : "Błąd formatowania dokumentu",
            });
        }
    });
    // POST /documents/process-async - Asynchroniczne przetwarzanie dokumentu
    fastify.post("/documents/process-async", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            // Get uploaded file
            const data = await request.file();
            if (!data) {
                return reply.status(400).send({ error: "Nie przesłano pliku" });
            }
            const { filename, mimetype } = data;
            const fileBuffer = await data.toBuffer();
            // Validate file type
            if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
                return reply.status(400).send({
                    error: `Nieobsługiwany format pliku: ${mimetype}`,
                });
            }
            // Parse options from form data
            const includeSentiment = data.fields?.includeSentiment?.toString() === "true";
            const saveToRag = data.fields?.saveToRag?.toString() !== "false";
            const formatAsProfessional = data.fields?.formatAsProfessional?.toString() !== "false";
            // Utwórz zadanie asynchroniczne
            const { DocumentProcessingJobService } = await import("../services/document-processing-job-service.js");
            const jobService = new DocumentProcessingJobService(user.id);
            const job = await jobService.createJob({
                fileName: filename,
                fileBuffer,
                mimeType: mimetype,
                includeSentiment,
                saveToRag,
                formatAsProfessional,
            });
            return reply.send({
                success: true,
                jobId: job.id,
                message: "Zadanie przetwarzania zostało utworzone",
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd tworzenia zadania",
            });
        }
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // TEST RAG SEARCH - Diagnostyka wyszukiwania
    // ═══════════════════════════════════════════════════════════════════════════
    // POST /documents/test-rag-search - Test inteligentnego wyszukiwania RAG
    fastify.post("/documents/test-rag-search", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            const bodySchema = z.object({
                query: z.string().min(1),
                documentType: z.string().optional(),
                maxResults: z.number().int().positive().max(100).default(20),
                includeRelated: z.boolean().default(true),
            });
            const body = bodySchema.parse(request.body);
            const { IntelligentRAGSearch } = await import("../services/intelligent-rag-search.js");
            const ragSearch = new IntelligentRAGSearch(user.id);
            const diagnostics = await ragSearch.runDiagnostics(body.query);
            return reply.send({
                success: true,
                diagnostics,
            });
        }
        catch (error) {
            if (error instanceof ZodError) {
                return reply
                    .status(400)
                    .send({ error: "Validation error", details: error.issues });
            }
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd testu RAG",
            });
        }
    });
    // POST /documents/intelligent-search - Inteligentne wyszukiwanie dokumentów
    fastify.post("/documents/intelligent-search", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const bodySchema = z.object({
                query: z.string().min(1),
                sessionNumber: z.number().int().positive().optional(),
                documentType: z.string().optional(),
                dateFrom: z.string().optional(),
                dateTo: z.string().optional(),
                maxResults: z.number().int().positive().max(100).default(30),
                includeRelated: z.boolean().default(true),
            });
            const body = bodySchema.parse(request.body);
            const { IntelligentRAGSearch } = await import("../services/intelligent-rag-search.js");
            const ragSearch = new IntelligentRAGSearch(userId);
            const searchQuery = {
                query: body.query,
                sessionNumber: body.sessionNumber,
                documentType: body.documentType,
                dateFrom: body.dateFrom,
                dateTo: body.dateTo,
                maxResults: body.maxResults,
                includeRelated: body.includeRelated,
            };
            const results = await ragSearch.search(searchQuery);
            return reply.send(results);
        }
        catch (error) {
            if (error instanceof ZodError) {
                return reply
                    .status(400)
                    .send({ error: "Validation error", details: error.issues });
            }
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd wyszukiwania",
            });
        }
    });
    // POST /documents/regenerate-embeddings - Regeneruj embeddingi dla dokumentów bez nich
    fastify.post("/documents/regenerate-embeddings", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            // Pobierz dokumenty bez embeddingów
            const { data: docs, error: fetchError } = await supabase
                .from("processed_documents")
                .select("id, title, content")
                .eq("user_id", user.id)
                .is("embedding", null)
                .not("content", "is", null)
                .limit(50);
            if (fetchError) {
                return reply.status(500).send({ error: fetchError.message });
            }
            if (!docs || docs.length === 0) {
                return reply.send({
                    success: true,
                    message: "Wszystkie dokumenty mają już embeddingi",
                    processed: 0,
                });
            }
            // Pobierz klienta embeddingów
            const { getEmbeddingsClient, getAIConfig } = await import("../ai/index.js");
            const embeddingsClient = await getEmbeddingsClient(user.id);
            const embConfig = await getAIConfig(user.id, "embeddings");
            let processed = 0;
            let errors = 0;
            for (const doc of docs) {
                try {
                    const textToEmbed = `${doc.title || ""}\n\n${doc.content || ""}`.substring(0, 8000);
                    const embeddingResponse = await embeddingsClient.embeddings.create({
                        model: embConfig.modelName,
                        input: textToEmbed,
                    });
                    const embedding = embeddingResponse.data[0]?.embedding;
                    if (embedding) {
                        await supabase
                            .from("processed_documents")
                            .update({ embedding })
                            .eq("id", doc.id);
                        processed++;
                    }
                }
                catch (err) {
                    console.error(`[Regenerate] Error for doc ${doc.id}:`, err);
                    errors++;
                }
            }
            return reply.send({
                success: true,
                message: `Zregenerowano ${processed} embeddingów`,
                processed,
                errors,
                remaining: docs.length - processed,
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd regeneracji",
            });
        }
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // DOCUMENT JOBS - Kolejkowanie zadań OCR/transkrypcji w Redis
    // ═══════════════════════════════════════════════════════════════════════════
    // POST /documents/jobs - Dodaj plik do kolejki przetwarzania
    fastify.post("/documents/jobs", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            const data = await request.file();
            if (!data) {
                return reply.status(400).send({ error: "Nie przesłano pliku" });
            }
            const { filename, mimetype } = data;
            const fileBuffer = await data.toBuffer();
            if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
                return reply.status(400).send({
                    error: `Nieobsługiwany format pliku: ${mimetype}`,
                });
            }
            if (fileBuffer.length > MAX_FILE_SIZE) {
                return reply.status(400).send({
                    error: `Plik jest zbyt duży (max 10MB)`,
                });
            }
            // Dodaj do kolejki Redis
            const { jobId, recordId } = await addDocumentProcessJob({
                userId: user.id,
                fileName: filename,
                fileBuffer: fileBuffer.toString("base64"),
                mimeType: mimetype,
                fileSize: fileBuffer.length,
            });
            return reply.status(202).send({
                success: true,
                jobId,
                recordId,
                message: "Zadanie dodane do kolejki",
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd dodawania do kolejki",
            });
        }
    });
    // GET /documents/jobs - Lista zadań użytkownika
    fastify.get("/documents/jobs", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            const querySchema = z.object({
                limit: z.coerce.number().min(1).max(100).default(20),
            });
            const { limit } = querySchema.parse(request.query);
            const jobs = await getUserDocumentJobs(user.id, limit);
            return reply.send({ jobs });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd pobierania zadań",
            });
        }
    });
    // GET /documents/jobs/:jobId - Status pojedynczego zadania
    fastify.get("/documents/jobs/:jobId", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            const { jobId } = request.params;
            const job = await getDocumentJob(jobId, user.id);
            if (!job) {
                return reply.status(404).send({ error: "Zadanie nie znalezione" });
            }
            return reply.send({ job });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd pobierania zadania",
            });
        }
    });
    // DELETE /documents/jobs/:jobId - Usuń zadanie
    fastify.delete("/documents/jobs/:jobId", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            const { jobId } = request.params;
            const deleted = await deleteDocumentJob(jobId, user.id);
            if (!deleted) {
                return reply.status(404).send({ error: "Zadanie nie znalezione" });
            }
            return reply.send({ success: true });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd usuwania zadania",
            });
        }
    });
    // POST /documents/jobs/:jobId/retry - Ponów przetwarzanie
    fastify.post("/documents/jobs/:jobId/retry", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            const { jobId } = request.params;
            const retried = await retryDocumentJob(jobId, user.id);
            if (!retried) {
                return reply.status(400).send({ error: "Nie można ponowić zadania" });
            }
            return reply.send({ success: true });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd ponawiania zadania",
            });
        }
    });
    // POST /documents/jobs/:jobId/save-rag - Zapisz wynik do RAG
    fastify.post("/documents/jobs/:jobId/save-rag", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            const { data: { user }, error: authError, } = await supabaseAuth.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            const bodySchema = z.object({
                title: z.string().min(1),
            });
            const { title } = bodySchema.parse(request.body);
            const { jobId } = request.params;
            const job = await getDocumentJob(jobId, user.id);
            if (!job) {
                return reply.status(404).send({ error: "Zadanie nie znalezione" });
            }
            if (job.status !== "completed" || !job.result?.text) {
                return reply
                    .status(400)
                    .send({ error: "Zadanie nie jest ukończone lub brak tekstu" });
            }
            // Zapisz do RAG
            const processor = new DocumentProcessor();
            await processor.initializeWithUserConfig(user.id);
            const ragResult = await processor.saveToRAG(user.id, job.result.text, title, job.file_name, "uploaded");
            return reply.send({
                success: true,
                documentId: ragResult.documentId,
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd zapisu do RAG",
            });
        }
    });
    // GET /documents/jobs/stats - Statystyki kolejki
    fastify.get("/documents/jobs/stats", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const stats = await getDocumentQueueStats();
            return reply.send({ stats });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd pobierania statystyk",
            });
        }
    });
};
//# sourceMappingURL=documents.js.map