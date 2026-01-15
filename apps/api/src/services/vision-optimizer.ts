/**
 * Vision Optimizer Service
 *
 * Optymalizacja obrazów i promptów dla Vision LLM (Qwen3-VL, GPT-4V, etc.)
 *
 * Funkcje:
 * - Normalizacja obrazów do optymalnej rozdzielczości (768px dla Qwen3-VL)
 * - Kompresja promptów tekstowych
 * - Zoptymalizowane prompty ekstrakcji dokumentów
 */

import { Buffer } from "node:buffer";
import sharp from "sharp";

// ============================================================================
// TYPES
// ============================================================================

export interface VisionOptimizationConfig {
  // Rozdzielczość docelowa (dłuższy bok)
  maxDimension: number;
  // Jakość kompresji (1-100)
  quality: number;
  // Format wyjściowy
  format: "webp" | "png" | "jpeg";
  // Czy wyostrzać tekst
  sharpenText: boolean;
  // Czy normalizować kontrast
  normalizeContrast: boolean;
  // Czy konwertować do skali szarości (lepsze dla OCR)
  grayscale: boolean;
}

export interface OptimizedImage {
  buffer: Buffer;
  base64: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  dimensions: { width: number; height: number };
  format: string;
}

export interface CompressedPrompt {
  original: string;
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
}

export interface DocumentStructure {
  typ:
    | "uchwała"
    | "zarządzenie"
    | "protokół"
    | "druk"
    | "faktura"
    | "umowa"
    | "pismo"
    | "inny";
  numer: string | null;
  data: string | null;
  tytul: string;
  organ: string | null;
  streszczenie: string | null;
  osoby: string[];
  kwoty: string[];
  punkty: string[];
}

// ============================================================================
// DEFAULT CONFIGS PER MODEL
// ============================================================================

const MODEL_CONFIGS: Record<string, VisionOptimizationConfig> = {
  // Qwen3-VL - optymalne 768px
  "qwen3-vl": {
    maxDimension: 768,
    quality: 85,
    format: "webp",
    sharpenText: true,
    normalizeContrast: true,
    grayscale: false,
  },
  "qwen3-vl:2b": {
    maxDimension: 768,
    quality: 85,
    format: "webp",
    sharpenText: true,
    normalizeContrast: true,
    grayscale: false,
  },
  // Llava - 672px optymalne
  llava: {
    maxDimension: 672,
    quality: 85,
    format: "webp",
    sharpenText: true,
    normalizeContrast: true,
    grayscale: false,
  },
  // GPT-4V - może obsłużyć większe, ale 1024 optymalne dla kosztów
  "gpt-4o": {
    maxDimension: 1024,
    quality: 90,
    format: "webp",
    sharpenText: false,
    normalizeContrast: false,
    grayscale: false,
  },
  "gpt-4-vision-preview": {
    maxDimension: 1024,
    quality: 90,
    format: "webp",
    sharpenText: false,
    normalizeContrast: false,
    grayscale: false,
  },
  // Claude - 1568px max efektywne
  "claude-3-opus": {
    maxDimension: 1568,
    quality: 90,
    format: "webp",
    sharpenText: false,
    normalizeContrast: false,
    grayscale: false,
  },
  // Default dla nieznanych modeli
  default: {
    maxDimension: 768,
    quality: 85,
    format: "webp",
    sharpenText: true,
    normalizeContrast: true,
    grayscale: false,
  },
};

// ============================================================================
// OPTIMIZED PROMPTS
// ============================================================================

