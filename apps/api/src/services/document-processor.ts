import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { pdfToPng } from "pdf-to-png-converter";

const require = createRequire(import.meta.url);
const pdfParseModule = require("pdf-parse");
const pdfParse = pdfParseModule.default || pdfParseModule;
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
    processingMethod: "ocr" | "text-extraction" | "direct";
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
  | "application/octet-stream";

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
  private openai: OpenAI | null = null;

  constructor() {}

  /**
   * Initialize OpenAI client with user's API key
   */
  async initializeWithUserConfig(userId: string): Promise<void> {
    const { data: config } = await supabase
      .from("api_configurations")
      .select("*")
      .eq("user_id", userId)
      .eq("is_default", true)
      .eq("is_active", true)
      .single();

    if (!config) {
      throw new Error("Brak skonfigurowanego klucza API. Przejdź do ustawień.");
    }

    const decodedApiKey = Buffer.from(
      config.api_key_encrypted,
      "base64"
    ).toString("utf-8");

    this.openai = new OpenAI({
      apiKey: decodedApiKey,
      baseURL: this.getProviderBaseUrl(config.provider),
    });
  }

  private getProviderBaseUrl(provider: string): string | undefined {
    switch (provider) {
      case "openai":
        return undefined;
      case "openrouter":
        return "https://openrouter.ai/api/v1";
      case "anthropic":
        return "https://api.anthropic.com/v1";
      case "groq":
        return "https://api.groq.com/openai/v1";
      default:
        return undefined;
    }
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
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }

    const base64Image = fileBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    console.log(
      `[DocumentProcessor] Processing image with GPT-4 Vision: ${fileName}`
    );

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
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
        processingMethod: "ocr",
        confidence: 0.9,
        language: "pl",
      },
    };
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

  /**
   * Process scanned PDF using GPT-4 Vision
   * Converts PDF pages to PNG images first, then sends to Vision API
   */
  private async processPDFWithOCR(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileSize: number,
    pageCount?: number
  ): Promise<ProcessedDocument> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }

    console.log(
      `[DocumentProcessor] Processing PDF with GPT-4 Vision OCR: ${fileName}`
    );

    try {
      // Konwertuj strony PDF na obrazy PNG
      console.log(`[DocumentProcessor] Converting PDF pages to PNG images...`);
      // Konwertuj Buffer na ArrayBuffer dla kompatybilności z pdf-to-png-converter
      const pdfArrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      );
      const pngPages = await pdfToPng(pdfArrayBuffer as ArrayBuffer, {
        disableFontFace: true,
        useSystemFonts: false,
        viewportScale: 2.0, // Wyższa rozdzielczość dla lepszego OCR
        pagesToProcess:
          pageCount && pageCount > 10
            ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
            : undefined, // Limit do 10 stron
      });

      if (!pngPages || pngPages.length === 0) {
        throw new Error("Nie udało się przekonwertować PDF na obrazy");
      }

      console.log(
        `[DocumentProcessor] Converted ${pngPages.length} pages to PNG`
      );

      // Przetwórz każdą stronę przez OCR
      const allTexts: string[] = [];
      const maxPagesToProcess = Math.min(pngPages.length, 10); // Limit 10 stron

      for (let i = 0; i < maxPagesToProcess; i++) {
        const page = pngPages[i];
        if (!page || !page.content) continue;

        console.log(
          `[DocumentProcessor] OCR processing page ${
            i + 1
          }/${maxPagesToProcess}`
        );

        const base64Image = page.content.toString("base64");
        const dataUrl = `data:image/png;base64,${base64Image}`;

        const response = await this.openai.chat.completions.create({
          model: "gpt-4o",
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
                  text: `Odczytaj cały tekst ze strony ${
                    i + 1
                  }. Zachowaj formatowanie.`,
                },
              ],
            },
          ],
          max_completion_tokens: 4096,
        });

        const pageText = response.choices[0]?.message?.content || "";
        if (pageText.trim()) {
          allTexts.push(`--- Strona ${i + 1} ---\n${pageText}`);
        }
      }

      const extractedText = allTexts.join("\n\n");

      if (!extractedText.trim()) {
        throw new Error("Nie udało się odczytać tekstu z żadnej strony");
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
          confidence: 0.85,
          language: "pl",
        },
      };
    } catch (error) {
      console.error("[DocumentProcessor] PDF OCR failed:", error);
      return {
        success: false,
        text: "",
        metadata: {
          fileName,
          fileType: "pdf",
          mimeType,
          fileSize,
          pageCount,
          processingMethod: "ocr",
        },
        error:
          error instanceof Error
            ? `OCR error: ${error.message}`
            : "Nie udało się odczytać tekstu z PDF. Spróbuj z plikiem lepszej jakości.",
      };
    }
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
      if (!this.openai) {
        throw new Error("OpenAI client not initialized");
      }

      // Generate embedding
      const embeddingResponse = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
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
}
