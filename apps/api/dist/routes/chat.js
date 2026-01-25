import { ZodError } from "zod";
import OpenAI from "openai";
import { ChatRequestSchema, buildSystemPrompt, } from "@aasystent-radnego/shared";
import { createClient } from "@supabase/supabase-js";
import { decryptApiKey } from "../utils/encryption.js";
import { optimizeContext } from "../services/context-compressor.js";
import { DocumentQueryService } from "../services/document-query-service.js";
import { SessionDiscoveryService } from "../services/session-discovery-service.js";
import { getEmbeddingsClient, getAIConfig } from "../ai/index.js";
import { AIToolOrchestrator, shouldUseOrchestrator, } from "../services/ai-tool-orchestrator.js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
/**
 * Generuje embedding dla długiego tekstu używając batch processing
 * Dzieli tekst na chunki, generuje embedding dla każdego, agreguje wyniki
 *
 * Strategia agregacji: średnia ważona wektorów (weighted by chunk length)
 * To zachowuje semantykę całego tekstu zamiast tracić informacje przez obcinanie
 */
async function generateBatchEmbedding(client, text, model, maxChunkChars = 18000) {
    // Jeśli tekst mieści się w limicie - pojedyncze wywołanie
    if (text.length <= maxChunkChars) {
        console.log(`[Embedding] Single chunk: ${text.length} chars`);
        const response = await client.embeddings.create({
            model,
            input: text,
        });
        return response.data[0].embedding;
    }
    // Podziel tekst na chunki z overlap dla zachowania kontekstu
    const overlap = 500; // 500 znaków overlap między chunkami
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + maxChunkChars, text.length);
        let chunk = text.slice(start, end);
        // Znajdź koniec zdania dla naturalnego podziału
        if (end < text.length) {
            const lastPeriod = chunk.lastIndexOf(". ");
            const lastNewline = chunk.lastIndexOf("\n");
            const breakPoint = Math.max(lastPeriod, lastNewline);
            if (breakPoint > maxChunkChars * 0.7) {
                chunk = chunk.slice(0, breakPoint + 1);
                start += breakPoint + 1 - overlap;
            }
            else {
                start = end - overlap;
            }
        }
        else {
            start = end;
        }
        if (chunk.trim().length > 100) {
            chunks.push(chunk.trim());
        }
    }
    console.log(`[Embedding] Batch processing: ${chunks.length} chunks from ${text.length} chars`);
    // Generuj embeddingi dla wszystkich chunków (batch API)
    const response = await client.embeddings.create({
        model,
        input: chunks,
    });
    // Agregacja: średnia ważona wektorów według długości chunków
    const embeddings = response.data.map((d) => d.embedding);
    const weights = chunks.map((c) => c.length);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    // Oblicz średnią ważoną dla każdego wymiaru wektora
    const dimensions = embeddings[0].length;
    const aggregatedEmbedding = new Array(dimensions).fill(0);
    for (let dim = 0; dim < dimensions; dim++) {
        let weightedSum = 0;
        for (let i = 0; i < embeddings.length; i++) {
            weightedSum += embeddings[i][dim] * weights[i];
        }
        aggregatedEmbedding[dim] = weightedSum / totalWeight;
    }
    // Normalizacja wektora (L2 norm) - ważne dla similarity search
    const norm = Math.sqrt(aggregatedEmbedding.reduce((sum, val) => sum + val * val, 0));
    const normalizedEmbedding = aggregatedEmbedding.map((val) => val / norm);
    console.log(`[Embedding] Aggregated ${chunks.length} embeddings into single vector`);
    return normalizedEmbedding;
}
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
            // Pobierz profil użytkownika (tabela: user_profiles, klucz: id)
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("*")
                .eq("id", userId)
                .single();
            // Pobierz ustawienia lokalne użytkownika (gmina, rada, BIP)
            const { data: localeSettings } = await supabase
                .from("user_locale_settings")
                .select("*")
                .eq("user_id", userId)
                .single();
            // Fallback: pobierz imię z auth.users jeśli brak w profiles
            let userName = profile?.full_name;
            if (!userName) {
                const { data: authUser } = await supabase.auth.admin.getUserById(userId);
                userName =
                    authUser?.user?.user_metadata?.full_name ||
                        authUser?.user?.user_metadata?.name ||
                        authUser?.user?.email?.split("@")[0]; // fallback do nazwy z email
            }
            // Pobierz domyślną konfigurację API użytkownika (dowolny provider)
            const { data: apiConfig } = await supabase
                .from("api_configurations")
                .select("*")
                .eq("user_id", userId)
                .eq("is_active", true)
                .eq("is_default", true)
                .single();
            // Domyślne URL dla providerów kompatybilnych z OpenAI API
            const providerBaseUrls = {
                openai: "https://api.openai.com/v1",
                local: "http://localhost:11434/v1", // Ollama default
                other: "", // Custom endpoint
            };
            // Konfiguracja AI - wymagana z bazy danych
            let apiKey = undefined;
            let model = process.env.OPENAI_MODEL || "gpt-4o-mini";
            let baseUrl = undefined;
            let embeddingModel = "text-embedding-3-small";
            let provider = "openai";
            if (apiConfig) {
                // Obsługa kluczy - base64 (domyślnie) lub AES-256-GCM (gdy encryption_iv istnieje)
                const hasEncryptionIv = apiConfig.encryption_iv &&
                    typeof apiConfig.encryption_iv === "string" &&
                    apiConfig.encryption_iv.trim().length > 0;
                if (hasEncryptionIv) {
                    // Nowy format - AES-256-GCM
                    console.log("[Chat] Decrypting API key using AES-256-GCM");
                    try {
                        apiKey = decryptApiKey(apiConfig.api_key_encrypted, apiConfig.encryption_iv);
                    }
                    catch (e) {
                        console.error("[Chat] AES decryption failed, trying base64:", e);
                        apiKey = Buffer.from(apiConfig.api_key_encrypted, "base64").toString("utf-8");
                    }
                }
                else {
                    // Stary format - base64
                    console.log("[Chat] Decrypting API key using base64");
                    const decoded = Buffer.from(apiConfig.api_key_encrypted, "base64").toString("utf-8");
                    // Obsługa kodowania encodeURIComponent z frontendu
                    try {
                        apiKey = decodeURIComponent(decoded);
                    }
                    catch {
                        // Jeśli nie jest URI encoded, użyj bezpośrednio
                        apiKey = decoded;
                    }
                }
                // Validate API key format
                console.log(`[Chat] API key decrypted, length: ${apiKey?.length || 0}, starts with sk-: ${apiKey?.startsWith("sk-")}`);
                model = apiConfig.model_name || model;
                provider = apiConfig.provider;
                // Ustaw baseUrl - użyj custom URL lub domyślnego dla providera
                baseUrl = apiConfig.base_url || providerBaseUrls[provider] || undefined;
                // Użyj embedding model z konfiguracji lub domyślny
                embeddingModel = apiConfig.embedding_model || "text-embedding-3-small";
                console.log(`[Chat] Using provider: ${provider}, model: ${model}, baseUrl: ${baseUrl}, embeddingModel: ${embeddingModel}`);
                // Zaktualizuj last_used_at
                await supabase
                    .from("api_configurations")
                    .update({ last_used_at: new Date().toISOString() })
                    .eq("id", apiConfig.id);
            }
            if (!apiKey) {
                return reply.status(400).send({
                    error: "Brak konfiguracji API. Przejdź do Ustawienia → Konfiguracja API i dodaj klucz API.",
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
            // ========================================================================
            // PHASE 0: WYKRYWANIE INTENCJI SESJI RADY
            // Sprawdzamy czy użytkownik pyta o konkretną sesję rady
            // ========================================================================
            const documentQueryService = new DocumentQueryService(userId);
            await documentQueryService.initialize();
            const sessionIntent = documentQueryService.detectSessionIntent(message);
            if (sessionIntent) {
                console.log(`[Chat] Session intent detected: session=${sessionIntent.sessionNumber}, type=${sessionIntent.requestType}`);
                // Uruchom kaskadowe wyszukiwanie sesji
                const sessionDiscovery = new SessionDiscoveryService(userId);
                await sessionDiscovery.initialize();
                const discoveryResult = await sessionDiscovery.discoverSession(sessionIntent);
                // Jeśli nie znaleziono transkrypcji ale jest wideo - zaproponuj transkrypcję
                if (!discoveryResult.hasTranscription &&
                    discoveryResult.hasVideo &&
                    discoveryResult.suggestions.length > 0) {
                    const { data: suggestionMessage } = await supabase
                        .from("messages")
                        .insert({
                        conversation_id: currentConversationId,
                        role: "assistant",
                        content: discoveryResult.message,
                    })
                        .select()
                        .single();
                    return reply.send({
                        conversationId: currentConversationId,
                        message: suggestionMessage || {
                            id: `temp-${Date.now()}`,
                            conversationId: currentConversationId,
                            role: "assistant",
                            content: discoveryResult.message,
                            citations: [],
                            createdAt: new Date().toISOString(),
                        },
                        citations: [],
                        sessionDiscovery: {
                            found: discoveryResult.found,
                            sessionNumber: discoveryResult.sessionNumber,
                            hasTranscription: discoveryResult.hasTranscription,
                            hasProtocol: discoveryResult.hasProtocol,
                            hasVideo: discoveryResult.hasVideo,
                            suggestions: discoveryResult.suggestions,
                        },
                    });
                }
                // Jeśli nie znaleziono żadnych materiałów
                if (!discoveryResult.found) {
                    const { data: notFoundMessage } = await supabase
                        .from("messages")
                        .insert({
                        conversation_id: currentConversationId,
                        role: "assistant",
                        content: discoveryResult.message,
                    })
                        .select()
                        .single();
                    return reply.send({
                        conversationId: currentConversationId,
                        message: notFoundMessage || {
                            id: `temp-${Date.now()}`,
                            conversationId: currentConversationId,
                            role: "assistant",
                            content: discoveryResult.message,
                            citations: [],
                            createdAt: new Date().toISOString(),
                        },
                        citations: [],
                    });
                }
                // Jeśli znaleziono materiały - dodaj je priorytetowo do kontekstu RAG
                console.log(`[Chat] Session documents found: ${discoveryResult.documents.length}`);
                // Zapisz dokumenty sesji do późniejszego użycia w kontekście RAG
                // Te dokumenty będą miały priorytet nad standardowym wyszukiwaniem
                if (discoveryResult.documents.length > 0) {
                    // @ts-expect-error - sessionDocuments będzie użyte później
                    request.sessionDocuments = discoveryResult.documents;
                }
            }
            // ========================================================================
            // PHASE 0.5: AI TOOL ORCHESTRATOR - Zaawansowane wyszukiwanie
            // Sprawdzamy czy pytanie wymaga głębokiego researchu z wieloma narzędziami
            // ========================================================================
            if (shouldUseOrchestrator(message)) {
                console.log(`[Chat] Deep research detected, using AI Tool Orchestrator`);
                try {
                    const orchestrator = new AIToolOrchestrator(userId);
                    // Pobierz kontekst konwersacji
                    const conversationContext = (history || [])
                        .slice(-5)
                        .map((m) => `${m.role}: ${m.content}`)
                        .join("\n");
                    const orchestratorResult = await orchestrator.process(message, conversationContext);
                    // Sprawdź czy to akcja kalendarza/zadań (krótka odpowiedź OK)
                    const actionTools = [
                        "calendar_add",
                        "calendar_list",
                        "calendar_edit",
                        "calendar_delete",
                        "task_add",
                        "task_list",
                        "task_complete",
                        "task_delete",
                        "alert_check",
                        "quick_tool",
                        "app_navigate",
                    ];
                    const isActionTool = actionTools.includes(orchestratorResult.intent.primaryIntent);
                    // Sprawdź czy orchestrator udzielił sensownej odpowiedzi
                    const hasActionSuccess = orchestratorResult.toolResults.some((r) => r.success &&
                        ((r.data !== undefined && r.data !== null) || r.message));
                    const hasValidResponse = orchestratorResult.synthesizedResponse &&
                        (isActionTool
                            ? orchestratorResult.synthesizedResponse.length > 5
                            : orchestratorResult.synthesizedResponse.length > 100) &&
                        !orchestratorResult.synthesizedResponse.includes("nie udało się znaleźć") &&
                        (isActionTool
                            ? hasActionSuccess
                            : orchestratorResult.toolResults.some((r) => r.success && r.data));
                    console.log(`[Chat] Orchestrator result: intent=${orchestratorResult.intent.primaryIntent}, isActionTool=${isActionTool}, hasValidResponse=${hasValidResponse}, responseLen=${orchestratorResult.synthesizedResponse?.length || 0}, successfulTools=${orchestratorResult.toolResults.filter((r) => r.success).length}`);
                    // Debug: pokaż wyniki narzędzi
                    if (isActionTool) {
                        console.log(`[Chat] Action tool results:`, JSON.stringify(orchestratorResult.toolResults, null, 2));
                    }
                    // Jeśli orchestrator udzielił pełnej odpowiedzi
                    if (hasValidResponse) {
                        // Dodaj informację o czasie i źródłach
                        let responseContent = orchestratorResult.synthesizedResponse;
                        // Dodaj źródła na końcu
                        if (orchestratorResult.sources.length > 0) {
                            responseContent += "\n\n---\n**Źródła:**\n";
                            orchestratorResult.sources.slice(0, 5).forEach((src, i) => {
                                responseContent += `${i + 1}. ${src.title}`;
                                if (src.url)
                                    responseContent += ` - [link](${src.url})`;
                                responseContent += ` _(${src.type})_\n`;
                            });
                        }
                        // Dodaj ostrzeżenia jeśli są
                        if (orchestratorResult.warnings.length > 0) {
                            responseContent +=
                                "\n\n⚠️ " + orchestratorResult.warnings.join("\n⚠️ ");
                        }
                        // Zapisz odpowiedź
                        const { data: assistantMessage } = await supabase
                            .from("messages")
                            .insert({
                            conversation_id: currentConversationId,
                            role: "assistant",
                            content: responseContent,
                        })
                            .select()
                            .single();
                        // Wyciągnij uiAction z toolResults (dla akcji kalendarza/zadań)
                        const uiActions = orchestratorResult.toolResults
                            .filter((r) => r.uiAction)
                            .map((r) => r.uiAction);
                        return reply.send({
                            conversationId: currentConversationId,
                            message: assistantMessage || {
                                id: `temp-${Date.now()}`,
                                conversationId: currentConversationId,
                                role: "assistant",
                                content: responseContent,
                                citations: [],
                                createdAt: new Date().toISOString(),
                            },
                            citations: orchestratorResult.sources.map((s) => ({
                                title: s.title,
                                url: s.url,
                                type: s.type,
                            })),
                            orchestratorMeta: {
                                intent: orchestratorResult.intent.primaryIntent,
                                toolsUsed: orchestratorResult.toolResults.map((r) => r.tool),
                                totalTimeMs: orchestratorResult.totalTimeMs,
                                requiresDeepSearch: orchestratorResult.intent.requiresDeepSearch,
                            },
                            // Przekaż akcje UI do frontendu (np. odświeżenie kalendarza)
                            uiActions: uiActions.length > 0 ? uiActions : undefined,
                        });
                    }
                }
                catch (orchError) {
                    console.warn("[Chat] Orchestrator failed, falling back to standard flow:", orchError);
                    // Kontynuuj standardowy flow
                }
            }
            // ========================================================================
            // PHASE 1: WYKRYWANIE DOKUMENTÓW W WIADOMOŚCI
            // Zamiast przekazywać pełną treść, wykrywamy ID/nazwę i szukamy w RAG
            // ========================================================================
            const documentQuery = await documentQueryService.queryDocuments(message);
            // Jeśli wykryto dokument i wymaga potwierdzenia - zwróć pytanie
            if (documentQuery.found &&
                documentQuery.needsConfirmation &&
                documentQuery.confirmationMessage) {
                console.log(`[Chat] Document detected, asking for confirmation`);
                // Zapisz odpowiedź asystenta z pytaniem o potwierdzenie
                const confirmationResponse = documentQuery.confirmationMessage;
                const { data: confirmationMessage } = await supabase
                    .from("messages")
                    .insert({
                    conversation_id: currentConversationId,
                    role: "assistant",
                    content: confirmationResponse,
                })
                    .select()
                    .single();
                return reply.send({
                    conversationId: currentConversationId,
                    message: confirmationMessage || {
                        id: `temp-${Date.now()}`,
                        conversationId: currentConversationId,
                        role: "assistant",
                        content: confirmationResponse,
                        citations: [],
                        createdAt: new Date().toISOString(),
                    },
                    citations: [],
                    documentQuery: {
                        found: true,
                        matches: documentQuery.matches,
                        needsConfirmation: true,
                    },
                });
            }
            // Jeśli dokument znaleziony bez potrzeby potwierdzenia - pobierz kontekst
            let documentContext = null;
            if (documentQuery.found &&
                !documentQuery.needsConfirmation &&
                documentQuery.matches.length > 0) {
                const primaryDoc = documentQuery.matches[0];
                if (primaryDoc) {
                    console.log(`[Chat] Document found by ID: ${primaryDoc.id}, fetching context`);
                    documentContext = await documentQueryService.getDocumentContext(primaryDoc.id, message);
                }
            }
            // Przygotuj kontekst RAG
            let ragContext;
            if (includeDocuments || includeMunicipalData) {
                // Użyj klienta embeddings z AIClientFactory (obsługuje OpenAI i lokalnych providerów)
                try {
                    const embeddingsClient = await getEmbeddingsClient(userId);
                    const embConfig = await getAIConfig(userId, "embeddings");
                    const currentEmbeddingModel = embConfig.modelName;
                    console.log(`[Chat] Using embeddings: provider=${embConfig.provider}, model=${currentEmbeddingModel}`);
                    // Batch embedding dla długich wiadomości
                    const maxChunkChars = 18000;
                    const queryEmbedding = await generateBatchEmbedding(embeddingsClient, message, currentEmbeddingModel, maxChunkChars);
                    ragContext = {
                        documents: [],
                        municipalData: [],
                    };
                    // Wyszukaj w przetworzonych dokumentach (źródła danych)
                    if (includeDocuments || includeMunicipalData) {
                        console.log("[Chat] Searching documents for user:", userId);
                        console.log("[Chat] Embedding generated, length:", queryEmbedding.length);
                        // Diagnostyka: ile dokumentów ma embeddingi
                        const { count: totalDocs } = await supabase
                            .from("processed_documents")
                            .select("*", { count: "exact", head: true })
                            .eq("user_id", userId);
                        const { count: docsWithEmbedding } = await supabase
                            .from("processed_documents")
                            .select("*", { count: "exact", head: true })
                            .eq("user_id", userId)
                            .not("embedding", "is", null);
                        console.log("[Chat] Documents stats:", {
                            total: totalDocs,
                            withEmbedding: docsWithEmbedding,
                        });
                        const { data: relevantDocs, error: searchError } = await supabase.rpc("search_processed_documents", {
                            query_embedding: queryEmbedding,
                            match_threshold: 0.25, // Obniżony próg dla lepszych wyników
                            match_count: 30, // Zwiększony limit dla pełniejszego kontekstu
                            filter_user_id: userId,
                            filter_types: null, // Wszystkie typy dokumentów
                        });
                        console.log("[Chat] Search result:", {
                            found: relevantDocs?.length || 0,
                            error: searchError?.message || null,
                        });
                        if (relevantDocs && relevantDocs.length > 0) {
                            // Log document types for debugging
                            const docTypes = relevantDocs.map((d) => d.document_type);
                            console.log("[Chat] Found document types:", docTypes);
                            // Dodaj wszystkie znalezione dokumenty do kontekstu
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
                                // Zawsze dodaj do dokumentów jeśli włączone
                                if (includeDocuments) {
                                    ragContext.documents.push(docData);
                                }
                                // Dodaj do danych gminnych jeśli to odpowiedni typ
                                if (includeMunicipalData &&
                                    [
                                        "news",
                                        "resolution",
                                        "protocol",
                                        "announcement",
                                        "article",
                                    ].includes(doc.document_type)) {
                                    ragContext.municipalData.push({
                                        id: doc.id,
                                        title: doc.title,
                                        content: doc.content || "",
                                        dataType: doc.document_type,
                                        relevanceScore: doc.similarity,
                                    });
                                }
                            });
                            console.log("[Chat] RAG context built:", {
                                documents: ragContext.documents.length,
                                municipalData: ragContext.municipalData.length,
                            });
                        }
                    }
                }
                catch (embError) {
                    console.warn("[Chat] RAG embeddings failed:", embError);
                    ragContext = undefined;
                }
            }
            // Zbuduj system prompt z danymi lokalnymi (priorytet: localeSettings > profile)
            const systemPromptContext = {
                // Priorytet dla danych z user_locale_settings (gmina, rada)
                municipalityName: localeSettings?.municipality ||
                    localeSettings?.council_name ||
                    profile?.municipality_name,
                municipalityType: profile?.municipality_type,
                // Dane użytkownika - używamy userName z fallbackiem
                userName: userName,
                userPosition: profile?.position,
                // Dane adresowe gminy
                postalCode: localeSettings?.postal_code,
                county: localeSettings?.county,
                // Dodatkowe dane lokalne
                voivodeship: localeSettings?.voivodeship,
                bipUrl: localeSettings?.bip_url,
                councilName: localeSettings?.council_name,
            };
            // Log personalizacji
            console.log("[Chat] Personalization context:", {
                userName: systemPromptContext.userName,
                municipality: systemPromptContext.municipalityName,
                council: systemPromptContext.councilName,
                voivodeship: systemPromptContext.voivodeship,
            });
            const systemPrompt = buildSystemPrompt(systemPromptContext);
            // ========================================================================
            // CONTEXT COMPRESSION - optymalizacja kontekstu dla oszczędności tokenów
            // ========================================================================
            // Przygotuj dokumenty do kompresji
            // WAŻNE: Jeśli mamy documentContext z wykrytego dokumentu, użyj chunków zamiast pełnej treści
            let ragDocuments = [];
            // PRIORYTET 1: Dokumenty sesji znalezione przez SessionDiscoveryService
            // @ts-expect-error - sessionDocuments jest dynamicznie dodane
            const sessionDocuments = request.sessionDocuments;
            if (sessionDocuments && sessionDocuments.length > 0) {
                console.log(`[Chat] Using ${sessionDocuments.length} session documents from SessionDiscoveryService`);
                sessionDocuments.forEach((doc) => {
                    const documentContent = doc.content || doc.summary || `Dokument sesji: ${doc.title}`;
                    ragDocuments.push({
                        id: doc.id,
                        title: `[Sesja] ${doc.title}`,
                        content: documentContent,
                        relevanceScore: doc.similarity || 0.95,
                        metadata: {
                            documentType: doc.documentType,
                            isSessionDocument: true,
                        },
                    });
                });
            }
            // PRIORYTET 2: Dokumenty z wykrytego kontekstu dokumentu
            if (documentContext && documentContext.relevantChunks.length > 0) {
                // Użyj chunków z wykrytego dokumentu (nie pełnej treści!)
                console.log(`[Chat] Using ${documentContext.relevantChunks.length} chunks from detected document`);
                ragDocuments = [
                    {
                        id: documentContext.documentId,
                        title: documentContext.title,
                        content: documentContext.relevantChunks
                            .map((c) => c.content)
                            .join("\n\n---\n\n"),
                        relevanceScore: 1.0,
                        metadata: { documentType: documentContext.documentType },
                    },
                ];
                // Dodaj powiązane dokumenty i załączniki (tylko metadane)
                documentContext.relatedDocuments.forEach((doc) => {
                    ragDocuments.push({
                        id: doc.id,
                        title: `[Powiązany] ${doc.title}`,
                        content: doc.summary || `Dokument typu: ${doc.documentType}`,
                        relevanceScore: doc.similarity,
                        metadata: { documentType: doc.documentType, isRelated: true },
                    });
                });
                documentContext.attachments.forEach((att) => {
                    ragDocuments.push({
                        id: att.id,
                        title: `[Załącznik] ${att.title}`,
                        content: att.summary || `Załącznik typu: ${att.documentType}`,
                        relevanceScore: 1.0,
                        metadata: { documentType: att.documentType, isAttachment: true },
                    });
                });
            }
            else {
                // Standardowy RAG z wyszukiwania semantycznego
                ragDocuments =
                    ragContext?.documents.map((doc) => ({
                        id: doc.id,
                        title: doc.title,
                        content: doc.content,
                        relevanceScore: doc.relevanceScore,
                        metadata: doc.metadata,
                    })) || [];
            }
            const ragMunicipalData = ragContext?.municipalData.map((item) => ({
                id: item.id,
                title: item.title,
                content: item.content,
                relevanceScore: item.relevanceScore,
                metadata: { dataType: item.dataType },
            })) || [];
            // Przygotuj historię konwersacji
            const conversationHistory = (history || []).map((msg) => ({
                role: msg.role,
                content: msg.content,
            }));
            // Optymalizuj kontekst z kompresją
            const optimized = optimizeContext(systemPrompt, ragDocuments, ragMunicipalData, conversationHistory, message, model, 2000);
            // Log oszczędności
            console.log(`[Chat] Context optimization:`, {
                originalTokens: optimized.savings.originalTokens,
                compressedTokens: optimized.savings.compressedTokens,
                savedTokens: optimized.savings.savedTokens,
                savingsPercent: `${optimized.savings.savingsPercent}%`,
                model,
            });
            // Przygotuj kontekst dla AI
            const messages = [
                {
                    role: "system",
                    content: optimized.systemPrompt,
                },
            ];
            // Dodaj skompresowany kontekst RAG jeśli dostępny
            if (optimized.ragContextMessage) {
                messages.push({
                    role: "system",
                    content: optimized.ragContextMessage,
                });
            }
            // Dodaj skompresowaną historię konwersacji
            if (optimized.historyMessages.length > 0) {
                optimized.historyMessages.forEach((msg) => {
                    messages.push({
                        role: msg.role,
                        content: msg.content,
                    });
                });
            }
            // Dodaj aktualną wiadomość użytkownika
            messages.push({
                role: "user",
                content: optimized.userMessage,
            });
            // Wywołaj AI z konfiguracją użytkownika
            const clientConfig = {
                apiKey: apiKey,
                baseURL: baseUrl,
            };
            // Google Gemini native API używa x-goog-api-key
            if (provider === "google" && baseUrl && !baseUrl.includes("/openai")) {
                clientConfig.defaultHeaders = {
                    "x-goog-api-key": apiKey,
                };
                clientConfig.apiKey = "dummy"; // OpenAI client wymaga apiKey, ale nie jest używany
            }
            const openai = new OpenAI(clientConfig);
            // Użyj max_completion_tokens dla nowych modeli OpenAI, max_tokens dla starszych
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const completionParams = {
                model: model,
                messages,
                temperature: temperature || 0.7,
            };
            // Nowe modele OpenAI używają max_completion_tokens
            // Wszystkie modele gpt-4o* (gpt-4o, gpt-4o-mini) i gpt-4-turbo
            if (model.includes("gpt-4o") ||
                model.includes("gpt-4-turbo") ||
                model.includes("o1")) {
                completionParams.max_completion_tokens = 2000;
            }
            else {
                completionParams.max_tokens = 2000;
            }
            // Log przed wywołaniem API
            console.log(`[Chat] Calling LLM with ${messages.length} messages, model: ${model}`);
            console.log(`[Chat] Estimated total tokens: ${optimized.totalTokens}`);
            const completion = await openai.chat.completions.create(completionParams);
            const aiResponse = completion.choices[0]?.message?.content ||
                "Przepraszam, nie mogę wygenerować odpowiedzi.";
            // Przygotuj cytaty
            const citations = [];
            if (ragContext) {
                ragContext.documents.forEach((doc) => {
                    citations.push({
                        documentId: doc.id,
                        documentTitle: doc.title || "Bez tytułu",
                        text: (doc.content || "").substring(0, 200) + "...",
                        relevanceScore: doc.relevanceScore,
                    });
                });
                ragContext.municipalData.forEach((item) => {
                    citations.push({
                        documentTitle: `${item.title || "Bez tytułu"} (${item.dataType})`,
                        text: (item.content || "").substring(0, 200) + "...",
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
            // Zwróć odpowiedź - zawsze z message zawierającym id
            return reply.send({
                conversationId: currentConversationId,
                message: aiMessage || {
                    id: `temp-${Date.now()}`,
                    conversationId: currentConversationId,
                    role: "assistant",
                    content: aiResponse,
                    citations: citations,
                    createdAt: new Date().toISOString(),
                },
                relatedDocuments: ragContext?.documents.map((doc) => ({
                    id: doc.id,
                    title: doc.title,
                    relevanceScore: doc.relevanceScore,
                })),
            });
        }
        catch (error) {
            if (error instanceof ZodError) {
                console.error("[Chat] Zod validation error:", JSON.stringify(error.issues, null, 2));
                console.error("[Chat] Request body was:", JSON.stringify(request.body, null, 2));
                return reply
                    .status(400)
                    .send({ error: "Validation error", details: error.issues });
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error("[Chat] Error:", errorMessage);
            if (errorStack) {
                console.error("[Chat] Stack:", errorStack);
            }
            // Obsługa błędu wyczerpania limitu OpenAI (429)
            if (errorMessage.includes("exceeded your current quota") ||
                errorMessage.includes("insufficient_quota") ||
                errorMessage.includes("429")) {
                return reply.status(402).send({
                    error: "QUOTA_EXCEEDED",
                    message: "Wyczerpano limit API OpenAI. Doładuj konto lub zmień klucz API.",
                    details: "Twój klucz API OpenAI wyczerpał dostępny limit. Aby kontynuować korzystanie z Asystenta AI, musisz doładować konto OpenAI.",
                    billingUrl: "https://platform.openai.com/account/billing/overview",
                    settingsUrl: "/settings/api",
                });
            }
            // Obsługa błędu nieprawidłowego klucza API
            if (errorMessage.includes("invalid_api_key") ||
                errorMessage.includes("Incorrect API key")) {
                return reply.status(401).send({
                    error: "INVALID_API_KEY",
                    message: "Nieprawidłowy klucz API OpenAI.",
                    details: "Sprawdź poprawność klucza API w ustawieniach.",
                    settingsUrl: "/settings/api",
                });
            }
            return reply.status(500).send({
                error: "CHAT_ERROR",
                message: "Nie udało się przetworzyć wiadomości.",
                details: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
    // GET /api/chat/conversations - Pobierz listę konwersacji z ostatnią wiadomością
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
            // Dla każdej konwersacji pobierz ostatnią wiadomość i liczbę wiadomości
            const conversationsWithDetails = await Promise.all((conversations || []).map(async (conv) => {
                // Pobierz ostatnią wiadomość
                const { data: lastMessage } = await supabase
                    .from("messages")
                    .select("content, created_at, role")
                    .eq("conversation_id", conv.id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .single();
                // Policz wiadomości
                const { count } = await supabase
                    .from("messages")
                    .select("*", { count: "exact", head: true })
                    .eq("conversation_id", conv.id);
                return {
                    ...conv,
                    lastMessage: lastMessage?.content || null,
                    lastMessageAt: lastMessage?.created_at || conv.updated_at,
                    lastMessageRole: lastMessage?.role || null,
                    messageCount: count || 0,
                };
            }));
            return reply.send({ conversations: conversationsWithDetails });
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
                console.log("[DELETE] Unauthorized - no user ID");
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const { id } = request.params;
            console.log("[DELETE] Deleting conversation:", { id, userId });
            const { error } = await supabase
                .from("conversations")
                .delete()
                .eq("id", id)
                .eq("user_id", userId);
            if (error) {
                console.error("[DELETE] Supabase error:", error);
                throw error;
            }
            console.log("[DELETE] Successfully deleted conversation:", id);
            return reply.send({ success: true });
        }
        catch (error) {
            fastify.log.error("Error deleting conversation:", error);
            console.error("[DELETE] Full error:", error);
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
            let openaiApiKey = undefined;
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
            let openaiApiKey = undefined;
            let openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
            let openaiBaseUrl = undefined;
            if (apiConfig) {
                openaiApiKey = Buffer.from(apiConfig.api_key_encrypted, "base64").toString("utf-8");
                openaiModel = apiConfig.model_name || openaiModel;
                openaiBaseUrl = apiConfig.base_url || undefined;
            }
            if (!openaiApiKey) {
                return reply.status(400).send({
                    error: "Brak konfiguracji OpenAI. Dodaj klucz API w ustawieniach.",
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
                match_threshold: 0.3,
                match_count: 30,
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const summaryParams = {
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
            };
            // Użyj max_completion_tokens dla nowych modeli OpenAI
            if (openaiModel.includes("gpt-4o") ||
                openaiModel.includes("gpt-4-turbo") ||
                openaiModel.includes("o1")) {
                summaryParams.max_completion_tokens = 2000;
            }
            else {
                summaryParams.max_tokens = 2000;
            }
            const completion = await openai.chat.completions.create(summaryParams);
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
    // POST /api/fetch-models - Pobierz listę modeli z API providera
    fastify.post("/api/fetch-models", async (request, reply) => {
        try {
            const { provider, apiKey, baseUrl } = request.body;
            if (!provider || !apiKey) {
                return reply.status(400).send({
                    error: "Provider i klucz API są wymagane",
                });
            }
            // Domyślne URL dla providerów - tylko OpenAI API compatible
            const providerBaseUrls = {
                openai: "https://api.openai.com/v1",
                local: "http://localhost:11434/v1", // Ollama default
                other: "", // Custom endpoint
            };
            const finalBaseUrl = baseUrl || providerBaseUrls[provider];
            if (!finalBaseUrl) {
                return reply.status(400).send({
                    error: "Nieznany provider lub brak URL API",
                });
            }
            // Pobierz listę modeli z API
            const modelsUrl = `${finalBaseUrl.replace(/\/$/, "")}/models`;
            console.log(`[FetchModels] Fetching from: ${modelsUrl}`);
            // Różne providery używają różnych metod autoryzacji
            const headers = {
                "Content-Type": "application/json",
            };
            // Google Gemini używa x-goog-api-key dla native API
            if (provider === "google" && !finalBaseUrl.includes("/openai")) {
                headers["x-goog-api-key"] = apiKey;
            }
            else {
                // Pozostali providerzy używają Bearer token
                headers["Authorization"] = `Bearer ${apiKey}`;
            }
            const response = await fetch(modelsUrl, {
                method: "GET",
                headers: headers,
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[FetchModels] Error: ${response.status} - ${errorText}`);
                return reply.status(response.status).send({
                    error: `Błąd API: ${response.status}`,
                    details: errorText,
                });
            }
            const data = await response.json();
            // Różne providery zwracają różne formaty
            let models = [];
            // Google Gemini: { models: [{ name: "models/gemini-...", displayName: "..." }] }
            if (data.models && Array.isArray(data.models)) {
                models = data.models.map((m) => ({
                    id: m.name?.replace("models/", "") || m.displayName || "",
                    name: m.displayName || m.name?.replace("models/", "") || "",
                    owned_by: "google",
                }));
            }
            // OpenAI: { data: [{ id, object, ... }] }
            else if (data.data && Array.isArray(data.data)) {
                models = data.data.map((m) => ({
                    id: m.id,
                    name: m.name || m.id,
                    owned_by: m.owned_by,
                }));
            }
            // Inne formaty: bezpośrednia tablica
            else if (Array.isArray(data)) {
                models = data.map((m) => ({
                    id: m.id || m.model || m.name || "",
                    name: m.name || m.id || m.model || "",
                }));
            }
            // Filtruj i sortuj modele - preferuj chat/completion modele
            const chatModels = models.filter((m) => {
                const id = m.id.toLowerCase();
                // Wyklucz modele embedding, whisper, dall-e, tts
                return (!id.includes("embedding") &&
                    !id.includes("whisper") &&
                    !id.includes("dall-e") &&
                    !id.includes("tts") &&
                    !id.includes("moderation"));
            });
            // Sortuj - najnowsze/najlepsze na górze
            chatModels.sort((a, b) => {
                const aId = a.id.toLowerCase();
                const bId = b.id.toLowerCase();
                // Priorytet dla najnowszych modeli
                if (aId.includes("gpt-4o") && !bId.includes("gpt-4o"))
                    return -1;
                if (bId.includes("gpt-4o") && !aId.includes("gpt-4o"))
                    return 1;
                if (aId.includes("gpt-4") && !bId.includes("gpt-4"))
                    return -1;
                if (bId.includes("gpt-4") && !aId.includes("gpt-4"))
                    return 1;
                if (aId.includes("gemini-2") && !bId.includes("gemini-2"))
                    return -1;
                if (bId.includes("gemini-2") && !aId.includes("gemini-2"))
                    return 1;
                if (aId.includes("claude-3") && !bId.includes("claude-3"))
                    return -1;
                if (bId.includes("claude-3") && !aId.includes("claude-3"))
                    return 1;
                return a.id.localeCompare(b.id);
            });
            console.log(`[FetchModels] Found ${chatModels.length} chat models`);
            return reply.send({
                success: true,
                models: chatModels,
                total: chatModels.length,
            });
        }
        catch (error) {
            console.error("[FetchModels] Error:", error);
            return reply.status(500).send({
                error: "Nie udało się pobrać listy modeli",
                details: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });
};
//# sourceMappingURL=chat.js.map
//# sourceMappingURL=chat.js.map