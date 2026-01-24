import { Buffer } from "node:buffer";
import { type DocumentStructure } from "./vision-optimizer.js";
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
        processingMethod: "ocr" | "text-extraction" | "direct" | "stt" | "vision";
        sttModel?: string;
        ocrEngine?: string;
        blankPagesSkipped?: number;
    };
    error?: string;
}
export interface SaveToRAGResult {
    success: boolean;
    documentId?: string;
    error?: string;
}
export interface OCROptions {
    /** Wymuś użycie tylko Vision API (bez Tesseract) */
    useVisionOnly?: boolean;
    /** Próg confidence dla Tesseract (domyślnie 75%) */
    tesseractConfidenceThreshold?: number;
    /** Rozdzielczość dla Tesseract w DPI (domyślnie 300) */
    tesseractDPI?: number;
    /** Rozdzielczość dla Vision API w px (domyślnie 768) */
    visionMaxDimension?: number;
    /** Użyj kolejki Redis dla Vision (async, bez timeout) */
    useVisionQueue?: boolean;
}
export declare class DocumentProcessor {
    private visionClient;
    private embeddingsClient;
    private embeddingModel;
    private visionModel;
    private visionProvider;
    private userId;
    constructor();
    /**
     * Initialize AI clients with user's configuration via AIClientFactory
     */
    initializeWithUserConfig(userId: string): Promise<void>;
    /**
     * Ekstrakcja strukturalna z tekstu OCR (etap 2)
     * Wywołuje LLM tekstowy (nie Vision!) z tekstem i zwraca JSON
     */
    extractStructuredData(ocrText: string): Promise<DocumentStructure | null>;
    /**
     * Process uploaded file and extract text
     * @param options OCR options (tesseractConfidenceThreshold, visionMaxDimension, etc.)
     */
    processFile(fileBuffer: Buffer, fileName: string, mimeType: string, options?: OCROptions): Promise<ProcessedDocument>;
    /**
     * Process image using Tesseract OCR with Vision API fallback
     */
    private processImage;
    /**
     * Buduje wiadomości dla Vision API w formacie odpowiednim dla providera
     * Ollama używa: { role: "user", content: "tekst", images: ["base64"] }
     * OpenAI używa: { role: "user", content: [{ type: "image_url", image_url: { url: "data:..." } }] }
     */
    private buildVisionMessages;
    /**
     * Process PDF - try text extraction first, fallback to OCR for scanned PDFs
     */
    private processPDF;
    /**
     * Detect garbled/corrupted text from broken PDF extraction
     */
    private detectGarbledText;
    /**
     * Check if text lacks meaningful Polish words (likely garbled)
     */
    private lacksMeaningfulPolishWords;
    /**
     * Detect repeated patterns (encoding/extraction issues)
     */
    private hasRepeatedPatterns;
    private analyzeImageStats;
    private calculateSharpness;
    private estimateNoise;
    private normalizeImageForOCR;
    private calculateAdaptiveParams;
    private processImageWithTesseract;
    /**
     * Process scanned PDF using Tesseract.js first, Vision API as fallback
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
     * Sprawdza duplikaty przed zapisem i normalizuje metadane
     */
    saveToRAG(userId: string, text: string, title: string, sourceFileName: string, documentType?: string): Promise<SaveToRAGResult>;
    /**
     * Wyodrębnia znormalizowane metadane z tytułu i treści dokumentu
     */
    private extractNormalizedMetadata;
    private extractSessionNumber;
    private romanToArabic;
    private extractPublishDate;
    private extractDocumentNumber;
    private extractSessionType;
    /**
     * Process audio/video file with STT transcription
     */
    private processAudio;
}
//# sourceMappingURL=document-processor.d.ts.map