import { createOpenAIClient, extractTextFromImage, chunkText, generateEmbedding, } from "@aasystent-radnego/shared";
import fs from "fs/promises";
export async function processExtraction(job) {
    const { documentId, filePath, mimeType } = job.data;
    job.log(`Starting extraction for document ${documentId}`);
    await job.updateProgress(10);
    try {
        // 1. Wczytaj plik
        const fileBuffer = await fs.readFile(filePath);
        const fileBase64 = fileBuffer.toString("base64");
        await job.updateProgress(20);
        // 2. Ekstrakcja tekstu (multimodal LLM)
        const openai = createOpenAIClient();
        const extraction = await extractTextFromImage(openai, fileBase64, mimeType);
        job.log(`Extracted ${extraction.text.length} characters, quality: ${extraction.qualityScore}`);
        await job.updateProgress(50);
        // 3. Walidacja jakości
        if (extraction.qualityScore < 0.5) {
            throw new Error(`Low extraction quality: ${extraction.qualityScore}`);
        }
        // 4. Zapisz wynik ekstrakcji do bazy
        // TODO: Update document in database
        job.log(`Updating document ${documentId} with extracted text`);
        await job.updateProgress(60);
        // 5. Chunking
        const chunks = chunkText(extraction.text, 512, 50);
        job.log(`Created ${chunks.length} chunks`);
        await job.updateProgress(70);
        // 6. Generowanie embeddingów
        const embeddings = await Promise.all(chunks.map(async (chunk, index) => {
            const embedding = await generateEmbedding(openai, chunk);
            return {
                chunk_index: index,
                content: chunk,
                embedding,
                token_count: Math.ceil(chunk.length / 4), // Heurystyka
            };
        }));
        job.log(`Generated ${embeddings.length} embeddings`);
        await job.updateProgress(90);
        // 7. Zapisz chunki i embeddingi do bazy
        // TODO: Insert chunks into database
        job.log(`Saving chunks to database`);
        await job.updateProgress(100);
        return {
            documentId,
            extractedText: extraction.text,
            qualityScore: extraction.qualityScore,
            chunksCount: chunks.length,
            tokensUsed: extraction.metadata.tokensUsed,
        };
    }
    catch (error) {
        job.log(`Extraction failed: ${error}`);
        throw error;
    }
}
//# sourceMappingURL=extraction.js.map