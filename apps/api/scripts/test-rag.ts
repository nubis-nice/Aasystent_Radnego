import "dotenv/config";
import OpenAI from "openai";
import { Pool } from "pg";

const pool = new Pool({ connectionString: "postgresql://postgres:postgres@localhost:5433/postgres" });
const openai = new OpenAI({ apiKey: "ollama", baseURL: "http://localhost:11434/v1" });

async function main() {
  const query = process.argv[2] || "sesja rady miejskiej transkrypcja";
  console.log(`[RAG Test] Query: "${query}"\n`);

  const resp = await openai.embeddings.create({
    model: "nomic-embed-text:latest",
    input: query,
  });

  const embedding = `[${resp.data[0].embedding.join(",")}]`;

  const { rows } = await pool.query(`
    SELECT id, document_type, title, 
           1 - (embedding <=> $1::vector) as similarity 
    FROM processed_documents 
    WHERE embedding IS NOT NULL 
    ORDER BY embedding <=> $1::vector 
    LIMIT 10
  `, [embedding]);

  console.log("Top 10 RAG results:");
  rows.forEach((r: any, i: number) => {
    const sim = (r.similarity * 100).toFixed(1);
    console.log(`${i + 1}. [${sim}%] ${r.document_type}: ${r.title?.slice(0, 55)}...`);
  });

  // Sprawdź ile transkrypcji w top 10
  const transcriptions = rows.filter((r: any) => r.document_type === "transkrypcja");
  console.log(`\nTranskrypcje w top 10: ${transcriptions.length}`);

  await pool.end();
}

main().catch(console.error);
