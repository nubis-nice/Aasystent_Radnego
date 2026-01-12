/**
 * DocumentProcessingJobService - Asynchroniczne przetwarzanie dokumentów OCR/transkrypcji
 *
 * Funkcje:
 * - Kolejkowanie zadań przetwarzania
 * - Automatyczny zapis do RAG
 * - Analiza sentymentu (opcjonalnie)
 * - Profesjonalne formatowanie dokumentu
 */

import { createClient } from "@supabase/supabase-js";
import { DocumentProcessor } from "./document-processor.js";
import { getLLMClient, getEmbeddingsClient, getAIConfig } from "../ai/index.js";
import OpenAI from "openai";
import { randomUUID } from "node:crypto";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ProcessingJob {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  status:
    | "pending"
    | "preprocessing"
    | "processing"
    | "analyzing"
    | "saving"
    | "completed"
    | "failed";
  progress: number;
  progressMessage: string;
  includeSentiment: boolean;
  saveToRag: boolean;
  formatAsProfessional: boolean;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
  resultDocumentId?: string;
}

interface CreateJobOptions {
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
  includeSentiment: boolean;
  saveToRag: boolean;
  formatAsProfessional: boolean;
}

// In-memory job queue (per-user)
const jobQueue = new Map<string, ProcessingJob>();

