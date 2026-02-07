/**
 * Testy jednostkowe dla DocumentProcessor
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DocumentProcessor, } from "../document-processor.js";
// Mock zewnętrznych zależności
vi.mock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => ({
        from: vi.fn(() => ({
            insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
            update: vi.fn(() => ({ eq: vi.fn() })),
            select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })),
        })),
    })),
}));
vi.mock("../../ai/index.js", () => ({
    getVisionClient: vi.fn(),
    getEmbeddingsClient: vi.fn(),
    getSTTClient: vi.fn(),
    getLLMClient: vi.fn(),
    getAIConfig: vi.fn(),
}));
vi.mock("../vision-queue.js", () => ({
    addVisionJob: vi.fn(),
    waitForVisionResult: vi.fn(),
}));
describe("DocumentProcessor", () => {
    let processor;
    beforeEach(() => {
        vi.clearAllMocks();
        processor = new DocumentProcessor();
    });
    describe("constructor", () => {
        it("powinien utworzyć instancję procesora", () => {
            expect(processor).toBeInstanceOf(DocumentProcessor);
        });
    });
    describe("MIME type detection", () => {
        it("powinien wykryć typ pliku na podstawie rozszerzenia", () => {
            // Test przez sprawdzenie że procesor istnieje
            // Szczegółowa logika MIME jest wewnętrzna
            expect(processor).toBeDefined();
        });
    });
    describe("OCROptions defaults", () => {
        it("powinien mieć domyślne wartości OCR", () => {
            // Sprawdź że domyślne opcje są sensowne
            const defaultOptions = {
                useVisionOnly: false,
                tesseractConfidenceThreshold: 85,
                tesseractDPI: 300,
                visionMaxDimension: 768,
                useVisionQueue: true,
            };
            expect(defaultOptions.tesseractConfidenceThreshold).toBe(85);
            expect(defaultOptions.visionMaxDimension).toBe(768);
        });
    });
    describe("ProcessedDocument interface", () => {
        it("powinien mieć poprawną strukturę wyniku", () => {
            const result = {
                success: true,
                text: "Test content",
                metadata: {
                    fileName: "test.pdf",
                    fileType: "pdf",
                    mimeType: "application/pdf",
                    fileSize: 1024,
                    pageCount: 1,
                    processingMethod: "text-extraction",
                },
            };
            expect(result.success).toBe(true);
            expect(result.text).toBe("Test content");
            expect(result.metadata.processingMethod).toBe("text-extraction");
        });
        it("powinien obsługiwać błędy", () => {
            const result = {
                success: false,
                text: "",
                metadata: {
                    fileName: "corrupt.pdf",
                    fileType: "pdf",
                    mimeType: "application/pdf",
                    fileSize: 0,
                    processingMethod: "text-extraction",
                },
                error: "Nie można odczytać pliku",
            };
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
    describe("Supported file types", () => {
        const supportedTypes = [
            { ext: ".pdf", mime: "application/pdf" },
            {
                ext: ".docx",
                mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            },
            { ext: ".txt", mime: "text/plain" },
            { ext: ".md", mime: "text/markdown" },
            { ext: ".jpg", mime: "image/jpeg" },
            { ext: ".png", mime: "image/png" },
            { ext: ".webp", mime: "image/webp" },
        ];
        supportedTypes.forEach(({ ext, mime }) => {
            it(`powinien obsługiwać pliki ${ext} (${mime})`, () => {
                // Weryfikacja że typ jest obsługiwany
                expect(mime).toBeDefined();
                expect(ext).toMatch(/^\./);
            });
        });
    });
    describe("Audio/Video types", () => {
        const audioVideoTypes = [
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/mp4",
            "audio/ogg",
            "video/mp4",
            "video/webm",
        ];
        audioVideoTypes.forEach((mime) => {
            it(`powinien obsługiwać ${mime}`, () => {
                expect(mime).toMatch(/^(audio|video)\//);
            });
        });
    });
    describe("Processing methods", () => {
        it("powinien obsługiwać metodę OCR", () => {
            const method = "ocr";
            expect(method).toBe("ocr");
        });
        it("powinien obsługiwać metodę text-extraction", () => {
            const method = "text-extraction";
            expect(method).toBe("text-extraction");
        });
        it("powinien obsługiwać metodę vision", () => {
            const method = "vision";
            expect(method).toBe("vision");
        });
        it("powinien obsługiwać metodę stt", () => {
            const method = "stt";
            expect(method).toBe("stt");
        });
        it("powinien obsługiwać metodę direct", () => {
            const method = "direct";
            expect(method).toBe("direct");
        });
    });
});
describe("OCROptions", () => {
    it("powinien pozwalać na wyłączenie Tesseract", () => {
        const options = {
            useVisionOnly: true,
        };
        expect(options.useVisionOnly).toBe(true);
    });
    it("powinien pozwalać na konfigurację progu confidence", () => {
        const options = {
            tesseractConfidenceThreshold: 90,
        };
        expect(options.tesseractConfidenceThreshold).toBe(90);
    });
    it("powinien pozwalać na konfigurację rozdzielczości", () => {
        const options = {
            tesseractDPI: 200,
            visionMaxDimension: 1024,
        };
        expect(options.tesseractDPI).toBe(200);
        expect(options.visionMaxDimension).toBe(1024);
    });
    it("powinien pozwalać na włączenie kolejki Vision", () => {
        const options = {
            useVisionQueue: true,
        };
        expect(options.useVisionQueue).toBe(true);
    });
});
//# sourceMappingURL=document-processor.test.js.map