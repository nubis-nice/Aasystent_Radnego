import { FastifyPluginAsync } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { YouTubeSessionService } from "../services/youtube-session-service.js";
import { YouTubeDownloader } from "../services/youtube-downloader.js";

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
};
