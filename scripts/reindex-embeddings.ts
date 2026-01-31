/**
 * Skrypt do reindeksacji embeddingów dokumentów
 * Używa dimensions: 1024 zgodnie z bazą danych
 * Pobiera konfigurację API z bazy danych (api_configurations)
 */

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// Wczytaj plik .env ręcznie
const envPath = path.join(process.cwd(), "apps", "api", ".env");
console.log(`[Reindex] Loading env from: ${envPath}`);
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars: Record<string, string> = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const encryptionKey =
  envVars.ENCRYPTION_KEY || "aasystent-radnego-encryption-key-2024";

console.log(`[Reindex] Supabase URL: ${supabaseUrl}`);

if (!supabaseUrl || !supabaseKey) {
  console.error("[Reindex] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Funkcja deszyfrowania klucza API (z apps/api/src/utils/encryption.ts)
function decryptApiKey(encryptedKey: string, iv: string): string {
  try {
    const [encrypted, authTag] = encryptedKey.split(":");
    if (!encrypted || !authTag) {
      throw new Error("Invalid encrypted key format");
    }
    const keyBuffer = crypto.scryptSync(encryptionKey, "salt", 32);
    const ivBuffer = Buffer.from(iv, "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      keyBuffer,
      ivBuffer,
    );
    decipher.setAuthTag(Buffer.from(authTag, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encryptedKey; // Fallback - może być niezaszyfrowany
  }
}

// Pobierz konfigurację API z bazy danych
async function getEmbeddingsConfig(userId: string) {
  const { data: config } = await supabase
    .from("api_configurations")
    .select("*")
    .eq("user_id", userId)
    .eq("function_type", "embeddings")
    .eq("is_active", true)
    .single();

  if (!config) {
    // Fallback do domyślnej konfiguracji
    const { data: defaultConfig } = await supabase
      .from("api_configurations")
      .select("*")
      .eq("function_type", "embeddings")
      .eq("is_default", true)
      .eq("is_active", true)
      .single();
    return defaultConfig;
  }
  return config;
}

async function reindexEmbeddings(userId: string, batchSize = 50) {
  console.log(`[Reindex] Starting reindexation for user: ${userId}`);

  // Pobierz konfigurację API z bazy danych
  const config = await getEmbeddingsConfig(userId);
  if (!config) {
    console.error("[Reindex] No embeddings API configuration found!");
    return;
  }

  // Odszyfruj klucz API
  const apiKey = config.api_key_iv
    ? decryptApiKey(config.api_key, config.api_key_iv)
    : config.api_key;

  console.log(`[Reindex] Using API: ${config.base_url || "OpenAI"}`);
  console.log(`[Reindex] Model: ${config.model_name}`);

  const openai = new OpenAI({
    apiKey,
    baseURL: config.base_url || undefined,
  });

  // Pobierz dokumenty bez embeddingów lub z embeddingami null
  const { data: docs, error: fetchError } = await supabase
    .from("processed_documents")
    .select("id, title, content, document_type")
    .eq("user_id", userId)
    .is("embedding", null)
    .limit(batchSize);

  if (fetchError) {
    console.error("[Reindex] Error fetching documents:", fetchError);
    return;
  }

  if (!docs || docs.length === 0) {
    console.log("[Reindex] No documents without embeddings found");
    return;
  }

  console.log(`[Reindex] Found ${docs.length} documents without embeddings`);

  let processed = 0;
  let errors = 0;

  for (const doc of docs) {
    try {
      const textToEmbed = `${doc.title || ""}\n\n${doc.content || ""}`.slice(
        0,
        8000,
      );

      if (textToEmbed.trim().length < 10) {
        console.log(`[Reindex] Skipping doc ${doc.id} - too short`);
        continue;
      }

      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: textToEmbed,
        dimensions: 1024, // Wymiar zgodny z bazą danych
      });

      const embedding = embeddingResponse.data[0].embedding;

      const { error: updateError } = await supabase
        .from("processed_documents")
        .update({ embedding })
        .eq("id", doc.id);

      if (updateError) {
        console.error(`[Reindex] Error updating doc ${doc.id}:`, updateError);
        errors++;
      } else {
        processed++;
        console.log(
          `[Reindex] ✓ ${processed}/${docs.length} - ${doc.document_type}: ${doc.title?.substring(0, 50)}...`,
        );
      }
    } catch (e) {
      console.error(`[Reindex] Error processing doc ${doc.id}:`, e);
      errors++;
    }
  }

  console.log(`\n[Reindex] Complete: ${processed} processed, ${errors} errors`);

  // Sprawdź ile dokumentów jeszcze wymaga reindeksacji
  const { count } = await supabase
    .from("processed_documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("embedding", null);

  if (count && count > 0) {
    console.log(`[Reindex] Remaining documents without embeddings: ${count}`);
    console.log("[Reindex] Run script again to process more...");
  }
}

// Uruchom reindeksację
const userId = process.argv[2] || "2a35546a-7b24-4631-882c-056e38129d92";
const batchSize = parseInt(process.argv[3] || "50");

reindexEmbeddings(userId, batchSize).catch(console.error);
