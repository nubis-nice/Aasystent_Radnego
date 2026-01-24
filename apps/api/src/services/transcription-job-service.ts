/**
 * TranscriptionJobService - Asynchroniczne przetwarzanie transkrypcji YouTube
 *
 * Funkcje:
 * - Kolejkowanie zadań transkrypcji
 * - Automatyczny zapis do RAG w kategorii "transkrypcje"
 * - Powiązanie z Sesjami Rady
 * - Identyfikacja mówców po imieniu i nazwisku
 * - Formatowanie dokumentu z ekspresją i sentymentem
 */

import { createClient } from "@supabase/supabase-js";
import { YouTubeDownloader } from "./youtube-downloader.js";
import { getEmbeddingsClient, getLLMClient, getAIConfig } from "../ai/index.js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type TranscriptionJobRow = {
  id: string;
  user_id: string;
  video_url: string;
  video_title: string;
  session_id: string | null;
  status: string;
  progress: number;
  progress_message: string | null;
  include_sentiment: boolean;
  identify_speakers: boolean;
  created_at: string;
  completed_at: string | null;
  error: string | null;
  result_document_id: string | null;
  audio_issues: unknown;
  metadata: Record<string, unknown> | null;
};

export interface TranscriptionJob {
  id: string;
  userId: string;
  videoUrl: string;
  videoTitle: string;
  sessionId?: string; // Powiązanie z Sesją Rady
  status:
    | "pending"
    | "downloading"
    | "preprocessing"
    | "transcribing"
    | "analyzing"
    | "saving"
    | "completed"
    | "failed";
  progress: number;
  progressMessage: string;
  includeSentiment: boolean;
  identifySpeakers: boolean;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
  resultDocumentId?: string;
  audioIssues?: string[]; // Wykryte problemy z audio
  metadata?: Record<string, unknown>;
}

export interface CouncilMember {
  id: string;
  name: string;
  role: string; // "Przewodniczący", "Radny", "Burmistrz", "Skarbnik", etc.
  party?: string;
  voiceCharacteristics?: string; // Opis głosu do identyfikacji
}

// In-memory job queue (w produkcji użyj Redis/Bull)
const jobQueue: Map<string, TranscriptionJob> = new Map();

export class TranscriptionJobService {
  private userId: string;
  private embeddingsClient: OpenAI | null = null;
  private llmClient: OpenAI | null = null;
  private embeddingModel: string = "text-embedding-3-small";
  private llmModel: string = "gpt-4o";

  constructor(userId: string) {
    this.userId = userId;
  }

  async initialize(): Promise<void> {
    this.embeddingsClient = await getEmbeddingsClient(this.userId);
    this.llmClient = await getLLMClient(this.userId);

    const embeddingsConfig = await getAIConfig(this.userId, "embeddings");
    this.embeddingModel = embeddingsConfig.modelName;

    const llmConfig = await getAIConfig(this.userId, "llm");
    this.llmModel = llmConfig.modelName;
  }

