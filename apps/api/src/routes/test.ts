import { FastifyInstance } from "fastify";
import { Buffer } from "node:buffer";
import { ProviderRegistry } from "../providers/index.js";
import { decryptApiKey } from "../utils/encryption.js";
import { supabase } from "../lib/supabase.js";
import {
  ProviderConfig,
  TestResult,
  ChatMessage,
} from "@aasystent-radnego/shared";

/**
 * Test Routes
 * New endpoints for testing provider connections
 */
export async function testRoutes(fastify: FastifyInstance) {
  // POST /api/test/connection - Basic connection test
  fastify.post<{
    Body: {
      config_id?: string;
      provider?: string;
      api_key?: string;
      base_url?: string;
      auth_method?: string;
    };
  }>("/test/connection", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { config_id, provider, api_key, base_url, auth_method } =
        request.body;

      let config: ProviderConfig;

      if (config_id) {
        // Test existing configuration
        const { data: dbConfig, error } = await supabase
          .from("api_configurations")
          .select("*")
          .eq("id", config_id)
          .eq("user_id", userId)
          .single();

        if (error || !dbConfig) {
          return reply.status(404).send({ error: "Configuration not found" });
        }

        // Obsługa starych kluczy base64 i nowych AES-256-GCM
        let decryptedKey: string;
        if (dbConfig.encryption_iv && dbConfig.encryption_iv.length > 0) {
          // Nowy format - AES-256-GCM
          decryptedKey = decryptApiKey(
            dbConfig.api_key_encrypted,
            dbConfig.encryption_iv,
          );
        } else {
          // Stary format - base64
          decryptedKey = Buffer.from(
            dbConfig.api_key_encrypted,
            "base64",
          ).toString("utf-8");
        }

        // Pobierz domyślny base_url jeśli nie jest ustawiony
        let baseUrl = dbConfig.base_url;
        if (!baseUrl || baseUrl.trim() === "") {
          const { data: capability } = await supabase
            .from("provider_capabilities")
            .select("default_base_url")
            .eq("provider", dbConfig.provider)
            .single();

          baseUrl = capability?.default_base_url || "";
        }

        config = {
          provider: dbConfig.provider,
          apiKey: decryptedKey,
          baseUrl: baseUrl,
          chatEndpoint: dbConfig.chat_endpoint || undefined,
          embeddingsEndpoint: dbConfig.embeddings_endpoint || undefined,
          modelsEndpoint: dbConfig.models_endpoint || undefined,
          modelName: dbConfig.model_name || undefined,
          embeddingModel: dbConfig.embedding_model || undefined,
          authMethod: dbConfig.auth_method || "bearer",
          customHeaders: dbConfig.custom_headers || undefined,
          timeoutSeconds: dbConfig.timeout_seconds || 30,
          maxRetries: dbConfig.max_retries || 3,
        };
      } else if (provider && api_key && base_url) {
        // Test new configuration
        config = {
          provider: provider as any,
          apiKey: api_key,
          baseUrl: base_url,
          authMethod: (auth_method as any) || "bearer",
          timeoutSeconds: 30,
          maxRetries: 3,
        };
      } else {
        return reply.status(400).send({ error: "Missing required parameters" });
      }

      // Check if provider is semantic search (no adapter needed)
      const semanticProviders = ["exa", "perplexity", "tavily", "brave"];
      let result: TestResult;

      if (semanticProviders.includes(config.provider)) {
        // Simple connectivity test for semantic search providers
        try {
          // Brave uses different endpoint and auth header
          const isBrave = config.provider === "brave";
          const testUrl = isBrave
            ? `${config.baseUrl}/res/v1/web/search?q=test&count=1`
            : `${config.baseUrl}/search`;
          const startTime = Date.now();

          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Accept: "application/json",
          };

          // Brave uses X-Subscription-Token, others use Authorization Bearer
          if (isBrave) {
            headers["X-Subscription-Token"] = config.apiKey;
            headers["Accept-Encoding"] = "gzip";
          } else {
            headers["Authorization"] = `Bearer ${config.apiKey}`;
          }

          const response = await globalThis.fetch(testUrl, {
            method: isBrave ? "GET" : "POST",
            headers,
            body: isBrave
              ? undefined
              : JSON.stringify({ query: "test", num_results: 1 }),
          });

          const responseTime = Date.now() - startTime;

          if (response.ok || response.status === 400) {
            // 400 is OK - means API is reachable, just bad request format
            result = {
              test_type: "connection",
              status: "success",
              response_time_ms: responseTime,
              error_message: null,
              error_details: null,
              tested_at: new Date().toISOString(),
            };
          } else {
            result = {
              test_type: "connection",
              status: "error",
              response_time_ms: responseTime,
              error_message: `HTTP ${response.status}: ${response.statusText}`,
              error_details: null,
              tested_at: new Date().toISOString(),
            };
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          result = {
            test_type: "connection",
            status: "error",
            response_time_ms: 0,
            error_message: err.message,
            error_details: null,
            tested_at: new Date().toISOString(),
          };
        }
      } else {
        // Use adapter for AI providers
        const adapter = ProviderRegistry.getAdapter(config);
        result = await adapter.testConnection();
      }

      // Save test result if config_id provided
      if (config_id) {
        await supabase.from("api_test_history").insert({
          config_id,
          test_type: result.test_type,
          status: result.status,
          response_time_ms: result.response_time_ms,
          error_message: result.error_message,
          error_details: result.error_details,
        });

        // Update configuration status
        await supabase
          .from("api_configurations")
          .update({
            connection_status:
              result.status === "success" ? "working" : "failed",
            last_test_at: new Date().toISOString(),
            last_test_result: result,
          })
          .eq("id", config_id);
      }

      return reply.send({ result });
    } catch (error: any) {
      fastify.log.error(
        {
          error: error,
          stack: error.stack,
          message: error.message,
          name: error.name,
          code: error.code,
        },
        "Connection test error",
      );
      return reply.status(500).send({
        error: "Test failed",
        message: error.message,
        details: error.stack,
      });
    }
  });

  // POST /api/test/chat - Test chat completion
  fastify.post<{
    Body: {
      config_id: string;
      message?: string;
    };
  }>("/test/chat", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { config_id, message = "Hello, this is a test message." } =
        request.body;

      const { data: dbConfig, error } = await supabase
        .from("api_configurations")
        .select("*")
        .eq("id", config_id)
        .eq("user_id", userId)
        .single();

      if (error || !dbConfig) {
        return reply.status(404).send({ error: "Configuration not found" });
      }

      const decryptedKey = decryptApiKey(
        dbConfig.api_key_encrypted,
        dbConfig.encryption_iv || "",
      );

      const config: ProviderConfig = {
        provider: dbConfig.provider,
        apiKey: decryptedKey,
        baseUrl: dbConfig.base_url || "",
        chatEndpoint: dbConfig.chat_endpoint || undefined,
        modelName: dbConfig.model_name || undefined,
        authMethod: dbConfig.auth_method || "bearer",
        customHeaders: dbConfig.custom_headers || undefined,
        timeoutSeconds: dbConfig.timeout_seconds || 30,
        maxRetries: dbConfig.max_retries || 3,
      };

      const adapter = ProviderRegistry.getAdapter(config);
      const startTime = Date.now();

      const messages: ChatMessage[] = [{ role: "user", content: message }];

      const response = await adapter.chat(messages, { max_tokens: 100 });

      const result: TestResult = {
        test_type: "chat",
        status: "success",
        response_time_ms: Date.now() - startTime,
        error_message: null,
        error_details: null,
        tested_at: new Date().toISOString(),
      };

      // Save test result
      await supabase.from("api_test_history").insert({
        config_id,
        test_type: result.test_type,
        status: result.status,
        response_time_ms: result.response_time_ms,
        error_message: result.error_message,
        error_details: result.error_details,
      });

      return reply.send({ result, response });
    } catch (error: any) {
      fastify.log.error(
        "Chat test error: " +
          String(error instanceof Error ? error.message : error),
      );

      const result: TestResult = {
        test_type: "chat",
        status: "failed",
        response_time_ms: null,
        error_message: error.message,
        error_details: { code: error.code, status: error.status },
        tested_at: new Date().toISOString(),
      };

      return reply.status(500).send({ result });
    }
  });

  // POST /api/test/embeddings - Test embeddings
  fastify.post<{
    Body: {
      config_id: string;
      text?: string;
    };
  }>("/test/embeddings", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { config_id, text = "Test embedding text" } = request.body;

      const { data: dbConfig, error } = await supabase
        .from("api_configurations")
        .select("*")
        .eq("id", config_id)
        .eq("user_id", userId)
        .single();

      if (error || !dbConfig) {
        return reply.status(404).send({ error: "Configuration not found" });
      }

      const decryptedKey = decryptApiKey(
        dbConfig.api_key_encrypted,
        dbConfig.encryption_iv || "",
      );

      const config: ProviderConfig = {
        provider: dbConfig.provider,
        apiKey: decryptedKey,
        baseUrl: dbConfig.base_url || "",
        embeddingsEndpoint: dbConfig.embeddings_endpoint || undefined,
        embeddingModel: dbConfig.embedding_model || undefined,
        authMethod: dbConfig.auth_method || "bearer",
        customHeaders: dbConfig.custom_headers || undefined,
        timeoutSeconds: dbConfig.timeout_seconds || 30,
        maxRetries: dbConfig.max_retries || 3,
      };

      const adapter = ProviderRegistry.getAdapter(config);
      const startTime = Date.now();

      const embedding = await adapter.embeddings(text);

      const result: TestResult = {
        test_type: "embeddings",
        status: "success",
        response_time_ms: Date.now() - startTime,
        error_message: null,
        error_details: null,
        tested_at: new Date().toISOString(),
      };

      // Save test result
      await supabase.from("api_test_history").insert({
        config_id,
        test_type: result.test_type,
        status: result.status,
        response_time_ms: result.response_time_ms,
        error_message: result.error_message,
        error_details: result.error_details,
      });

      return reply.send({
        result,
        embedding: {
          dimensions: embedding.length,
          sample: embedding.slice(0, 5),
        },
      });
    } catch (error: any) {
      fastify.log.error(
        "Embeddings test error: " +
          String(error instanceof Error ? error.message : error),
      );

      const result: TestResult = {
        test_type: "embeddings",
        status: "failed",
        response_time_ms: null,
        error_message: error.message,
        error_details: { code: error.code, status: error.status },
        tested_at: new Date().toISOString(),
      };

      return reply.status(500).send({ result });
    }
  });

  // POST /api/test/models - Test listing models
  fastify.post<{
    Body: {
      config_id: string;
    };
  }>("/test/models", async (request, reply) => {
    try {
      const userId = request.headers["x-user-id"] as string;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { config_id } = request.body;

      const { data: dbConfig, error } = await supabase
        .from("api_configurations")
        .select("*")
        .eq("id", config_id)
        .eq("user_id", userId)
        .single();

      if (error || !dbConfig) {
        return reply.status(404).send({ error: "Configuration not found" });
      }

      const decryptedKey = decryptApiKey(
        dbConfig.api_key_encrypted,
        dbConfig.encryption_iv || "",
      );

      const config: ProviderConfig = {
        provider: dbConfig.provider,
        apiKey: decryptedKey,
        baseUrl: dbConfig.base_url || "",
        modelsEndpoint: dbConfig.models_endpoint || undefined,
        authMethod: dbConfig.auth_method || "bearer",
        customHeaders: dbConfig.custom_headers || undefined,
        timeoutSeconds: dbConfig.timeout_seconds || 30,
        maxRetries: dbConfig.max_retries || 3,
      };

      const adapter = ProviderRegistry.getAdapter(config);
      const startTime = Date.now();

      const models = await adapter.listModels();

      const result: TestResult = {
        test_type: "models",
        status: "success",
        response_time_ms: Date.now() - startTime,
        error_message: null,
        error_details: null,
        tested_at: new Date().toISOString(),
      };

      // Save test result
      await supabase.from("api_test_history").insert({
        config_id,
        test_type: result.test_type,
        status: result.status,
        response_time_ms: result.response_time_ms,
        error_message: result.error_message,
        error_details: result.error_details,
      });

      return reply.send({ result, models });
    } catch (error: any) {
      fastify.log.error(
        "Models test error: " +
          String(error instanceof Error ? error.message : error),
      );

      const result: TestResult = {
        test_type: "models",
        status: "failed",
        response_time_ms: null,
        error_message: error.message,
        error_details: { code: error.code, status: error.status },
        tested_at: new Date().toISOString(),
      };

      return reply.status(500).send({ result });
    }
  });
}
