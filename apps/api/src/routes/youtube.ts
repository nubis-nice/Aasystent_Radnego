import { FastifyPluginAsync } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { YouTubeSessionService } from "../services/youtube-session-service.js";
import { YouTubeDownloader } from "../services/youtube-downloader.js";
import {
  addTranscriptionJob,
  getTranscriptionJobStatus,
  getUserTranscriptionJobs,
  cancelTranscriptionJob,
  retryTranscriptionJob,
} from "../services/transcription-queue.js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const youtubeRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/youtube/sessions - Pobierz listę sesji rady z YouTube
  fastify.get("/youtube/sessions", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      // Pobierz źródła YouTube użytkownika - szukaj tych z pełnym URL kanału
      const { data: youtubeSources } = await supabase
        .from("data_sources")
        .select("url, name")
        .eq("user_id", user.id)
        .or(
          "type.eq.youtube,url.ilike.%youtube.com/@%,url.ilike.%youtube.com/channel/%"
        )
        .limit(1);

      // Użyj źródła użytkownika lub domyślnego kanału Drawno
      const firstSource = youtubeSources?.[0];

      // Sprawdź czy URL jest prawidłowy (zawiera @handle lub /channel/)
      const isValidChannelUrl =
        firstSource?.url &&
        (firstSource.url.includes("/@") ||
          firstSource.url.includes("/channel/"));

      const channelConfig = isValidChannelUrl
        ? {
            channelUrl: firstSource!.url
              .replace("/streams", "")
              .replace("/videos", ""),
            name: firstSource!.name || "Kanał YouTube",
          }
        : {
            channelUrl: "https://www.youtube.com/@gminadrawno9146",
            name: "Gmina Drawno",
          };

      console.log(
        `[YouTube API] Using channel: ${channelConfig.channelUrl} (${channelConfig.name})`
      );

      const service = new YouTubeSessionService();
      const result = await service.getCouncilSessions(channelConfig);

      if (!result.success) {
        return reply.status(500).send({
          error: result.error,
          sessions: [],
        });
      }

      return reply.send({
        success: true,
        channelName: result.channelName,
        sessions: result.sessions,
        formattedList: service.formatSessionList(result.sessions),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Błąd pobierania sesji",
      });
    }
  });

  // POST /api/youtube/session-info - Pobierz info o konkretnym wideo
  fastify.post<{
    Body: { videoUrl: string };
  }>("/youtube/session-info", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const { videoUrl } = request.body;
      if (!videoUrl) {
        return reply.status(400).send({ error: "Brak URL wideo" });
      }

      const service = new YouTubeSessionService();
      const videoInfo = await service.getVideoInfo(videoUrl);

      if (!videoInfo) {
        return reply.status(404).send({ error: "Nie znaleziono wideo" });
      }

      return reply.send({
        success: true,
        video: videoInfo,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Błąd pobierania info",
      });
    }
  });

  // POST /api/youtube/transcribe - Pobierz i transkrybuj wideo z YouTube
  fastify.post<{
    Body: { videoUrl: string; videoTitle?: string };
  }>("/youtube/transcribe", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const { videoUrl, videoTitle } = request.body;
      if (!videoUrl) {
        return reply.status(400).send({ error: "Brak URL wideo" });
      }

      // Extract video ID
      const videoIdMatch = videoUrl.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/);
      if (!videoIdMatch) {
        return reply.status(400).send({ error: "Nieprawidłowy URL YouTube" });
      }
      const videoId = videoIdMatch[1] as string;

      fastify.log.info(`[YouTube] Starting transcription for: ${videoUrl}`);

      // Initialize downloader with user config
      const downloader = new YouTubeDownloader();
      await downloader.initializeWithUserConfig(user.id);

      // Download audio
      const downloadResult = await downloader.downloadAudio(videoUrl);

      if (!downloadResult.success || !downloadResult.audioPath) {
        return reply.status(422).send({
          error: downloadResult.error || "Błąd pobierania audio",
          hint: "Upewnij się, że yt-dlp jest zainstalowany (pip install yt-dlp)",
        });
      }

      fastify.log.info(
        `[YouTube] Audio downloaded: ${downloadResult.audioPath}`
      );

      // Transcribe and analyze
      const result = await downloader.transcribeAndAnalyze(
        downloadResult.audioPath,
        videoId,
        videoTitle || downloadResult.title || "Sesja Rady",
        videoUrl
      );

      if (!result.success) {
        return reply.status(422).send({
          error: result.error,
        });
      }

      fastify.log.info(`[YouTube] Transcription complete for: ${videoUrl}`);

      return reply.send({
        success: true,
        rawTranscript: result.rawTranscript,
        formattedTranscript: result.formattedTranscript,
        segments: result.segments,
        summary: result.summary,
        metadata: result.metadata,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Błąd transkrypcji",
      });
    }
  });

  // POST /api/youtube/transcribe-async - Asynchroniczna transkrypcja z zapisem do RAG
  fastify.post<{
    Body: {
      videoUrl: string;
      videoTitle?: string;
      sessionId?: string;
      includeSentiment?: boolean;
      identifySpeakers?: boolean;
    };
  }>("/youtube/transcribe-async", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const {
        videoUrl,
        videoTitle,
        sessionId,
        includeSentiment,
        identifySpeakers,
      } = request.body;

      if (!videoUrl) {
        return reply.status(400).send({ error: "Brak URL wideo" });
      }

      // Walidacja URL YouTube
      const videoIdMatch = videoUrl.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/);
      if (!videoIdMatch) {
        return reply.status(400).send({ error: "Nieprawidłowy URL YouTube" });
      }

      fastify.log.info(
        `[YouTube] Creating async transcription job for: ${videoUrl}`
      );

      // Utwórz zadanie asynchroniczne w Redis queue
      const jobId = await addTranscriptionJob(
        user.id,
        videoUrl,
        videoTitle || "Sesja Rady",
        {
          sessionId,
          includeSentiment: includeSentiment ?? true,
          identifySpeakers: identifySpeakers ?? true,
        }
      );

      // Zapisz zadanie w bazie dla persystencji
      await supabase.from("transcription_jobs").insert({
        id: jobId,
        user_id: user.id,
        video_url: videoUrl,
        video_title: videoTitle || "Sesja Rady",
        session_id: sessionId ?? null,
        status: "pending",
        progress: 0,
        progress_message: "Oczekuje w kolejce...",
        include_sentiment: includeSentiment ?? true,
        identify_speakers: identifySpeakers ?? true,
        created_at: new Date().toISOString(),
      });

      fastify.log.info(`[YouTube] Job created: ${jobId}`);

      return reply.send({
        success: true,
        jobId: jobId,
        status: "pending",
        message:
          "Zadanie transkrypcji zostało utworzone. Możesz kontynuować pracę.",
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error:
          error instanceof Error ? error.message : "Błąd tworzenia zadania",
      });
    }
  });

  // GET /api/youtube/job/:jobId/detailed - Pobierz szczegółowy status zadania
  fastify.get<{
    Params: { jobId: string };
  }>("/youtube/job/:jobId/detailed", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const { jobId } = request.params;

      // Pobierz szczegółowy status z queue
      const job = await getTranscriptionJobStatus(jobId);

      if (!job) {
        return reply.status(404).send({ error: "Zadanie nie znalezione" });
      }

      // Weryfikuj dostęp przez bazę danych
      const { data: dbJob } = await supabase
        .from("transcription_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (!dbJob || dbJob.user_id !== user.id) {
        return reply
          .status(403)
          .send({ error: "Brak dostępu do tego zadania" });
      }

      return reply.send({
        success: true,
        job: {
          id: job.id,
          videoTitle: dbJob.video_title,
          videoUrl: dbJob.video_url,
          status: job.status,
          progress: job.progress,
          progressMessage: job.progressMessage,
          detailedProgress: job.detailedProgress,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          error: job.error,
          resultDocumentId: dbJob.result_document_id,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error:
          error instanceof Error ? error.message : "Błąd pobierania statusu",
      });
    }
  });

  // GET /api/youtube/job/:jobId - Sprawdź status zadania
  fastify.get<{
    Params: { jobId: string };
  }>("/youtube/job/:jobId", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const { jobId } = request.params;

      // Pobierz z queue
      const job = await getTranscriptionJobStatus(jobId);

      if (!job) {
        return reply.status(404).send({ error: "Zadanie nie znalezione" });
      }

      // Weryfikuj dostęp przez bazę danych
      const { data: dbJob } = await supabase
        .from("transcription_jobs")
        .select("user_id")
        .eq("id", jobId)
        .single();

      if (!dbJob || dbJob.user_id !== user.id) {
        return reply
          .status(403)
          .send({ error: "Brak dostępu do tego zadania" });
      }

      // Pobierz szczegóły z bazy
      const { data: jobDetails } = await supabase
        .from("transcription_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      return reply.send({
        success: true,
        job: {
          id: job.id,
          status: job.status,
          progress: job.progress,
          progressMessage: job.progressMessage,
          videoTitle: jobDetails?.video_title,
          videoUrl: jobDetails?.video_url,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          error: job.error,
          resultDocumentId: jobDetails?.result_document_id,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error:
          error instanceof Error ? error.message : "Błąd pobierania statusu",
      });
    }
  });

  // GET /api/youtube/jobs - Lista zadań użytkownika
  fastify.get("/youtube/jobs", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      // Pobierz zadania z BAZY DANYCH jako źródło prawdy
      const { data: dbJobs, error: dbError } = await supabase
        .from("transcription_jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      // Pobierz zadania z Redis queue dla aktualnego postępu
      const queueJobs = await getUserTranscriptionJobs(user.id);
      const queueJobsMap = new Map(queueJobs.map((j) => [j.id, j]));

      // Połącz dane z bazy z postępem z queue
      const jobsWithDetails = (dbJobs || []).map((dbJob) => {
        const queueJob = queueJobsMap.get(dbJob.id);

        return {
          id: dbJob.id,
          status: queueJob?.status || dbJob.status,
          progress: queueJob?.progress ?? dbJob.progress,
          progressMessage: queueJob?.progressMessage || dbJob.progress_message,
          videoTitle: dbJob.video_title,
          videoUrl: dbJob.video_url,
          createdAt: queueJob?.createdAt || new Date(dbJob.created_at),
          completedAt: dbJob.completed_at
            ? new Date(dbJob.completed_at)
            : undefined,
          error: queueJob?.error || dbJob.error,
          resultDocumentId: dbJob.result_document_id,
        };
      });

      return reply.send({
        success: true,
        jobs: jobsWithDetails,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Błąd pobierania zadań",
      });
    }
  });

  // POST /api/youtube/rag/add-youtube-session - Dodaj sesję YouTube do RAG z powiązaniami
  fastify.post<{
    Body: {
      session: {
        id: string;
        title: string;
        url: string;
        publishedAt?: string;
        thumbnailUrl?: string;
      };
      relatedDocumentId?: string | null;
      detectedRelation?: string | null;
    };
  }>("/youtube/rag/add-youtube-session", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const { session, relatedDocumentId, detectedRelation } = request.body;

      if (!session || !session.id || !session.title) {
        return reply.status(400).send({ error: "Brak danych sesji" });
      }

      // Zapisz do scraped_content
      const { data: scraped, error: scrapedError } = await supabase
        .from("scraped_content")
        .insert({
          url: session.url,
          title: session.title,
          content_type: "youtube_session",
          raw_content: JSON.stringify({
            videoId: session.id,
            title: session.title,
            url: session.url,
            publishedAt: session.publishedAt,
            thumbnailUrl: session.thumbnailUrl,
            detectedRelation,
          }),
          metadata: {
            videoId: session.id,
            thumbnailUrl: session.thumbnailUrl,
            publishedAt: session.publishedAt,
            relatedDocumentId,
            detectedRelation,
          },
        })
        .select()
        .single();

      if (scrapedError) {
        console.error("Error saving to scraped_content:", scrapedError);
        return reply.status(500).send({ error: "Błąd zapisu do bazy" });
      }

      // Jeśli wykryto powiązanie, wyszukaj dokumenty do powiązania
      if (detectedRelation) {
        const sessionNumber = detectedRelation.replace(/[^0-9IVXLCDM]/gi, "");
        if (sessionNumber) {
          // Szukaj dokumentów z tym numerem sesji
          const { data: relatedDocs } = await supabase
            .from("processed_documents")
            .select("id, title")
            .eq("user_id", user.id)
            .or(
              `title.ilike.%sesja ${sessionNumber}%,title.ilike.%${sessionNumber} sesj%`
            )
            .limit(5);

          if (relatedDocs && relatedDocs.length > 0) {
            // Zapisz powiązania w document_relations (jeśli tabela istnieje)
            console.log(
              `[RAG] Found ${relatedDocs.length} related documents for session ${sessionNumber}`
            );
          }
        }
      }

      return reply.send({
        success: true,
        message: "Sesja YouTube dodana do RAG",
        scrapedContentId: scraped.id,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Błąd dodawania do RAG",
      });
    }
  });

  // POST /api/youtube/job/:jobId/cancel - Anuluj zadanie transkrypcji
  fastify.post<{
    Params: { jobId: string };
  }>("/youtube/job/:jobId/cancel", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const { jobId } = request.params;

      // Sprawdź czy zadanie należy do użytkownika
      const { data: dbJob } = await supabase
        .from("transcription_jobs")
        .select("user_id, status")
        .eq("id", jobId)
        .single();

      if (!dbJob || dbJob.user_id !== user.id) {
        return reply
          .status(403)
          .send({ error: "Brak dostępu do tego zadania" });
      }

      if (dbJob.status === "completed" || dbJob.status === "failed") {
        return reply
          .status(400)
          .send({ error: "Nie można anulować zakończonego zadania" });
      }

      // Anuluj w Redis queue
      const cancelled = await cancelTranscriptionJob(jobId);

      // Zaktualizuj status w bazie
      await supabase
        .from("transcription_jobs")
        .update({
          status: "failed",
          error: "Anulowane przez użytkownika",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      fastify.log.info(`[YouTube] Job ${jobId} cancelled by user ${user.id}`);

      return reply.send({
        success: true,
        cancelled,
        message: "Zadanie zostało anulowane",
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error:
          error instanceof Error ? error.message : "Błąd anulowania zadania",
      });
    }
  });

  // DELETE /api/youtube/job/:jobId - Usuń zadanie transkrypcji
  fastify.delete<{
    Params: { jobId: string };
  }>("/youtube/job/:jobId", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const { jobId } = request.params;

      // Sprawdź czy zadanie należy do użytkownika
      const { data: dbJob } = await supabase
        .from("transcription_jobs")
        .select("user_id, status, result_document_id")
        .eq("id", jobId)
        .single();

      if (!dbJob) {
        return reply.status(404).send({ error: "Zadanie nie znalezione" });
      }

      if (dbJob.user_id !== user.id) {
        return reply
          .status(403)
          .send({ error: "Brak dostępu do tego zadania" });
      }

      // Jeśli zadanie jest aktywne, anuluj je najpierw
      if (dbJob.status !== "completed" && dbJob.status !== "failed") {
        await cancelTranscriptionJob(jobId);
      }

      // Usuń z bazy danych
      await supabase.from("transcription_jobs").delete().eq("id", jobId);

      fastify.log.info(`[YouTube] Job ${jobId} deleted by user ${user.id}`);

      return reply.send({
        success: true,
        message: "Zadanie zostało usunięte",
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Błąd usuwania zadania",
      });
    }
  });

  // POST /api/youtube/job/:jobId/retry - Ponów nieudane zadanie
  fastify.post<{
    Params: { jobId: string };
  }>("/youtube/job/:jobId/retry", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const { jobId } = request.params;

      // Sprawdź czy zadanie należy do użytkownika
      const { data: dbJob } = await supabase
        .from("transcription_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (!dbJob) {
        return reply.status(404).send({ error: "Zadanie nie znalezione" });
      }

      if (dbJob.user_id !== user.id) {
        return reply
          .status(403)
          .send({ error: "Brak dostępu do tego zadania" });
      }

      if (dbJob.status !== "failed") {
        return reply
          .status(400)
          .send({ error: "Można ponowić tylko nieudane zadania" });
      }

      // Spróbuj retry w Redis queue
      const retried = await retryTranscriptionJob(jobId);

      if (retried) {
        // Zaktualizuj status w bazie
        await supabase
          .from("transcription_jobs")
          .update({
            status: "pending",
            progress: 0,
            progress_message: "Oczekuje w kolejce (ponowiona próba)...",
            error: null,
            completed_at: null,
          })
          .eq("id", jobId);

        fastify.log.info(`[YouTube] Job ${jobId} retried by user ${user.id}`);

        return reply.send({
          success: true,
          message: "Zadanie zostało ponowione",
        });
      } else {
        // Utwórz nowe zadanie z tymi samymi parametrami
        const newJobId = await addTranscriptionJob(
          user.id,
          dbJob.video_url,
          dbJob.video_title,
          {
            sessionId: dbJob.session_id,
            includeSentiment: dbJob.include_sentiment,
            identifySpeakers: dbJob.identify_speakers,
          }
        );

        // Zapisz nowe zadanie w bazie
        await supabase.from("transcription_jobs").insert({
          id: newJobId,
          user_id: user.id,
          video_url: dbJob.video_url,
          video_title: dbJob.video_title,
          session_id: dbJob.session_id,
          status: "pending",
          progress: 0,
          progress_message: "Oczekuje w kolejce (nowa próba)...",
          include_sentiment: dbJob.include_sentiment,
          identify_speakers: dbJob.identify_speakers,
          created_at: new Date().toISOString(),
        });

        fastify.log.info(
          `[YouTube] New job ${newJobId} created to replace failed job ${jobId}`
        );

        return reply.send({
          success: true,
          newJobId,
          message: "Utworzono nowe zadanie transkrypcji",
        });
      }
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error:
          error instanceof Error ? error.message : "Błąd ponowienia zadania",
      });
    }
  });

  // GET /api/youtube/transcription/:documentId - Pobierz treść zapisanej transkrypcji
  fastify.get<{
    Params: { documentId: string };
  }>("/youtube/transcription/:documentId", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return reply.status(401).send({ error: "Invalid token" });
      }

      const { documentId } = request.params;

      const { data: document, error: docError } = await supabase
        .from("processed_documents")
        .select("id, title, content, metadata")
        .eq("user_id", user.id)
        .eq("id", documentId)
        .single();

      if (docError || !document) {
        return reply.status(404).send({ error: "Transkrypcja nie znaleziona" });
      }

      return reply.send({ success: true, document });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Błąd pobierania transkrypcji",
      });
    }
  });
};