  /**
   * Tworzy nowe zadanie transkrypcji i uruchamia je asynchronicznie
   */
  async createJob(
    videoUrl: string,
    videoTitle: string,
    options: {
      sessionId?: string;
      includeSentiment?: boolean;
      identifySpeakers?: boolean;
    } = {},
  ): Promise<TranscriptionJob> {
    const jobId = `job_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const job: TranscriptionJob = {
      id: jobId,
      userId: this.userId,
      videoUrl,
      videoTitle,
      sessionId: options.sessionId,
      status: "pending",
      progress: 0,
      progressMessage: "Zadanie utworzone, oczekuje w kolejce...",
      includeSentiment: options.includeSentiment ?? true,
      identifySpeakers: options.identifySpeakers ?? true,
      createdAt: new Date(),
    };

    jobQueue.set(jobId, job);
    await this.saveJobRow(job);

    // Uruchom przetwarzanie asynchronicznie
    this.processJob(jobId).catch((error) => {
      console.error(`[TranscriptionJob] Job ${jobId} failed:`, error);
      const failedJob = jobQueue.get(jobId);
      if (failedJob) {
        failedJob.status = "failed";
        failedJob.error =
          error instanceof Error ? error.message : "Nieznany błąd";
        void this.saveJobRow(failedJob);
      }
    });

    return job;
  }

  /**
   * Pobiera status zadania
   */
  async getJob(jobId: string): Promise<TranscriptionJob | undefined> {
    const inMemory = jobQueue.get(jobId);
    if (inMemory) {
      return inMemory;
    }

    const { data, error } = await supabase
      .from("transcription_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", this.userId)
      .maybeSingle();

    if (error || !data) {
      return undefined;
    }

    return this.mapRowToJob(data);
  }

  /**
   * Pobiera wszystkie zadania użytkownika
   */
  async getUserJobs(): Promise<TranscriptionJob[]> {
    const { data, error } = await supabase
      .from("transcription_jobs")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data) {
      return Array.from(jobQueue.values())
        .filter((job) => job.userId === this.userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return data.map((row) => this.mapRowToJob(row));
  }

  /**
   * Główna logika przetwarzania zadania
   */
  private async processJob(jobId: string): Promise<void> {
    const job = jobQueue.get(jobId);
    if (!job) return;

    try {
      // 1. Pobieranie audio
      this.updateJob(jobId, {
        status: "downloading",
        progress: 10,
        progressMessage: "Pobieranie audio z YouTube...",
      });

      const downloader = new YouTubeDownloader();
      await downloader.initializeWithUserConfig(this.userId);

      const downloadResult = await downloader.downloadAudio(job.videoUrl);
      if (!downloadResult.success || !downloadResult.audioPath) {
        throw new Error(downloadResult.error || "Błąd pobierania audio");
      }

      // 2. Preprocessing audio (adaptacyjna normalizacja)
      this.updateJob(jobId, {
        status: "preprocessing",
        progress: 20,
        progressMessage: "Analiza i normalizacja audio...",
      });

      // 3. Transkrypcja (preprocessing jest zintegrowany w transcribeAndAnalyze)
      this.updateJob(jobId, {
        status: "transcribing",
        progress: 35,
        progressMessage: "Transkrypcja audio (może potrwać kilka minut)...",
      });

      const videoIdMatch = job.videoUrl.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/);
      const videoId = videoIdMatch?.[1] || "unknown";

      const transcriptionResult = await downloader.transcribeAndAnalyze(
        downloadResult.audioPath,
        videoId,
        job.videoTitle,
        job.videoUrl,
        downloadResult.parts, // Precomputed parts z downloadAudio()
      );

      // Zapisz wykryte problemy z audio
      if (transcriptionResult.audioAnalysis?.issues) {
        this.updateJob(jobId, {
          audioIssues: transcriptionResult.audioAnalysis.issues.map(
            (i) => i.type,
          ),
        });
      }

      if (!transcriptionResult.success) {
        throw new Error(transcriptionResult.error || "Błąd transkrypcji");
      }

      // 3. Identyfikacja mówców
      this.updateJob(jobId, {
        status: "analyzing",
        progress: 60,
        progressMessage: "Identyfikacja mówców i analiza sentymentu...",
      });

      let enhancedTranscript = transcriptionResult.formattedTranscript;
      let enhancedSegments = transcriptionResult.segments;

      if (job.identifySpeakers) {
        const councilMembers = await this.getCouncilMembers();
        const identified = await this.identifySpeakers(
          transcriptionResult.rawTranscript,
          transcriptionResult.segments,
          councilMembers,
        );
        enhancedSegments = identified.segments;
        enhancedTranscript = this.formatEnhancedTranscript(
          transcriptionResult.rawTranscript,
          identified.segments,
          transcriptionResult.summary,
          job.videoTitle,
          job.videoUrl,
          job.includeSentiment,
        );
      }

      // 4. Zapis do RAG
      this.updateJob(jobId, {
        status: "saving",
        progress: 85,
        progressMessage: "Zapisywanie do bazy wiedzy...",
      });

      const documentId = await this.saveToRAG(
        enhancedTranscript,
        job.videoTitle,
        job.videoUrl,
        job.sessionId,
        transcriptionResult.summary,
        enhancedSegments,
      );

      // 4.5. Aktualizuj status transkrypcji w scraped_content
      await this.updateScrapedContentTranscriptionStatus(
        job.videoUrl,
        "completed",
        documentId,
      );

      // 5. Zakończenie
      this.updateJob(jobId, {
        status: "completed",
        progress: 100,
        progressMessage: "Transkrypcja zakończona i zapisana do bazy wiedzy!",
        completedAt: new Date(),
        resultDocumentId: documentId,
      });

      console.log(
        `[TranscriptionJob] Job ${jobId} completed, document ID: ${documentId}`,
      );
    } catch (error) {
      console.error(`[TranscriptionJob] Job ${jobId} error:`, error);
      this.updateJob(jobId, {
        status: "failed",
        progress: 0,
        progressMessage: "Błąd przetwarzania",
        error: error instanceof Error ? error.message : "Nieznany błąd",
      });
    }
  }

  private updateJob(jobId: string, updates: Partial<TranscriptionJob>): void {
    const job = jobQueue.get(jobId);
    if (job) {
      Object.assign(job, updates);
      void this.saveJobRow(job);
    }
  }

  private mapRowToJob(row: TranscriptionJobRow): TranscriptionJob {
    return {
      id: row.id,
      userId: row.user_id,
      videoUrl: row.video_url,
      videoTitle: row.video_title,
      sessionId: row.session_id ?? undefined,
      status: row.status as TranscriptionJob["status"],
      progress: row.progress,
      progressMessage: row.progress_message ?? "",
      includeSentiment: Boolean(row.include_sentiment),
      identifySpeakers: Boolean(row.identify_speakers),
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      error: row.error ?? undefined,
      resultDocumentId: row.result_document_id ?? undefined,
      audioIssues: (row.audio_issues as string[]) ?? undefined,
      metadata: row.metadata ?? undefined,
    };
  }

  private async saveJobRow(job: TranscriptionJob): Promise<void> {
    const { error } = await supabase.from("transcription_jobs").upsert({
      id: job.id,
      user_id: job.userId,
      video_url: job.videoUrl,
      video_title: job.videoTitle,
      session_id: job.sessionId ?? null,
      status: job.status,
      progress: job.progress,
      progress_message: job.progressMessage,
      include_sentiment: job.includeSentiment,
      identify_speakers: job.identifySpeakers,
      created_at: job.createdAt.toISOString(),
      completed_at: job.completedAt ? job.completedAt.toISOString() : null,
      error: job.error ?? null,
      result_document_id: job.resultDocumentId ?? null,
      audio_issues: job.audioIssues ?? null,
      metadata: job.metadata ?? null,
    });

    if (error) {
      console.error("[TranscriptionJob] Failed to persist job row:", error);
    }
  }

  /**
   * Pobiera listę radnych z bazy danych
   */
  private async getCouncilMembers(): Promise<CouncilMember[]> {
    // Próbuj pobrać z bazy danych
    const { data: members } = await supabase
      .from("council_members")
      .select("*")
      .eq("user_id", this.userId);

    if (members && members.length > 0) {
      return members.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role || "Radny",
        party: m.party,
        voiceCharacteristics: m.voice_characteristics,
      }));
    }

    // Domyślna lista dla Drawna (fallback)
    return [
      { id: "1", name: "Przewodniczący Rady", role: "Przewodniczący" },
      { id: "2", name: "Burmistrz", role: "Burmistrz" },
      { id: "3", name: "Skarbnik", role: "Skarbnik" },
      { id: "4", name: "Sekretarz", role: "Sekretarz" },
    ];
  }

  /**
   * Identyfikuje mówców używając LLM
   */
  private async identifySpeakers(
    rawTranscript: string,
    segments: Array<{
      timestamp: string;
      speaker: string;
      text: string;
      sentiment: string;
      emotion: string;
      emotionEmoji: string;
      tension: number;
      credibility: number;
      credibilityEmoji: string;
    }>,
    councilMembers: CouncilMember[],
  ): Promise<{
    segments: Array<{
      timestamp: string;
      speaker: string;
      speakerRole?: string;
      text: string;
      sentiment: string;
      emotion: string;
      emotionEmoji: string;
      tension: number;
      credibility: number;
      credibilityEmoji: string;
    }>;
  }> {
    if (!this.llmClient) {
      return { segments };
    }

    const membersList = councilMembers
      .map((m) => `- ${m.name} (${m.role})`)
      .join("\n");

    const prompt = `Jesteś ekspertem analizy sesji rady miejskiej. Przeanalizuj transkrypcję i zidentyfikuj mówców.

ZNANI CZŁONKOWIE RADY:
${membersList}

ZASADY IDENTYFIKACJI:
1. Przewodniczący prowadzi obrady, udziela głosu, ogłasza wyniki głosowań
2. Burmistrz przedstawia projekty uchwał, odpowiada na pytania
3. Skarbnik omawia kwestie finansowe i budżetowe
4. Radni zadają pytania, zgłaszają wnioski, głosują
5. Jeśli nie możesz zidentyfikować - użyj "Radny/Radna" z numerem

Dla każdego segmentu określ:
- speaker: imię i nazwisko lub rola (np. "Jan Kowalski" lub "Przewodniczący")
- speakerRole: rola w radzie

Odpowiedz w formacie JSON:
{
  "identifiedSpeakers": [
    { "originalSpeaker": "Mówca 1", "identifiedName": "Jan Kowalski", "role": "Przewodniczący" }
  ]
}`;

    try {
      const response = await this.llmClient.chat.completions.create({
        model: this.llmModel,
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: `Transkrypcja:\n${rawTranscript.slice(
              0,
              10000,
            )}\n\nSegmenty do identyfikacji:\n${JSON.stringify(
              segments.slice(0, 20).map((s) => ({
                speaker: s.speaker,
                text: s.text.slice(0, 100),
              })),
            )}`,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return { segments };

      const result = JSON.parse(content);
      const speakerMap = new Map<string, { name: string; role: string }>();

      for (const identified of result.identifiedSpeakers || []) {
        speakerMap.set(identified.originalSpeaker, {
          name: identified.identifiedName,
          role: identified.role,
        });
      }

      // Zastosuj identyfikację do segmentów
      const enhancedSegments = segments.map((seg) => {
        const identified = speakerMap.get(seg.speaker);
        return {
          ...seg,
          speaker: identified?.name || seg.speaker,
          speakerRole: identified?.role,
        };
      });

      return { segments: enhancedSegments };
    } catch (error) {
      console.error("[TranscriptionJob] Speaker identification error:", error);
      return { segments };
    }
  }

  /**
   * Formatuje transkrypcję w profesjonalny dokument
   */
  private formatEnhancedTranscript(
    rawTranscript: string,
    segments: Array<{
      timestamp: string;
      speaker: string;
      speakerRole?: string;
      text: string;
      sentiment: string;
      emotion: string;
      emotionEmoji: string;
      tension: number;
      credibility: number;
      credibilityEmoji: string;
    }>,
    summary: {
      averageTension: number;
      dominantSentiment: string;
      overallCredibility: number;
      overallCredibilityEmoji: string;
      speakerCount: number;
      duration: string;
    },
    videoTitle: string,
    videoUrl: string,
    includeSentiment: boolean,
  ): string {
    const date = new Date().toLocaleDateString("pl-PL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let md = `# 📋 Protokół z Sesji Rady\n\n`;
    md += `## ${videoTitle}\n\n`;
    md += `**Data transkrypcji:** ${date}\n`;
    md += `**Źródło:** [Nagranie YouTube](${videoUrl})\n`;
    md += `**Czas trwania:** ${summary.duration}\n\n`;

    md += `---\n\n`;
    md += `## 📊 Podsumowanie sesji\n\n`;
    md += `| Parametr | Wartość |\n`;
    md += `|:---------|:--------|\n`;
    md += `| 👥 Liczba mówców | ${summary.speakerCount} |\n`;

    if (includeSentiment) {
      md += `| 🎭 Dominujący nastrój | ${this.translateSentiment(
        summary.dominantSentiment,
      )} |\n`;
      md += `| ⚡ Średnie napięcie | ${
        summary.averageTension?.toFixed(1) || "N/A"
      }/10 |\n`;
      md += `| ✅ Ogólna wiarygodność | ${summary.overallCredibility}% ${summary.overallCredibilityEmoji} |\n`;
    }
    md += `\n`;

    // Lista mówców
    const speakers = new Map<string, { role?: string; count: number }>();
    for (const seg of segments) {
      const existing = speakers.get(seg.speaker) || {
        role: seg.speakerRole,
        count: 0,
      };
      existing.count++;
      speakers.set(seg.speaker, existing);
    }

    md += `## 👥 Uczestnicy sesji\n\n`;
    for (const [name, info] of speakers) {
      const roleStr = info.role ? ` *(${info.role})*` : "";
      md += `- **${name}**${roleStr} — ${info.count} wypowiedzi\n`;
    }
    md += `\n`;

    md += `---\n\n`;
    md += `## 📝 Przebieg sesji\n\n`;

    // Grupuj wypowiedzi według mówców
    let currentSpeaker = "";
    for (const seg of segments) {
      if (seg.speaker !== currentSpeaker) {
        currentSpeaker = seg.speaker;
        const roleStr = seg.speakerRole ? ` *(${seg.speakerRole})*` : "";
        md += `\n### 🎤 ${seg.speaker}${roleStr}\n\n`;
      }

      // Tekst wypowiedzi z ekspresją
      if (includeSentiment) {
        const tensionIndicator =
          seg.tension > 7 ? "🔥" : seg.tension > 4 ? "⚡" : "";
        md += `> ${seg.emotionEmoji} ${seg.text} ${tensionIndicator}\n\n`;

        // Metryki dla ważnych wypowiedzi
        if (seg.tension > 6 || seg.credibility < 50) {
          md += `*Napięcie: ${seg.tension}/10 | Wiarygodność: ${seg.credibility}% ${seg.credibilityEmoji}*\n\n`;
        }
      } else {
        md += `> ${seg.text}\n\n`;
      }
    }

    md += `---\n\n`;
    md += `## 📄 Pełna transkrypcja\n\n`;
    md += `<details>\n<summary>Kliknij aby rozwinąć pełny tekst</summary>\n\n`;
    md += `${rawTranscript}\n\n`;
    md += `</details>\n\n`;

    md += `---\n\n`;
    md += `*Dokument wygenerowany automatycznie przez Asystent Radnego*\n`;
    md += `*Kategoria: Transkrypcje*\n`;

    return md;
  }

