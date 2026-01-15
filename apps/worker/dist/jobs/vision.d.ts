/**
 * Vision Job Handler - Przetwarzanie zadań OCR/Vision AI
 *
 * Obsługuje:
 * - Ollama Vision (qwen3-vl, llava, etc.)
 * - OpenAI Vision (gpt-4o, gpt-4-vision)
 * - Google Vision
 */
import { Job } from "bullmq";
export interface VisionJobData {
    id: string;
    userId: string;
    imageBase64: string;
    prompt: string;
    pageNumber?: number;
    fileName?: string;
    provider: string;
    model: string;
    createdAt: string;
}
export interface VisionJobResult {
    success: boolean;
    text: string;
    confidence?: number;
    error?: string;
    processingTimeMs?: number;
}
/**
 * Główna funkcja przetwarzania zadania Vision
 */
export declare function processVision(job: Job<VisionJobData>): Promise<VisionJobResult>;
//# sourceMappingURL=vision.d.ts.map