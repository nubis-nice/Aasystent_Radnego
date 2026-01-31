/**
 * Skrypt reindeksacji embeddingów - uruchom z katalogu apps/api
 * npx tsx scripts/reindex.ts
 */
import "dotenv/config";
import { getEmbeddingsClient, getAIConfig } from "../src/ai/index.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const userId = process.argv[2] || "2a35546a-7b24-4631-882c-056e38129d92";
const batchSize = parseInt(process.argv[3] || "50");

async function main() {
  console.log(`[Reindex] User: ${userId}, Batch: ${batchSize}`);

  // Pobierz klienta embeddingów i konfigurację
  const embeddingsClient = await getEmbeddingsClient(userId);
  const embConfig = await getAIConfig(userId, "embeddings");

  console.log(`[Reindex] Model: ${embConfig.modelName}`);

  // Pobierz dokumenty bez embeddingów
  const { data: docs, error } = await supabase
    .from("processed_documents")
    .select("id, title, content, document_type")
    .eq("user_id", userId)
    .is("embedding", null)
    .limit(batchSize);

  if (error) {
    console.error("[Reindex] Error:", error);
    return;
  }

  if (!docs?.length) {
    console.log("[Reindex] No documents without embeddings");
    return;
  }

  console.log(`[Reindex] Found ${docs.length} documents`);

  let ok = 0,
    fail = 0;

  for (const doc of docs) {
    try {
      // nomic-embed-text ma limit ~2000 tokenów, więc ograniczamy do 4000 znaków
      const text = `${doc.title || ""}\n\n${doc.content || ""}`.slice(0, 4000);
      if (text.trim().length < 10) continue;

      const resp = await embeddingsClient.embeddings.create({
        model: embConfig.modelName,
        input: text,
      });

      const { error: updateError } = await supabase
        .from("processed_documents")
        .update({ embedding: resp.data[0].embedding })
        .eq("id", doc.id);

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`);
      }

      ok++;
      console.log(
        `[Reindex] ✓ ${ok}/${docs.length} ${doc.document_type}: ${doc.title?.slice(0, 40)}...`,
      );
    } catch (e) {
      fail++;
      console.error(`[Reindex] ✗ ${doc.id}:`, e);
    }
  }

  console.log(`\n[Reindex] Done: ${ok} ok, ${fail} failed`);

  // Ile pozostało
  const { count } = await supabase
    .from("processed_documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("embedding", null);

  if (count) console.log(`[Reindex] Remaining: ${count}`);
}

main().catch(console.error);
