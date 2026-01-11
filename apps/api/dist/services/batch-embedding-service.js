/**
 * Batch Embedding Service
 *
 * Wykorzystuje OpenAI Batch API dla embeddingów dokumentów
 * - 50% niższe koszty vs synchroniczne API
 * - Osobna pula rate limits
 * - Przetwarzanie do 24h (zazwyczaj szybciej)
 *
 * Użycie: przetwarzanie dokumentów, indeksowanie, re-embedding
 * NIE używać dla: chat w czasie rzeczywistym (użyj sync API)
 */
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
const DEFAULT_OPTIONS = {
    model: "text-embedding-3-small",
    dimensions: 1536,
    maxRequestsPerBatch: 50000,
    pollIntervalMs: 30000, // 30 sekund
    maxWaitTimeMs: 24 * 60 * 60 * 1000, // 24 godziny
};
// ============================================================================
// BATCH EMBEDDING SERVICE
// ============================================================================
export class BatchEmbeddingService {
    client;
    options;
    constructor(apiKey, options = {}) {
        this.client = new OpenAI({ apiKey });
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    /**
     * Tworzy batch job dla embeddingów
     * Zwraca batchId do śledzenia statusu
     */
    async createBatchJob(requests) {
        if (requests.length === 0) {
            throw new Error("No requests provided");
        }
        if (requests.length > this.options.maxRequestsPerBatch) {
            throw new Error(`Too many requests: ${requests.length} > ${this.options.maxRequestsPerBatch}`);
        }
        console.log(`[BatchEmbedding] Creating batch job for ${requests.length} requests`);
        // 1. Przygotuj plik JSONL
        const jsonlContent = requests
            .map((req) => {
            return JSON.stringify({
                custom_id: req.customId,
                method: "POST",
                url: "/v1/embeddings",
                body: {
                    model: this.options.model,
                    input: req.text,
                    dimensions: this.options.dimensions,
                },
            });
        })
            .join("\n");
        // 2. Zapisz do pliku tymczasowego
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `batch_embedding_${Date.now()}.jsonl`);
        fs.writeFileSync(tempFile, jsonlContent);
        try {
            // 3. Upload pliku do OpenAI
            console.log(`[BatchEmbedding] Uploading batch file: ${tempFile}`);
            const file = await this.client.files.create({
                file: fs.createReadStream(tempFile),
                purpose: "batch",
            });
            console.log(`[BatchEmbedding] File uploaded: ${file.id}`);
            // 4. Utwórz batch job
            const batch = await this.client.batches.create({
                input_file_id: file.id,
                endpoint: "/v1/embeddings",
                completion_window: "24h",
                metadata: {
                    description: `Embedding batch: ${requests.length} documents`,
                    created_by: "batch-embedding-service",
                },
            });
            console.log(`[BatchEmbedding] Batch created: ${batch.id}, status: ${batch.status}`);
            return batch.id;
        }
        finally {
            // Cleanup temp file
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    }
    /**
     * Sprawdza status batch job
     */
    async getBatchStatus(batchId) {
        const batch = await this.client.batches.retrieve(batchId);
        return {
            batchId: batch.id,
            status: batch.status,
            totalRequests: batch.request_counts?.total || 0,
            completedRequests: batch.request_counts?.completed || 0,
            failedRequests: batch.request_counts?.failed || 0,
            createdAt: new Date(batch.created_at * 1000),
            completedAt: batch.completed_at
                ? new Date(batch.completed_at * 1000)
                : undefined,
            outputFileId: batch.output_file_id || undefined,
            errorFileId: batch.error_file_id || undefined,
        };
    }
    /**
     * Pobiera wyniki batch job
     */
    async getBatchResults(batchId) {
        const status = await this.getBatchStatus(batchId);
        if (status.status !== "completed") {
            throw new Error(`Batch not completed: ${status.status}`);
        }
        if (!status.outputFileId) {
            throw new Error("No output file available");
        }
        console.log(`[BatchEmbedding] Downloading results from: ${status.outputFileId}`);
        const fileResponse = await this.client.files.content(status.outputFileId);
        const fileContent = await fileResponse.text();
        const results = [];
        const lines = fileContent.split("\n").filter((line) => line.trim());
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                if (parsed.error) {
                    results.push({
                        customId: parsed.custom_id,
                        embedding: [],
                        error: parsed.error.message || "Unknown error",
                    });
                }
                else if (parsed.response?.body?.data?.[0]?.embedding) {
                    results.push({
                        customId: parsed.custom_id,
                        embedding: parsed.response.body.data[0].embedding,
                    });
                }
                else {
                    results.push({
                        customId: parsed.custom_id,
                        embedding: [],
                        error: "Invalid response format",
                    });
                }
            }
            catch (e) {
                console.error(`[BatchEmbedding] Failed to parse line: ${line}`, e);
            }
        }
        console.log(`[BatchEmbedding] Retrieved ${results.length} results`);
        return results;
    }
    /**
     * Anuluje batch job
     */
    async cancelBatch(batchId) {
        console.log(`[BatchEmbedding] Cancelling batch: ${batchId}`);
        await this.client.batches.cancel(batchId);
    }
    /**
     * Listuje wszystkie batch jobs
     */
    async listBatches(limit = 10) {
        const batches = await this.client.batches.list({ limit });
        const results = [];
        for await (const batch of batches) {
            results.push({
                batchId: batch.id,
                status: batch.status,
                totalRequests: batch.request_counts?.total || 0,
                completedRequests: batch.request_counts?.completed || 0,
                failedRequests: batch.request_counts?.failed || 0,
                createdAt: new Date(batch.created_at * 1000),
                completedAt: batch.completed_at
                    ? new Date(batch.completed_at * 1000)
                    : undefined,
                outputFileId: batch.output_file_id || undefined,
                errorFileId: batch.error_file_id || undefined,
            });
        }
        return results;
    }
    /**
     * Czeka na zakończenie batch job (polling)
     * Zwraca wyniki po zakończeniu
     */
    async waitForCompletion(batchId, onProgress) {
        const startTime = Date.now();
        while (true) {
            const status = await this.getBatchStatus(batchId);
            if (onProgress) {
                onProgress(status);
            }
            console.log(`[BatchEmbedding] Status: ${status.status}, ` +
                `completed: ${status.completedRequests}/${status.totalRequests}`);
            if (status.status === "completed") {
                return this.getBatchResults(batchId);
            }
            if (status.status === "failed" ||
                status.status === "cancelled" ||
                status.status === "expired") {
                throw new Error(`Batch failed with status: ${status.status}`);
            }
            // Check timeout
            if (Date.now() - startTime > this.options.maxWaitTimeMs) {
                throw new Error(`Batch timeout after ${this.options.maxWaitTimeMs}ms`);
            }
            // Wait before next poll
            await new Promise((resolve) => {
                const timer = globalThis.setTimeout(resolve, this.options.pollIntervalMs);
                return timer;
            });
        }
    }
    /**
     * Przetwarza dokumenty z automatycznym chunkowaniem
     * Dla dużych dokumentów dzieli na chunki i agreguje wyniki
     */
    async processDocuments(documents, maxChunkChars = 18000) {
        const requests = [];
        const documentChunks = new Map();
        // Przygotuj chunki dla każdego dokumentu
        for (const doc of documents) {
            const chunks = this.chunkText(doc.text, maxChunkChars);
            documentChunks.set(doc.id, []);
            for (let i = 0; i < chunks.length; i++) {
                const chunkId = `${doc.id}__chunk_${i}`;
                const docChunks = documentChunks.get(doc.id);
                if (docChunks)
                    docChunks.push(chunkId);
                const chunkText = chunks[i];
                if (chunkText) {
                    requests.push({
                        customId: chunkId,
                        text: chunkText,
                        metadata: doc.metadata,
                    });
                }
            }
        }
        console.log(`[BatchEmbedding] Processing ${documents.length} documents ` +
            `(${requests.length} total chunks)`);
        // Utwórz i czekaj na batch
        const batchId = await this.createBatchJob(requests);
        const results = await this.waitForCompletion(batchId);
        // Mapuj wyniki po customId
        const resultMap = new Map();
        for (const result of results) {
            if (!result.error && result.embedding.length > 0) {
                resultMap.set(result.customId, result.embedding);
            }
        }
        // Agreguj chunki do pojedynczych embeddingów per dokument
        const documentEmbeddings = new Map();
        for (const [docId, chunkIds] of documentChunks) {
            const chunkEmbeddings = [];
            for (const chunkId of chunkIds) {
                const embedding = resultMap.get(chunkId);
                if (embedding) {
                    chunkEmbeddings.push(embedding);
                }
            }
            if (chunkEmbeddings.length > 0) {
                // Agregacja: średnia ważona
                const aggregated = this.aggregateEmbeddings(chunkEmbeddings);
                documentEmbeddings.set(docId, aggregated);
            }
        }
        console.log(`[BatchEmbedding] Generated embeddings for ${documentEmbeddings.size} documents`);
        return documentEmbeddings;
    }
    /**
     * Dzieli tekst na chunki
     */
    chunkText(text, maxChars) {
        if (text.length <= maxChars) {
            return [text];
        }
        const chunks = [];
        const overlap = 500;
        let start = 0;
        while (start < text.length) {
            const end = Math.min(start + maxChars, text.length);
            let chunk = text.slice(start, end);
            if (end < text.length) {
                const lastPeriod = chunk.lastIndexOf(". ");
                const lastNewline = chunk.lastIndexOf("\n");
                const breakPoint = Math.max(lastPeriod, lastNewline);
                if (breakPoint > maxChars * 0.7) {
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
        return chunks;
    }
    /**
     * Agreguje wiele embeddingów do jednego (średnia ważona + normalizacja)
     */
    aggregateEmbeddings(embeddings) {
        if (embeddings.length === 0) {
            return [];
        }
        if (embeddings.length === 1) {
            return embeddings[0];
        }
        const firstEmbedding = embeddings[0];
        if (!firstEmbedding)
            return [];
        const dimensions = firstEmbedding.length;
        const aggregated = new Array(dimensions).fill(0);
        // Średnia
        for (const embedding of embeddings) {
            for (let i = 0; i < dimensions; i++) {
                aggregated[i] += embedding[i];
            }
        }
        for (let i = 0; i < dimensions; i++) {
            aggregated[i] /= embeddings.length;
        }
        // Normalizacja L2
        const norm = Math.sqrt(aggregated.reduce((sum, val) => sum + val * val, 0));
        return aggregated.map((val) => val / norm);
    }
}
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
/**
 * Szacuje koszt batch embeddingu
 * Batch API: 50% taniej niż sync
 */
export function estimateBatchCost(totalTokens, model = "text-embedding-3-small") {
    // Ceny per 1M tokenów (styczeń 2026)
    const prices = {
        "text-embedding-3-small": 0.02,
        "text-embedding-3-large": 0.13,
        "text-embedding-ada-002": 0.1,
    };
    const pricePerMillion = prices[model] || 0.02;
    const syncCost = (totalTokens / 1_000_000) * pricePerMillion;
    const batchCost = syncCost * 0.5; // 50% discount
    return {
        syncCost: Math.round(syncCost * 10000) / 10000,
        batchCost: Math.round(batchCost * 10000) / 10000,
        savings: Math.round((syncCost - batchCost) * 10000) / 10000,
    };
}
/**
 * Szacuje liczbę tokenów w tekście
 */
export function estimateTokens(text) {
    // ~2.5 znaku = 1 token dla polskiego tekstu
    return Math.ceil(text.length / 2.5);
}
export default BatchEmbeddingService;
//# sourceMappingURL=batch-embedding-service.js.map