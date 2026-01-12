import { FastifyPluginAsync } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { YouTubeSessionService } from "../services/youtube-session-service.js";
import { YouTubeDownloader } from "../services/youtube-downloader.js";
import { getTranscriptionJobService } from "../services/transcription-job-service.js";

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

      const service = new YouTubeSessionService();
      const result = await service.getCouncilSessions();

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

      // Utwórz zadanie asynchroniczne
      const jobService = await getTranscriptionJobService(user.id);
      const job = await jobService.createJob(
        videoUrl,
        videoTitle || "Sesja Rady",
        {
          sessionId,
          includeSentiment: includeSentiment ?? true,
          identifySpeakers: identifySpeakers ?? true,
        }
      );

      fastify.log.info(`[YouTube] Job created: ${job.id}`);

      return reply.send({
        success: true,
        jobId: job.id,
        status: job.status,
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
      const jobService = await getTranscriptionJobService(user.id);
      const job = jobService.getJob(jobId);

      if (!job) {
        return reply.status(404).send({ error: "Zadanie nie znalezione" });
      }

      if (job.userId !== user.id) {
        return reply
          .status(403)
          .send({ error: "Brak dostępu do tego zadania" });
      }

      return reply.send({
        success: true,
        job: {
          id: job.id,
          status: job.status,
          progress: job.progress,
          progressMessage: job.progressMessage,
          videoTitle: job.videoTitle,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          error: job.error,
          resultDocumentId: job.resultDocumentId,
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

      const jobService = await getTranscriptionJobService(user.id);
      const jobs = jobService.getUserJobs();

      return reply.send({
        success: true,
        jobs: jobs.map((job) => ({
          id: job.id,
          status: job.status,
          progress: job.progress,
          progressMessage: job.progressMessage,
          videoTitle: job.videoTitle,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          error: job.error,
          resultDocumentId: job.resultDocumentId,
        })),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Błąd pobierania zadań",
      });
    }
  });
};
