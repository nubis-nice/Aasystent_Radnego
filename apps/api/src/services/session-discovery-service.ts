/**
 * Session Discovery Service
 *
 * Kaskadowe wyszukiwanie materiałów z sesji rady:
 * 1. RAG Search → processed_documents (transkrypcje, protokoły)
 * 2. YouTube Search → kanał rady miejskiej
 * 3. Auto-Transcription → uruchom transkrypcję w tle
 */

import { createClient } from "@supabase/supabase-js";
import {
  DocumentQueryService,
  SessionQueryIntent,
  DocumentMatch,
} from "./document-query-service.js";
import { TranscriptionJobService } from "./transcription-job-service.js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// TYPES
// ============================================================================

export interface SessionDiscoveryResult {
  found: boolean;
  sessionNumber: number;
  requestType: SessionQueryIntent["requestType"];

  // Znalezione materiały
  documents: DocumentMatch[];
  hasTranscription: boolean;
  hasProtocol: boolean;
  hasVideo: boolean;

  // Akcje
  transcriptionStarted: boolean;
  transcriptionJobId?: string;

  // Wiadomość dla użytkownika
  message: string;

  // Sugestie dalszych działań
  suggestions: string[];
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  channelTitle: string;
}

// ============================================================================
// SESSION DISCOVERY SERVICE
// ============================================================================

export class SessionDiscoveryService {
  private userId: string;
  private documentQueryService: DocumentQueryService;

  constructor(userId: string) {
    this.userId = userId;
    this.documentQueryService = new DocumentQueryService(userId);
  }

  async initialize(): Promise<void> {
    await this.documentQueryService.initialize();
  }

  /**
   * Główna metoda - odkrywa materiały z sesji rady
   */
  async discoverSession(
    intent: SessionQueryIntent
  ): Promise<SessionDiscoveryResult> {
    const { sessionNumber, requestType } = intent;

    console.log(
      `[SessionDiscovery] Starting discovery for session ${sessionNumber}, type=${requestType}`
    );

    // KROK 1: Szukaj w RAG
    const ragDocuments = await this.documentQueryService.findSessionDocuments(
      sessionNumber
    );

    // Kategoryzuj znalezione dokumenty
    // Rozszerzone wykrywanie typów - uwzględnia różne nazewnictwo w bazie
    const hasTranscription = ragDocuments.some(
      (d) =>
        d.documentType === "transkrypcja" ||
        d.documentType === "transcription" ||
        d.title.toLowerCase().includes("transkrypcja") ||
        d.title.toLowerCase().includes("stenogram")
    );
    const hasProtocol = ragDocuments.some(
      (d) =>
        d.documentType === "protokol" ||
        d.documentType === "protocol" ||
        d.documentType === "pdf_attachment" || // Załączniki PDF często zawierają protokoły
        d.title.toLowerCase().includes("protokół") ||
        d.title.toLowerCase().includes("protokol") ||
        d.title.toLowerCase().includes("projekt-protokolu")
    );
    const hasSessionMaterials = ragDocuments.some(
      (d) =>
        d.documentType === "resolution" || // Porządek obrad sesji
        d.documentType === "session" ||
        d.title.toLowerCase().includes("sesja nr") ||
        d.title.toLowerCase().includes("porządek obrad")
    );
    const hasVideo = ragDocuments.some(
      (d) =>
        d.sourceUrl?.includes("youtube.com") ||
        d.sourceUrl?.includes("youtu.be")
    );

    console.log(
      `[SessionDiscovery] RAG results: ${ragDocuments.length} docs, transcription=${hasTranscription}, protocol=${hasProtocol}, sessionMaterials=${hasSessionMaterials}, video=${hasVideo}`
    );

    // Jeśli mamy wystarczające dane - zwróć
    // Dla streszczenia akceptujemy: transkrypcję LUB protokół LUB materiały sesji
    if (
      this.hasRequiredData(
        requestType,
        hasTranscription,
        hasProtocol || hasSessionMaterials, // Rozszerzone - materiały sesji liczą się jako protokół
        ragDocuments.length > 0
      )
    ) {
      return this.buildSuccessResult(
        intent,
        ragDocuments,
        hasTranscription,
        hasProtocol,
        hasVideo
      );
    }

    // KROK 2: Szukaj na YouTube (źródła danych użytkownika)
    const youtubeResults = await this.searchYouTubeDataSources(sessionNumber);

    if (youtubeResults.length > 0) {
      console.log(
        `[SessionDiscovery] Found ${youtubeResults.length} YouTube videos`
      );

      // Jeśli użytkownik chce transkrypcję/streszczenie - zaproponuj
      if (
        requestType === "streszczenie" ||
        requestType === "transkrypcja" ||
        requestType === "ogolne"
      ) {
        // Sprawdź czy transkrypcja już trwa
        const firstResult = youtubeResults[0];
        if (!firstResult) {
          return this.buildNotFoundResult(intent, ragDocuments);
        }
        const existingJob = await this.checkExistingTranscriptionJob(
          firstResult.videoId
        );

        if (existingJob) {
          return this.buildTranscriptionInProgressResult(
            intent,
            ragDocuments,
            existingJob,
            hasProtocol
          );
        }

        // Zaproponuj rozpoczęcie transkrypcji
        return this.buildYouTubeFoundResult(
          intent,
          ragDocuments,
          youtubeResults,
          hasProtocol
        );
      }
    }

    // KROK 3: Brak danych - zwróć sugestie
    return this.buildNotFoundResult(intent, ragDocuments);
  }

