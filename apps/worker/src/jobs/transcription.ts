/**
 * Transcription Worker - Przetwarzanie zadań transkrypcji YouTube
 */

import { type Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import type {
  TranscriptionJobData,
  TranscriptionJobResult,
} from "../../../api/src/services/transcription-queue.js";

// Import serwisów z API
import { YouTubeDownloader } from "../../../api/src/services/youtube-downloader.js";
import {
  getEmbeddingsClient,
  getLLMClient,
  getAIConfig,
} from "../../../api/src/ai/index.js";
import { TranscriptionProgressTracker } from "./transcription-progress.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// INTERFACES
// ============================================================================

interface CouncilMember {
  id: string;
  name: string;
  role: string;
  party?: string;
  voiceCharacteristics?: string;
}

interface TranscriptSegment {
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
}

// ============================================================================
// GŁÓWNA FUNKCJA PROCESSINGU
// ============================================================================

export async function processTranscription(
  job: Job<TranscriptionJobData>
): Promise<TranscriptionJobResult> {
  const {
    id,
    userId,
    videoUrl,
    videoTitle,
    sessionId,
    includeSentiment,
    identifySpeakers,
  } = job.data;

  console.log(`[TranscriptionWorker] Processing job ${id} - "${videoTitle}"`);
  const startTime = Date.now();

  // Inicjalizuj detailed progress tracker
  const progressTracker = new TranscriptionProgressTracker(job);

  try {
    // 1. KROK: Download
    await progressTracker.startStep(
      "download",
      "Pobieranie audio z YouTube..."
    );
    await updateJobStatus(
      id,
      "downloading",
      10,
      "Pobieranie audio z YouTube..."
    );

    // Pobieranie audio
    const downloader = new YouTubeDownloader();
    await downloader.initializeWithUserConfig(userId);

    await progressTracker.updateStep("download", 50, "Łączenie z YouTube...");

    const downloadResult = await downloader.downloadAudio(videoUrl);
    if (!downloadResult.success || !downloadResult.audioPath) {
      await progressTracker.failStep(
        "download",
        downloadResult.error || "Błąd pobierania audio"
      );
      throw new Error(downloadResult.error || "Błąd pobierania audio");
    }

    // Zakończ krok download
    await progressTracker.completeStep("download", {
      fileSize: "Unknown", // TODO: Get from downloadResult
    });

    console.log(
      `[TranscriptionWorker] Audio downloaded: ${downloadResult.audioPath}`
    );

    // 2. KROK: Transcription (zawiera preprocessing)
    await progressTracker.updateStep(
      "preprocessing",
      50,
      "Przygotowanie do transkrypcji..."
    );

    await progressTracker.startStep(
      "transcription",
      "Transkrypcja audio (może potrwać kilka minut)..."
    );
    await updateJobStatus(
      id,
      "transcribing",
      35,
      "Transkrypcja audio (może potrwać kilka minut)..."
    );

    const videoIdMatch = videoUrl.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/);
    const videoId = videoIdMatch?.[1] || "unknown";

    await progressTracker.updateStep(
      "transcription",
      10,
      "Inicjalizacja Whisper...",
      {
        model: "whisper-1",
        language: "pl",
      }
    );

    const transcriptionResult = await downloader.transcribeAndAnalyze(
      downloadResult.audioPath,
      videoId,
      videoTitle,
      videoUrl,
      true // enablePreprocessing
    );

    if (!transcriptionResult.success) {
      await progressTracker.failStep(
        "transcription",
        transcriptionResult.error || "Błąd transkrypcji"
      );
      throw new Error(transcriptionResult.error || "Błąd transkrypcji");
    }

    // Zakończ krok preprocessing z wynikami z audio analysis
    const audioIssues =
      transcriptionResult.audioAnalysis?.issues?.map((i) => i.type) ?? [];
    await progressTracker.completeStep("preprocessing", {
      audioIssues,
      appliedFilters: ["loudnorm", "highpass", "denoise"],
    });

    console.log(`[TranscriptionWorker] Transcription completed`);

    // Zakończ krok transcription
    await progressTracker.completeStep("transcription", {
      model: "whisper-1",
      language: "pl",
      audioIssues,
    });

    // 4. KROK: Analysis
    await progressTracker.startStep(
      "analysis",
      "Identyfikacja mówców i analiza sentymentu..."
    );
    await updateJobStatus(
      id,
      "analyzing",
      60,
      "Identyfikacja mówców i analiza sentymentu..."
    );

    let enhancedTranscript = transcriptionResult.formattedTranscript;
    let enhancedSegments = transcriptionResult.segments;

    if (identifySpeakers) {
      await progressTracker.updateStep(
        "analysis",
        30,
        "Identyfikacja mówców..."
      );

      const councilMembers = await getCouncilMembers(userId);
      const identified = await identifySpeakers_internal(
        userId,
        transcriptionResult.rawTranscript,
        transcriptionResult.segments,
        councilMembers
      );
      enhancedSegments = identified.segments;

      await progressTracker.updateStep("analysis", 70, "Analiza sentymentu...");

      enhancedTranscript = formatEnhancedTranscript(
        transcriptionResult.rawTranscript,
        identified.segments,
        transcriptionResult.summary,
        videoTitle,
        videoUrl,
        includeSentiment
      );
    }

    // Zakończ krok analysis
    const uniqueSpeakers = new Set(enhancedSegments.map((s) => s.speaker)).size;
    await progressTracker.completeStep("analysis", {
      speakersFound: uniqueSpeakers,
    });

    // 5. KROK: Saving
    await progressTracker.startStep("saving", "Zapisywanie do bazy wiedzy...");
    await updateJobStatus(id, "saving", 85, "Zapisywanie do bazy wiedzy...");

    await progressTracker.updateStep(
      "saving",
      30,
      "Generowanie embeddingów..."
    );

    const documentId = await saveToRAG(
      userId,
      enhancedTranscript,
      videoTitle,
      videoUrl,
      sessionId,
      transcriptionResult.summary,
      enhancedSegments
    );

    console.log(`[TranscriptionWorker] Saved to RAG: ${documentId}`);

    await progressTracker.updateStep(
      "saving",
      70,
      "Aktualizacja bazy danych..."
    );

    // 6. Aktualizuj status transkrypcji w scraped_content
    await updateScrapedContentTranscriptionStatus(
      videoUrl,
      "completed",
      documentId
    );

    // Zakończ krok saving
    await progressTracker.completeStep("saving");

    // 7. Zakończenie
    await updateJobStatus(
      id,
      "completed",
      100,
      "Transkrypcja zakończona i zapisana do bazy wiedzy!",
      undefined
    );

    const processingTime = Date.now() - startTime;
    console.log(
      `[TranscriptionWorker] Job ${id} completed in ${(
        processingTime / 1000
      ).toFixed(1)}s`
    );

    return {
      success: true,
      documentId,
      processingTimeMs: processingTime,
      audioIssues,
    };
  } catch (error) {
    console.error(`[TranscriptionWorker] Job ${id} failed:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "Nieznany błąd";

    await updateJobStatus(id, "failed", 0, "Błąd przetwarzania", errorMessage);

    return {
      success: false,
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function updateJobStatus(
  jobId: string,
  status: string,
  progress: number,
  progressMessage: string,
  error?: string
): Promise<void> {
  try {
    await supabase
      .from("transcription_jobs")
      .update({
        status,
        progress,
        progress_message: progressMessage,
        error: error ?? null,
        completed_at:
          status === "completed" || status === "failed"
            ? new Date().toISOString()
            : null,
      })
      .eq("id", jobId);
  } catch (err) {
    console.error(`[TranscriptionWorker] Failed to update job status:`, err);
  }
}

async function getCouncilMembers(userId: string): Promise<CouncilMember[]> {
  const { data: members } = await supabase
    .from("council_members")
    .select("*")
    .eq("user_id", userId);

  if (members && members.length > 0) {
    return members.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role || "Radny",
      party: m.party,
      voiceCharacteristics: m.voice_characteristics,
    }));
  }

  return [
    { id: "1", name: "Przewodniczący Rady", role: "Przewodniczący" },
    { id: "2", name: "Burmistrz", role: "Burmistrz" },
    { id: "3", name: "Skarbnik", role: "Skarbnik" },
    { id: "4", name: "Sekretarz", role: "Sekretarz" },
  ];
}

async function identifySpeakers_internal(
  userId: string,
  rawTranscript: string,
  segments: TranscriptSegment[],
  councilMembers: CouncilMember[]
): Promise<{ segments: TranscriptSegment[] }> {
  try {
    const llmClient = await getLLMClient(userId);
    const llmConfig = await getAIConfig(userId, "llm");

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

    const response = await llmClient.chat.completions.create({
      model: llmConfig.modelName,
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: `Transkrypcja:\n${rawTranscript.slice(
            0,
            10000
          )}\n\nSegmenty do identyfikacji:\n${JSON.stringify(
            segments.slice(0, 20).map((s) => ({
              speaker: s.speaker,
              text: s.text.slice(0, 100),
            }))
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
    console.error("[TranscriptionWorker] Speaker identification error:", error);
    return { segments };
  }
}

function formatEnhancedTranscript(
  rawTranscript: string,
  segments: TranscriptSegment[],
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
  includeSentiment: boolean
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
    md += `| 🎭 Dominujący nastrój | ${translateSentiment(
      summary.dominantSentiment
    )} |\n`;
    md += `| ⚡ Średnie napięcie | ${
      summary.averageTension?.toFixed(1) || "N/A"
    }/10 |\n`;
    md += `| ✅ Ogólna wiarygodność | ${summary.overallCredibility}% ${summary.overallCredibilityEmoji} |\n`;
  }
  md += `\n`;

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

  let currentSpeaker = "";
  for (const seg of segments) {
    if (seg.speaker !== currentSpeaker) {
      currentSpeaker = seg.speaker;
      const roleStr = seg.speakerRole ? ` *(${seg.speakerRole})*` : "";
      md += `\n### 🎤 ${seg.speaker}${roleStr}\n\n`;
    }

    if (includeSentiment) {
      const tensionIndicator =
        seg.tension > 7 ? "🔥" : seg.tension > 4 ? "⚡" : "";
      md += `> ${seg.emotionEmoji} ${seg.text} ${tensionIndicator}\n\n`;

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

function translateSentiment(sentiment: string): string {
  const translations: Record<string, string> = {
    positive: "Pozytywny 😊",
    neutral: "Neutralny 😐",
    negative: "Negatywny 😠",
  };
  return translations[sentiment] || sentiment;
}

async function saveToRAG(
  userId: string,
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
  segments: TranscriptSegment[]
): Promise<string> {
  const embeddingsClient = await getEmbeddingsClient(userId);
  const embeddingsConfig = await getAIConfig(userId, "embeddings");

  const embeddingText = `${videoTitle}\n\n${formattedTranscript.slice(
    0,
    8000
  )}`;
  const embeddingResponse = await embeddingsClient.embeddings.create({
    model: embeddingsConfig.modelName,
    input: embeddingText,
  });

  const embedding = embeddingResponse.data[0]?.embedding;
  if (!embedding) {
    throw new Error("Nie udało się wygenerować embeddingu");
  }

  const keywords = extractKeywords(videoTitle, formattedTranscript);

  const { data, error } = await supabase
    .from("processed_documents")
    .insert({
      user_id: userId,
      title: `Transkrypcja: ${videoTitle}`,
      content: formattedTranscript,
      source_url: videoUrl,
      document_type: "transkrypcja",
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
    throw new Error(`Błąd zapisu do bazy: ${error.message}`);
  }

  if (sessionId) {
    await linkToSession(userId, data.id, sessionId);
  }

  return data.id;
}

async function linkToSession(
  userId: string,
  documentId: string,
  sessionId: string
): Promise<void> {
  try {
    await supabase.from("document_relations").insert({
      user_id: userId,
      source_document_id: documentId,
      target_session_id: sessionId,
      relation_type: "transcription_of",
      created_at: new Date().toISOString(),
    });
  } catch {
    console.warn("[TranscriptionWorker] Session linking not available");
  }
}

async function updateScrapedContentTranscriptionStatus(
  videoUrl: string,
  status: "pending" | "completed" | "failed",
  transcriptionDocumentId?: string
): Promise<void> {
  try {
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

      await supabase
        .from("scraped_content")
        .update({ metadata })
        .eq("url", videoUrl)
        .eq("content_type", "youtube_video");

      console.log(
        `[TranscriptionWorker] Updated transcription status to '${status}'`
      );
    }
  } catch (error) {
    console.error(
      "[TranscriptionWorker] Error updating scraped_content:",
      error
    );
  }
}

function extractKeywords(title: string, content: string): string[] {
  const text = `${title} ${content}`.toLowerCase();

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

  const titleWords = title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["sesja", "rady", "miejskiej"].includes(w));

  return [...new Set([...found, ...titleWords])].slice(0, 20);
}
