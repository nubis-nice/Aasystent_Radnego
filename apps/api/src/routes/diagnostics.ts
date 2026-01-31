import { FastifyPluginAsync } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { getEmbeddingsClient, getAIConfig } from "../ai/index.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface DiagnosticStatus {
  status: "healthy" | "degraded" | "error";
  message: string;
}

interface RAGDiagnostic extends DiagnosticStatus {
  documentsCount: number;
  embeddingsCount: number;
  lastIndexed: string | null;
}

interface ResearchDiagnostic extends DiagnosticStatus {
  providers: Record<string, boolean>;
  totalProviders: number;
  activeProviders: number;
}

interface TranscriptionDiagnostic extends DiagnosticStatus {
  model: string;
}

interface EmbeddingDiagnostic extends DiagnosticStatus {
  model: string;
  dimensions: number;
}

interface ReasoningEngineDiagnostics {
  rag: RAGDiagnostic;
  research: ResearchDiagnostic;
  transcription: TranscriptionDiagnostic;
  embedding: EmbeddingDiagnostic;
}

export const diagnosticsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/diagnostics/reindex-embeddings
   * Przeindeksowuje dokumenty - generuje embeddingi dla dokumentów bez nich
   */
  fastify.post("/diagnostics/reindex-embeddings", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { batchSize = 10 } = request.body as { batchSize?: number };

      // Pobierz klienta embeddingów
      const embeddingsClient = await getEmbeddingsClient(userId);
      const embConfig = await getAIConfig(userId, "embeddings");

      if (!embeddingsClient) {
        return reply
          .status(500)
          .send({ error: "Nie można zainicjalizować klienta embeddingów" });
      }

      // Pobierz dokumenty bez embeddingów
      const { data: docsWithoutEmbeddings, error: fetchError } = await supabase
        .from("processed_documents")
        .select("id, title, content")
        .eq("user_id", userId)
        .is("embedding", null)
        .limit(batchSize);

      if (fetchError) {
        return reply.status(500).send({ error: fetchError.message });
      }

      if (!docsWithoutEmbeddings || docsWithoutEmbeddings.length === 0) {
        return reply.send({
          success: true,
          processed: 0,
          message: "Wszystkie dokumenty mają embeddingi",
        });
      }

      let processed = 0;
      let errors: string[] = [];

      for (const doc of docsWithoutEmbeddings) {
        try {
          // nomic-embed-text ma limit ~2000 tokenów (~4000 znaków)
          const textToEmbed = `${doc.title || ""}\n\n${
            doc.content || ""
          }`.slice(0, 4000);

          const embeddingResponse = await embeddingsClient.embeddings.create({
            model: embConfig.modelName,
            input: textToEmbed,
          });

          const embedding = embeddingResponse.data[0].embedding;

          const { error: updateError } = await supabase
            .from("processed_documents")
            .update({ embedding })
            .eq("id", doc.id);

          if (updateError) {
            errors.push(`${doc.title}: ${updateError.message}`);
          } else {
            processed++;
          }
        } catch (err) {
          errors.push(
            `${doc.title}: ${
              err instanceof Error ? err.message : "Unknown error"
            }`,
          );
        }
      }

      // Policz pozostałe dokumenty bez embeddingów
      const { count: remaining } = await supabase
        .from("processed_documents")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("embedding", null);

      return reply.send({
        success: true,
        processed,
        remaining: remaining || 0,
        errors: errors.length > 0 ? errors : undefined,
        model: embConfig.modelName,
      });
    } catch (error) {
      console.error("[Diagnostics] Reindex error:", error);
      return reply.status(500).send({
        error: "Błąd reindeksacji",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /api/diagnostics/reasoning-engine
   * Sprawdza status wszystkich komponentów Reasoning Engine
   */
  fastify.get("/diagnostics/reasoning-engine", async (request, reply) => {
    try {
      // Pobierz userId z nagłówka ustawionego przez authMiddleware
      const userId = request.headers["x-user-id"] as string;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Sprawdź status RAG
      const ragDiagnostic = await checkRAGStatus(userId);

      // Sprawdź status Research providers
      const researchDiagnostic = await checkResearchStatus(userId);

      // Sprawdź status Transcription
      const transcriptionDiagnostic = await checkTranscriptionStatus(userId);

      // Sprawdź status Embedding
      const embeddingDiagnostic = await checkEmbeddingStatus(userId);

      const diagnostics: ReasoningEngineDiagnostics = {
        rag: ragDiagnostic,
        research: researchDiagnostic,
        transcription: transcriptionDiagnostic,
        embedding: embeddingDiagnostic,
      };

      return reply.send(diagnostics);
    } catch (error) {
      console.error("[Diagnostics] Error:", error);
      return reply.status(500).send({
        error: "Failed to get diagnostics",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
};

/**
 * Sprawdza status systemu RAG
 */
async function checkRAGStatus(userId: string): Promise<RAGDiagnostic> {
  try {
    // Policz wszystkie dokumenty użytkownika
    const { count: totalDocs, error: countError } = await supabase
      .from("processed_documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) {
      return {
        status: "error",
        message: `Database error: ${countError.message}`,
        documentsCount: 0,
        embeddingsCount: 0,
        lastIndexed: null,
      };
    }

    // Policz dokumenty z embeddingami
    const { count: docsWithEmbeddings, error: embError } = await supabase
      .from("processed_documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("embedding", "is", null);

    if (embError) {
      return {
        status: "error",
        message: `Database error: ${embError.message}`,
        documentsCount: totalDocs || 0,
        embeddingsCount: 0,
        lastIndexed: null,
      };
    }

    // Pobierz ostatnio zindeksowany dokument
    const { data: lastDoc } = await supabase
      .from("processed_documents")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const documentsCount = totalDocs || 0;
    const embeddingsCount = docsWithEmbeddings || 0;
    const lastIndexed = lastDoc?.created_at || null;

    // Określ status
    let status: "healthy" | "degraded" | "error";
    let message: string;

    if (documentsCount === 0) {
      status = "degraded";
      message = "Brak dokumentów w bazie RAG";
    } else if (embeddingsCount === 0) {
      status = "error";
      message = "Dokumenty bez embeddingów - RAG nie działa";
    } else if (embeddingsCount < documentsCount) {
      status = "degraded";
      message = `${
        documentsCount - embeddingsCount
      } dokumentów bez embeddingów`;
    } else {
      status = "healthy";
      message = `RAG działa poprawnie - ${documentsCount} dokumentów`;
    }

    return {
      status,
      message,
      documentsCount,
      embeddingsCount,
      lastIndexed,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      documentsCount: 0,
      embeddingsCount: 0,
      lastIndexed: null,
    };
  }
}

/**
 * Sprawdza status providerów Research
 */
async function checkResearchStatus(
  userId: string,
): Promise<ResearchDiagnostic> {
  type ProviderRow = {
    provider: string | null;
    is_active: boolean | null;
  };

  try {
    // Najpierw pobierz konfiguracje semantic search
    const { data: semanticConfigs, error: semanticError } = await supabase
      .from("api_configurations")
      .select("provider, is_active, config_type")
      .eq("user_id", userId)
      .eq("config_type", "semantic");

    if (semanticError) {
      return {
        status: "error",
        message: `Database error: ${semanticError.message}`,
        providers: {},
        totalProviders: 0,
        activeProviders: 0,
      };
    }

    let providerConfigs = (semanticConfigs || []) as ProviderRow[];

    // Fallback dla starszych konfiguracji, które mogły nie mieć typu "semantic"
    if (providerConfigs.length === 0) {
      const { data: legacyConfigs, error: legacyError } = await supabase
        .from("api_configurations")
        .select("provider, is_active")
        .eq("user_id", userId)
        .is("config_type", null)
        .in("provider", ["exa", "tavily", "serper"]);

      if (legacyError) {
        return {
          status: "error",
          message: `Database error: ${legacyError.message}`,
          providers: {},
          totalProviders: 0,
          activeProviders: 0,
        };
      }

      providerConfigs = (legacyConfigs || []) as ProviderRow[];
    }

    if (providerConfigs.length === 0) {
      return {
        status: "error",
        message: "Brak skonfigurowanych wyszukiwarek semantycznych",
        providers: {},
        totalProviders: 0,
        activeProviders: 0,
      };
    }

    const providers = providerConfigs.reduce<Record<string, boolean>>(
      (acc, config) => {
        const providerName = config.provider?.toLowerCase();
        if (!providerName) return acc;

        if (!(providerName in acc)) {
          acc[providerName] = Boolean(config.is_active);
        } else if (config.is_active) {
          acc[providerName] = true;
        }

        return acc;
      },
      {},
    );

    const totalProviders = Object.keys(providers).length;
    const activeProviders = Object.values(providers).filter(Boolean).length;

    if (totalProviders === 0) {
      return {
        status: "error",
        message: "Brak skonfigurowanych wyszukiwarek semantycznych",
        providers: {},
        totalProviders: 0,
        activeProviders: 0,
      };
    }

    let status: "healthy" | "degraded" | "error";
    let message: string;

    if (activeProviders === 0) {
      status = "error";
      message = "Brak aktywnych providerów semantic search";
    } else if (activeProviders === 1) {
      status = "degraded";
      message = "Tylko jeden provider semantic search jest aktywny";
    } else {
      status = "healthy";
      message = `${activeProviders}/${totalProviders} providerów semantic search aktywnych`;
    }

    return {
      status,
      message,
      providers,
      totalProviders,
      activeProviders,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      providers: {},
      totalProviders: 0,
      activeProviders: 0,
    };
  }
}

/**
 * Sprawdza status modelu transkrypcji
 */
async function checkTranscriptionStatus(
  userId: string,
): Promise<TranscriptionDiagnostic> {
  try {
    // Pobierz domyślną konfigurację API
    const { data: config, error } = await supabase
      .from("api_configurations")
      .select("transcription_model, is_active")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();

    if (error || !config) {
      return {
        status: "error",
        message: "Brak konfiguracji API",
        model: "unknown",
      };
    }

    const model = config.transcription_model || "whisper-1";

    if (!config.is_active) {
      return {
        status: "degraded",
        message: "Konfiguracja API nieaktywna",
        model,
      };
    }

    return {
      status: "healthy",
      message: `Model transkrypcji: ${model}`,
      model,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      model: "unknown",
    };
  }
}

/**
 * Sprawdza status modelu embedding
 */
async function checkEmbeddingStatus(
  userId: string,
): Promise<EmbeddingDiagnostic> {
  try {
    // Pobierz domyślną konfigurację API
    const { data: config, error } = await supabase
      .from("api_configurations")
      .select("embedding_model, is_active")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();

    if (error || !config) {
      return {
        status: "error",
        message: "Brak konfiguracji API",
        model: "unknown",
        dimensions: 0,
      };
    }

    const model = config.embedding_model || "text-embedding-3-small";

    // Określ wymiary na podstawie modelu
    let dimensions = 1536; // Domyślnie dla text-embedding-3-small i ada-002
    if (model === "text-embedding-3-large") {
      dimensions = 3072;
    }

    if (!config.is_active) {
      return {
        status: "degraded",
        message: "Konfiguracja API nieaktywna",
        model,
        dimensions,
      };
    }

    return {
      status: "healthy",
      message: `Model embedding: ${model} (${dimensions} dim)`,
      model,
      dimensions,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      model: "unknown",
      dimensions: 0,
    };
  }
}
