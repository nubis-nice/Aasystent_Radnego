import { FastifyPluginAsync } from "fastify";
import { z, ZodError } from "zod";
import { createClient } from "@supabase/supabase-js";
import { DocumentProcessor } from "../services/document-processor.js";
import { AudioTranscriber } from "../services/audio-transcriber.js";
import {
  DocumentScorer,
  type DocumentPriority,
} from "../services/document-scorer.js";
import { DocumentAnalysisService } from "../services/document-analysis-service.js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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

export const documentsRoutes: FastifyPluginAsync = async (fastify) => {
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
      limit: z.coerce.number().int().positive().max(100).default(20),
      offset: z.coerce.number().int().min(0).default(0),
    });

    try {
      const query = querySchema.parse(request.query);
      const userId = request.headers["x-user-id"] as string;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Użyj DocumentScorer do pobrania dokumentów ze scoringiem
      const scorer = new DocumentScorer();
      // Mapowanie "session" i "chronological" na "date" (sortowanie chronologiczne)
      const effectiveSortBy =
        query.sortBy === "session" || query.sortBy === "chronological"
          ? "date"
          : query.sortBy;

      const result = await scorer.getDocumentsWithScores(userId, {
        search: query.search,
        documentType: query.documentType,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        priority: query.priority as DocumentPriority | undefined,
        sortBy: effectiveSortBy,
        sortOrder: query.sortOrder,
        limit: query.limit,
        offset: query.offset,
      });

      return reply.send({
        documents: result.documents,
        total: result.total,
      });
    } catch (error) {
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
  fastify.get<{ Params: { id: string } }>(
    "/documents/:id",
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.headers["x-user-id"] as string;

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
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /documents - Upload nowego dokumentu
  fastify.post("/documents", async (request, reply) => {
    try {
      const data = CreateDocumentSchema.parse(request.body);

      // TODO: Zapisz dokument do bazy
      // TODO: Dodaj job do kolejki dla ekstrakcji

      return reply
        .status(201)
        .send({ message: "Document created successfully" });
    } catch (error) {
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
  fastify.patch<{ Params: { id: string } }>(
    "/documents/:id",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const data = UpdateDocumentSchema.parse(request.body);

        // TODO: Aktualizuj dokument w bazie

        return reply
          .status(200)
          .send({ message: "Document updated successfully" });
      } catch (error) {
        if (error instanceof ZodError) {
          return reply
            .status(400)
            .send({ error: "Validation error", details: error.issues });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // DELETE /documents/:id - Usunięcie dokumentu
  fastify.delete<{ Params: { id: string } }>(
    "/documents/:id",
    async (request, reply) => {
      const { id } = request.params;

      try {
        // TODO: Usuń dokument z bazy

        return reply
          .status(204)
          .send({ message: "Document deleted successfully" });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /documents/search - Wyszukiwanie semantyczne
  fastify.post("/documents/search", async (request, reply) => {
    try {
      const query = SearchQuerySchema.parse(request.body);

      // TODO: Wygeneruj embedding dla zapytania
      // TODO: Wykonaj wyszukiwanie semantyczne

      return reply.status(200).send({ message: "Search results" });
    } catch (error) {
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
  fastify.get<{ Params: { id: string } }>(
    "/documents/:id/analyses",
    async (request, reply) => {
      const { id } = request.params;

      try {
        // TODO: Pobierz analizy dokumentu

        return reply.status(501).send({ error: "Not implemented yet" });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /documents/:id/analyze - Profesjonalna analiza dokumentu z kontekstem RAG
  fastify.post<{ Params: { id: string } }>(
    "/documents/:id/analyze",
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.headers["x-user-id"] as string;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      try {
        // Inicjalizuj serwis analizy
        const analysisService = new DocumentAnalysisService();
        await analysisService.initialize(userId);

        // Zbuduj pełny kontekst analizy (dokument + druki + załączniki z RAG)
        const analysisContext = await analysisService.buildAnalysisContext(
          userId,
          id
        );

        if (!analysisContext) {
          return reply.status(404).send({ error: "Document not found" });
        }

        // Oblicz score dokumentu
        const scorer = new DocumentScorer();
        const { data: docForScore } = await supabase
          .from("processed_documents")
          .select("*")
          .eq("id", id)
          .eq("user_id", userId)
          .single();

        const score = docForScore ? scorer.calculateScore(docForScore) : null;

        // Generuj profesjonalny prompt analizy
        const analysisResult =
          analysisService.generateAnalysisPrompt(analysisContext);

        // Zwróć dane do analizy
        return reply.send({
          success: true,
          document: {
            id: analysisContext.mainDocument.id,
            title: analysisContext.mainDocument.title,
            document_type: analysisContext.mainDocument.documentType,
            publish_date: analysisContext.mainDocument.publishDate,
            summary: analysisContext.mainDocument.summary,
            contentPreview:
              analysisContext.mainDocument.content?.substring(0, 500) + "...",
          },
          score,
          // Informacje o znalezionych referencjach
          references: {
            found: analysisContext.references.filter((r) => r.found).length,
            missing: analysisContext.missingReferences.length,
            details: analysisContext.references,
          },
          // Prompt i system prompt do chatu
          analysisPrompt: analysisResult.prompt,
          systemPrompt: analysisResult.systemPrompt,
          chatContext: {
            type: "document_analysis",
            documentId: analysisContext.mainDocument.id,
            documentTitle: analysisContext.mainDocument.title,
            hasAdditionalContext: analysisContext.additionalContext.length > 0,
            missingReferences: analysisContext.missingReferences,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

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
      const {
        data: { user },
        error: authError,
      } = await supabaseAuth.auth.getUser(token);

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
          error: `Plik jest zbyt duży (${Math.round(
            fileBuffer.length / 1024 / 1024
          )}MB). Maksymalny rozmiar to 10MB.`,
        });
      }

      // Process file
      const processor = new DocumentProcessor();
      await processor.initializeWithUserConfig(user.id);

      const result = await processor.processFile(
        fileBuffer,
        filename,
        mimetype
      );

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
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error:
          error instanceof Error ? error.message : "Błąd przetwarzania pliku",
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
      const {
        data: { user },
        error: authError,
      } = await supabaseAuth.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const body = bodySchema.parse(request.body);

      const processor = new DocumentProcessor();
      await processor.initializeWithUserConfig(user.id);

      const result = await processor.saveToRAG(
        user.id,
        body.text,
        body.title,
        body.sourceFileName,
        body.documentType
      );

      if (!result.success) {
        return reply.status(500).send({ error: result.error });
      }

      return reply.send({
        success: true,
        documentId: result.documentId,
        message: "Dokument został zapisany do bazy wiedzy",
      });
    } catch (error) {
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
      const {
        data: { user },
        error: authError,
      } = await supabaseAuth.auth.getUser(token);

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
          error: `Plik jest zbyt duży (${Math.round(
            fileBuffer.length / 1024 / 1024
          )}MB). Maksymalny rozmiar to 25MB.`,
        });
      }

      // Transcribe
      const transcriber = new AudioTranscriber();
      await transcriber.initializeWithUserConfig(user.id);

      const result = await transcriber.transcribe(
        fileBuffer,
        filename,
        mimetype
      );

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
    } catch (error) {
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
      const {
        data: { user },
        error: authError,
      } = await supabaseAuth.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const { data: documents, error } = await supabase
        .from("processed_documents")
        .select("*")
        .eq("user_id", user.id)
        .order("processed_at", { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      // Mapuj do formatu frontendu
      const mappedDocuments = (documents || []).map((doc) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        formattedContent: doc.metadata?.formattedContent || null,
        documentType:
          doc.document_type === "transkrypcja"
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
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error:
          error instanceof Error ? error.message : "Błąd pobierania dokumentów",
      });
    }
  });

  // GET /documents/processed/:id - Szczegóły przetworzonego dokumentu
  fastify.get<{ Params: { id: string } }>(
    "/documents/processed/:id",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const token = authHeader.substring(7);
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
        const {
          data: { user },
          error: authError,
        } = await supabaseAuth.auth.getUser(token);

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
            documentType:
              doc.document_type === "transkrypcja"
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
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error:
            error instanceof Error
              ? error.message
              : "Błąd pobierania dokumentu",
        });
      }
    }
  );

  // DELETE /documents/processed/:id - Usuń przetworzony dokument
  fastify.delete<{ Params: { id: string } }>(
    "/documents/processed/:id",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const token = authHeader.substring(7);
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
        const {
          data: { user },
          error: authError,
        } = await supabaseAuth.auth.getUser(token);

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
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error:
            error instanceof Error ? error.message : "Błąd usuwania dokumentu",
        });
      }
    }
  );

  // POST /documents/processed/:id/analyze-sentiment - Analiza sentymentu
  fastify.post<{ Params: { id: string } }>(
    "/documents/processed/:id/analyze-sentiment",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const token = authHeader.substring(7);
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
        const {
          data: { user },
          error: authError,
        } = await supabaseAuth.auth.getUser(token);

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
          sentiment = JSON.parse(
            sentimentText.replace(/```json\n?|\n?```/g, "")
          );
        } catch {
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
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error:
            error instanceof Error ? error.message : "Błąd analizy sentymentu",
        });
      }
    }
  );

  // POST /documents/processed/:id/format - Profesjonalne formatowanie dokumentu
  fastify.post<{ Params: { id: string } }>(
    "/documents/processed/:id/format",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const token = authHeader.substring(7);
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
        const {
          data: { user },
          error: authError,
        } = await supabaseAuth.auth.getUser(token);

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

        const formattedContent =
          response.choices[0]?.message?.content || doc.content;

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
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error:
            error instanceof Error
              ? error.message
              : "Błąd formatowania dokumentu",
        });
      }
    }
  );

  // GET /documents/jobs - Lista zadań przetwarzania
  fastify.get("/documents/jobs", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
      const {
        data: { user },
        error: authError,
      } = await supabaseAuth.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      // Pobierz zadania z serwisu (in-memory queue)
      const { DocumentProcessingJobService } = await import(
        "../services/document-processing-job-service.js"
      );
      const jobService = new DocumentProcessingJobService(user.id);
      const jobs = jobService.getUserJobs();

      return reply.send({
        success: true,
        jobs,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.send({
        success: true,
        jobs: [], // Zwróć pustą listę jeśli serwis nie istnieje
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
      const {
        data: { user },
        error: authError,
      } = await supabaseAuth.auth.getUser(token);

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
      const includeSentiment =
        data.fields?.includeSentiment?.toString() === "true";
      const saveToRag = data.fields?.saveToRag?.toString() !== "false";
      const formatAsProfessional =
        data.fields?.formatAsProfessional?.toString() !== "false";

      // Utwórz zadanie asynchroniczne
      const { DocumentProcessingJobService } = await import(
        "../services/document-processing-job-service.js"
      );
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
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error:
          error instanceof Error ? error.message : "Błąd tworzenia zadania",
      });
    }
  });
};
