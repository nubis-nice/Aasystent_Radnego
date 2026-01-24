import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import { Poppler } from "node-poppler";
import { getVisionClient, getEmbeddingsClient, getSTTClient, getLLMClient, getAIConfig, } from "../ai/index.js";
import { getVisionOptimizer, EXTRACTION_PROMPTS, getTextToStructuredPrompt, parseDocumentStructure, } from "./vision-optimizer.js";
import { addVisionJob, waitForVisionResult, } from "./vision-queue.js";
// import { getAudioPreprocessor } from "./audio-preprocessor.js"; // Tymczasowo wyłączone
const require = createRequire(import.meta.url);
// Konfiguracja Poppler - ścieżka do binariów na Windows
const popplerBinPath = process.platform === "win32"
    ? "C:\\ProgramData\\poppler\\poppler-24.08.0\\Library\\bin"
    : undefined; // Na Linux/macOS używa systemowego poppler
const poppler = new Poppler(popplerBinPath);
console.log("[DocumentProcessor] node-poppler initialized");
// pdf-parse - nowa wersja eksportuje obiekt z klasą PDFParse
let pdfParse;
try {
    const pdfParseModule = require("pdf-parse");
    // Sprawdź różne formaty eksportu
    if (typeof pdfParseModule === "function") {
        // Stara wersja - funkcja bezpośrednio
        pdfParse = pdfParseModule;
    }
    else if (typeof pdfParseModule.default === "function") {
        // ESM default export
        pdfParse = pdfParseModule.default;
    }
    else if (typeof pdfParseModule.PDFParse === "function") {
        // Nowa wersja - klasa PDFParse z metodą getText()
        const PDFParse = pdfParseModule.PDFParse;
        pdfParse = async (buffer) => {
            const parser = new PDFParse({ verbosity: 0, data: buffer });
            const textResult = await parser.getText();
            return {
                text: textResult?.text || "",
                numpages: textResult?.numPages || textResult?.pages?.length || 1,
            };
        };
    }
    else {
        // Fallback - spróbuj użyć jako funkcji
        console.warn("[DocumentProcessor] pdf-parse format unknown, keys:", Object.keys(pdfParseModule));
        pdfParse = async () => {
            throw new Error("pdf-parse format not supported");
        };
    }
    console.log("[DocumentProcessor] pdf-parse loaded successfully");
}
catch (err) {
    console.error("[DocumentProcessor] Failed to load pdf-parse:", err);
    pdfParse = async () => {
        throw new Error("pdf-parse module not available");
    };
}
const mammoth = require("mammoth");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const DEFAULT_OCR_OPTIONS = {
    useVisionOnly: false,
    tesseractConfidenceThreshold: 75,
    tesseractDPI: 300,
    visionMaxDimension: 768,
    useVisionQueue: true,
};
// Mapowanie rozszerzeń plików na MIME types
const EXTENSION_TO_MIME = {
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".txt": "text/plain",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
};
export class DocumentProcessor {
    visionClient = null;
    embeddingsClient = null;
    embeddingModel = "nomic-embed-text";
    visionModel = "gpt-4o";
    visionProvider = "openai"; // ollama, openai, google, etc.
    userId = null;
    constructor() { }
    /**
     * Initialize AI clients with user's configuration via AIClientFactory
     */
    async initializeWithUserConfig(userId) {
        this.userId = userId;
        // Pobierz klienta Vision z fabryki (do analizy obrazów)
        this.visionClient = await getVisionClient(userId);
        // Pobierz klienta Embeddings z fabryki
        this.embeddingsClient = await getEmbeddingsClient(userId);
        // Pobierz konfigurację embeddings aby znać model
        const embConfig = await getAIConfig(userId, "embeddings");
        this.embeddingModel = embConfig.modelName;
        const visionConfig = await getAIConfig(userId, "vision");
        this.visionModel = visionConfig.modelName;
        this.visionProvider = visionConfig.provider;
        console.log(`[DocumentProcessor] Initialized for user ${userId.substring(0, 8)}...`);
        console.log(`[DocumentProcessor] Vision: provider=${visionConfig.provider}, model=${this.visionModel}`);
        console.log(`[DocumentProcessor] Embeddings: model=${this.embeddingModel}`);
    }
    // ==========================================================================
    // TWO-STAGE EXTRACTION: OCR Text → Structured JSON
    // ==========================================================================
    /**
     * Ekstrakcja strukturalna z tekstu OCR (etap 2)
     * Wywołuje LLM tekstowy (nie Vision!) z tekstem i zwraca JSON
     */
    async extractStructuredData(ocrText) {
        if (!this.userId) {
            console.warn("[DocumentProcessor] User ID not set for structured extraction");
            return null;
        }
        try {
            // Użyj klienta LLM tekstowego (nie Vision!) do generowania JSON
            const llmClient = await getLLMClient(this.userId);
            const llmConfig = await getAIConfig(this.userId, "llm");
            const prompt = getTextToStructuredPrompt();
            // Skróć tekst jeśli za długi (max 4000 znaków dla kontekstu)
            const truncatedText = ocrText.length > 4000 ? ocrText.substring(0, 4000) + "..." : ocrText;
            console.log(`[DocumentProcessor] Extracting structured data from ${truncatedText.length} chars using ${llmConfig.modelName}`);
            const response = await llmClient.chat.completions.create({
                model: llmConfig.modelName,
                messages: [
                    { role: "system", content: prompt.system },
                    { role: "user", content: `${prompt.user}\n\n${truncatedText}` },
                ],
                max_tokens: 1024,
                temperature: 0.1, // Niska temperatura dla deterministycznego JSON
            });
            const jsonResponse = response.choices[0]?.message?.content || "";
            console.log(`[DocumentProcessor] LLM response (${jsonResponse.length} chars): ${jsonResponse.substring(0, 200)}...`);
            const structured = parseDocumentStructure(jsonResponse);
            if (structured) {
                console.log(`[DocumentProcessor] ✓ Extracted: typ=${structured.typ}, numer=${structured.numer}`);
            }
            return structured;
        }
        catch (error) {
            console.error("[DocumentProcessor] Structured extraction failed:", error);
            return null;
        }
    }
    /**
     * Process uploaded file and extract text
     * @param options OCR options (tesseractConfidenceThreshold, visionMaxDimension, etc.)
     */
    async processFile(fileBuffer, fileName, mimeType, options = {}) {
        // Merge with defaults
        const ocrOptions = { ...DEFAULT_OCR_OPTIONS, ...options };
        const fileSize = fileBuffer.length;
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (fileSize > maxSize) {
            return {
                success: false,
                text: "",
                metadata: {
                    fileName,
                    fileType: this.getFileType(mimeType),
                    mimeType,
                    fileSize,
                    processingMethod: "direct",
                },
                error: `Plik jest zbyt duży (${Math.round(fileSize / 1024 / 1024)}MB). Maksymalny rozmiar to 10MB.`,
            };
        }
        // Rozpoznaj MIME type na podstawie rozszerzenia jeśli to octet-stream
        let effectiveMimeType = mimeType;
        if (mimeType === "application/octet-stream") {
            const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
            if (EXTENSION_TO_MIME[ext]) {
                effectiveMimeType = EXTENSION_TO_MIME[ext];
                console.log(`[DocumentProcessor] Detected ${ext} file, using ${effectiveMimeType}`);
            }
        }
        try {
            switch (effectiveMimeType) {
                case "image/jpeg":
                case "image/png":
                case "image/gif":
                case "image/bmp":
                case "image/webp":
                    return await this.processImage(fileBuffer, fileName, mimeType, fileSize, ocrOptions);
                case "application/pdf":
                    return await this.processPDF(fileBuffer, fileName, mimeType, fileSize, ocrOptions);
                case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                    return await this.processDOCX(fileBuffer, fileName, mimeType, fileSize);
                case "text/plain":
                case "text/markdown":
                    return this.processTextFile(fileBuffer, fileName, mimeType, fileSize);
                // Audio formats
                case "audio/mpeg":
                case "audio/mp3":
                case "audio/wav":
                case "audio/x-wav":
                case "audio/mp4":
                case "audio/m4a":
                case "audio/x-m4a":
                case "audio/ogg":
                case "audio/webm":
                case "video/mp4": // Video formats
                case "video/webm":
                case "video/ogg":
                    return await this.processAudio(fileBuffer, fileName, mimeType, fileSize);
                default:
                    return {
                        success: false,
                        text: "",
                        metadata: {
                            fileName,
                            fileType: "unknown",
                            mimeType,
                            fileSize,
                            processingMethod: "direct",
                        },
                        error: `Nieobsługiwany format pliku: ${mimeType}`,
                    };
            }
        }
        catch (error) {
            console.error("[DocumentProcessor] Error processing file:", error);
            return {
                success: false,
                text: "",
                metadata: {
                    fileName,
                    fileType: this.getFileType(mimeType),
                    mimeType,
                    fileSize,
                    processingMethod: "direct",
                },
                error: error instanceof Error ? error.message : "Błąd przetwarzania pliku",
            };
        }
    }
    /**
     * Process image using Tesseract OCR with Vision API fallback
     */
    async processImage(fileBuffer, fileName, mimeType, fileSize, ocrOptions = {}) {
        if (!this.visionClient) {
            throw new Error("Vision client not initialized. Call initializeWithUserConfig first.");
        }
        console.log(`[DocumentProcessor] Processing image with Vision model ${this.visionModel}: ${fileName}`);
        // Analiza statystyk obrazu
        const stats = await this.analyzeImageStats(fileBuffer);
        console.log(`[DocumentProcessor] Image analysis: brightness=${stats.brightness.toFixed(1)}, contrast=${stats.contrast.toFixed(2)}, sharpness=${stats.sharpness.toFixed(2)}, noise=${stats.noiseLevel.toFixed(2)}`);
        // Sprawdź czy obraz jest pusty/biały
        if (stats.brightness > 250 && stats.contrast < 0.05) {
            console.log(`[DocumentProcessor] Image appears to be blank (brightness=${stats.brightness.toFixed(1)}, contrast=${stats.contrast.toFixed(2)})`);
            return {
                success: false,
                text: "",
                metadata: {
                    fileName,
                    fileType: "image",
                    mimeType,
                    fileSize,
                    processingMethod: "ocr",
                },
                error: "Obraz wydaje się być pusty lub całkowicie biały",
            };
        }
        // Pobierz parametry OCR
        const confidenceThreshold = ocrOptions.tesseractConfidenceThreshold ?? 75;
        const visionMaxDim = ocrOptions.visionMaxDimension ?? 768;
        const useVisionOnly = ocrOptions.useVisionOnly ?? false;
        // Normalizacja obrazu przed OCR (300 DPI dla Tesseract)
        const normalizedImage = await this.normalizeImageForOCR(fileBuffer);
        console.log(`[DocumentProcessor] Image normalized for OCR`);
        // Jeśli useVisionOnly - pomiń Tesseract
        if (!useVisionOnly) {
            // KROK 1: Najpierw spróbuj Tesseract (darmowe, lokalne)
            const tesseractResult = await this.processImageWithTesseract(normalizedImage, 1 // page number
            );
            console.log(`[DocumentProcessor] Tesseract result: ${tesseractResult.text.length} chars, confidence: ${tesseractResult.confidence.toFixed(1)}% (threshold: ${confidenceThreshold}%)`);
            // Jeśli Tesseract dał dobry wynik (confidence > threshold i tekst > 30 znaków) - użyj go
            if (tesseractResult.confidence >= confidenceThreshold &&
                tesseractResult.text.length > 30) {
                console.log(`[DocumentProcessor] ✓ Using Tesseract result (confidence >= ${confidenceThreshold}%)`);
                return {
                    success: true,
                    text: tesseractResult.text,
                    metadata: {
                        fileName,
                        fileType: "image",
                        mimeType,
                        fileSize,
                        processingMethod: "ocr",
                        confidence: tesseractResult.confidence / 100,
                        language: "pl",
                        ocrEngine: "tesseract",
                    },
                };
            }
            // KROK 2: Tesseract słaby - użyj Vision API jako fallback
            console.log(`[DocumentProcessor] Tesseract confidence too low (${tesseractResult.confidence.toFixed(1)}% < ${confidenceThreshold}%), using Vision API fallback`);
        }
        else {
            console.log(`[DocumentProcessor] useVisionOnly=true, skipping Tesseract`);
        }
        // Optymalizacja obrazu dla Vision API (768px domyślnie)
        const visionOptimizer = getVisionOptimizer(this.visionModel);
        visionOptimizer.setConfig({ maxDimension: visionMaxDim });
        const optimizedImage = await visionOptimizer.optimizeImage(normalizedImage);
        console.log(`[DocumentProcessor] Vision optimization: ${optimizedImage.dimensions.width}x${optimizedImage.dimensions.height}, ` +
            `${optimizedImage.compressionRatio.toFixed(1)}x compression`);
        try {
            // Użyj zoptymalizowanego promptu
            const prompt = EXTRACTION_PROMPTS.ocr;
            // Buduj wiadomości w zależności od providera
            const messages = this.buildVisionMessages(optimizedImage.base64, prompt.user);
            const response = (await this.visionClient.chat.completions.create({
                model: this.visionModel,
                messages,
                max_tokens: 4096,
            }));
            const extractedText = response.choices[0]?.message?.content || "";
            return {
                success: true,
                text: extractedText,
                metadata: {
                    fileName,
                    fileType: "image",
                    mimeType,
                    fileSize,
                    processingMethod: "vision",
                    confidence: 0.9,
                    language: "pl",
                    ocrEngine: "vision-api",
                },
            };
        }
        catch (visionError) {
            console.error(`[DocumentProcessor] Vision API failed:`, visionError);
            // Vision API failed - zwróć błąd (Tesseract już próbowany wcześniej)
            return {
                success: false,
                text: "",
                metadata: {
                    fileName,
                    fileType: "image",
                    mimeType,
                    fileSize,
                    processingMethod: "ocr",
                },
                error: "Nie udało się odczytać tekstu z obrazu (Tesseract i Vision API zawiodły)",
            };
        }
    }
    /**
     * Buduje wiadomości dla Vision API w formacie odpowiednim dla providera
     * Ollama używa: { role: "user", content: "tekst", images: ["base64"] }
     * OpenAI używa: { role: "user", content: [{ type: "image_url", image_url: { url: "data:..." } }] }
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildVisionMessages(base64Image, prompt) {
        // Użyj zoptymalizowanego, skompresowanego promptu z VisionOptimizer
        const systemPrompt = EXTRACTION_PROMPTS.ocr.system;
        // Dla Ollama używamy formatu z polem "images"
        if (this.visionProvider === "ollama") {
            console.log(`[DocumentProcessor] Using Ollama Vision format for model ${this.visionModel}`);
            return [
                {
                    role: "system",
                    content: systemPrompt,
                },
                {
                    role: "user",
                    content: prompt,
                    images: [base64Image], // Ollama format - base64 bez prefixu data:
                },
            ];
        }
        // Dla OpenAI i innych używamy standardowego formatu image_url
        const dataUrl = `data:image/png;base64,${base64Image}`;
        return [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: dataUrl,
                            detail: "high",
                        },
                    },
                    {
                        type: "text",
                        text: prompt,
                    },
                ],
            },
        ];
    }
    /**
     * Process PDF - try text extraction first, fallback to OCR for scanned PDFs
     */
    async processPDF(fileBuffer, fileName, mimeType, fileSize, ocrOptions = {}) {
        console.log(`[DocumentProcessor] Processing PDF: ${fileName}`);
        try {
            const pdfData = await pdfParse(fileBuffer);
            const extractedText = pdfData.text.trim();
            // If text is very short or mostly whitespace, it's likely a scanned PDF
            const meaningfulText = extractedText.replace(/\s+/g, " ").trim();
            // Check for binary garbage (non-printable characters)
            const nonPrintableRatio = (meaningfulText.match(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F]/g) || [])
                .length / Math.max(meaningfulText.length, 1);
            const isBinaryGarbage = nonPrintableRatio > 0.3; // More than 30% non-printable = garbage
            // Check if text is mostly just page numbers (e.g., "-- 1 of 8 --")
            const pageNumberPattern = /--\s*\d+\s+of\s+\d+\s*--/gi;
            const pageNumberMatches = extractedText.match(pageNumberPattern) || [];
            const isOnlyPageNumbers = pageNumberMatches.length > 0 &&
                meaningfulText.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "").trim().length <
                    50;
            // Calculate characters per page
            const charsPerPage = meaningfulText.length / Math.max(pdfData.numpages, 1);
            const hasVeryLittleTextPerPage = charsPerPage < 100; // Increased from 80 to 100
            // NEW: Check for corrupted/garbled text (common patterns in broken PDF extraction)
            const hasGarbledText = this.detectGarbledText(meaningfulText);
            // NEW: Check if text lacks meaningful Polish words
            const lacksMeaningfulWords = this.lacksMeaningfulPolishWords(meaningfulText);
            // NEW: Check for repeated character sequences (encoding issues)
            const hasRepeatedPatterns = this.hasRepeatedPatterns(meaningfulText);
            // Decision: use OCR if any of these conditions are true
            const shouldUseOCR = meaningfulText.length < 300 ||
                isBinaryGarbage ||
                isOnlyPageNumbers ||
                hasVeryLittleTextPerPage ||
                hasGarbledText ||
                lacksMeaningfulWords ||
                hasRepeatedPatterns;
            if (shouldUseOCR) {
                console.log(`[DocumentProcessor] PDF requires OCR: ` +
                    `textLength=${meaningfulText.length}, ` +
                    `charsPerPage=${charsPerPage.toFixed(1)}, ` +
                    `nonPrintable=${(nonPrintableRatio * 100).toFixed(1)}%, ` +
                    `onlyPageNumbers=${isOnlyPageNumbers}, ` +
                    `garbled=${hasGarbledText}, ` +
                    `lacksMeaningful=${lacksMeaningfulWords}, ` +
                    `repeatedPatterns=${hasRepeatedPatterns}`);
                return await this.processPDFWithOCR(fileBuffer, fileName, mimeType, fileSize, pdfData.numpages, ocrOptions);
            }
            console.log(`[DocumentProcessor] PDF text extraction successful: ${meaningfulText.length} chars, ${charsPerPage.toFixed(1)} chars/page`);
            return {
                success: true,
                text: extractedText,
                metadata: {
                    fileName,
                    fileType: "pdf",
                    mimeType,
                    fileSize,
                    pageCount: pdfData.numpages,
                    processingMethod: "text-extraction",
                    language: "pl",
                },
            };
        }
        catch (error) {
            console.error("[DocumentProcessor] PDF parsing failed, trying OCR:", error);
            return await this.processPDFWithOCR(fileBuffer, fileName, mimeType, fileSize, undefined, ocrOptions);
        }
    }
    /**
     * Detect garbled/corrupted text from broken PDF extraction
     */
    detectGarbledText(text) {
        if (text.length < 50)
            return false;
        // Check for Unicode replacement character sequences
        if (/\uFFFD{2,}/.test(text)) {
            return true;
        }
        // Check for same character repeated 10+ times
        if (/(.)\1{10,}/.test(text)) {
            return true;
        }
        // Check for control characters (using char codes to avoid ESLint warning)
        let controlCharCount = 0;
        for (let i = 0; i < Math.min(text.length, 1000); i++) {
            const code = text.charCodeAt(i);
            if ((code >= 0 && code <= 8) ||
                code === 11 ||
                code === 12 ||
                (code >= 14 && code <= 31)) {
                controlCharCount++;
            }
        }
        if (controlCharCount > 3) {
            return true;
        }
        // Check ratio of letters vs special characters
        const letterCount = (text.match(/[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || [])
            .length;
        const specialCount = (text.match(/[^\w\s.,;:!?()\-"']/g) || []).length;
        if (text.length > 100 && specialCount > letterCount * 0.5) {
            return true; // Too many special characters
        }
        return false;
    }
    /**
     * Check if text lacks meaningful Polish words (likely garbled)
     */
    lacksMeaningfulPolishWords(text) {
        if (text.length < 200)
            return false;
        // Common Polish words that should appear in documents
        const commonPolishWords = [
            /\b(i|w|z|na|do|dla|od|o|się|jest|są|być|to|nie|tak|co|jak|lub|oraz|przez|po|ze|za|przy|nad|pod|przed|między|wobec|według|mimo|podczas|poprzez|wskutek|dzięki|oprócz|poza|wzdłuż|obok|naprzeciwko|względem|stosunku|sprawie|celu|ramach|zakresie|przypadku|warunkach|terminie|dniu|roku|miesiącu|tygodniu|czasie|miejscu|sposób|podstawie|zgodnie|związku)\b/gi,
            /\b(uchwała|zarządzenie|decyzja|postanowienie|protokół|sprawozdanie|budżet|gmina|rada|burmistrz|wójt|starosta|prezydent|sekretarz|skarbnik|radny|komisja|sesja|posiedzenie|głosowanie|wniosek|projekt|załącznik|druk)\b/gi,
        ];
        let matchCount = 0;
        for (const pattern of commonPolishWords) {
            const matches = text.match(pattern);
            if (matches) {
                matchCount += matches.length;
            }
        }
        // If text is long but has very few common words, it's likely garbled
        const wordsPerChar = matchCount / text.length;
        return wordsPerChar < 0.01; // Less than 1 common word per 100 characters
    }
    /**
     * Detect repeated patterns (encoding/extraction issues)
     */
    hasRepeatedPatterns(text) {
        if (text.length < 100)
            return false;
        // Check for repeated 2-4 character sequences
        const patterns = [
            /(.{2,4})\1{5,}/g, // Same 2-4 char sequence repeated 5+ times
            /(\s{3,})/g, // 3+ spaces in a row (count occurrences)
        ];
        for (const pattern of patterns) {
            const matches = text.match(pattern);
            if (matches && matches.length > 3) {
                return true;
            }
        }
        // Check if most "words" are very short (1-2 chars) - sign of broken extraction
        const words = text.split(/\s+/).filter((w) => w.length > 0);
        const shortWords = words.filter((w) => w.length <= 2);
        if (words.length > 20 && shortWords.length > words.length * 0.7) {
            return true; // More than 70% very short words
        }
        return false;
    }
    // ============================================================================
    // SHARP IMAGE NORMALIZER - preprocessing dla lepszego OCR
    // ============================================================================
    // ============================================================================
    // ADAPTIVE IMAGE ANALYSIS - analiza obrazu dla adaptacyjnej normalizacji
    // ============================================================================
    async analyzeImageStats(imageBuffer) {
        try {
            const image = sharp(imageBuffer);
            const { width, height } = await image.metadata();
            // Pobierz statystyki obrazu
            const stats = await image.stats();
            // Oblicz średnią jasność (z kanałów RGB lub grayscale)
            const channels = stats.channels;
            const avgBrightness = channels.reduce((sum, ch) => sum + ch.mean, 0) / channels.length;
            // Oblicz kontrast (bazując na odchyleniu standardowym)
            const avgStdDev = channels.reduce((sum, ch) => sum + ch.stdev, 0) / channels.length;
            const contrast = Math.min(avgStdDev / 128, 1); // Normalizuj do 0-1
            // Analiza ostrości - użyj Laplacian variance (przybliżenie)
            // Wysoka wariancja = ostry obraz, niska = rozmyty
            const grayscaleBuffer = await sharp(imageBuffer)
                .grayscale()
                .raw()
                .toBuffer();
            const sharpnessScore = this.calculateSharpness(grayscaleBuffer, width || 100, height || 100);
            // Analiza szumu - bazując na lokalnej wariancji w gładkich obszarach
            const noiseScore = this.estimateNoise(grayscaleBuffer, width || 100, height || 100);
            // Klasyfikacja
            const isLowContrast = contrast < 0.15;
            const isDark = avgBrightness < 80;
            const isBright = avgBrightness > 200;
            const isBlurry = sharpnessScore < 0.3;
            const isNoisy = noiseScore > 0.4;
            console.log(`[DocumentProcessor] Image analysis: brightness=${avgBrightness.toFixed(1)}, contrast=${contrast.toFixed(2)}, sharpness=${sharpnessScore.toFixed(2)}, noise=${noiseScore.toFixed(2)}`);
            return {
                brightness: avgBrightness,
                contrast,
                sharpness: sharpnessScore,
                noiseLevel: noiseScore,
                isLowContrast,
                isDark,
                isBright,
                isBlurry,
                isNoisy,
            };
        }
        catch (error) {
            console.error("[DocumentProcessor] Image analysis failed:", error);
            // Zwróć domyślne wartości
            return {
                brightness: 128,
                contrast: 0.5,
                sharpness: 0.5,
                noiseLevel: 0.2,
                isLowContrast: false,
                isDark: false,
                isBright: false,
                isBlurry: false,
                isNoisy: false,
            };
        }
    }
    calculateSharpness(buffer, width, height) {
        // Laplacian variance - przybliżenie ostrości
        // Wysoka wariancja gradientów = ostry obraz
        let sumVariance = 0;
        let count = 0;
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const center = buffer[idx] ?? 0;
                const left = buffer[idx - 1] ?? 0;
                const right = buffer[idx + 1] ?? 0;
                const top = buffer[idx - width] ?? 0;
                const bottom = buffer[idx + width] ?? 0;
                // Laplacian kernel: -4*center + left + right + top + bottom
                const laplacian = Math.abs(-4 * center + left + right + top + bottom);
                sumVariance += laplacian * laplacian;
                count++;
            }
        }
        const variance = count > 0 ? sumVariance / count : 0;
        // Normalizuj do 0-1 (empirycznie dobrane progi)
        return Math.min(variance / 5000, 1);
    }
    estimateNoise(buffer, width, height) {
        // Estymacja szumu metodą MAD (Median Absolute Deviation)
        // w małych blokach 3x3
        const differences = [];
        for (let y = 1; y < Math.min(height - 1, 100); y += 3) {
            for (let x = 1; x < Math.min(width - 1, 100); x += 3) {
                const idx = y * width + x;
                const center = buffer[idx] ?? 0;
                const neighbors = [
                    buffer[idx - 1] ?? 0,
                    buffer[idx + 1] ?? 0,
                    buffer[idx - width] ?? 0,
                    buffer[idx + width] ?? 0,
                ];
                const avgNeighbor = neighbors.reduce((a, b) => a + b, 0) / 4;
                differences.push(Math.abs(center - avgNeighbor));
            }
        }
        if (differences.length === 0)
            return 0;
        // Mediana różnic
        differences.sort((a, b) => a - b);
        const median = differences[Math.floor(differences.length / 2)] ?? 0;
        // Normalizuj do 0-1
        return Math.min(median / 30, 1);
    }
    // ============================================================================
    // ADAPTIVE NORMALIZATION - adaptacyjna normalizacja na podstawie analizy
    // ============================================================================
    async normalizeImageForOCR(imageBuffer) {
        try {
            // KROK 1: Analiza obrazu
            const stats = await this.analyzeImageStats(imageBuffer);
            // KROK 2: Dobór adaptacyjnych parametrów
            const params = this.calculateAdaptiveParams(stats);
            console.log(`[DocumentProcessor] Adaptive params: gamma=${params.gamma.toFixed(2)}, sharpen=${params.sharpenSigma.toFixed(2)}, denoise=${params.denoiseStrength}`);
            // KROK 3: Buduj pipeline Sharp z adaptacyjnymi parametrami
            let pipeline = sharp(imageBuffer).grayscale();
            // Korekcja jasności (gamma)
            if (params.gamma !== 1.0) {
                pipeline = pipeline.gamma(params.gamma);
            }
            // Normalizacja histogramu (zawsze dla OCR)
            pipeline = pipeline.normalize();
            // Odszumianie (jeśli potrzebne)
            if (params.denoiseStrength > 0) {
                pipeline = pipeline.median(params.denoiseStrength);
            }
            // Korekcja kontrastu (linear)
            if (params.contrastMultiplier !== 1.0) {
                pipeline = pipeline.linear(params.contrastMultiplier, params.brightnessOffset);
            }
            // Wyostrzenie (adaptacyjne sigma)
            if (params.sharpenSigma > 0) {
                pipeline = pipeline.sharpen({
                    sigma: params.sharpenSigma,
                    m1: params.sharpenFlat,
                    m2: params.sharpenJagged,
                });
            }
            // Skalowanie do optymalnej rozdzielczości
            pipeline = pipeline.resize({
                width: params.targetWidth,
                height: params.targetHeight,
                fit: "inside",
                withoutEnlargement: true,
            });
            // Binaryzacja dla bardzo słabych skanów (opcjonalnie)
            if (params.applyThreshold) {
                pipeline = pipeline.threshold(params.thresholdValue);
            }
            const normalized = await pipeline.png({ quality: 100 }).toBuffer();
            return normalized;
        }
        catch (error) {
            console.error("[DocumentProcessor] Adaptive normalization failed:", error);
            return imageBuffer;
        }
    }
    calculateAdaptiveParams(stats) {
        // Domyślne parametry
        let gamma = 1.0;
        let contrastMultiplier = 1.0;
        let brightnessOffset = 0;
        let sharpenSigma = 1.0;
        let sharpenFlat = 1.0;
        let sharpenJagged = 2.0;
        let denoiseStrength = 0;
        const targetWidth = 2480; // ~A4 @ 300 DPI
        const targetHeight = 3508;
        let applyThreshold = false;
        let thresholdValue = 128;
        // ADAPTACJA: Korekcja jasności
        if (stats.isDark) {
            // Ciemny obraz - rozjaśnij (gamma < 1 rozjaśnia)
            gamma = 0.7 + (stats.brightness / 255) * 0.3; // 0.7-1.0
            brightnessOffset = Math.round((128 - stats.brightness) * 0.3);
            console.log("[DocumentProcessor] Dark image detected - applying brightness correction");
        }
        else if (stats.isBright) {
            // Jasny obraz - przyciemnij (gamma > 1 przyciemnia)
            gamma = 1.0 + ((stats.brightness - 200) / 55) * 0.5; // 1.0-1.5
            brightnessOffset = -Math.round((stats.brightness - 128) * 0.2);
            console.log("[DocumentProcessor] Bright image detected - applying darkness correction");
        }
        // ADAPTACJA: Korekcja kontrastu
        if (stats.isLowContrast) {
            // Niski kontrast - zwiększ
            contrastMultiplier = 1.2 + (0.15 - stats.contrast) * 2; // 1.2-1.5
            console.log("[DocumentProcessor] Low contrast detected - boosting contrast");
        }
        // ADAPTACJA: Wyostrzenie
        if (stats.isBlurry) {
            // Rozmyty obraz - mocniejsze wyostrzenie
            sharpenSigma = 1.5 + (0.3 - stats.sharpness) * 2; // 1.5-2.1
            sharpenFlat = 1.5;
            sharpenJagged = 3.0;
            console.log("[DocumentProcessor] Blurry image detected - applying strong sharpening");
        }
        else if (stats.sharpness > 0.7) {
            // Już ostry - lekkie wyostrzenie
            sharpenSigma = 0.5;
            sharpenFlat = 0.5;
            sharpenJagged = 1.0;
        }
        // ADAPTACJA: Odszumianie
        if (stats.isNoisy) {
            // Zaszumiony obraz - odszum przed wyostrzeniem
            denoiseStrength = stats.noiseLevel > 0.6 ? 5 : 3; // median filter size
            // Zmniejsz wyostrzenie dla zaszumionych obrazów
            sharpenSigma = Math.max(sharpenSigma * 0.7, 0.5);
            console.log("[DocumentProcessor] Noisy image detected - applying denoising");
        }
        // ADAPTACJA: Binaryzacja dla bardzo słabych skanów
        if (stats.isLowContrast && stats.contrast < 0.1) {
            applyThreshold = true;
            // Adaptacyjny próg bazujący na jasności
            thresholdValue = Math.round(stats.brightness * 0.9);
            console.log("[DocumentProcessor] Very low contrast - applying adaptive threshold");
        }
        return {
            gamma,
            contrastMultiplier,
            brightnessOffset,
            sharpenSigma,
            sharpenFlat,
            sharpenJagged,
            denoiseStrength,
            targetWidth,
            targetHeight,
            applyThreshold,
            thresholdValue,
        };
    }
    // ============================================================================
    // TESSERACT.JS OCR - lokalne OCR bez API
    // ============================================================================
    async processImageWithTesseract(imageBuffer, pageNum) {
        try {
            console.log(`[DocumentProcessor] Tesseract OCR processing page ${pageNum}...`);
            // Normalizuj obraz przed OCR
            const normalizedImage = await this.normalizeImageForOCR(imageBuffer);
            const result = await Tesseract.recognize(normalizedImage, "pol+eng", {
                logger: (m) => {
                    if (m.status === "recognizing text") {
                        // Opcjonalnie loguj postęp
                    }
                },
            });
            const text = result.data.text.trim();
            const confidence = result.data.confidence;
            console.log(`[DocumentProcessor] Tesseract page ${pageNum}: ${text.length} chars, confidence: ${confidence.toFixed(1)}%`);
            return { text, confidence };
        }
        catch (error) {
            console.error(`[DocumentProcessor] Tesseract OCR failed for page ${pageNum}:`, error);
            return { text: "", confidence: 0 };
        }
    }
    // ============================================================================
    // PDF OCR - Tesseract first, GPT-4 Vision fallback
    // ============================================================================
    /**
     * Process scanned PDF using Tesseract.js first, Vision API as fallback
     * Converts PDF pages to PNG images using Poppler, normalizes with Sharp, then OCR
     */
    async processPDFWithOCR(fileBuffer, fileName, mimeType, fileSize, pageCount, ocrOptions = {}) {
        console.log(`[DocumentProcessor] Processing PDF with OCR: ${fileName}`);
        let pngPages = [];
        // KROK 1: Konwertuj PDF na obrazy PNG używając Poppler (node-poppler)
        const tempDir = path.join(os.tmpdir(), `pdf-ocr-${Date.now()}`);
        const tempPdfPath = path.join(tempDir, "input.pdf");
        try {
            console.log(`[DocumentProcessor] Converting PDF pages to PNG images using Poppler...`);
            // Utwórz katalog tymczasowy
            await fs.promises.mkdir(tempDir, { recursive: true });
            // Zapisz PDF do pliku tymczasowego
            await fs.promises.writeFile(tempPdfPath, fileBuffer);
            // Określ maksymalną liczbę stron do przetworzenia
            const maxPages = pageCount && pageCount > 10 ? 10 : pageCount || 10;
            // Użyj Poppler do konwersji PDF na PNG
            const outputPrefix = path.join(tempDir, "page");
            await poppler.pdfToPpm(tempPdfPath, outputPrefix, {
                pngFile: true,
                resolutionXYAxis: 200, // 200 DPI - dobra jakość dla OCR
                firstPageToConvert: 1,
                lastPageToConvert: maxPages,
            });
            // Wczytaj wygenerowane pliki PNG
            const files = await fs.promises.readdir(tempDir);
            const pngFiles = files
                .filter((f) => f.startsWith("page") && f.endsWith(".png"))
                .sort();
            for (let i = 0; i < pngFiles.length; i++) {
                const pngFile = pngFiles[i];
                if (!pngFile)
                    continue;
                const pngPath = path.join(tempDir, pngFile);
                const pngBuffer = await fs.promises.readFile(pngPath);
                pngPages.push({
                    content: pngBuffer,
                    pageNumber: i + 1,
                });
            }
            console.log(`[DocumentProcessor] Converted ${pngPages.length} pages to PNG using Poppler`);
        }
        catch (pdfConversionError) {
            console.error("[DocumentProcessor] PDF to PNG conversion failed:", pdfConversionError instanceof Error
                ? pdfConversionError.message
                : pdfConversionError);
        }
        finally {
            // Posprzątaj pliki tymczasowe
            try {
                await fs.promises.rm(tempDir, { recursive: true, force: true });
            }
            catch {
                // Ignoruj błędy sprzątania
            }
        }
        // Jeśli konwersja nie zadziałała, zwróć informacyjny błąd
        if (pngPages.length === 0) {
            return {
                success: false,
                text: "",
                metadata: {
                    fileName,
                    fileType: "pdf",
                    mimeType,
                    fileSize,
                    processingMethod: "ocr",
                },
                error: "Nie udało się przekonwertować PDF na obrazy. Sprawdź czy Poppler jest zainstalowany.",
            };
        }
        // KROK 2: OCR każdej strony - najpierw Tesseract, potem Vision API jeśli słaba jakość
        const confidenceThreshold = ocrOptions.tesseractConfidenceThreshold ?? 75;
        const visionMaxDim = ocrOptions.visionMaxDimension ?? 768;
        const useVisionOnly = ocrOptions.useVisionOnly ?? false;
        const allTexts = [];
        const maxPagesToProcess = Math.min(pngPages.length, 10);
        let totalConfidence = 0;
        let pagesProcessed = 0;
        let blankPagesSkipped = 0;
        for (let i = 0; i < maxPagesToProcess; i++) {
            const page = pngPages[i];
            if (!page || !page.content)
                continue;
            // Jeśli nie useVisionOnly - najpierw spróbuj Tesseract
            if (!useVisionOnly) {
                const tesseractResult = await this.processImageWithTesseract(page.content, page.pageNumber);
                // Jeśli Tesseract dał dobry wynik (confidence >= threshold i tekst > 30 znaków) - użyj go
                if (tesseractResult.confidence >= confidenceThreshold &&
                    tesseractResult.text.length > 30) {
                    allTexts.push(`--- Strona ${page.pageNumber} ---\n${tesseractResult.text}`);
                    totalConfidence += tesseractResult.confidence;
                    pagesProcessed++;
                    continue;
                }
                // Tesseract słaby - kontynuuj do Vision API
                console.log(`[DocumentProcessor] Tesseract confidence too low (${tesseractResult.confidence.toFixed(1)}% < ${confidenceThreshold}%), using Vision API for page ${page.pageNumber}`);
            }
            // Sprawdź czy strona jest pusta (brightness ~255 i contrast ~0)
            const stats = await this.analyzeImageStats(page.content);
            if (stats.brightness > 250 && stats.contrast < 0.05) {
                console.log(`[DocumentProcessor] Page ${page.pageNumber} appears to be blank (brightness=${stats.brightness.toFixed(1)}, contrast=${stats.contrast.toFixed(2)}), skipping`);
                blankPagesSkipped++;
                continue; // Pomiń pustą stronę
            }
            // Vision API dla słabych wyników Tesseract lub useVisionOnly
            if (this.visionClient && this.visionModel && this.userId) {
                console.log(`[DocumentProcessor] Using Vision API (${this.visionModel}) for page ${page.pageNumber}`);
                try {
                    // Optymalizuj obraz dla Vision API (768px domyślnie, konfigurowalne)
                    const visionOptimizer = getVisionOptimizer(this.visionModel);
                    visionOptimizer.setConfig({ maxDimension: visionMaxDim });
                    const optimizedImage = await visionOptimizer.optimizeImage(page.content);
                    // Użyj VisionQueue dla async processing (bez timeout)
                    const useQueue = ocrOptions.useVisionQueue ?? true;
                    if (useQueue) {
                        // Async przez Redis queue - dodaj zadanie i czekaj na wynik
                        const jobId = await addVisionJob(this.userId, optimizedImage.base64, `Odczytaj cały tekst ze strony ${page.pageNumber}. Zachowaj formatowanie.`, {
                            provider: this.visionProvider,
                            model: this.visionModel,
                            pageNumber: page.pageNumber,
                            fileName,
                        });
                        // Czekaj na wynik z dłuższym timeout (5 minut per strona)
                        const result = await waitForVisionResult(jobId, 300000);
                        if (result.success && result.text.trim()) {
                            allTexts.push(`--- Strona ${page.pageNumber} ---\n${result.text}`);
                            totalConfidence += result.confidence ?? 90;
                            pagesProcessed++;
                        }
                        else if (result.error) {
                            console.warn(`[DocumentProcessor] Vision Queue job failed for page ${page.pageNumber}: ${result.error}`);
                        }
                    }
                    else {
                        // Bezpośrednie wywołanie (może timeout)
                        const messages = this.buildVisionMessages(optimizedImage.base64, `Odczytaj cały tekst ze strony ${page.pageNumber}. Zachowaj formatowanie.`);
                        const response = (await this.visionClient.chat.completions.create({
                            model: this.visionModel,
                            messages,
                            max_tokens: 4096,
                        }));
                        const pageText = response.choices[0]?.message?.content || "";
                        if (pageText.trim()) {
                            allTexts.push(`--- Strona ${page.pageNumber} ---\n${pageText}`);
                            totalConfidence += 90;
                            pagesProcessed++;
                        }
                    }
                }
                catch (visionError) {
                    console.error(`[DocumentProcessor] Vision API (${this.visionModel}) failed for page ${page.pageNumber}:`, visionError);
                    console.warn(`[DocumentProcessor] Page ${page.pageNumber} could not be processed`);
                }
            }
            else {
                // Brak Vision API - loguj ostrzeżenie
                console.warn(`[DocumentProcessor] No Vision API available for page ${page.pageNumber}, skipping`);
            }
        }
        const extractedText = allTexts.join("\n\n");
        const avgConfidence = pagesProcessed > 0 ? totalConfidence / pagesProcessed : 0;
        if (!extractedText.trim()) {
            return {
                success: false,
                text: "",
                metadata: {
                    fileName,
                    fileType: "pdf",
                    mimeType,
                    fileSize,
                    pageCount: pngPages.length,
                    processingMethod: "ocr",
                },
                error: "Nie udało się odczytać tekstu z żadnej strony",
            };
        }
        return {
            success: true,
            text: extractedText,
            metadata: {
                fileName,
                fileType: "pdf",
                mimeType,
                fileSize,
                pageCount: pngPages.length,
                processingMethod: "ocr",
                confidence: avgConfidence / 100, // Normalizuj do 0-1
                language: "pl",
                blankPagesSkipped,
            },
        };
    }
    /**
     * Process DOCX file
     */
    async processDOCX(fileBuffer, fileName, mimeType, fileSize) {
        console.log(`[DocumentProcessor] Processing DOCX: ${fileName}`);
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        return {
            success: true,
            text: result.value,
            metadata: {
                fileName,
                fileType: "docx",
                mimeType,
                fileSize,
                processingMethod: "text-extraction",
                language: "pl",
            },
        };
    }
    /**
     * Process plain text file
     */
    processTextFile(fileBuffer, fileName, mimeType, fileSize) {
        console.log(`[DocumentProcessor] Processing text file: ${fileName}`);
        return {
            success: true,
            text: fileBuffer.toString("utf-8"),
            metadata: {
                fileName,
                fileType: "text",
                mimeType,
                fileSize,
                processingMethod: "direct",
                language: "pl",
            },
        };
    }
    getFileType(mimeType) {
        if (mimeType.startsWith("image/"))
            return "image";
        if (mimeType === "application/pdf")
            return "pdf";
        if (mimeType.includes("wordprocessingml"))
            return "docx";
        if (mimeType.startsWith("text/"))
            return "text";
        return "unknown";
    }
    /**
     * Save extracted text to RAG database
     * Sprawdza duplikaty przed zapisem i normalizuje metadane
     */
    async saveToRAG(userId, text, title, sourceFileName, documentType = "uploaded") {
        try {
            if (!this.embeddingsClient) {
                throw new Error("Embeddings client not initialized. Call initializeWithUserConfig first.");
            }
            const sourceUrl = `file://${sourceFileName}`;
            // ═══════════════════════════════════════════════════════════════════
            // SPRAWDZENIE DUPLIKATÓW
            // ═══════════════════════════════════════════════════════════════════
            const { data: existingByUrl } = await supabase
                .from("processed_documents")
                .select("id, title")
                .eq("user_id", userId)
                .eq("source_url", sourceUrl)
                .maybeSingle();
            if (existingByUrl) {
                console.log(`[DocumentProcessor] Document already exists (by URL): ${existingByUrl.id} - "${existingByUrl.title}"`);
                return {
                    success: true,
                    documentId: existingByUrl.id,
                    error: "Dokument już istnieje w bazie (ten sam URL)",
                };
            }
            // ═══════════════════════════════════════════════════════════════════
            // NORMALIZACJA METADANYCH
            // ═══════════════════════════════════════════════════════════════════
            const normalized = this.extractNormalizedMetadata(title, text);
            console.log(`[DocumentProcessor] Normalized: session=${normalized.sessionNumber || "N/A"}, ` +
                `title="${normalized.normalizedTitle}", date=${normalized.publishDate || "N/A"}`);
            // Sprawdź duplikat po znormalizowanym tytule
            if (normalized.normalizedTitle) {
                const { data: existingByNormTitle } = await supabase
                    .from("processed_documents")
                    .select("id, title, source_url")
                    .eq("user_id", userId)
                    .eq("document_type", documentType)
                    .ilike("normalized_title", normalized.normalizedTitle)
                    .maybeSingle();
                if (existingByNormTitle) {
                    console.log(`[DocumentProcessor] Document already exists (by normalized title): ${existingByNormTitle.id}`);
                    return {
                        success: true,
                        documentId: existingByNormTitle.id,
                        error: "Dokument już istnieje w bazie (ten sam tytuł)",
                    };
                }
            }
            // ═══════════════════════════════════════════════════════════════════
            // GENEROWANIE EMBEDDINGU I ZAPIS
            // ═══════════════════════════════════════════════════════════════════
            const embeddingResponse = await this.embeddingsClient.embeddings.create({
                model: this.embeddingModel,
                input: text.slice(0, 8000),
            });
            const embeddingData = embeddingResponse.data[0];
            if (!embeddingData) {
                throw new Error("Nie udało się wygenerować embeddingu");
            }
            const embedding = embeddingData.embedding;
            const { data, error } = await supabase
                .from("processed_documents")
                .insert({
                user_id: userId,
                title,
                content: text,
                source_url: sourceUrl,
                document_type: documentType,
                embedding,
                processed_at: new Date().toISOString(),
                // Nowe znormalizowane pola
                session_number: normalized.sessionNumber,
                normalized_title: normalized.normalizedTitle,
                normalized_publish_date: normalized.publishDate,
                document_number: normalized.documentNumber,
                session_type: normalized.sessionType,
                is_normalized: true,
                normalization_confidence: 70,
            })
                .select("id")
                .single();
            if (error) {
                throw error;
            }
            console.log(`[DocumentProcessor] Saved to RAG with ID: ${data.id}`);
            return {
                success: true,
                documentId: data.id,
            };
        }
        catch (error) {
            console.error("[DocumentProcessor] Failed to save to RAG:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Błąd zapisu do bazy",
            };
        }
    }
    /**
     * Wyodrębnia znormalizowane metadane z tytułu i treści dokumentu
     */
    extractNormalizedMetadata(title, content) {
        // Wyodrębnij numer sesji
        const sessionNumber = this.extractSessionNumber(title) ||
            this.extractSessionNumber(content.slice(0, 500));
        // Znormalizuj tytuł
        let normalizedTitle = title
            .replace(/\s*\|.*$/, "") // Usuń " | Urząd Miejski..."
            .replace(/\s*-?\s*System\s+Rada.*$/i, "") // Usuń "System Rada"
            .trim();
        if (sessionNumber) {
            // Zamień różne formaty numeru sesji na zunifikowany
            normalizedTitle = normalizedTitle.replace(/(?:sesj[iaęy])\s+(?:nr\.?\s*)?[IVXLC0-9]+/gi, `Sesja ${sessionNumber}`);
        }
        normalizedTitle = normalizedTitle.replace(/\s+/g, " ").trim();
        // Wyodrębnij datę publikacji
        const publishDate = this.extractPublishDate(title, content);
        // Wyodrębnij numer dokumentu (np. XV/123/24)
        const documentNumber = this.extractDocumentNumber(title);
        // Określ typ sesji
        const sessionType = this.extractSessionType(title, content);
        return {
            sessionNumber,
            normalizedTitle: normalizedTitle || null,
            publishDate,
            documentNumber,
            sessionType,
        };
    }
    extractSessionNumber(text) {
        if (!text)
            return null;
        // Wzorce dla numeru sesji (arabskie)
        const arabicPatterns = [
            /sesj[iaęy]\s+(?:nr\.?\s*)?(\d{1,3})/i,
            /(\d{1,3})\s*sesj/i,
        ];
        for (const pattern of arabicPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const num = parseInt(match[1], 10);
                if (num > 0 && num <= 200)
                    return num;
            }
        }
        // Wzorce dla numeru sesji (rzymskie)
        const romanPatterns = [
            /sesj[iaęy]\s+(?:nr\.?\s*)?([IVXLC]{1,10})/i,
            /([IVXLC]{1,10})\s*sesj/i,
            /nr\.?\s*([IVXLC]{1,10})/i,
        ];
        for (const pattern of romanPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const num = this.romanToArabic(match[1]);
                if (num > 0 && num <= 200)
                    return num;
            }
        }
        return null;
    }
    romanToArabic(roman) {
        const values = { I: 1, V: 5, X: 10, L: 50, C: 100 };
        let result = 0, prev = 0;
        for (let i = roman.length - 1; i >= 0; i--) {
            const char = roman[i];
            const curr = char ? values[char.toUpperCase()] || 0 : 0;
            result += curr < prev ? -curr : curr;
            prev = curr;
        }
        return result;
    }
    extractPublishDate(title, content) {
        const text = title + " " + content.slice(0, 1000);
        // Wzorce dat: "15.01.2026", "15-01-2026", "15 stycznia 2026", "2026-01-15"
        const patterns = [
            /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
            /(\d{1,2})-(\d{1,2})-(\d{4})/,
            /(\d{4})-(\d{2})-(\d{2})/,
            /(\d{1,2})\s+(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia)\s+(\d{4})/i,
        ];
        const monthNames = {
            stycznia: "01",
            lutego: "02",
            marca: "03",
            kwietnia: "04",
            maja: "05",
            czerwca: "06",
            lipca: "07",
            sierpnia: "08",
            września: "09",
            października: "10",
            listopada: "11",
            grudnia: "12",
        };
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                try {
                    let year, month, day;
                    if (match[2] && monthNames[match[2].toLowerCase()]) {
                        // Format: "15 stycznia 2026"
                        day = match[1].padStart(2, "0");
                        month = monthNames[match[2].toLowerCase()];
                        year = match[3];
                    }
                    else if (match[1].length === 4) {
                        // Format: "2026-01-15"
                        year = match[1];
                        month = match[2];
                        day = match[3];
                    }
                    else {
                        // Format: "15.01.2026" lub "15-01-2026"
                        day = match[1].padStart(2, "0");
                        month = match[2].padStart(2, "0");
                        year = match[3];
                    }
                    const dateStr = `${year}-${month}-${day}`;
                    // Walidacja daty
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime()) &&
                        date.getFullYear() >= 2000 &&
                        date.getFullYear() <= 2030) {
                        return dateStr;
                    }
                }
                catch {
                    continue;
                }
            }
        }
        return null;
    }
    extractDocumentNumber(title) {
        // Wzorce dla numerów uchwał: XV/123/24, 123/2024, Nr 123
        const patterns = [
            /([IVXLC]+\/\d+\/\d+)/i, // XV/123/24
            /(?:uchwała|uchwały)\s+(?:nr\.?\s*)?(\d+\/\d+)/i, // uchwała 123/2024
            /(?:nr\.?\s*)(\d+\/\d+\/\d+)/i, // Nr 123/456/24
        ];
        for (const pattern of patterns) {
            const match = title.match(pattern);
            if (match && match[1]) {
                return match[1].toUpperCase();
            }
        }
        return null;
    }
    extractSessionType(title, content) {
        const text = (title + " " + content.slice(0, 500)).toLowerCase();
        if (text.includes("nadzwyczajn"))
            return "extraordinary";
        if (text.includes("budżet") || text.includes("budzetow"))
            return "budget";
        if (text.includes("konstytucyjn") || text.includes("inauguracyjn"))
            return "constituent";
        return "ordinary";
    }
    /**
     * Process audio/video file with STT transcription
     */
    async processAudio(fileBuffer, fileName, mimeType, fileSize) {
        if (!this.userId) {
            return {
                success: false,
                text: "",
                metadata: {
                    fileName,
                    fileType: "audio",
                    mimeType,
                    fileSize,
                    processingMethod: "stt",
                },
                error: "User not initialized. Call initializeWithUserConfig first.",
            };
        }
        try {
            console.log(`[DocumentProcessor] Processing audio file: ${fileName}`);
            // Get STT client
            const sttClient = await getSTTClient(this.userId);
            const sttConfig = await getAIConfig(this.userId, "stt");
            console.log(`[DocumentProcessor] STT: provider=${sttConfig.provider}, model=${sttConfig.modelName}`);
            // Zapisz plik do temp
            const tempDir = path.join(os.tmpdir(), "aasystent-documents");
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const tempPath = path.join(tempDir, `${Date.now()}-${fileName}`);
            fs.writeFileSync(tempPath, fileBuffer);
            // Adaptacyjny preprocessing audio
            let processedPath = tempPath;
            try {
                const { getAudioPreprocessor } = await import("./audio-preprocessor.js");
                const preprocessor = getAudioPreprocessor();
                console.log(`[DocumentProcessor] Starting adaptive audio preprocessing...`);
                const result = await preprocessor.preprocessAdaptive(tempPath, "wav");
                processedPath = result.outputPath;
                console.log(`[DocumentProcessor] Preprocessing complete. Issues: ${result.analysis.issues.map((i) => i.type).join(", ") || "none"}`);
            }
            catch (preprocessError) {
                console.warn(`[DocumentProcessor] Preprocessing failed, using original audio:`, preprocessError);
                processedPath = tempPath;
            }
            try {
                // Create read stream for transcription
                const audioStream = fs.createReadStream(processedPath);
                const transcription = await sttClient.audio.transcriptions.create({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    file: audioStream,
                    model: sttConfig.modelName,
                    language: "pl",
                    response_format: "text",
                });
                const text = transcription;
                // Cleanup temp files
                if (fs.existsSync(processedPath))
                    fs.unlinkSync(processedPath);
                if (processedPath !== tempPath && fs.existsSync(tempPath))
                    fs.unlinkSync(tempPath);
                if (!text || text.trim().length === 0) {
                    return {
                        success: false,
                        text: "",
                        metadata: {
                            fileName,
                            fileType: "audio",
                            mimeType,
                            fileSize,
                            processingMethod: "stt",
                        },
                        error: "Nie udało się rozpoznać mowy w nagraniu",
                    };
                }
                return {
                    success: true,
                    text: text.trim(),
                    metadata: {
                        fileName,
                        fileType: "audio",
                        mimeType,
                        fileSize,
                        processingMethod: "stt",
                        sttModel: sttConfig.modelName,
                    },
                };
            }
            catch (error) {
                // Cleanup temp files on error
                if (fs.existsSync(processedPath))
                    fs.unlinkSync(processedPath);
                if (processedPath !== tempPath && fs.existsSync(tempPath))
                    fs.unlinkSync(tempPath);
                throw error;
            }
        }
        catch (error) {
            console.error("[DocumentProcessor] Audio processing error:", error);
            return {
                success: false,
                text: "",
                metadata: {
                    fileName,
                    fileType: "audio",
                    mimeType,
                    fileSize,
                    processingMethod: "stt",
                },
                error: error instanceof Error ? error.message : "Błąd transkrypcji audio",
            };
        }
    }
}
//# sourceMappingURL=document-processor.js.map