  private translateSentiment(sentiment: string): string {
    const translations: Record<string, string> = {
      positive: "Pozytywny 😊",
      neutral: "Neutralny 😐",
      negative: "Negatywny 😠",
    };
    return translations[sentiment] || sentiment;
  }

  /**
   * Zapisuje transkrypcję do RAG jako dokument
   */
  private async saveToRAG(
    formattedTranscript: string,
    videoTitle: string,
    videoUrl: string,
    sessionId: string | undefined,
    summary: {
      averageTension: number;
      dominantSentiment: string;
      overallCredibility: number;
      overallCredibilityEmoji: string;
      speakerCount: number;
      duration: string;
    },
    segments: Array<{
      timestamp: string;
      speaker: string;
      speakerRole?: string;
      text: string;
      sentiment: string;
      emotion: string;
      emotionEmoji: string;
      tension: number;
      credibility: number;
      credibilityEmoji: string;
    }>,
  ): Promise<string> {
    if (!this.embeddingsClient) {
      throw new Error("Embeddings client not initialized");
    }

    // Generuj embedding dla wyszukiwania semantycznego
    const embeddingText = `${videoTitle}\n\n${formattedTranscript.slice(
      0,
      8000,
    )}`;
    const embeddingResponse = await this.embeddingsClient.embeddings.create({
      model: this.embeddingModel,
      input: embeddingText,
    });

    const embedding = embeddingResponse.data[0]?.embedding;
    if (!embedding) {
      throw new Error("Nie udało się wygenerować embeddingu");
    }

    // Wyodrębnij słowa kluczowe
    const keywords = this.extractKeywords(videoTitle, formattedTranscript);

    // Zapisz do processed_documents
    const { data, error } = await supabase
      .from("processed_documents")
      .insert({
        user_id: this.userId,
        title: `Transkrypcja: ${videoTitle}`,
        content: formattedTranscript,
        source_url: videoUrl,
        document_type: "transkrypcja", // Kategoria: transkrypcje
        embedding,
        keywords,
        metadata: {
          category: "transkrypcje",
          sessionId,
          videoUrl,
          duration: summary.duration,
          speakerCount: summary.speakerCount,
          dominantSentiment: summary.dominantSentiment,
          averageTension: summary.averageTension,
          overallCredibility: summary.overallCredibility,
          speakers: [...new Set(segments.map((s) => s.speaker))],
        },
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[TranscriptionJob] RAG save error:", error);
      throw new Error(`Błąd zapisu do bazy: ${error.message}`);
    }

    // Powiąż z Sesją Rady jeśli podano
    if (sessionId) {
      await this.linkToSession(data.id, sessionId);
    }

    return data.id;
  }

  /**
   * Powiązuje transkrypcję z Sesją Rady
   */
  private async linkToSession(
    documentId: string,
    sessionId: string,
  ): Promise<void> {
    try {
      // Sprawdź czy tabela document_relations istnieje
      const { error } = await supabase.from("document_relations").insert({
        user_id: this.userId,
        source_document_id: documentId,
        target_session_id: sessionId,
        relation_type: "transcription_of",
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.warn(
          "[TranscriptionJob] Could not link to session:",
          error.message,
        );
      }
    } catch {
      console.warn("[TranscriptionJob] Session linking not available");
    }
  }

  /**
   * Aktualizuje status transkrypcji w scraped_content
   */
  private async updateScrapedContentTranscriptionStatus(
    videoUrl: string,
    status: "pending" | "completed" | "failed",
    transcriptionDocumentId?: string,
  ): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {
        metadata: {}, // Będzie zaktualizowane przez merge
      };

      // Pobierz istniejące metadata
      const { data: existing } = await supabase
        .from("scraped_content")
        .select("metadata")
        .eq("url", videoUrl)
        .eq("content_type", "youtube_video")
        .maybeSingle();

      if (existing) {
        const metadata = (existing.metadata as Record<string, unknown>) || {};
        metadata.transcriptionStatus = status;
        if (transcriptionDocumentId) {
          metadata.transcriptionDocumentId = transcriptionDocumentId;
        }
        updateData.metadata = metadata;

        const { error } = await supabase
          .from("scraped_content")
          .update(updateData)
          .eq("url", videoUrl)
          .eq("content_type", "youtube_video");

        if (error) {
          console.error(
            "[TranscriptionJob] Failed to update scraped_content:",
            error,
          );
        } else {
          console.log(
            `[TranscriptionJob] Updated transcription status to '${status}' for ${videoUrl}`,
          );
        }
      }
    } catch (error) {
      console.error(
        "[TranscriptionJob] Error updating scraped_content:",
        error,
      );
    }
  }