  /**
   * Rozpoczyna transkrypcję YouTube w tle
   */
  async startTranscription(
    videoUrl: string,
    videoTitle: string
  ): Promise<{ jobId: string; estimatedTime: string }> {
    const transcriptionService = new TranscriptionJobService(this.userId);
    await transcriptionService.initialize();

    const job = await transcriptionService.createJob(videoUrl, videoTitle, {});

    return {
      jobId: job.id,
      estimatedTime: "15-30 minut",
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private hasRequiredData(
    requestType: SessionQueryIntent["requestType"],
    hasTranscription: boolean,
    hasProtocol: boolean,
    hasAnyDocs: boolean
  ): boolean {
    switch (requestType) {
      case "streszczenie":
        // Streszczenie można zrobić z transkrypcji LUB protokołu LUB innych materiałów sesji
        return hasTranscription || hasProtocol || hasAnyDocs;
      case "transkrypcja":
        return hasTranscription;
      case "protokol":
        return hasProtocol;
      case "glosowania":
        return hasTranscription || hasProtocol;
      case "wideo":
        // Dla wideo - jeśli mamy jakiekolwiek dokumenty o sesji, użyj ich do kontekstu
        // Zawsze też szukaj linku do wideo, ale nie ignoruj znalezionych dokumentów
        return hasAnyDocs; // Zmienione z false - teraz zwraca dokumenty jeśli są
      case "ogolne":
        return hasAnyDocs;
      default:
        return hasAnyDocs;
    }
  }

  /**
   * Szuka wideo na YouTube w źródłach danych użytkownika
   */
  private async searchYouTubeDataSources(
    sessionNumber: number
  ): Promise<YouTubeSearchResult[]> {
    // Pobierz źródła YouTube użytkownika
    const { data: sources } = await supabase
      .from("data_sources")
      .select("id, name, url, metadata")
      .eq("user_id", this.userId)
      .eq("scraping_enabled", true)
      .or("type.eq.youtube,url.ilike.%youtube.com%");

    if (!sources || sources.length === 0) {
      console.log("[SessionDiscovery] No YouTube data sources configured");
      return [];
    }

    // Szukaj w przetworzonych dokumentach z tych źródeł
    const romanNumber = this.arabicToRoman(sessionNumber);
    const searchPatterns = [
      `%sesja%${sessionNumber}%`,
      `%sesja%${romanNumber}%`,
      `%${sessionNumber}%sesja%`,
      `%${romanNumber}%sesja%`,
    ];

    const results: YouTubeSearchResult[] = [];

    for (const source of sources) {
      // Szukaj w scraped_content
      for (const pattern of searchPatterns) {
        const { data: scraped } = await supabase
          .from("scraped_content")
          .select("id, url, title, scraped_at")
          .eq("source_id", source.id)
          .ilike("title", pattern)
          .limit(3);

        if (scraped) {
          for (const item of scraped) {
            if (
              item.url.includes("youtube.com") ||
              item.url.includes("youtu.be")
            ) {
              const videoId = this.extractYouTubeVideoId(item.url);
              if (videoId && !results.some((r) => r.videoId === videoId)) {
                results.push({
                  videoId,
                  title: item.title,
                  url: item.url,
                  publishedAt: item.scraped_at,
                  channelTitle: source.name,
                });
              }
            }
          }
        }
      }
    }

    return results;
  }

  private async checkExistingTranscriptionJob(
    videoId: string
  ): Promise<{ id: string; progress: number } | null> {
    const { data } = await supabase
      .from("transcription_jobs")
      .select("id, progress, status")
      .eq("user_id", this.userId)
      .ilike("video_url", `%${videoId}%`)
      .in("status", ["pending", "downloading", "transcribing", "analyzing"])
      .single();

    if (data) {
      return { id: data.id, progress: data.progress };
    }

    return null;
  }

  private extractYouTubeVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) return match[1];
    }

