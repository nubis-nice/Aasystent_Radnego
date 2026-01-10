import { ZodError } from "zod";
import OpenAI from "openai";
import { ChatRequestSchema, buildSystemPrompt, } from "@aasystent-radnego/shared";
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
export const chatRoutes = async (fastify) => {
    // POST /api/chat/message - Wyślij wiadomość do AI
    fastify.post("/chat/message", async (request, reply) => {
        try {
            // Walidacja
            const validatedData = ChatRequestSchema.parse(request.body);
            const { message, conversationId, includeDocuments, includeMunicipalData, temperature, } = validatedData;
            // Pobierz użytkownika z headera (zakładamy że auth middleware dodaje user_id)
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            // Pobierz profil użytkownika
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("*")
                .eq("user_id", userId)
                .single();
            // Pobierz konfigurację OpenAI użytkownika (domyślną i aktywną)
            const { data: apiConfig } = await supabase
                .from("api_configurations")
                .select("*")
                .eq("user_id", userId)
                .eq("is_active", true)
                .eq("is_default", true)
                .eq("provider", "openai")
                .single();
            // Jeśli użytkownik nie ma konfiguracji, użyj zmiennej środowiskowej
            let openaiApiKey = process.env.OPENAI_API_KEY;
            let openaiModel = process.env.OPENAI_MODEL || "gpt-4-turbo-preview";
            let openaiBaseUrl = undefined;
            if (apiConfig) {
                // Odszyfruj klucz API (base64)
                openaiApiKey = Buffer.from(apiConfig.api_key_encrypted, "base64").toString("utf-8");
                openaiModel = apiConfig.model_name || openaiModel;
                openaiBaseUrl = apiConfig.base_url || undefined;
                // Zaktualizuj last_used_at
                await supabase
                    .from("api_configurations")
                    .update({ last_used_at: new Date().toISOString() })
                    .eq("id", apiConfig.id);
            }
            if (!openaiApiKey) {
                return reply.status(400).send({
                    error: "Brak konfiguracji OpenAI. Przejdź do Ustawienia → Konfiguracja API i dodaj klucz OpenAI.",
                });
            }
            // Pobierz lub utwórz konwersację
            let currentConversationId = conversationId;
            if (!currentConversationId) {
                // Utwórz nową konwersację
                const { data: newConversation, error: convError } = await supabase
                    .from("conversations")
                    .insert({
                    user_id: userId,
                    title: message.substring(0, 100),
                })
                    .select()
                    .single();
                if (convError || !newConversation) {
                    throw new Error("Failed to create conversation");
                }
                currentConversationId = newConversation.id;
            }
            // Zapisz wiadomość użytkownika
            await supabase.from("messages").insert({
                conversation_id: currentConversationId,
                role: "user",
                content: message,
            });
            // Pobierz historię konwersacji (ostatnie 10 wiadomości)
            const { data: history } = await supabase
                .from("messages")
                .select("role, content")
                .eq("conversation_id", currentConversationId)
                .order("created_at", { ascending: true })
                .limit(10);
            // Przygotuj kontekst RAG
            let ragContext;
            if (includeDocuments || includeMunicipalData) {
                // Generuj embedding dla zapytania (używamy konfiguracji użytkownika)
                const embeddingOpenai = new OpenAI({
                    apiKey: openaiApiKey,
                    baseURL: openaiBaseUrl,
                });
                const embeddingResponse = await embeddingOpenai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: message,
                });
                const queryEmbedding = embeddingResponse.data[0].embedding;
                ragContext = {
                    documents: [],
                    municipalData: [],
                };
                // Wyszukaj w przetworzonych dokumentach (źródła danych)
                if (includeDocuments || includeMunicipalData) {
                    const { data: relevantDocs } = await supabase.rpc("search_processed_documents", {
                        query_embedding: queryEmbedding,
                        match_threshold: 0.7,
                        match_count: 5,
                        filter_user_id: userId,
                        filter_types: null, // Wszystkie typy dokumentów
                    });
                    if (relevantDocs && relevantDocs.length > 0) {
                        // Rozdziel dokumenty na kategorie
                        relevantDocs.forEach((doc) => {
                            const docData = {
                                id: doc.id,
                                title: doc.title,
                                content: doc.content,
                                relevanceScore: doc.similarity,
                                metadata: {
                                    documentType: doc.document_type,
                                    publishDate: doc.publish_date,
                                    sourceUrl: doc.source_url,
                                },
                            };
                            // Dokumenty użytkownika vs dane gminy
                            if (includeDocuments && doc.document_type !== "news") {
                                ragContext.documents.push(docData);
                            }
                            if (includeMunicipalData &&
                                ["news", "resolution", "protocol", "announcement"].includes(doc.document_type)) {
                                ragContext.municipalData.push({
                                    id: doc.id,
                                    title: doc.title,
                                    content: doc.content || "",
                                    dataType: doc.document_type,
                                    relevanceScore: doc.similarity,
                                });
                            }
                        });
                    }
                }
            }
            // Zbuduj system prompt
            const systemPromptContext = {
                municipalityName: profile?.municipality_name,
                municipalityType: profile?.municipality_type,
                userName: profile?.full_name,
                userPosition: profile?.position,
            };
            const systemPrompt = buildSystemPrompt(systemPromptContext);
            // Przygotuj kontekst dla AI
            const messages = [
                {
                    role: "system",
                    content: systemPrompt,
                },
            ];
            // Dodaj kontekst RAG jeśli dostępny
            if (ragContext &&
                (ragContext.documents.length > 0 || ragContext.municipalData.length > 0)) {
                let contextMessage = "# DOSTĘPNY KONTEKST\n\n";
                if (ragContext.documents.length > 0) {
                    contextMessage += "## Dokumenty użytkownika:\n\n";
                    ragContext.documents.forEach((doc, idx) => {
                        contextMessage += `### [${idx + 1}] ${doc.title}\n${doc.content}\n\n`;
                    });
                }
                if (ragContext.municipalData.length > 0) {
                    contextMessage += "## Dane z gminy/miasta:\n\n";
                    ragContext.municipalData.forEach((item, idx) => {
                        contextMessage += `### [${idx + 1}] ${item.title} (${item.dataType})\n${item.content}\n\n`;
                    });
                }
                contextMessage +=
                    "\nOdpowiadając na pytanie użytkownika, wykorzystaj powyższy kontekst i zawsze cytuj źródła.";
                messages.push({
                    role: "system",
                    content: contextMessage,
                });
            }
            // Dodaj historię konwersacji
            if (history) {
                history.forEach((msg) => {
                    messages.push({
                        role: msg.role,
                        content: msg.content,
                    });
                });
            }
            // Wywołaj OpenAI z konfiguracją użytkownika
            const openai = new OpenAI({
                apiKey: openaiApiKey,
                baseURL: openaiBaseUrl,
            });
            const completion = await openai.chat.completions.create({
                model: openaiModel,
                messages,
                temperature: temperature || 0.7,
                max_tokens: 2000,
            });
            const aiResponse = completion.choices[0]?.message?.content ||
                "Przepraszam, nie mogę wygenerować odpowiedzi.";
            // Przygotuj cytaty
            const citations = [];
            if (ragContext) {
                ragContext.documents.forEach((doc) => {
                    citations.push({
                        documentId: doc.id,
                        documentTitle: doc.title,
                        text: doc.content.substring(0, 200) + "...",
                        relevanceScore: doc.relevanceScore,
                    });
                });
                ragContext.municipalData.forEach((item) => {
                    citations.push({
                        documentTitle: `${item.title} (${item.dataType})`,
                        text: item.content.substring(0, 200) + "...",
                        relevanceScore: item.relevanceScore,
                    });
                });
            }
            // Zapisz odpowiedź AI
            const { data: aiMessage } = await supabase
                .from("messages")
                .insert({
                conversation_id: currentConversationId,
                role: "assistant",
                content: aiResponse,
                citations: citations,
            })
                .select()
                .single();
            // Zwróć odpowiedź
            return reply.send({
                conversationId: currentConversationId,
                message: aiMessage,
                relatedDocuments: ragContext?.documents.map((doc) => ({
                    id: doc.id,
                    title: doc.title,
                    relevanceScore: doc.relevanceScore,
                })),
            });
        }
        catch (error) {
            if (error instanceof ZodError) {
                return reply
                    .status(400)
                    .send({ error: "Validation error", details: error.issues });
            }
            fastify.log.error("Chat error:", error);
            return reply.status(500).send({
                error: "Failed to process chat message",
                details: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // GET /api/chat/conversations - Pobierz listę konwersacji
    fastify.get("/chat/conversations", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const { data: conversations, error } = await supabase
                .from("conversations")
                .select("*")
                .eq("user_id", userId)
                .order("updated_at", { ascending: false })
                .limit(50);
            if (error) {
                throw error;
            }
            return reply.send({ conversations });
        }
        catch (error) {
            fastify.log.error("Error fetching conversations:", error);
            return reply.status(500).send({ error: "Failed to fetch conversations" });
        }
    });
    // GET /api/chat/conversation/:id - Pobierz konwersację z wiadomościami
    fastify.get("/chat/conversation/:id", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const { id } = request.params;
            // Pobierz konwersację
            const { data: conversation, error: convError } = await supabase
                .from("conversations")
                .select("*")
                .eq("id", id)
                .eq("user_id", userId)
                .single();
            if (convError || !conversation) {
                return reply.status(404).send({ error: "Conversation not found" });
            }
            // Pobierz wiadomości
            const { data: messages, error: msgError } = await supabase
                .from("messages")
                .select("*")
                .eq("conversation_id", id)
                .order("created_at", { ascending: true });
            if (msgError) {
                throw msgError;
            }
            return reply.send({
                conversation: {
                    ...conversation,
                    messages,
                },
            });
        }
        catch (error) {
            fastify.log.error("Error fetching conversation:", error);
            return reply.status(500).send({ error: "Failed to fetch conversation" });
        }
    });
    // DELETE /api/chat/conversation/:id - Usuń konwersację
    fastify.delete("/chat/conversation/:id", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const { id } = request.params;
            const { error } = await supabase
                .from("conversations")
                .delete()
                .eq("id", id)
                .eq("user_id", userId);
            if (error) {
                throw error;
            }
            return reply.send({ success: true });
        }
        catch (error) {
            fastify.log.error("Error deleting conversation:", error);
            return reply.status(500).send({ error: "Failed to delete conversation" });
        }
    });
    // POST /api/chat/create-document - Utwórz dokument na bazie analizy czatu
    fastify.post("/chat/create-document", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const { title, content, documentType, summary, keywords, conversationId, } = request.body;
            // Walidacja
            if (!title || !content || !documentType) {
                return reply.status(400).send({
                    error: "Missing required fields: title, content, documentType",
                });
            }
            // Pobierz konfigurację OpenAI użytkownika
            const { data: apiConfig } = await supabase
                .from("api_configurations")
                .select("*")
                .eq("user_id", userId)
                .eq("is_active", true)
                .eq("is_default", true)
                .eq("provider", "openai")
                .single();
            let openaiApiKey = process.env.OPENAI_API_KEY;
            let openaiBaseUrl = undefined;
            if (apiConfig) {
                openaiApiKey = Buffer.from(apiConfig.api_key_encrypted, "base64").toString("utf-8");
                openaiBaseUrl = apiConfig.base_url || undefined;
            }
            if (!openaiApiKey) {
                return reply.status(400).send({
                    error: "Brak konfiguracji OpenAI. Dodaj klucz API w ustawieniach.",
                });
            }
            // Generuj embedding dla nowego dokumentu
            const openai = new OpenAI({
                apiKey: openaiApiKey,
                baseURL: openaiBaseUrl,
            });
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: content,
            });
            const embedding = embeddingResponse.data[0].embedding;
            // Zapisz dokument do bazy
            const { data: newDocument, error: insertError } = await supabase
                .from("processed_documents")
                .insert({
                user_id: userId,
                document_type: documentType,
                title: title,
                content: content,
                summary: summary || content.substring(0, 200) + "...",
                keywords: keywords || [],
                embedding: embedding,
                source_url: conversationId
                    ? `/chat/conversation/${conversationId}`
                    : null,
                metadata: {
                    created_by: "ai_assistant",
                    conversation_id: conversationId,
                    created_at: new Date().toISOString(),
                },
            })
                .select()
                .single();
            if (insertError || !newDocument) {
                throw new Error("Failed to create document");
            }
            // Jeśli jest conversationId, dodaj notatkę do konwersacji
            if (conversationId) {
                await supabase.from("messages").insert({
                    conversation_id: conversationId,
                    role: "system",
                    content: `📄 Utworzono dokument: "${title}" (typ: ${documentType})`,
                    metadata: {
                        document_id: newDocument.id,
                        action: "document_created",
                    },
                });
            }
            return reply.send({
                success: true,
                document: newDocument,
                message: `Dokument "${title}" został utworzony i zapisany w bazie.`,
            });
        }
        catch (error) {
            fastify.log.error("Error creating document:", error);
            return reply.status(500).send({
                error: "Failed to create document",
                details: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // POST /api/chat/create-summary - Utwórz podsumowanie dokumentów
    fastify.post("/chat/create-summary", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const { query, documentTypes, conversationId } = request.body;
            if (!query) {
                return reply.status(400).send({ error: "Query is required" });
            }
            // Pobierz konfigurację OpenAI
            const { data: apiConfig } = await supabase
                .from("api_configurations")
                .select("*")
                .eq("user_id", userId)
                .eq("is_active", true)
                .eq("is_default", true)
                .eq("provider", "openai")
                .single();
            let openaiApiKey = process.env.OPENAI_API_KEY;
            let openaiModel = process.env.OPENAI_MODEL || "gpt-4-turbo-preview";
            let openaiBaseUrl = undefined;
            if (apiConfig) {
                openaiApiKey = Buffer.from(apiConfig.api_key_encrypted, "base64").toString("utf-8");
                openaiModel = apiConfig.model_name || openaiModel;
                openaiBaseUrl = apiConfig.base_url || undefined;
            }
            if (!openaiApiKey) {
                return reply.status(400).send({
                    error: "Brak konfiguracji OpenAI",
                });
            }
            const openai = new OpenAI({
                apiKey: openaiApiKey,
                baseURL: openaiBaseUrl,
            });
            // Generuj embedding dla zapytania
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: query,
            });
            const queryEmbedding = embeddingResponse.data[0].embedding;
            // Wyszukaj relevantne dokumenty
            const { data: relevantDocs } = await supabase.rpc("search_processed_documents", {
                query_embedding: queryEmbedding,
                match_threshold: 0.6,
                match_count: 10,
                filter_user_id: userId,
                filter_types: documentTypes || null,
            });
            if (!relevantDocs || relevantDocs.length === 0) {
                return reply.status(404).send({
                    error: "Nie znaleziono dokumentów pasujących do zapytania",
                });
            }
            // Przygotuj kontekst dla AI
            let contextMessage = "# DOKUMENTY DO PODSUMOWANIA\n\n";
            relevantDocs.forEach((doc, idx) => {
                contextMessage += `## Dokument ${idx + 1}: ${doc.title}\n`;
                contextMessage += `Typ: ${doc.document_type}\n`;
                contextMessage += `Treść: ${doc.content}\n\n`;
            });
            // Poproś AI o podsumowanie
            const completion = await openai.chat.completions.create({
                model: openaiModel,
                messages: [
                    {
                        role: "system",
                        content: "Jesteś asystentem tworzącym zwięzłe i merytoryczne podsumowania dokumentów. Twoim zadaniem jest przeanalizować podane dokumenty i stworzyć kompleksowe podsumowanie.",
                    },
                    {
                        role: "user",
                        content: `${contextMessage}\n\nZapytanie: ${query}\n\nUtwórz szczegółowe podsumowanie powyższych dokumentów w kontekście zapytania. Uwzględnij najważniejsze informacje, daty, liczby i fakty.`,
                    },
                ],
                temperature: 0.3,
                max_tokens: 2000,
            });
            const summaryContent = completion.choices[0]?.message?.content ||
                "Nie udało się wygenerować podsumowania";
            // Zapisz podsumowanie jako nowy dokument
            const summaryTitle = `Podsumowanie: ${query}`;
            const keywords = relevantDocs.map((doc) => doc.document_type);
            const embeddingSummary = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: summaryContent,
            });
            const { data: summaryDoc } = await supabase
                .from("processed_documents")
                .insert({
                user_id: userId,
                document_type: "article",
                title: summaryTitle,
                content: summaryContent,
                summary: summaryContent.substring(0, 200) + "...",
                keywords: Array.from(new Set(keywords)),
                embedding: embeddingSummary.data[0].embedding,
                metadata: {
                    created_by: "ai_assistant",
                    source_documents: relevantDocs.map((d) => d.id),
                    query: query,
                    conversation_id: conversationId,
                    created_at: new Date().toISOString(),
                },
            })
                .select()
                .single();
            return reply.send({
                success: true,
                summary: summaryContent,
                document: summaryDoc,
                sourceDocuments: relevantDocs.length,
            });
        }
        catch (error) {
            fastify.log.error("Error creating summary:", error);
            return reply.status(500).send({
                error: "Failed to create summary",
                details: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // GET /dashboard/stats - Statystyki dla Dashboard
    fastify.get("/dashboard/stats", async (request, reply) => {
        try {
            const userId = request.headers["x-user-id"];
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            // Pobierz liczbę dokumentów
            const { count: documentsCount } = await supabase
                .from("processed_documents")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId);
            // Pobierz dokumenty z ostatniego tygodnia
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const { count: documentsThisWeek } = await supabase
                .from("processed_documents")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId)
                .gte("processed_at", weekAgo.toISOString());
            // Pobierz liczbę konwersacji
            const { count: conversationsCount } = await supabase
                .from("conversations")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId);
            // Pobierz liczbę wiadomości
            const { data: conversations } = await supabase
                .from("conversations")
                .select("id")
                .eq("user_id", userId);
            const conversationIds = conversations?.map((c) => c.id) || [];
            let messagesCount = 0;
            if (conversationIds.length > 0) {
                const { count } = await supabase
                    .from("messages")
                    .select("*", { count: "exact", head: true })
                    .in("conversation_id", conversationIds);
                messagesCount = count || 0;
            }
            // Pobierz ostatnią aktywność
            const { data: recentDocs } = await supabase
                .from("processed_documents")
                .select("id, title, processed_at")
                .eq("user_id", userId)
                .order("processed_at", { ascending: false })
                .limit(3);
            const recentActivity = (recentDocs || []).map((doc) => ({
                id: doc.id,
                type: "document",
                title: `Przetworzono "${doc.title}"`,
                timestamp: doc.processed_at,
            }));
            return reply.send({
                documentsCount: documentsCount || 0,
                documentsThisWeek: documentsThisWeek || 0,
                conversationsCount: conversationsCount || 0,
                messagesCount: messagesCount,
                recentActivity: recentActivity,
            });
        }
        catch (error) {
            fastify.log.error("Error fetching dashboard stats:", error);
            return reply.status(500).send({
                error: "Failed to fetch dashboard stats",
                details: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
};
//# sourceMappingURL=chat.js.map