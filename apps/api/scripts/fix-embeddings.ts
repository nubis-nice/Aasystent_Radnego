/**
 * Skrypt naprawy embeddingów - wymusza 1024 wymiarów używając OpenAI
 * Model bge-m3 z Ollama nie obsługuje dimensions, więc używamy OpenAI
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const userId = process.argv[2] || "2a35546a-7b24-4631-882c-056e38129d92";
const batchSize = parseInt(process.argv[3] || "50");

async function main() {
  console.log(`[FixEmbed] User: ${userId}`);

  // Pobierz klucz OpenAI z konfiguracji użytkownika
  const { data: config } = await supabase
    .from("api_configurations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "openai")
    .eq("is_active", true)
    .single();

  if (!config?.api_key) {
    console.error("[FixEmbed] No OpenAI API key found in api_configurations!");
    console.log("[FixEmbed] Please configure OpenAI in settings.");
    return;
  }

  const openai = new OpenAI({ apiKey: config.api_key });
  console.log("[FixEmbed] Using OpenAI text-embedding-3-small");

  // Pobierz wszystkie dokumenty (sprawdzimy wymiarowość)
  const { data: docs, error } = await supabase
    .from("processed_documents")
    .select("id, title, content, document_type, embedding")
    .eq("user_id", userId)
    .not("embedding", "is", null)
    .limit(batchSize);

  if (error) {
    console.error("[FixEmbed] Error:", error);
    return;
  }

  if (!docs?.length) {
    console.log("[FixEmbed] No documents found");
    return;
  }

  // Filtruj dokumenty ze złą wymiarowością
  const badDocs = docs.filter((d) => {
    const emb = d.embedding as number[] | null;
    return emb && emb.length !== 1024;
  });

  console.log(`[FixEmbed] Found ${badDocs.length}/${docs.length} docs with wrong dimensions`);

  if (!badDocs.length) {
    console.log("[FixEmbed] All documents have correct 1024 dimensions!");
    return;
  }

  let ok = 0, fail = 0;

  for (const doc of badDocs) {
    try {
      const text = `${doc.title || ""}\n\n${doc.content || ""}`.slice(0, 8000);
      if (text.trim().length < 10) continue;

      const resp = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        dimensions: 1024,
      });

      const { error: updateError } = await supabase
        .from("processed_documents")
        .update({ embedding: resp.data[0].embedding })
        .eq("id", doc.id);

      if (updateError) throw updateError;

      ok++;
      const dims = (doc.embedding as number[])?.length || 0;
      console.log(`[FixEmbed] ✓ ${ok}/${badDocs.length} ${doc.document_type} (${dims}→1024): ${doc.title?.slice(0, 35)}...`);
    } catch (e: any) {
      fail++;
      console.error(`[FixEmbed] ✗ ${doc.id}:`, e.message || e);
    }
  }

  console.log(`\n[FixEmbed] Done: ${ok} fixed, ${fail} failed`);

  // Sprawdź czy są jeszcze dokumenty do naprawy
  const { data: remaining } = await supabase
    .from("processed_documents")
    .select("id, embedding")
    .eq("user_id", userId)
    .not("embedding", "is", null);

  const stillBad = remaining?.filter((d) => {
    const emb = d.embedding as number[] | null;
    return emb && emb.length !== 1024;
  });

  if (stillBad?.length) {
    console.log(`[FixEmbed] Remaining with wrong dimensions: ${stillBad.length}`);
    console.log("[FixEmbed] Run script again to fix more...");
  }
}

main().catch(console.error);