    return null;
  }

  private arabicToRoman(num: number): string {
    const romanNumerals: [number, string][] = [
      [1000, "M"],
      [900, "CM"],
      [500, "D"],
      [400, "CD"],
      [100, "C"],
      [90, "XC"],
      [50, "L"],
      [40, "XL"],
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"],
    ];

    let result = "";
    let remaining = num;

    for (const [value, numeral] of romanNumerals) {
      while (remaining >= value) {
        result += numeral;
        remaining -= value;
      }
    }

    return result;
  }

  // ============================================================================
  // RESULT BUILDERS
  // ============================================================================

  private buildSuccessResult(
    intent: SessionQueryIntent,
    documents: DocumentMatch[],
    hasTranscription: boolean,
    hasProtocol: boolean,
    hasVideo: boolean
  ): SessionDiscoveryResult {
    const romanNumber = this.arabicToRoman(intent.sessionNumber);

    let message = `Znalazłem materiały z sesji nr ${romanNumber} (${intent.sessionNumber}):\n\n`;

    if (hasTranscription) {
      const transcription = documents.find(
        (d) => d.documentType === "transkrypcja"
      );
      message += `📝 **Transkrypcja**: "${transcription?.title}"\n`;
    }

    if (hasProtocol) {
      const protocol = documents.find((d) => d.documentType === "protokol");
      message += `📋 **Protokół**: "${protocol?.title}"\n`;
    }

    if (hasVideo) {
      const video = documents.find((d) => d.sourceUrl?.includes("youtube"));
      message += `🎥 **Nagranie wideo**: [Link](${video?.sourceUrl})\n`;
    }

    return {
      found: true,
      sessionNumber: intent.sessionNumber,
      requestType: intent.requestType,
      documents,
      hasTranscription,
      hasProtocol,
      hasVideo,
      transcriptionStarted: false,
      message,
      suggestions: [],
    };
  }

  private buildYouTubeFoundResult(
    intent: SessionQueryIntent,
    ragDocuments: DocumentMatch[],
    youtubeResults: YouTubeSearchResult[],
    hasProtocol: boolean
  ): SessionDiscoveryResult {
    const romanNumber = this.arabicToRoman(intent.sessionNumber);
    const video = youtubeResults[0];
    if (!video) {
      return this.buildNotFoundResult(intent, ragDocuments);
    }

    let message = `Nie znalazłem transkrypcji sesji nr ${romanNumber}, ale znalazłem nagranie wideo:\n\n`;
    message += `🎥 **"${video.title}"**\n`;
    message += `📺 Kanał: ${video.channelTitle}\n`;
    message += `🔗 [Obejrzyj na YouTube](${video.url})\n\n`;
    message += `Czy chcesz, abym rozpoczął automatyczną transkrypcję tego nagrania? `;
    message += `Proces zajmie około 15-30 minut w zależności od długości sesji.`;

    if (hasProtocol) {
      message += `\n\n_Mam też dostępny protokół z tej sesji, jeśli potrzebujesz szybkiej informacji._`;
    }

    return {
      found: true,
      sessionNumber: intent.sessionNumber,
      requestType: intent.requestType,
      documents: ragDocuments,
      hasTranscription: false,
      hasProtocol,
      hasVideo: true,
      transcriptionStarted: false,
      message,
      suggestions: [
        `Tak, rozpocznij transkrypcję`,
        `Pokaż protokół z sesji`,
        `Nie, dziękuję`,
      ],
    };
  }

  private buildTranscriptionInProgressResult(
    intent: SessionQueryIntent,
    ragDocuments: DocumentMatch[],
    job: { id: string; progress: number },
    hasProtocol: boolean
  ): SessionDiscoveryResult {
    const romanNumber = this.arabicToRoman(intent.sessionNumber);

    let message = `Transkrypcja sesji nr ${romanNumber} jest już w toku!\n\n`;
    message += `📊 **Postęp**: ${job.progress}%\n`;
    message += `⏳ Szacowany czas zakończenia: kilka minut\n\n`;
    message += `Powiadomię Cię, gdy transkrypcja będzie gotowa.`;

    if (hasProtocol) {
      message += `\n\n_W międzyczasie mogę odpowiedzieć na pytania na podstawie protokołu._`;
    }

    return {
      found: true,
      sessionNumber: intent.sessionNumber,
      requestType: intent.requestType,
      documents: ragDocuments,
      hasTranscription: false,
      hasProtocol,
      hasVideo: true,
      transcriptionStarted: true,
      transcriptionJobId: job.id,
      message,
      suggestions: hasProtocol ? [`Pokaż protokół z sesji`] : [],
    };
  }

  private buildNotFoundResult(
    intent: SessionQueryIntent,
    ragDocuments: DocumentMatch[]
  ): SessionDiscoveryResult {
    const romanNumber = this.arabicToRoman(intent.sessionNumber);

    // Jeśli mamy jakiekolwiek dokumenty - pokaż je
    if (ragDocuments.length > 0) {
      let message = `Znalazłem ${ragDocuments.length} dokumentów powiązanych z sesją nr ${romanNumber} (${intent.sessionNumber}):\n\n`;

      for (const doc of ragDocuments.slice(0, 5)) {
        message += `📄 **${doc.title}**\n`;
        if (doc.sourceUrl) message += `   🔗 [Link](${doc.sourceUrl})\n`;
        if (doc.content)
          message += `   _${doc.content.substring(0, 150)}..._\n`;
        message += `\n`;
      }

      message += `\n**Brak transkrypcji wideo** - możesz:\n`;
      message += `1. Uruchomić transkrypcję w zakładce YouTube\n`;
      message += `2. Dodać źródło YouTube w ustawieniach\n`;

      return {
        found: true,
        sessionNumber: intent.sessionNumber,
        requestType: intent.requestType,
        documents: ragDocuments,
        hasTranscription: false,
        hasProtocol: ragDocuments.some((d) =>
          d.title.toLowerCase().includes("protokół")
        ),
        hasVideo: ragDocuments.some((d) => d.sourceUrl?.includes("youtube")),
        transcriptionStarted: false,
        message,
        suggestions: [`Uruchom transkrypcję sesji`, `Dodaj źródło YouTube`],
      };
    }

    // Brak dokumentów
    let message = `Nie znalazłem materiałów z sesji nr ${romanNumber} (${intent.sessionNumber}).\n\n`;
    message += `**Możliwe przyczyny:**\n`;
    message += `- Sesja nie została jeszcze dodana do systemu\n`;
    message += `- Nagranie wideo nie zostało jeszcze opublikowane\n`;
    message += `- Protokół jest w trakcie przygotowania\n\n`;
    message += `**Sugestie:**\n`;
    message += `1. Sprawdź portal rady miejskiej\n`;
    message += `2. Dodaj źródło danych YouTube w ustawieniach\n`;
    message += `3. Prześlij nagranie do transkrypcji ręcznie`;

    return {
      found: false,
      sessionNumber: intent.sessionNumber,
      requestType: intent.requestType,
      documents: ragDocuments,
      hasTranscription: false,
      hasProtocol: false,
      hasVideo: false,
      transcriptionStarted: false,
      message,
      suggestions: [
        `Dodaj źródło danych YouTube`,
        `Prześlij nagranie do transkrypcji`,
      ],
    };
  }
}

export default SessionDiscoveryService;
