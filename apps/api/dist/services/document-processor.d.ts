import { Buffer } from "node:buffer";
export interface ProcessedDocument {
    success: boolean;
    text: string;
    metadata: {
        fileName: string;
        fileType: string;
        mimeType: string;
        fileSize: number;
        pageCount?: number;
        confidence?: number;
        language?: string;
        processingMethod: "ocr" | "text-extraction" | "direct" | "stt";
        sttModel?: string;
    };
    error?: string;
}
export interface SaveToRAGResult {
    success: boolean;
    documentId?: string;
    error?: string;
}
export declare class DocumentProcessor {
    private visionClient;
    private embeddingsClient;
    private embeddingModel;
    private visionModel;
    private userId;
    constructor();
    /**
     * Initialize AI clients with user's configuration via AIClientFactory
     */
    initializeWithUserConfig(userId: string): Promise<void>;
    /**
     * Process uploaded file and extract text
     */
    processFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<ProcessedDocument>;
    /**
     * Process image using GPT-4 Vision OCR
     */
    private processImage;
    /**
     * Process PDF - try text extraction first, fallback to OCR for scanned PDFs
     */
    private processPDF;
    private analyzeImageStats;
    private calculateSharpness;
    private estimateNoise;
    private normalizeImageForOCR;
    private calculateAdaptiveParams;
    private processImageWithTesseract;
    /**
     * Process scanned PDF using Tesseract.js first, GPT-4 Vision as fallback
     * Converts PDF pages to PNG images using Poppler, normalizes with Sharp, then OCR
     */
    private processPDFWithOCR;
    /**
     * Process DOCX file
     */
    private processDOCX;
    /**
     * Process plain text file
     */
    private processTextFile;
    private getFileType;
    /**
     * Save extracted text to RAG database
     */
    saveToRAG(userId: string, text: string, title: string, sourceFileName: string, documentType?: string): Promise<SaveToRAGResult>;
    /**
     * Process audio/video file with STT transcription
     */
    private processAudio;
}
//# sourceMappingURL=document-processor.d.ts.map