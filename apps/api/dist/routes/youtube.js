import { createClient } from "@supabase/supabase-js";
import { YouTubeSessionService } from "../services/youtube-session-service.js";
import { YouTubeDownloader } from "../services/youtube-downloader.js";
import { getTranscriptionJobService } from "../services/transcription-job-service.js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
export const youtubeRoutes = async (fastify) => {
    // GET /api/youtube/sessions - Pobierz listę sesji rady z YouTube
    fastify.get("/youtube/sessions", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { data: { user }, error: authError, } = await supabase.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            // Pobierz źródła YouTube użytkownika - szukaj tych z pełnym URL kanału
            const { data: youtubeSources } = await supabase
                .from("data_sources")
                .select("url, name")
                .eq("user_id", user.id)
                .or("type.eq.youtube,url.ilike.%youtube.com/@%,url.ilike.%youtube.com/channel/%")
                .limit(1);
            // Użyj źródła użytkownika lub domyślnego kanału Drawno
            const firstSource = youtubeSources?.[0];
            // Sprawdź czy URL jest prawidłowy (zawiera @handle lub /channel/)
            const isValidChannelUrl = firstSource?.url &&
                (firstSource.url.includes("/@") ||
                    firstSource.url.includes("/channel/"));
            const channelConfig = isValidChannelUrl
                ? {
                    channelUrl: firstSource.url
                        .replace("/streams", "")
                        .replace("/videos", ""),
                    name: firstSource.name || "Kanał YouTube",
                }
                : {
                    channelUrl: "https://www.youtube.com/@gminadrawno9146",
                    name: "Gmina Drawno",
                };
            console.log(`[YouTube API] Using channel: ${channelConfig.channelUrl} (${channelConfig.name})`);
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
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd pobierania sesji",
            });
        }
    });
    // POST /api/youtube/session-info - Pobierz info o konkretnym wideo
    fastify.post("/youtube/session-info", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { data: { user }, error: authError, } = await supabase.auth.getUser(token);
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
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd pobierania info",
            });
        }
    });
    // POST /api/youtube/transcribe - Pobierz i transkrybuj wideo z YouTube
    fastify.post("/youtube/transcribe", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { data: { user }, error: authError, } = await supabase.auth.getUser(token);
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
            const videoId = videoIdMatch[1];
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
            fastify.log.info(`[YouTube] Audio downloaded: ${downloadResult.audioPath}`);
            // Transcribe and analyze
            const result = await downloader.transcribeAndAnalyze(downloadResult.audioPath, videoId, videoTitle || downloadResult.title || "Sesja Rady", videoUrl);
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
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd transkrypcji",
            });
        }
    });
    // POST /api/youtube/transcribe-async - Asynchroniczna transkrypcja z zapisem do RAG
    fastify.post("/youtube/transcribe-async", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { data: { user }, error: authError, } = await supabase.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Invalid token" });
            }
            const { videoUrl, videoTitle, sessionId, includeSentiment, identifySpeakers, } = request.body;
            if (!videoUrl) {
                return reply.status(400).send({ error: "Brak URL wideo" });
            }
            // Walidacja URL YouTube
            const videoIdMatch = videoUrl.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/);
            if (!videoIdMatch) {
                return reply.status(400).send({ error: "Nieprawidłowy URL YouTube" });
            }
            fastify.log.info(`[YouTube] Creating async transcription job for: ${videoUrl}`);
            // Utwórz zadanie asynchroniczne
            const jobService = await getTranscriptionJobService(user.id);
            const job = await jobService.createJob(videoUrl, videoTitle || "Sesja Rady", {
                sessionId,
                includeSentiment: includeSentiment ?? true,
                identifySpeakers: identifySpeakers ?? true,
            });
            fastify.log.info(`[YouTube] Job created: ${job.id}`);
            return reply.send({
                success: true,
                jobId: job.id,
                status: job.status,
                message: "Zadanie transkrypcji zostało utworzone. Możesz kontynuować pracę.",
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd tworzenia zadania",
            });
        }
    });
    // GET /api/youtube/job/:jobId - Sprawdź status zadania
    fastify.get("/youtube/job/:jobId", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { data: { user }, error: authError, } = await supabase.auth.getUser(token);
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
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd pobierania statusu",
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
            const { data: { user }, error: authError, } = await supabase.auth.getUser(token);
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
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd pobierania zadań",
            });
        }
    });
    // POST /api/youtube/rag/add-youtube-session - Dodaj sesję YouTube do RAG z powiązaniami
    fastify.post("/youtube/rag/add-youtube-session", async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith("Bearer ")) {
                return reply.status(401).send({ error: "Unauthorized" });
            }
            const token = authHeader.substring(7);
            const { data: { user }, error: authError, } = await supabase.auth.getUser(token);
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
                        .or(`title.ilike.%sesja ${sessionNumber}%,title.ilike.%${sessionNumber} sesj%`)
                        .limit(5);
                    if (relatedDocs && relatedDocs.length > 0) {
                        // Zapisz powiązania w document_relations (jeśli tabela istnieje)
                        console.log(`[RAG] Found ${relatedDocs.length} related documents for session ${sessionNumber}`);
                    }
                }
            }
            return reply.send({
                success: true,
                message: "Sesja YouTube dodana do RAG",
                scrapedContentId: scraped.id,
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Błąd dodawania do RAG",
            });
        }
    });
};
//# sourceMappingURL=youtube.js.map