export const EXTRACTION_PROMPTS = {
  // Ekstrakcja tekstu z dokumentu (OCR)
  ocr: {
    system: `Ekspert OCR. Odczytaj CAŁY tekst z obrazu.
Zasady:
- Zachowaj strukturę (akapity, listy, tabele)
- Popraw oczywiste błędy OCR
- Nie dodawaj tekstu którego nie ma
- Jeśli nieczytelne: [nieczytelne]`,
    user: "Odczytaj tekst z dokumentu:",
  },

  // Ekstrakcja danych strukturalnych
  structured: {
    system: `Ekstraktor danych dokumentów urzędowych.
Zwróć JSON:
{
  "typ": "uchwała|zarządzenie|protokół|druk|inny",
  "numer": "numer dokumentu lub null",
  "data": "YYYY-MM-DD lub null",
  "tytul": "tytuł dokumentu",
  "organ": "nazwa organu wydającego",
  "streszczenie": "1-2 zdania",
  "osoby": ["lista osób wymienionych"],
  "kwoty": ["lista kwot jeśli są"]
}
Brak danych = null. Nie zgaduj.`,
    user: "Wyodrębnij dane:",
  },

  // Analiza sesji rady
  session: {
    system: `Analizator dokumentów sesji rady.
Zwróć JSON:
{
  "numerSesji": "numer rzymski lub arabski",
  "data": "YYYY-MM-DD",
  "godzina": "HH:MM lub null",
  "miejsce": "adres/lokalizacja",
  "punktyPorzadku": ["lista punktów"],
  "obecni": ["lista obecnych"],
  "glosowania": [{"punkt": "nr", "za": 0, "przeciw": 0, "wstrzymalo": 0}]
}`,
    user: "Przeanalizuj dokument sesji:",
  },

  // Szybka klasyfikacja
  classify: {
    system: `Klasyfikator dokumentów. Zwróć TYLKO jedną kategorię:
UCHWALA, ZARZADZENIE, PROTOKOL, DRUK, FAKTURA, UMOWA, PISMO, INNE`,
    user: "Klasyfikuj:",
  },
};

// ============================================================================
// VISION OPTIMIZER CLASS
// ============================================================================

export class VisionOptimizer {
  private config: VisionOptimizationConfig;

  constructor(modelName?: string) {
    // Znajdź config dla modelu lub użyj default
    const normalizedModel = (modelName || "default").toLowerCase();
    this.config = MODEL_CONFIGS[normalizedModel] || MODEL_CONFIGS["default"];

    console.log(
      `[VisionOptimizer] Initialized for model: ${
        modelName || "default"
      }, maxDim=${this.config.maxDimension}px`
    );
  }

