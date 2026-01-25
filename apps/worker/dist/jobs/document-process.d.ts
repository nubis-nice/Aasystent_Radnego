/**
 * Document Process Job Handler
 * Przetwarza zadania OCR/transkrypcji z kolejki Redis
 * Używa HTTP API zamiast bezpośrednich importów (izolacja pakietów)
 */
import { Job } from "bullmq";
export interface DocumentProcessJobData {
    userId: string;
    fileName: string;
    fileBuffer: string;
    mimeType: string;
    fileSize: number;
    options?: {
        useVisionOnly?: boolean;
        tesseractConfidenceThreshold?: number;
        visionMaxDimension?: number;
    };
}
export interface DocumentProcessJobResult {
    success: boolean;
    text?: string;
    metadata?: {
        fileName: string;
        fileType: string;
        mimeType: string;
        fileSize: number;
        processingMethod: string;
        confidence?: number;
        language?: string;
        ocrEngine?: string;
        pageCount?: number;
    };
    error?: string;
}
export declare function processDocumentJob(job: Job<DocumentProcessJobData>): Promise<DocumentProcessJobResult>;
//# sourceMappingURL=document-process.d.ts.map