export class DocumentProcessingJobService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Tworzy nowe zadanie przetwarzania i uruchamia je asynchronicznie
   */
  async createJob(options: CreateJobOptions): Promise<ProcessingJob> {
    const jobId = randomUUID();

    const job: ProcessingJob = {
      id: jobId,
      userId: this.userId,
      fileName: options.fileName,
      fileType: this.getFileType(options.mimeType),
      status: "pending",
      progress: 0,
      progressMessage: "Oczekuje w kolejce...",
      includeSentiment: options.includeSentiment,
      saveToRag: options.saveToRag,
      formatAsProfessional: options.formatAsProfessional,
      createdAt: new Date(),
    };

    jobQueue.set(jobId, job);

    // Uruchom przetwarzanie asynchronicznie
    this.processJob(jobId, options.fileBuffer, options.mimeType).catch(
      (error) => {
        console.error(`[DocumentProcessingJob] Job ${jobId} failed:`, error);
        this.updateJob(jobId, {
          status: "failed",
          error: error instanceof Error ? error.message : "Nieznany błąd",
          completedAt: new Date(),
        });
      }
    );

    return job;
  }

  /**
   * Aktualizuje status zadania
   */
  private updateJob(jobId: string, updates: Partial<ProcessingJob>): void {
    const job = jobQueue.get(jobId);
    if (job) {
      Object.assign(job, updates);
      jobQueue.set(jobId, job);
    }
  }

  /**
   * Pobiera status zadania
   */
  getJob(jobId: string): ProcessingJob | undefined {
    return jobQueue.get(jobId);
  }

  /**
   * Pobiera wszystkie zadania użytkownika
   */
  getUserJobs(): ProcessingJob[] {
    return Array.from(jobQueue.values())
      .filter((job) => job.userId === this.userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Główna logika przetwarzania zadania
   */
  private async processJob(
    jobId: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<void> {
    const job = jobQueue.get(jobId);
    if (!job) return;

    try {
      // 1. Preprocessing
      this.updateJob(jobId, {
        status: "preprocessing",
        progress: 10,
        progressMessage: "Przygotowywanie pliku...",
      });

      // 2. Przetwarzanie (OCR lub transkrypcja)
      this.updateJob(jobId, {
        status: "processing",
        progress: 20,
        progressMessage: this.isAudioFile(mimeType)
          ? "Transkrypcja audio..."
          : "Rozpoznawanie tekstu (OCR)...",
      });

      const processor = new DocumentProcessor();
      await processor.initializeWithUserConfig(this.userId);

      const result = await processor.processFile(
        fileBuffer,
        job.fileName,
        mimeType
      );

      if (!result.success || !result.text) {
        throw new Error(result.error || "Błąd przetwarzania pliku");
      }

      let content = result.text;
      let formattedContent = content;
      let sentiment = null;

      // 3. Analiza sentymentu (jeśli włączona i to transkrypcja)
      if (job.includeSentiment && this.isAudioFile(mimeType)) {
        this.updateJob(jobId, {
          status: "analyzing",
          progress: 50,
          progressMessage: "Analiza sentymentu...",
        });

        sentiment = await this.analyzeSentiment(content);
      }

      // 4. Profesjonalne formatowanie
      if (job.formatAsProfessional) {
        this.updateJob(jobId, {
          status: "analyzing",
          progress: 70,
          progressMessage: "Formatowanie dokumentu...",
        });

        formattedContent = await this.formatDocument(
          content,
          this.isAudioFile(mimeType)
        );
      }

      // 5. Zapis do RAG
      if (job.saveToRag) {
        this.updateJob(jobId, {
          status: "saving",
          progress: 85,
          progressMessage: "Zapisywanie do bazy wiedzy...",
        });

        const documentType = this.isAudioFile(mimeType)
          ? "transkrypcja"
          : "ocr";

        const saveResult = await processor.saveToRAG(
          this.userId,
          content,
          job.fileName,
          job.fileName,
          documentType
        );

        if (saveResult.success && saveResult.documentId) {
          // Zapisz dodatkowe metadane
          const metadata = {
            formattedContent,
            sentiment,
            mimeType,
            fileSize: fileBuffer.length,
            processingMethod: this.isAudioFile(mimeType) ? "stt" : "ocr",
            sttModel: result.metadata?.sttModel,
            ocrEngine: result.metadata?.ocrEngine,
          };

          await supabase
            .from("processed_documents")
            .update({ metadata })
            .eq("id", saveResult.documentId);

          this.updateJob(jobId, {
            resultDocumentId: saveResult.documentId,
          });
        }
      }

      // 6. Zakończone
      this.updateJob(jobId, {
        status: "completed",
        progress: 100,
        progressMessage: "Zakończone",
        completedAt: new Date(),
      });

      console.log(
        `[DocumentProcessingJob] Job ${jobId} completed successfully`
      );
    } catch (error) {
      console.error(`[DocumentProcessingJob] Job ${jobId} error:`, error);
      this.updateJob(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Nieznany błąd",
        completedAt: new Date(),
      });
    }
  }

  /**
   * Analiza sentymentu przez LLM
   */
  private async analyzeSentiment(
    content: string
  ): Promise<{ overall: string; score: number; summary: string }> {
    try {
      const llmClient = await getLLMClient(this.userId);
      const config = await getAIConfig(this.userId, "llm");

      const response = await llmClient.chat.completions.create({
        model: config.modelName,
        messages: [
          {
            role: "system",
            content: `Jesteś ekspertem od analizy sentymentu. Przeanalizuj poniższy tekst i zwróć JSON z analizą.
            
Format odpowiedzi (tylko JSON, bez markdown):
{
  "overall": "positive" | "negative" | "neutral" | "mixed",
  "score": 0.0-1.0,
  "summary": "krótkie podsumowanie sentymentu"
}`,
          },
          {
            role: "user",
            content: content.substring(0, 4000),
          },
        ],
        temperature: 0.3,
      });

      const sentimentText = response.choices[0]?.message?.content || "{}";
      try {
        return JSON.parse(sentimentText.replace(/```json\n?|\n?```/g, ""));
      } catch {
        return {
          overall: "neutral",
          score: 0.5,
          summary: "Nie udało się przeanalizować",
        };
      }
    } catch (error) {
      console.error("[DocumentProcessingJob] Sentiment analysis error:", error);
      return {
        overall: "neutral",
        score: 0.5,
        summary: "Błąd analizy",
      };
    }
  }

  /**
   * Profesjonalne formatowanie dokumentu przez LLM
   */
  private async formatDocument(
    content: string,
    isTranscription: boolean
  ): Promise<string> {
    try {
      const llmClient = await getLLMClient(this.userId);
      const config = await getAIConfig(this.userId, "llm");

      const response = await llmClient.chat.completions.create({
        model: config.modelName,
        messages: [
          {
            role: "system",
            content: isTranscription
              ? `Jesteś ekspertem od formatowania transkrypcji. Sformatuj poniższą transkrypcję jako profesjonalny protokół w Markdown.
              
Zawrzyj:
- Tytuł i datę (jeśli można wywnioskować)
- Podsumowanie głównych punktów
- Sformatowaną treść z wyróżnieniem mówców (jeśli można zidentyfikować)
- Kluczowe wnioski`
              : `Jesteś ekspertem od formatowania dokumentów. Sformatuj poniższy tekst OCR jako profesjonalny dokument w Markdown.
              
Zawrzyj:
- Tytuł dokumentu
- Poprawioną strukturę (nagłówki, akapity, listy)
- Poprawione błędy OCR
- Wyróżnione kluczowe informacje`,
          },
          {
            role: "user",
            content: content.substring(0, 8000),
          },
        ],
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content || content;
    } catch (error) {
      console.error("[DocumentProcessingJob] Formatting error:", error);
      return content;
    }
  }

  /**
   * Sprawdza czy plik to audio/video
   */
  private isAudioFile(mimeType: string): boolean {
    return mimeType.startsWith("audio/") || mimeType.startsWith("video/");
  }

  /**
   * Określa typ pliku
   */
  private getFileType(mimeType: string): string {
    if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
      return "audio";
    }
    if (mimeType.startsWith("image/")) {
      return "image";
    }
    if (mimeType === "application/pdf") {
      return "pdf";
    }
    return "document";
  }
}
