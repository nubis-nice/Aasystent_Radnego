import { Job } from "bullmq";
import {
  createOpenAIClient,
  extractTextFromImage,
  chunkText,
  generateEmbedding,
} from "@aasystent-radnego/shared";
import { supabase } from "../lib/supabase";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

interface ExtractionJobData {
  documentId: string;
  filePath: string;
  mimeType: string;
}

interface DocumentChunk {
  id?: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding: number[];
  token_count: number;
}

export async function processExtraction(job: Job<ExtractionJobData>) {
  const { documentId, filePath, mimeType } = job.data;

  job.log(`Starting extraction for document ${documentId}`);
  await job.updateProgress(10);

  try {
    // 1. Load file
    const fileBuffer = await fs.readFile(filePath);
    const fileBase64 = fileBuffer.toString("base64");

    await job.updateProgress(20);

    // 2. Extract text (multimodal LLM)
    const openai = createOpenAIClient();
    const extraction = await extractTextFromImage(openai, fileBase64, mimeType);

    job.log(
      `Extracted ${extraction.text.length} characters, quality: ${extraction.qualityScore}`
    );
    await job.updateProgress(50);

    // 3. Quality validation
    if (extraction.qualityScore < 0.5) {
      throw new Error(`Low extraction quality: ${extraction.qualityScore}`);
    }

    // 4. Update document in database with extracted text
    job.log(`Updating document ${documentId} with extracted text`);
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        extracted_text: extraction.text,
        extraction_quality: extraction.qualityScore,
        extraction_metadata: extraction.metadata,
        status: "extracted",
      })
      .eq("id", documentId);

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    await job.updateProgress(60);

    // 5. Chunking
    const chunks = chunkText(extraction.text, 512, 50);
    job.log(`Created ${chunks.length} chunks`);

    await job.updateProgress(70);

    // 6. Generate embeddings
    const embeddings: DocumentChunk[] = await Promise.all(
      chunks.map(async (chunk: string, index: number) => {
        const embedding = await generateEmbedding(openai, chunk);
        return {
          document_id: documentId,
          chunk_index: index,
          content: chunk,
          embedding,
          token_count: Math.ceil(chunk.length / 4), // Heuristic
        };
      })
    );

    job.log(`Generated ${embeddings.length} embeddings`);
    await job.updateProgress(90);

    // 7. Save chunks and embeddings to database
    job.log(`Saving ${chunks.length} chunks to database`);
    const { error: insertError } = await supabase
      .from("document_chunks")
      .insert(embeddings);

    if (insertError) {
      throw new Error(
        `Failed to insert chunks: ${insertError.message}`
      );
    }

    // Update document status to completed
    await supabase
      .from("documents")
      .update({ status: "indexed" })
      .eq("id", documentId);

    await job.updateProgress(100);

    return {
      documentId,
      extractedText: extraction.text,
      qualityScore: extraction.qualityScore,
      chunksCount: chunks.length,
      tokensUsed: extraction.metadata.tokensUsed,
    };
  } catch (error) {
    job.log(`Extraction failed: ${error}`);
    
    // Update document status to failed
    await supabase
      .from("documents")
      .update({
        status: "extraction_failed",
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq("id", documentId)
      .catch((err) => job.log(`Failed to update error status: ${err}`));

    throw error;
  }
}