  /**
   * Ustaw konfigurację ręcznie
   */
  setConfig(config: Partial<VisionOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Pobierz aktualną konfigurację
   */
  getConfig(): VisionOptimizationConfig {
    return { ...this.config };
  }

  // ==========================================================================
  // IMAGE OPTIMIZATION
  // ==========================================================================

  /**
   * Optymalizuj obraz dla Vision API
   */
  async optimizeImage(imageBuffer: Buffer): Promise<OptimizedImage> {
    const originalSize = imageBuffer.length;

    try {
      // Pobierz metadane oryginału
      const metadata = await sharp(imageBuffer).metadata();
      const originalWidth = metadata.width || 0;
      const originalHeight = metadata.height || 0;

      // Oblicz nowe wymiary
      const { width, height } = this.calculateDimensions(
        originalWidth,
        originalHeight,
        this.config.maxDimension
      );

      // Buduj pipeline Sharp
      let pipeline = sharp(imageBuffer);

      // Resize do optymalnych wymiarów
      if (width !== originalWidth || height !== originalHeight) {
        pipeline = pipeline.resize({
          width,
          height,
          fit: "inside",
          withoutEnlargement: true,
          kernel: "lanczos3", // Najlepsza jakość dla tekstu
        });
      }

      // Opcjonalna konwersja do skali szarości
      if (this.config.grayscale) {
        pipeline = pipeline.grayscale();
      }

      // Normalizacja kontrastu (histogram stretch)
      if (this.config.normalizeContrast) {
        pipeline = pipeline.normalize();
      }

      // Wyostrzenie tekstu
      if (this.config.sharpenText) {
        pipeline = pipeline.sharpen({
          sigma: 0.8,
          m1: 0.5,
          m2: 1.5,
        });
      }

      // Konwersja do formatu wyjściowego
      let outputBuffer: Buffer;
      let outputFormat = this.config.format;

      switch (this.config.format) {
        case "webp":
          outputBuffer = await pipeline
            .webp({ quality: this.config.quality, effort: 4 })
            .toBuffer();
          break;
        case "jpeg":
          outputBuffer = await pipeline
            .jpeg({ quality: this.config.quality, mozjpeg: true })
            .toBuffer();
          break;
        case "png":
        default:
          outputBuffer = await pipeline.png({ compressionLevel: 6 }).toBuffer();
          outputFormat = "png";
      }

      const optimizedSize = outputBuffer.length;
      const compressionRatio = originalSize / optimizedSize;

      console.log(
        `[VisionOptimizer] Image optimized: ${originalWidth}x${originalHeight} → ${width}x${height}, ` +
          `${this.formatBytes(originalSize)} → ${this.formatBytes(
            optimizedSize
          )} (${compressionRatio.toFixed(1)}x)`
      );

      return {
        buffer: outputBuffer,
        base64: outputBuffer.toString("base64"),
        originalSize,
        optimizedSize,
        compressionRatio,
        dimensions: { width, height },
        format: outputFormat,
      };
    } catch (error) {
      console.error("[VisionOptimizer] Image optimization failed:", error);

      // Fallback - zwróć oryginał
      return {
        buffer: imageBuffer,
        base64: imageBuffer.toString("base64"),
        originalSize,
        optimizedSize: originalSize,
        compressionRatio: 1,
        dimensions: { width: 0, height: 0 },
        format: "unknown",
      };
    }
  }

  /**
   * Optymalizuj wiele obrazów (batch)
   */
  async optimizeImages(imageBuffers: Buffer[]): Promise<OptimizedImage[]> {
    return Promise.all(imageBuffers.map((buf) => this.optimizeImage(buf)));
  }

  // ==========================================================================
  // PROMPT COMPRESSION
  // ==========================================================================

  /**
   * Kompresuj prompt tekstowy
   */
  compressPrompt(prompt: string, maxTokens?: number): CompressedPrompt {
    const originalTokens = this.estimateTokens(prompt);
    let compressed = prompt;

    // Krok 1: Usuń nadmiarowe białe znaki
    compressed = compressed.replace(/\s+/g, " ").trim();

    // Krok 2: Usuń powtórzenia fraz
    compressed = this.removeRedundantPhrases(compressed);

    // Krok 3: Skróć instrukcje do esencji
    compressed = this.shortenInstructions(compressed);

    // Krok 4: Jeśli nadal za długi - przytnij
    if (maxTokens && this.estimateTokens(compressed) > maxTokens) {
      compressed = this.truncateToTokens(compressed, maxTokens);
    }

    const compressedTokens = this.estimateTokens(compressed);

    return {
      original: prompt,
      compressed,
      originalTokens,
      compressedTokens,
      compressionRatio: originalTokens / Math.max(compressedTokens, 1),
    };
  }

  /**
   * Pobierz zoptymalizowany prompt dla danego typu ekstrakcji
   */
  getExtractionPrompt(type: keyof typeof EXTRACTION_PROMPTS): {
    system: string;
    user: string;
  } {
    return EXTRACTION_PROMPTS[type] || EXTRACTION_PROMPTS.ocr;
  }

  /**
   * Zbuduj pełny prompt z kontekstem
   */
  buildPrompt(
    type: keyof typeof EXTRACTION_PROMPTS,
    additionalContext?: string
  ): { system: string; user: string } {
    const base = this.getExtractionPrompt(type);

    return {
      system: base.system,
      user: additionalContext
        ? `${base.user}\n${additionalContext}`
        : base.user,
    };
  }

  // ==========================================================================
  // TWO-STAGE EXTRACTION: OCR → Text → Structured JSON
  // ==========================================================================

  /**
   * Prompt do ekstrakcji strukturalnej z tekstu OCR (etap 2)
   * Krótki, zoptymalizowany pod tokeny
   */
  getTextToStructuredPrompt(): { system: string; user: string } {
    return {
      system: `Ekstraktor JSON. Przeanalizuj tekst dokumentu i zwróć TYLKO JSON:
{
  "typ": "uchwała|zarządzenie|protokół|druk|faktura|umowa|pismo|inny",
  "numer": "string|null",
  "data": "YYYY-MM-DD|null", 
  "tytul": "string",
  "organ": "string|null",
  "streszczenie": "max 2 zdania",
  "osoby": ["imiona i nazwiska"],
  "kwoty": ["kwoty z PLN"],
  "punkty": ["główne punkty jeśli są"]
}
Brak danych = null. NIE zgaduj. TYLKO JSON, bez markdown.`,
      user: "Wyodrębnij dane z tekstu:",
    };
  }

  /**
   * Parsuj odpowiedź JSON z LLM (z obsługą błędów)
   */
  parseStructuredResponse(response: string): DocumentStructure | null {
    try {
      // Usuń markdown code blocks jeśli są
      let cleaned = response.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);

      // Walidacja podstawowych pól
      return {
        typ: parsed.typ || "inny",
        numer: parsed.numer || null,
        data: parsed.data || null,
        tytul: parsed.tytul || "Bez tytułu",
        organ: parsed.organ || null,
        streszczenie: parsed.streszczenie || null,
        osoby: Array.isArray(parsed.osoby) ? parsed.osoby : [],
        kwoty: Array.isArray(parsed.kwoty) ? parsed.kwoty : [],
        punkty: Array.isArray(parsed.punkty) ? parsed.punkty : [],
      };
    } catch (error) {
      console.error(
        "[VisionOptimizer] Failed to parse structured response:",
        error
      );
      return null;
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private calculateDimensions(
    width: number,
    height: number,
    maxDimension: number
  ): { width: number; height: number } {
    if (width <= maxDimension && height <= maxDimension) {
      return { width, height };
    }

    const ratio = width / height;

    if (width > height) {
      return {
        width: maxDimension,
        height: Math.round(maxDimension / ratio),
      };
    } else {
      return {
        width: Math.round(maxDimension * ratio),
        height: maxDimension,
      };
    }
  }

  private estimateTokens(text: string): number {
    // Przybliżenie: ~4 znaki = 1 token dla polskiego tekstu
    return Math.ceil(text.length / 4);
  }

  private removeRedundantPhrases(text: string): string {
    // Usuń typowe redundantne frazy
    const redundantPatterns = [
      /proszę o\s*/gi,
      /uprzejmie proszę\s*/gi,
      /bardzo proszę\s*/gi,
      /należy\s+koniecznie\s*/gi,
      /ważne jest aby\s*/gi,
      /pamiętaj że\s*/gi,
      /zwróć uwagę że\s*/gi,
    ];

    let result = text;
    for (const pattern of redundantPatterns) {
      result = result.replace(pattern, "");
    }

    return result;
  }

  private shortenInstructions(text: string): string {
    // Zamień długie instrukcje na krótsze
    const replacements: [RegExp, string][] = [
      [/na podstawie (poniższego|powyższego) dokumentu/gi, "z dokumentu"],
      [/wyodrębnij (wszystkie )?informacje (dotyczące|o)/gi, "wyodrębnij"],
      [/przeanalizuj (dokładnie )?(i )?/gi, "analizuj "],
      [/w sposób (szczegółowy|dokładny)/gi, "dokładnie"],
      [/jeżeli (nie )?możesz/gi, "jeśli"],
      [/w przypadku gdy/gi, "jeśli"],
    ];

    let result = text;
    for (const [pattern, replacement] of replacements) {
      result = result.replace(pattern, replacement);
    }

    return result;
  }

  private truncateToTokens(text: string, maxTokens: number): string {
    const targetChars = maxTokens * 4;

    if (text.length <= targetChars) {
      return text;
    }

    // Znajdź koniec zdania przed limitem
    const truncated = text.substring(0, targetChars);
    const lastSentence = truncated.lastIndexOf(". ");

    if (lastSentence > targetChars * 0.7) {
      return truncated.substring(0, lastSentence + 1);
    }

    return truncated + "...";
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

const optimizerCache = new Map<string, VisionOptimizer>();

export function getVisionOptimizer(modelName?: string): VisionOptimizer {
  const key = modelName || "default";

  if (!optimizerCache.has(key)) {
    optimizerCache.set(key, new VisionOptimizer(modelName));
  }

  return optimizerCache.get(key)!;
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export async function optimizeImageForVision(
  imageBuffer: Buffer,
  modelName?: string
): Promise<OptimizedImage> {
  const optimizer = getVisionOptimizer(modelName);
  return optimizer.optimizeImage(imageBuffer);
}

export function compressVisionPrompt(
  prompt: string,
  maxTokens?: number
): CompressedPrompt {
  const optimizer = getVisionOptimizer();
  return optimizer.compressPrompt(prompt, maxTokens);
}

/**
 * Dwuetapowa ekstrakcja: OCR tekst → Structured JSON
 * Użyj po otrzymaniu tekstu z Vision OCR
 */
export function getTextToStructuredPrompt(): { system: string; user: string } {
  const optimizer = getVisionOptimizer();
  return optimizer.getTextToStructuredPrompt();
}

export function parseDocumentStructure(
  response: string
): DocumentStructure | null {
  const optimizer = getVisionOptimizer();
  return optimizer.parseStructuredResponse(response);
}
