import { z, ZodError } from "zod";
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
export const documentsRoutes = async (fastify) => {
    // GET /documents - Lista dokumentów z filtrowaniem i paginacją
    fastify.get("/documents", async (request, reply) => {
        const querySchema = z.object({
            search: z.string().optional(),
            documentType: z.string().optional(),
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
            limit: z.coerce.number().int().positive().max(100).default(20),
            offset: z.coerce.number().int().min(0).default(0),
        });
        try {
            const query = querySchema.parse(request.query);
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            // Buduj zapytanie Supabase
            let supabaseQuery = supabase
                .from("processed_documents")
                .select("*", { count: "exact" })
                .eq("user_id", userId);
            // Filtry
            if (query.documentType) {
                supabaseQuery = supabaseQuery.eq("document_type", query.documentType);
            }
            if (query.search) {
                supabaseQuery = supabaseQuery.or(`title.ilike.%${query.search}%,content.ilike.%${query.search}%`);
            }
            if (query.dateFrom) {
                supabaseQuery = supabaseQuery.gte("publish_date", query.dateFrom);
            }
            if (query.dateTo) {
                supabaseQuery = supabaseQuery.lte("publish_date", query.dateTo);
            }
            // Sortowanie i paginacja
            const { data: documents, error, count, } = await supabaseQuery
                .order("processed_at", { ascending: false })
                .range(query.offset, query.offset + query.limit - 1);
            if (error) {
                throw error;
            }
            return reply.send({
                documents: documents || [],
                total: count || 0,
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
            const data = CreateDocumentSchema.parse(request.body);
            // TODO: Zapisz dokument do bazy
            // TODO: Dodaj job do kolejki dla ekstrakcji
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
        const { id } = request.params;
        try {
            const data = UpdateDocumentSchema.parse(request.body);
            // TODO: Aktualizuj dokument w bazie
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
    // DELETE /documents/:id - Usunięcie dokumentu
    fastify.delete("/documents/:id", async (request, reply) => {
        const { id } = request.params;
        try {
            // TODO: Usuń dokument z bazy
            return reply
                .status(204)
                .send({ message: "Document deleted successfully" });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // POST /documents/search - Wyszukiwanie semantyczne
    fastify.post("/documents/search", async (request, reply) => {
        try {
            const query = SearchQuerySchema.parse(request.body);
            // TODO: Wygeneruj embedding dla zapytania
            // TODO: Wykonaj wyszukiwanie semantyczne
            return reply.status(200).send({ message: "Search results" });
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
        const { id } = request.params;
        try {
            // TODO: Pobierz analizy dokumentu
            return reply.status(501).send({ error: "Not implemented yet" });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
    // POST /documents/:id/analyze - Zlecenie analizy dokumentu
    fastify.post("/documents/:id/analyze", async (request, reply) => {
        const { id } = request.params;
        try {
            // TODO: Dodaj job analizy do kolejki
            return reply.status(501).send({ error: "Not implemented yet" });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });
};
//# sourceMappingURL=documents.js.map