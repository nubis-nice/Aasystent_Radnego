/**
 * Document Process Job Handler
 * Przetwarza zadania OCR/transkrypcji z kolejki Redis
 * Używa HTTP API zamiast bezpośrednich importów (izolacja pakietów)
 */
import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
// Załaduj zmienne środowiskowe
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../api/.env") });
// Lazy initialization
let _supabase = null;
function getSupabase() {
    if (!_supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
            throw new Error(`Missing Supabase config. SUPABASE_URL=${url ? "set" : "missing"}, ` +
                `SUPABASE_SERVICE_ROLE_KEY=${key ? "set" : "missing"}`);
        }
        _supabase = createClient(url, key);
    }
    return _supabase;
}
export async function processDocumentJob(job) {
    const { userId, fileName, fileBuffer, mimeType, fileSize } = job.data;
    const supabase = getSupabase();
    console.log(`[document-process] Starting job ${job.id} for ${fileName}`);
    // Aktualizuj status na "processing"
    await supabase
        .from("document_jobs")
        .update({
        status: "processing",
        started_at: new Date().toISOString(),
    })
        .eq("job_id", job.id);
    try {
        await job.updateProgress(10);
        // Decode base64 file
        const buffer = Buffer.from(fileBuffer, "base64");
        console.log(`[document-process] Decoded file: ${buffer.length} bytes`);
        await job.updateProgress(20);
        // Dynamicznie importuj DocumentProcessor z dist (skompilowane)
        const apiDistPath = path.resolve(__dirname, "../../../api/dist/services/document-processor.js");
        const { DocumentProcessor } = await import(pathToFileURL(apiDistPath).href);
        const processor = new DocumentProcessor();
        await processor.initializeWithUserConfig(userId);
        await job.updateProgress(30);
        // Check if audio/video for transcription
        const isAudioVideo = mimeType.startsWith("audio/") || mimeType.startsWith("video/");
        if (isAudioVideo) {
            // Transkrypcja audio/video
            console.log(`[document-process] Processing audio/video: ${mimeType}`);
            await job.updateProgress(40);
            const audioDistPath = path.resolve(__dirname, "../../../api/dist/services/audio-transcriber.js");
            const { AudioTranscriber } = await import(pathToFileURL(audioDistPath).href);
            const transcriber = new AudioTranscriber();
            await transcriber.initializeWithUserConfig(userId);
            const result = await transcriber.transcribe(buffer, fileName, mimeType);
            await job.updateProgress(90);
            if (!result.success) {
                throw new Error(result.error || "Transkrypcja nie powiodła się");
            }
            const jobResult = {
                success: true,
                text: result.formattedTranscript ||
                    result.rawTranscript ||
                    result.transcript ||
                    result.text ||
                    "",
                metadata: {
                    fileName,
                    fileType: "audio",
                    mimeType,
                    fileSize,
                    processingMethod: "transcription",
                    language: "pl",
                    ...(result.summary && { summary: result.summary }),
                },
            };
            // Zapisz wynik do bazy danych
            await supabase
                .from("document_jobs")
                .update({
                status: "completed",
                progress: 100,
                result: jobResult,
                completed_at: new Date().toISOString(),
            })
                .eq("job_id", job.id);
            console.log(`[document-process] Job ${job.id} completed successfully`);
            return jobResult;
        }
        else {
            // OCR dokumentu/obrazu
            console.log(`[document-process] Processing document: ${mimeType}`);
            await job.updateProgress(40);
            const result = await processor.processFile(buffer, fileName, mimeType);
            await job.updateProgress(90);
            if (!result.success) {
                throw new Error(result.error || "Przetwarzanie nie powiodło się");
            }
            const jobResult = {
                success: true,
                text: result.text,
                metadata: result.metadata,
            };
            // Zapisz wynik do bazy danych
            await supabase
                .from("document_jobs")
                .update({
                status: "completed",
                progress: 100,
                result: jobResult,
                completed_at: new Date().toISOString(),
            })
                .eq("job_id", job.id);
            console.log(`[document-process] Job ${job.id} completed successfully`);
            return jobResult;
        }
    }
    catch (error) {
        console.error(`[document-process] Job ${job.id} failed:`, error);
        const errorMessage = error instanceof Error ? error.message : "Nieznany błąd przetwarzania";
        // Aktualizuj status na "failed"
        await supabase
            .from("document_jobs")
            .update({
            status: "failed",
            error: errorMessage,
            completed_at: new Date().toISOString(),
        })
            .eq("job_id", job.id);
        return {
            success: false,
            error: errorMessage,
        };
    }
}
//# sourceMappingURL=document-process.js.map