  /**
   * Wyodrębnia słowa kluczowe z tekstu
   */
  private extractKeywords(title: string, content: string): string[] {
    const text = `${title} ${content}`.toLowerCase();

    // Słowa kluczowe specyficzne dla sesji rady
    const importantTerms = [
      "uchwała",
      "budżet",
      "głosowanie",
      "wniosek",
      "projekt",
      "radny",
      "burmistrz",
      "przewodniczący",
      "komisja",
      "inwestycja",
      "dotacja",
      "podatek",
      "opłata",
      "sesja",
      "rada",
      "gmina",
      "miasto",
    ];

    const found = importantTerms.filter((term) => text.includes(term));

    // Dodaj słowa z tytułu
    const titleWords = title
      .toLowerCase()
      .split(/\s+/)
      .filter(
        (w) => w.length > 3 && !["sesja", "rady", "miejskiej"].includes(w),
      );

    return [...new Set([...found, ...titleWords])].slice(0, 20);
  }
}

// Singleton dla zarządzania zadaniami
const jobServices: Map<string, TranscriptionJobService> = new Map();

export async function getTranscriptionJobService(
  userId: string,
): Promise<TranscriptionJobService> {
  let service = jobServices.get(userId);
  if (!service) {
    service = new TranscriptionJobService(userId);
    await service.initialize();
    jobServices.set(userId, service);
  }
  return service;
}
