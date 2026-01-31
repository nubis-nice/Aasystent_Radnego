/**
 * Reindeksacja z bezpośrednim SQL (omija cache Supabase)
 */
import "dotenv/config";
import { getEmbeddingsClient, getAIConfig } from "../src/ai/index.js";
import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://postgres:postgres@localhost:5433/postgres`,
});
const userId = process.argv[2] || "2a35546a-7b24-4631-882c-056e38129d92";
const batchSize = parseInt(process.argv[3] || "50");

async function main() {
  console.log(`[Reindex] User: ${userId}, Batch: ${batchSize}`);

  const embeddingsClient = await getEmbeddingsClient(userId);
  const embConfig = await getAIConfig(userId, "embeddings");
  console.log(`[Reindex] Model: ${embConfig.modelName}`);

  // Pobierz dokumenty bez embeddingów
  const { rows: docs } = await pool.query(
    `SELECT id, title, content, document_type FROM processed_documents 
     WHERE user_id = $1 AND embedding IS NULL LIMIT $2`,
    [userId, batchSize],
  );

  if (!docs.length) {
    console.log("[Reindex] No documents without embeddings");
    await pool.end();
    return;
  }

  console.log(`[Reindex] Found ${docs.length} documents`);
  let ok = 0,
    fail = 0;

  for (const doc of docs) {
    try {
      const text = `${doc.title || ""}\n\n${doc.content || ""}`.slice(0, 4000);
      if (text.trim().length < 10) continue;

      const resp = await embeddingsClient.embeddings.create({
        model: embConfig.modelName,
        input: text,
      });

      const embedding = resp.data[0].embedding;
      const embStr = `[${embedding.join(",")}]`;

      await pool.query(
        `UPDATE processed_documents SET embedding = $1::vector WHERE id = $2`,
        [embStr, doc.id],
      );

      ok++;
      console.log(
        `[Reindex] ✓ ${ok}/${docs.length} ${doc.document_type}: ${doc.title?.slice(0, 40)}...`,
      );
    } catch (e: any) {
      fail++;
      console.error(`[Reindex] ✗ ${doc.id}:`, e.message || e);
    }
  }

  console.log(`\n[Reindex] Done: ${ok} ok, ${fail} failed`);

  const {
    rows: [{ count }],
  } = await pool.query(
    `SELECT COUNT(*) as count FROM processed_documents WHERE user_id = $1 AND embedding IS NULL`,
    [userId],
  );
  if (parseInt(count) > 0) console.log(`[Reindex] Remaining: ${count}`);

  await pool.end();
}

main().catch(console.error);
