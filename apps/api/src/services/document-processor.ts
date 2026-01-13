import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import { Poppler } from "node-poppler";
import {
  getVisionClient,
  getEmbeddingsClient,
  getSTTClient,
  getAIConfig,
} from "../ai/index.js";
// import { getAudioPreprocessor } from "./audio-preprocessor.js"; // Tymczasowo wyłączone

const require = createRequire(import.meta.url);

// Konfiguracja Poppler - ścieżka do binariów na Windows
const popplerBinPath =
  process.platform === "win32"
    ? "C:\\ProgramData\\poppler\\poppler-24.08.0\\Library\\bin"
    : undefined; // Na Linux/macOS używa systemowego poppler

const poppler = new Poppler(popplerBinPath);
console.log("[DocumentProcessor] node-poppler initialized");

// pdf-parse - nowa wersja eksportuje obiekt z klasą PDFParse
let pdfParse: (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
try {
  const pdfParseModule = require("pdf-parse");

  // Sprawdź różne formaty eksportu
  if (typeof pdfParseModule === "function") {
    // Stara wersja - funkcja bezpośrednio
    pdfParse = pdfParseModule;
  } else if (typeof pdfParseModule.default === "function") {
    // ESM default export
    pdfParse = pdfParseModule.default;
  } else if (typeof pdfParseModule.PDFParse === "function") {
    // Nowa wersja - klasa PDFParse z metodą getText()
    const PDFParse = pdfParseModule.PDFParse;
    pdfParse = async (buffer: Buffer) => {
      const parser = new PDFParse({ verbosity: 0, data: buffer });
      const textResult = await parser.getText();
      return {
        text: textResult?.text || "",
        numpages: textResult?.numPages || textResult?.pages?.length || 1,
      };
    };
  } else {
    // Fallback - spróbuj użyć jako funkcji
    console.warn(
      "[DocumentProcessor] pdf-parse format unknown, keys:",
      Object.keys(pdfParseModule)
    );
    pdfParse = async () => {
      throw new Error("pdf-parse format not supported");
    };
  }

  console.log("[DocumentProcessor] pdf-parse loaded successfully");
} catch (err) {
  console.error("[DocumentProcessor] Failed to load pdf-parse:", err);
  pdfParse = async () => {
    throw new Error("pdf-parse module not available");
  };
}

const mammoth = require("mammoth");

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

type SupportedMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/bmp"
  | "image/webp"
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "text/plain"
  | "text/markdown"
  | "application/octet-stream"
  // Audio formats
  | "audio/mpeg"
  | "audio/mp3"
  | "audio/wav"
  | "audio/x-wav"
  | "audio/mp4"
  | "audio/m4a"
  | "audio/x-m4a"
  | "audio/ogg"
  | "audio/webm"
  // Video formats
  | "video/mp4"
  | "video/webm"
  | "video/ogg";

// Mapowanie rozszerzeń plików na MIME types
const EXTENSION_TO_MIME: Record<string, SupportedMimeType> = {
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
};

export class DocumentProcessor {
  private visionClient: OpenAI | null = null;
  private embeddingsClient: OpenAI | null = null;
  private embeddingModel: string = "nomic-embed-text";
  private visionModel: string = "gpt-4o";
  private userId: string | null = null;

  constructor() {}

  /**
   * Initialize AI clients with user's configuration via AIClientFactory
   */
  async initializeWithUserConfig(userId: string): Promise<void> {
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
    console.log(
      `[DocumentProcessor] Initialized for user ${userId.substring(0, 8)}...`
    );
    console.log(
      `[DocumentProcessor] Vision: provider=${visionConfig.provider}, model=${this.visionModel}`
    );
    console.log(`[DocumentProcessor] Embeddings: model=${this.embeddingModel}`);
  }

  /**
   * Process uploaded file and extract text
   */
  async processFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<ProcessedDocument> {
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
        error: `Plik jest zbyt duży (${Math.round(
          fileSize / 1024 / 1024
        )}MB). Maksymalny rozmiar to 10MB.`,
      };
    }

    // Rozpoznaj MIME type na podstawie rozszerzenia jeśli to octet-stream
    let effectiveMimeType = mimeType;
    if (mimeType === "application/octet-stream") {
      const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
      if (EXTENSION_TO_MIME[ext]) {
        effectiveMimeType = EXTENSION_TO_MIME[ext];
        console.log(
          `[DocumentProcessor] Detected ${ext} file, using ${effectiveMimeType}`
        );
      }
    }

    try {
      switch (effectiveMimeType as SupportedMimeType) {
        case "image/jpeg":
        case "image/png":
        case "image/gif":
        case "image/bmp":
        case "image/webp":
          return await this.processImage(
            fileBuffer,
            fileName,
            mimeType,
            fileSize
          );

        case "application/pdf":
          return await this.processPDF(
            fileBuffer,
            fileName,
            mimeType,
            fileSize
          );

        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          return await this.processDOCX(
            fileBuffer,
            fileName,
            mimeType,
            fileSize
          );

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
        // Video formats
        case "video/mp4":
        case "video/webm":
        case "video/ogg":
          return await this.processAudio(
            fileBuffer,
            fileName,
            mimeType,
            fileSize
          );

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
    } catch (error) {
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
        error:
          error instanceof Error ? error.message : "Błąd przetwarzania pliku",
      };
    }
  }

  /**
   * Process image using GPT-4 Vision OCR
   */
  private async processImage(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileSize: number
  ): Promise<ProcessedDocument> {
    if (!this.visionClient) {
      throw new Error(
        "Vision client not initialized. Call initializeWithUserConfig first."
      );
    }

    console.log(
      `[DocumentProcessor] Processing image with Vision model ${this.visionModel}: ${fileName}`
    );

    // Analiza statystyk obrazu
    const stats = await this.analyzeImageStats(fileBuffer);
    console.log(
      `[DocumentProcessor] Image analysis: brightness=${stats.brightness.toFixed(
        1
      )}, contrast=${stats.contrast.toFixed(
        2
      )}, sharpness=${stats.sharpness.toFixed(
        2
      )}, noise=${stats.noiseLevel.toFixed(2)}`
    );

    // Sprawdź czy obraz jest pusty/biały
    if (stats.brightness > 250 && stats.contrast < 0.05) {
      console.log(
        `[DocumentProcessor] Image appears to be blank (brightness=${stats.brightness.toFixed(
          1
        )}, contrast=${stats.contrast.toFixed(2)})`
      );
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

    // Normalizacja obrazu przed OCR
    const normalizedImage = await this.normalizeImageForOCR(fileBuffer);
    console.log(`[DocumentProcessor] Image normalized`);

    // KROK 1: Najpierw spróbuj Tesseract (darmowe, lokalne)
    const tesseractResult = await this.processImageWithTesseract(
      normalizedImage,
      1 // page number
    );

    console.log(
      `[DocumentProcessor] Tesseract result: ${
        tesseractResult.text.length
      } chars, confidence: ${tesseractResult.confidence.toFixed(1)}%`
    );

    // Jeśli Tesseract dał dobry wynik (confidence > 50% i tekst > 30 znaków) - użyj go
    if (tesseractResult.confidence > 50 && tesseractResult.text.length > 30) {
      console.log(`[DocumentProcessor] Using Tesseract result (good quality)`);
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
    console.log(
      `[DocumentProcessor] Tesseract confidence too low (${tesseractResult.confidence.toFixed(
        1
      )}%), using Vision API fallback`
    );

    const base64Image = normalizedImage.toString("base64");
    const dataUrl = `data:image/png;base64,${base64Image}`;

    try {
      const response = await this.visionClient.chat.completions.create({
        model: this.visionModel,
        messages: [
          {
            role: "system",
            content: `Jesteś ekspertem OCR. Twoim zadaniem jest dokładne odczytanie i transkrypcja CAŁEGO tekstu widocznego na obrazie.

Zasady:
1. Odczytaj CAŁY tekst, zachowując oryginalną strukturę i formatowanie
2. Zachowaj akapity, nagłówki, listy i wcięcia
3. Jeśli tekst jest w tabelce, odtwórz strukturę używając | jako separatora
4. Jeśli tekst jest nieczytelny, oznacz to jako [nieczytelne]
5. Nie dodawaj własnych komentarzy ani interpretacji
6. Odpowiedz TYLKO tekstem odczytanym z obrazu`,
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
                text: "Odczytaj cały tekst z tego obrazu. Zachowaj formatowanie i strukturę dokumentu.",
              },
            ],
          },
        ],
        max_completion_tokens: 4096,
      });

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
    } catch (visionError) {
      console.error(`[DocumentProcessor] Vision API failed:`, visionError);

      // Użyj wyniku Tesseract nawet jeśli słaby
      if (tesseractResult.text.trim()) {
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
            ocrEngine: "tesseract-fallback",
          },
        };
      }

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
        error:
          "Nie udało się odczytać tekstu z obrazu (Tesseract i Vision API zawiodły)",
      };
    }
  }

  /**
   * Process PDF - try text extraction first, fallback to OCR for scanned PDFs
   */
  private async processPDF(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileSize: number
  ): Promise<ProcessedDocument> {
    console.log(`[DocumentProcessor] Processing PDF: ${fileName}`);

    try {
      const pdfData = await pdfParse(fileBuffer);
      const extractedText = pdfData.text.trim();

      // If text is very short or mostly whitespace, it's likely a scanned PDF
      const meaningfulText = extractedText.replace(/\s+/g, " ").trim();

      // Check for binary garbage (non-printable characters)
      const nonPrintableRatio =
        (meaningfulText.match(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F]/g) || [])
          .length / Math.max(meaningfulText.length, 1);
      const isBinaryGarbage = nonPrintableRatio > 0.3; // More than 30% non-printable = garbage

      if (meaningfulText.length < 100 || isBinaryGarbage) {
        console.log(
          `[DocumentProcessor] PDF appears to be scanned or contains binary garbage (nonPrintable: ${(
            nonPrintableRatio * 100
          ).toFixed(1)}%), using OCR`
        );
        // For scanned PDFs, we need to use Vision API
        // Convert first page to image concept - in production you'd use pdf-poppler
        // For now, send the PDF to Vision API which can handle some PDF formats
        return await this.processPDFWithOCR(
          fileBuffer,
          fileName,
          mimeType,
          fileSize,
          pdfData.numpages
        );
      }

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
    } catch (error) {
      console.error(
        "[DocumentProcessor] PDF parsing failed, trying OCR:",
        error
      );
      return await this.processPDFWithOCR(
        fileBuffer,
        fileName,
        mimeType,
        fileSize
      );
    }
  }

  // ============================================================================
  // SHARP IMAGE NORMALIZER - preprocessing dla lepszego OCR
  // ============================================================================

  // ============================================================================
  // ADAPTIVE IMAGE ANALYSIS - analiza obrazu dla adaptacyjnej normalizacji
  // ============================================================================

  private async analyzeImageStats(imageBuffer: Buffer): Promise<{
    brightness: number; // 0-255, średnia jasność
    contrast: number; // 0-1, współczynnik kontrastu
    sharpness: number; // 0-1, ostrość (bazując na krawędziach)
    noiseLevel: number; // 0-1, poziom szumu
    isLowContrast: boolean;
    isDark: boolean;
    isBright: boolean;
    isBlurry: boolean;
    isNoisy: boolean;
  }> {
    try {
      const image = sharp(imageBuffer);
      const { width, height } = await image.metadata();

      // Pobierz statystyki obrazu
      const stats = await image.stats();

      // Oblicz średnią jasność (z kanałów RGB lub grayscale)
      const channels = stats.channels;
      const avgBrightness =
        channels.reduce((sum, ch) => sum + ch.mean, 0) / channels.length;

      // Oblicz kontrast (bazując na odchyleniu standardowym)
      const avgStdDev =
        channels.reduce((sum, ch) => sum + ch.stdev, 0) / channels.length;
      const contrast = Math.min(avgStdDev / 128, 1); // Normalizuj do 0-1

      // Analiza ostrości - użyj Laplacian variance (przybliżenie)
      // Wysoka wariancja = ostry obraz, niska = rozmyty
      const grayscaleBuffer = await sharp(imageBuffer)
        .grayscale()
        .raw()
        .toBuffer();
      const sharpnessScore = this.calculateSharpness(
        grayscaleBuffer,
        width || 100,
        height || 100
      );

      // Analiza szumu - bazując na lokalnej wariancji w gładkich obszarach
      const noiseScore = this.estimateNoise(
        grayscaleBuffer,
        width || 100,
        height || 100
      );

      // Klasyfikacja
      const isLowContrast = contrast < 0.15;
      const isDark = avgBrightness < 80;
      const isBright = avgBrightness > 200;
      const isBlurry = sharpnessScore < 0.3;
      const isNoisy = noiseScore > 0.4;

      console.log(
        `[DocumentProcessor] Image analysis: brightness=${avgBrightness.toFixed(
          1
        )}, contrast=${contrast.toFixed(2)}, sharpness=${sharpnessScore.toFixed(
          2
        )}, noise=${noiseScore.toFixed(2)}`
      );

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
    } catch (error) {
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

  private calculateSharpness(
    buffer: Buffer,
    width: number,
    height: number
  ): number {
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

  private estimateNoise(buffer: Buffer, width: number, height: number): number {
    // Estymacja szumu metodą MAD (Median Absolute Deviation)
    // w małych blokach 3x3
    const differences: number[] = [];

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

    if (differences.length === 0) return 0;

    // Mediana różnic
    differences.sort((a, b) => a - b);
    const median = differences[Math.floor(differences.length / 2)] ?? 0;

    // Normalizuj do 0-1
    return Math.min(median / 30, 1);
  }

  // ============================================================================
  // ADAPTIVE NORMALIZATION - adaptacyjna normalizacja na podstawie analizy
  // ============================================================================

  private async normalizeImageForOCR(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // KROK 1: Analiza obrazu
      const stats = await this.analyzeImageStats(imageBuffer);

      // KROK 2: Dobór adaptacyjnych parametrów
      const params = this.calculateAdaptiveParams(stats);

      console.log(
        `[DocumentProcessor] Adaptive params: gamma=${params.gamma.toFixed(
          2
        )}, sharpen=${params.sharpenSigma.toFixed(2)}, denoise=${
          params.denoiseStrength
        }`
      );

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
        pipeline = pipeline.linear(
          params.contrastMultiplier,
          params.brightnessOffset
        );
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
    } catch (error) {
      console.error(
        "[DocumentProcessor] Adaptive normalization failed:",
        error
      );
      return imageBuffer;
    }
  }

  private calculateAdaptiveParams(stats: {
    brightness: number;
    contrast: number;
    sharpness: number;
    noiseLevel: number;
    isLowContrast: boolean;
    isDark: boolean;
    isBright: boolean;
    isBlurry: boolean;
    isNoisy: boolean;
  }): {
    gamma: number;
    contrastMultiplier: number;
    brightnessOffset: number;
    sharpenSigma: number;
    sharpenFlat: number;
    sharpenJagged: number;
    denoiseStrength: number;
    targetWidth: number;
    targetHeight: number;
    applyThreshold: boolean;
    thresholdValue: number;
  } {
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
      console.log(
        "[DocumentProcessor] Dark image detected - applying brightness correction"
      );
    } else if (stats.isBright) {
      // Jasny obraz - przyciemnij (gamma > 1 przyciemnia)
      gamma = 1.0 + ((stats.brightness - 200) / 55) * 0.5; // 1.0-1.5
      brightnessOffset = -Math.round((stats.brightness - 128) * 0.2);
      console.log(
        "[DocumentProcessor] Bright image detected - applying darkness correction"
      );
    }

    // ADAPTACJA: Korekcja kontrastu
    if (stats.isLowContrast) {
      // Niski kontrast - zwiększ
      contrastMultiplier = 1.2 + (0.15 - stats.contrast) * 2; // 1.2-1.5
      console.log(
        "[DocumentProcessor] Low contrast detected - boosting contrast"
      );
    }

    // ADAPTACJA: Wyostrzenie
    if (stats.isBlurry) {
      // Rozmyty obraz - mocniejsze wyostrzenie
      sharpenSigma = 1.5 + (0.3 - stats.sharpness) * 2; // 1.5-2.1
      sharpenFlat = 1.5;
      sharpenJagged = 3.0;
      console.log(
        "[DocumentProcessor] Blurry image detected - applying strong sharpening"
      );
    } else if (stats.sharpness > 0.7) {
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
      console.log(
        "[DocumentProcessor] Noisy image detected - applying denoising"
      );
    }

    // ADAPTACJA: Binaryzacja dla bardzo słabych skanów
    if (stats.isLowContrast && stats.contrast < 0.1) {
      applyThreshold = true;
      // Adaptacyjny próg bazujący na jasności
      thresholdValue = Math.round(stats.brightness * 0.9);
      console.log(
        "[DocumentProcessor] Very low contrast - applying adaptive threshold"
      );
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

  private async processImageWithTesseract(
    imageBuffer: Buffer,
    pageNum: number
  ): Promise<{ text: string; confidence: number }> {
    try {
      console.log(
        `[DocumentProcessor] Tesseract OCR processing page ${pageNum}...`
      );

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

      console.log(
        `[DocumentProcessor] Tesseract page ${pageNum}: ${
          text.length
        } chars, confidence: ${confidence.toFixed(1)}%`
      );

      return { text, confidence };
    } catch (error) {
      console.error(
        `[DocumentProcessor] Tesseract OCR failed for page ${pageNum}:`,
        error
      );
      return { text: "", confidence: 0 };
    }
  }

  // ============================================================================
  // PDF OCR - Tesseract first, GPT-4 Vision fallback
  // ============================================================================

  /**
   * Process scanned PDF using Tesseract.js first, GPT-4 Vision as fallback
   * Converts PDF pages to PNG images using Poppler, normalizes with Sharp, then OCR
   */
  private async processPDFWithOCR(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileSize: number,
    pageCount?: number
  ): Promise<ProcessedDocument> {
    console.log(`[DocumentProcessor] Processing PDF with OCR: ${fileName}`);

    let pngPages: Array<{ content: Buffer; pageNumber: number }> = [];

    // KROK 1: Konwertuj PDF na obrazy PNG używając Poppler (node-poppler)
    const tempDir = path.join(os.tmpdir(), `pdf-ocr-${Date.now()}`);
    const tempPdfPath = path.join(tempDir, "input.pdf");

    try {
      console.log(
        `[DocumentProcessor] Converting PDF pages to PNG images using Poppler...`
      );

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
        if (!pngFile) continue;
        const pngPath = path.join(tempDir, pngFile);
        const pngBuffer = await fs.promises.readFile(pngPath);
        pngPages.push({
          content: pngBuffer,
          pageNumber: i + 1,
        });
      }

      console.log(
        `[DocumentProcessor] Converted ${pngPages.length} pages to PNG using Poppler`
      );
    } catch (pdfConversionError) {
      console.error(
        "[DocumentProcessor] PDF to PNG conversion failed:",
        pdfConversionError instanceof Error
          ? pdfConversionError.message
          : pdfConversionError
      );
    } finally {
      // Posprzątaj pliki tymczasowe
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
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
        error:
          "Nie udało się przekonwertować PDF na obrazy. Sprawdź czy Poppler jest zainstalowany.",
      };
    }

    // KROK 2: OCR każdej strony - najpierw Tesseract, potem GPT-4 Vision jeśli słaba jakość
    const allTexts: string[] = [];
    const maxPagesToProcess = Math.min(pngPages.length, 10);
    let totalConfidence = 0;
    let pagesProcessed = 0;
    let blankPagesSkipped = 0;

    for (let i = 0; i < maxPagesToProcess; i++) {
      const page = pngPages[i];
      if (!page || !page.content) continue;

      // Najpierw spróbuj Tesseract (darmowe, lokalne)
      const tesseractResult = await this.processImageWithTesseract(
        page.content,
        page.pageNumber
      );

      // Jeśli Tesseract dał dobry wynik (confidence > 50% i tekst > 30 znaków) - użyj go
      if (tesseractResult.confidence > 50 && tesseractResult.text.length > 30) {
        allTexts.push(
          `--- Strona ${page.pageNumber} ---\n${tesseractResult.text}`
        );
        totalConfidence += tesseractResult.confidence;
        pagesProcessed++;
        continue;
      }

      // Sprawdź czy strona jest pusta (brightness ~255 i contrast ~0)
      const stats = await this.analyzeImageStats(page.content);
      if (stats.brightness > 250 && stats.contrast < 0.05) {
        console.log(
          `[DocumentProcessor] Page ${
            page.pageNumber
          } appears to be blank (brightness=${stats.brightness.toFixed(
            1
          )}, contrast=${stats.contrast.toFixed(2)}), skipping`
        );
        blankPagesSkipped++;
        continue; // Pomiń pustą stronę
      }

      // Fallback do Vision API dla słabych wyników Tesseract (tylko jeśli jest klient)
      if (this.visionClient && this.visionModel) {
        console.log(
          `[DocumentProcessor] Tesseract confidence too low (${tesseractResult.confidence.toFixed(
            1
          )}%), using Vision API (${this.visionModel}) for page ${
            page.pageNumber
          }`
        );

        try {
          // Normalizuj obraz przed wysłaniem do Vision API
          const normalizedImage = await this.normalizeImageForOCR(page.content);
          const base64Image = normalizedImage.toString("base64");
          const dataUrl = `data:image/png;base64,${base64Image}`;

          const response = await this.visionClient.chat.completions.create({
            model: this.visionModel,
            messages: [
              {
                role: "system",
                content: `Jesteś ekspertem OCR. Odczytaj CAŁY tekst z tego obrazu strony dokumentu.

Zasady:
1. Odczytaj CAŁY tekst, zachowując strukturę
2. Zachowaj akapity, nagłówki, listy
3. Dla tabel użyj formatu markdown z |
4. Nieczytelne fragmenty oznacz jako [nieczytelne]
5. Odpowiedz TYLKO odczytanym tekstem`,
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
                    text: `Odczytaj cały tekst ze strony ${page.pageNumber}. Zachowaj formatowanie.`,
                  },
                ],
              },
            ],
            max_completion_tokens: 4096,
          });

          const pageText = response.choices[0]?.message?.content || "";
          if (pageText.trim()) {
            allTexts.push(`--- Strona ${page.pageNumber} ---\n${pageText}`);
            totalConfidence += 90; // Vision API ma wysoką jakość
            pagesProcessed++;
          }
        } catch (visionError) {
          console.error(
            `[DocumentProcessor] Vision API (${this.visionModel}) failed for page ${page.pageNumber}:`,
            visionError
          );
          // Użyj wyniku Tesseract nawet jeśli słaby
          if (tesseractResult.text.trim()) {
            allTexts.push(
              `--- Strona ${page.pageNumber} ---\n${tesseractResult.text}`
            );
            totalConfidence += tesseractResult.confidence;
            pagesProcessed++;
          }
        }
      } else {
        // Brak Vision API - użyj Tesseract nawet jeśli słaby wynik
        console.log(
          `[DocumentProcessor] No Vision API available, using Tesseract result for page ${
            page.pageNumber
          } (confidence: ${tesseractResult.confidence.toFixed(1)}%)`
        );
        if (tesseractResult.text.trim()) {
          allTexts.push(
            `--- Strona ${page.pageNumber} ---\n${tesseractResult.text}`
          );
          totalConfidence += Math.max(tesseractResult.confidence, 30); // Minimum 30% dla słabych wyników
          pagesProcessed++;
        } else {
          console.warn(
            `[DocumentProcessor] Page ${page.pageNumber} has no readable text (Tesseract returned empty)`
          );
        }
      }
    }

    const extractedText = allTexts.join("\n\n");
    const avgConfidence =
      pagesProcessed > 0 ? totalConfidence / pagesProcessed : 0;

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
  private async processDOCX(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileSize: number
  ): Promise<ProcessedDocument> {
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
  private processTextFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileSize: number
  ): ProcessedDocument {
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

  private getFileType(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType === "application/pdf") return "pdf";
    if (mimeType.includes("wordprocessingml")) return "docx";
    if (mimeType.startsWith("text/")) return "text";
    return "unknown";
  }

  /**
   * Save extracted text to RAG database
   */
  async saveToRAG(
    userId: string,
    text: string,
    title: string,
    sourceFileName: string,
    documentType: string = "uploaded"
  ): Promise<SaveToRAGResult> {
    try {
      if (!this.embeddingsClient) {
        throw new Error(
          "Embeddings client not initialized. Call initializeWithUserConfig first."
        );
      }

      // Generate embedding
      const embeddingResponse = await this.embeddingsClient.embeddings.create({
        model: this.embeddingModel,
        input: text.slice(0, 8000), // Limit for embedding
      });

      const embeddingData = embeddingResponse.data[0];
      if (!embeddingData) {
        throw new Error("Nie udało się wygenerować embeddingu");
      }
      const embedding = embeddingData.embedding;

      // Save to processed_documents
      const { data, error } = await supabase
        .from("processed_documents")
        .insert({
          user_id: userId,
          title,
          content: text,
          source_url: `file://${sourceFileName}`,
          document_type: documentType,
          embedding,
          processed_at: new Date().toISOString(),
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
    } catch (error) {
      console.error("[DocumentProcessor] Failed to save to RAG:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Błąd zapisu do bazy",
      };
    }
  }

  /**
   * Process audio/video file with STT transcription
   */
  private async processAudio(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileSize: number
  ): Promise<ProcessedDocument> {
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

      console.log(
        `[DocumentProcessor] STT: provider=${sttConfig.provider}, model=${sttConfig.modelName}`
      );

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
        const { getAudioPreprocessor } = await import(
          "./audio-preprocessor.js"
        );
        const preprocessor = getAudioPreprocessor();
        console.log(
          `[DocumentProcessor] Starting adaptive audio preprocessing...`
        );
        const result = await preprocessor.preprocessAdaptive(tempPath, "wav");
        processedPath = result.outputPath;
        console.log(
          `[DocumentProcessor] Preprocessing complete. Issues: ${
            result.analysis.issues.map((i) => i.type).join(", ") || "none"
          }`
        );
      } catch (preprocessError) {
        console.warn(
          `[DocumentProcessor] Preprocessing failed, using original audio:`,
          preprocessError
        );
        processedPath = tempPath;
      }

      try {
        // Create read stream for transcription
        const audioStream = fs.createReadStream(processedPath);

        const transcription = await sttClient.audio.transcriptions.create({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          file: audioStream as any,
          model: sttConfig.modelName,
          language: "pl",
          response_format: "text",
        });

        const text = transcription as unknown as string;

        // Cleanup temp files
        if (fs.existsSync(processedPath)) fs.unlinkSync(processedPath);
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
      } catch (error) {
        // Cleanup temp files on error
        if (fs.existsSync(processedPath)) fs.unlinkSync(processedPath);
        if (processedPath !== tempPath && fs.existsSync(tempPath))
          fs.unlinkSync(tempPath);
        throw error;
      }
    } catch (error) {
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
        error:
          error instanceof Error ? error.message : "Błąd transkrypcji audio",
      };
    }
  }
}
