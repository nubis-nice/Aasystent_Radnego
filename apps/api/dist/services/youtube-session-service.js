import { getLLMClient, getAIConfig } from "../ai/index.js";
export class YouTubeSessionService {
    llmClient = null;
    userId = null;
    modelName = "gpt-4o-mini";
    municipalityInfo = null;
    constructor() { }
    async initializeWithUserConfig(userId) {
        this.userId = userId;
        this.llmClient = await getLLMClient(userId);
        const llmConfig = await getAIConfig(userId, "llm");
        this.modelName = llmConfig.modelName;
        // Pobierz informacje o gminie użytkownika
        this.municipalityInfo = await this.getMunicipalityInfo(userId);
        console.log(`[YouTubeSessionService] Initialized: provider=${llmConfig.provider}, model=${llmConfig.modelName}`);
        console.log(`[YouTubeSessionService] Municipality: ${this.municipalityInfo?.municipality || "not set"}`);
    }
    /**
     * Pobiera informacje o gminie użytkownika z profilu
     */
    async getMunicipalityInfo(userId) {
        try {
            const { createClient } = await import("@supabase/supabase-js");
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            const { data } = await supabase
                .from("user_locale_settings")
                .select("municipality, council_name, voivodeship")
                .eq("user_id", userId)
                .single();
            return {
                municipality: data?.municipality || null,
                councilName: data?.council_name || null,
                voivodeship: data?.voivodeship || null,
            };
        }
        catch (error) {
            console.error("[YouTubeSessionService] Error fetching municipality info:", error);
            return {
                municipality: null,
                councilName: null,
                voivodeship: null,
            };
        }
    }
    /**
     * Analizuje tytuł wideo YouTube i wyodrębnia numer sesji rady
     * Konwertuje numery rzymskie na arabskie
     */
    async analyzeVideoTitle(videoTitle) {
        if (!this.llmClient) {
            console.warn("[YouTubeSessionService] LLM client not initialized, using regex fallback");
            return this.analyzeVideoTitleWithRegex(videoTitle);
        }
        try {
            const prompt = `Jesteś ekspertem analizy tytułów nagrań sesji rad miejskich/gminnych.

Przeanalizuj tytuł wideo YouTube i określ numer sesji rady.

TYTUŁ WIDEO:
"${videoTitle}"

ZASADY:
1. Szukaj słów: "sesja", "rada", "obrady", "posiedzenie"
2. Wyodrębnij numer sesji (może być arabski lub rzymski)
3. Konwertuj numery rzymskie na arabskie (np. XIV → 14, XVII → 17)
4. Jeśli brak numeru sesji - zwróć null
5. Oceń pewność identyfikacji (0-100%)

PRZYKŁADY:
- "Sesja Rady Miejskiej nr 14" → sessionNumber: 14, confidence: 95
- "XVII Sesja Rady Gminy Drawno" → sessionNumber: 17, confidence: 90
- "Transmisja obrad rady - sesja 25" → sessionNumber: 25, confidence: 85
- "Konferencja prasowa burmistrza" → sessionNumber: null, confidence: 0

Odpowiedz TYLKO w formacie JSON (bez markdown):
{
  "sessionNumber": 14,
  "confidence": 95,
  "reasoning": "Tytuł zawiera wyraźne oznaczenie 'sesja nr 14'"
}`;
            const response = await this.llmClient.chat.completions.create({
                model: this.modelName,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
                response_format: { type: "json_object" },
            }, {
                timeout: 30000, // 30s timeout dla prostej analizy tytułu
            });
            const content = response.choices[0]?.message?.content;
            if (!content) {
                return this.analyzeVideoTitleWithRegex(videoTitle);
            }
            const result = JSON.parse(content);
            console.log(`[YouTubeSessionService] Analyzed title: "${videoTitle}" → session ${result.sessionNumber} (confidence: ${result.confidence}%)`);
            return {
                sessionNumber: result.sessionNumber,
                confidence: result.confidence || 0,
                reasoning: result.reasoning || "Analiza LLM",
            };
        }
        catch (error) {
            console.error("[YouTubeSessionService] Title analysis error:", error);
            return this.analyzeVideoTitleWithRegex(videoTitle);
        }
    }
    /**
     * Fallback: Analiza tytułu za pomocą regex (bez LLM)
     */
    analyzeVideoTitleWithRegex(videoTitle) {
        const title = videoTitle.toLowerCase();
        // Sprawdź czy to sesja rady
        const isSession = title.includes("sesja") ||
            title.includes("rada") ||
            title.includes("obrady") ||
            title.includes("posiedzenie");
        if (!isSession) {
            return {
                sessionNumber: null,
                confidence: 0,
                reasoning: "Brak słów kluczowych sesji",
            };
        }
        // Konwersja rzymskich na arabskie
        const romanToArabic = {
            i: 1,
            ii: 2,
            iii: 3,
            iv: 4,
            v: 5,
            vi: 6,
            vii: 7,
            viii: 8,
            ix: 9,
            x: 10,
            xi: 11,
            xii: 12,
            xiii: 13,
            xiv: 14,
            xv: 15,
            xvi: 16,
            xvii: 17,
            xviii: 18,
            xix: 19,
            xx: 20,
            xxi: 21,
            xxii: 22,
            xxiii: 23,
            xxiv: 24,
            xxv: 25,
            xxvi: 26,
            xxvii: 27,
            xxviii: 28,
            xxix: 29,
            xxx: 30,
            xxxi: 31,
            xxxii: 32,
            xxxiii: 33,
            xxxiv: 34,
            xxxv: 35,
            xxxvi: 36,
            xxxvii: 37,
            xxxviii: 38,
            xxxix: 39,
            xl: 40,
            xli: 41,
            xlii: 42,
            xliii: 43,
            xliv: 44,
            xlv: 45,
            xlvi: 46,
            xlvii: 47,
            xlviii: 48,
            xlix: 49,
            l: 50,
        };
        // Szukaj numeru arabskiego (np. "sesja 14", "nr 25")
        const arabicMatch = title.match(/(?:sesja|nr|numer|posiedzenie)\s*\.?\s*(\d{1,3})/);
        if (arabicMatch && arabicMatch[1]) {
            const num = parseInt(arabicMatch[1], 10);
            return {
                sessionNumber: num,
                confidence: 85,
                reasoning: `Znaleziono numer arabski: ${num}`,
            };
        }
        // Szukaj numeru rzymskiego
        for (const [roman, arabic] of Object.entries(romanToArabic)) {
            const romanPattern = new RegExp(`\\b${roman}\\b`, "i");
            if (romanPattern.test(title)) {
                return {
                    sessionNumber: arabic,
                    confidence: 80,
                    reasoning: `Znaleziono numer rzymski: ${roman.toUpperCase()} → ${arabic}`,
                };
            }
        }
        return {
            sessionNumber: null,
            confidence: 30,
            reasoning: "Wykryto sesję, ale brak numeru",
        };
    }
    /**
     * Generuje dynamiczne zapytanie YouTube na podstawie kontekstu
     */
    async generateSearchQuery(context, documentContext) {
        if (!this.llmClient) {
            console.warn("[YouTubeSessionService] LLM client not initialized, using context directly");
            return context;
        }
        try {
            const prompt = `Jesteś ekspertem od wyszukiwania materiałów wideo z sesji rad gminnych/miejskich w Polsce.

Na podstawie podanego kontekstu wygeneruj JEDNO optymalne zapytanie do wyszukiwarki YouTube.

KONTEKST UŻYTKOWNIKA:
${context}

${documentContext
                ? `KONTEKST DOKUMENTU:
- Tytuł: ${documentContext.title || "brak"}
- Opis: ${documentContext.description || "brak"}
- Tematy: ${documentContext.topics?.join(", ") || "brak"}`
                : ""}

ZASADY:
1. Zapytanie powinno być krótkie (3-6 słów)
2. Użyj słów kluczowych: "sesja rady", "rada miejska", "rada gminy", nazwa miejscowości
3. Jeśli kontekst dotyczy konkretnej gminy/miasta - użyj jej nazwy
4. Jeśli kontekst dotyczy konkretnego numeru sesji - dodaj go
5. Odpowiedz TYLKO zapytaniem, bez dodatkowego tekstu

PRZYKŁADY:
- "sesja rady drawno" 
- "rada miejska szczecin sesja 45"
- "obrady rady gminy przybiernów"

ZAPYTANIE:`;
            const response = await this.llmClient.chat.completions.create({
                model: this.modelName,
                messages: [{ role: "user", content: prompt }],
                max_tokens: 50,
                temperature: 0.3,
            });
            const query = response.choices[0]?.message?.content?.trim() || context;
            console.log(`[YouTubeSessionService] Generated search query: "${query}" from context: "${context.substring(0, 50)}..."`);
            return query;
        }
        catch (error) {
            console.error("[YouTubeSessionService] Error generating search query:", error);
            return context;
        }
    }
    /**
     * Inteligentne wyszukiwanie kanału YouTube gminy przez LLM
     * Generuje zapytanie wyszukiwania na podstawie danych użytkownika
     */
    async findMunicipalityChannel() {
        if (!this.municipalityInfo?.municipality) {
            return null;
        }
        if (!this.llmClient) {
            // Fallback: proste zapytanie
            return `${this.municipalityInfo.municipality} rada gminy oficjalny kanał`;
        }
        try {
            const prompt = `Wygeneruj zapytanie wyszukiwania YouTube aby znaleźć OFICJALNY kanał gminy/miasta.

DANE GMINY:
- Gmina/Miasto: ${this.municipalityInfo.municipality}
- Rada: ${this.municipalityInfo.councilName || "brak"}
- Województwo: ${this.municipalityInfo.voivodeship || "brak"}

ZASADY:
1. Zapytanie powinno zawierać nazwę gminy/miasta
2. Dodaj słowa kluczowe: "gmina", "urząd", "oficjalny", "kanał"
3. Unikaj zbyt długich zapytań (max 5-6 słów)
4. Odpowiedz TYLKO zapytaniem, bez dodatkowego tekstu

PRZYKŁADY:
- "gmina drawno oficjalny kanał"
- "urząd miasta szczecin youtube"
- "rada miejska białobrzegi"

ZAPYTANIE:`;
            const response = await this.llmClient.chat.completions.create({
                model: this.modelName,
                messages: [{ role: "user", content: prompt }],
                max_tokens: 30,
                temperature: 0.2,
            });
            const query = response.choices[0]?.message?.content?.trim();
            console.log(`[YouTubeSessionService] Generated channel search query: "${query}"`);
            return query || null;
        }
        catch (error) {
            console.error("[YouTubeSessionService] Error generating channel search:", error);
            return `${this.municipalityInfo.municipality} rada gminy`;
        }
    }
    /**
     * Wyszukuje wideo na YouTube z dynamicznym zapytaniem
     * Obsługuje zarówno sesje rady jak i dowolne materiały
     */
    async searchWithContext(userQuery, documentContext) {
        // Generuj zapytanie wyszukiwania
        const searchQuery = await this.generateSearchQuery(userQuery, documentContext);
        // Wyszukaj filmy na YouTube
        return this.getCouncilSessions(undefined, searchQuery);
    }
    async getCouncilSessions(channelConfig, searchQuery) {
        // Jeśli brak zapytania i brak konfiguracji kanału, zwróć błąd
        if (!searchQuery && !channelConfig) {
            console.warn("[YouTubeSessionService] No search query or channel config provided");
            return {
                success: false,
                sessions: [],
                channelName: "Brak konfiguracji",
                error: "Wymagane jest zapytanie wyszukiwania lub konfiguracja kanału YouTube",
            };
        }
        // Jeśli brak zapytania ale jest kanał, scrapuj kanał
        if (!searchQuery && channelConfig) {
            console.log(`[YouTubeSessionService] No search query, scraping channel: ${channelConfig.channelUrl}`);
            const channelSessions = await this.scrapeChannelVideos(channelConfig);
            return {
                success: true,
                sessions: channelSessions,
                channelName: channelConfig.name,
            };
        }
        const query = searchQuery;
        try {
            console.log(`[YouTubeSessionService] Searching YouTube for: ${query}`);
            // Użyj wyszukiwania YouTube
            const sessions = await this.searchYouTubeVideos(query);
            // Jeśli wyszukiwanie nie zwróciło wyników i jest kanał fallback
            if (sessions.length === 0 && channelConfig) {
                console.log(`[YouTubeSessionService] No search results, falling back to channel: ${channelConfig.channelUrl}`);
                const channelSessions = await this.scrapeChannelVideos(channelConfig);
                return {
                    success: true,
                    sessions: channelSessions,
                    channelName: channelConfig.name,
                };
            }
            return {
                success: sessions.length > 0,
                sessions,
                channelName: `Wyniki wyszukiwania: ${query}`,
                error: sessions.length === 0
                    ? "Nie znaleziono nagrań dla podanego zapytania"
                    : undefined,
            };
        }
        catch (error) {
            console.error("[YouTubeSessionService] Error fetching sessions:", error);
            return {
                success: false,
                sessions: [],
                channelName: channelConfig?.name || "Wyszukiwanie YouTube",
                error: error instanceof Error
                    ? error.message
                    : "Błąd pobierania listy sesji",
            };
        }
    }
    async searchYouTubeVideos(query) {
        const videos = [];
        try {
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=CAI%253D`;
            console.log(`[YouTubeSessionService] Search URL: ${searchUrl}`);
            const response = await fetch(searchUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
                },
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const html = await response.text();
            // Extract video data from ytInitialData
            const ytDataMatch = html.match(/var ytInitialData = ({.+?});<\/script>/s);
            if (ytDataMatch) {
                try {
                    const ytData = JSON.parse(ytDataMatch[1]);
                    const contents = ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents
                        ?.sectionListRenderer?.contents || [];
                    for (const section of contents) {
                        const items = section?.itemSectionRenderer?.contents || [];
                        for (const item of items) {
                            const videoRenderer = item?.videoRenderer;
                            if (videoRenderer) {
                                const videoId = videoRenderer.videoId;
                                const title = videoRenderer.title?.runs?.[0]?.text || "Bez tytułu";
                                const description = videoRenderer.detailedMetadataSnippets?.[0]?.snippetText?.runs
                                    ?.map((r) => r.text)
                                    .join("") ||
                                    videoRenderer.descriptionSnippet?.runs?.[0]?.text ||
                                    "";
                                const publishedAt = videoRenderer.publishedTimeText?.simpleText || "";
                                const thumbnailUrl = videoRenderer.thumbnail?.thumbnails?.[0]?.url || "";
                                const duration = videoRenderer.lengthText?.simpleText || "";
                                videos.push({
                                    id: videoId,
                                    title,
                                    description,
                                    publishedAt,
                                    thumbnailUrl,
                                    duration,
                                    url: `https://www.youtube.com/watch?v=${videoId}`,
                                });
                            }
                        }
                    }
                }
                catch (parseError) {
                    console.error("[YouTubeSessionService] Error parsing search ytInitialData:", parseError);
                }
            }
            console.log(`[YouTubeSessionService] Search found ${videos.length} videos`);
            return videos.slice(0, 20); // Limit to 20 most recent
        }
        catch (error) {
            console.error("[YouTubeSessionService] Search error:", error);
            return [];
        }
    }
    async scrapeChannelVideos(config) {
        const videos = [];
        // Próbuj najpierw /streams (transmisje/nagrania sesji), potem /videos
        const endpoints = ["/streams", "/videos"];
        for (const endpoint of endpoints) {
            try {
                const channelUrl = `${config.channelUrl}${endpoint}`;
                console.log(`[YouTubeSessionService] Scraping channel: ${channelUrl}`);
                const response = await fetch(channelUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
                    },
                });
                if (!response.ok) {
                    console.log(`[YouTubeSessionService] ${endpoint} returned ${response.status}, trying next...`);
                    continue;
                }
                const html = await response.text();
                // Extract video data from ytInitialData
                const ytDataMatch = html.match(/var ytInitialData = ({.+?});<\/script>/);
                if (ytDataMatch) {
                    try {
                        const ytData = JSON.parse(ytDataMatch[1]);
                        const tabs = ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
                        for (const tab of tabs) {
                            const tabContent = tab?.tabRenderer?.content?.richGridRenderer?.contents || [];
                            for (const item of tabContent) {
                                const videoRenderer = item?.richItemRenderer?.content?.videoRenderer;
                                if (videoRenderer) {
                                    const videoId = videoRenderer.videoId;
                                    const title = videoRenderer.title?.runs?.[0]?.text || "Bez tytułu";
                                    const description = videoRenderer.descriptionSnippet?.runs?.[0]?.text || "";
                                    const publishedAt = videoRenderer.publishedTimeText?.simpleText || "";
                                    const thumbnailUrl = videoRenderer.thumbnail?.thumbnails?.[0]?.url || "";
                                    const duration = videoRenderer.lengthText?.simpleText || "";
                                    // Dla /streams nie filtruj - wszystko to sesje
                                    // Dla /videos filtruj tylko sesje
                                    const isStreamsEndpoint = endpoint === "/streams";
                                    const isSessionVideo = title.toLowerCase().includes("sesja") ||
                                        title.toLowerCase().includes("rada") ||
                                        title.toLowerCase().includes("obrady");
                                    if (isStreamsEndpoint || isSessionVideo) {
                                        videos.push({
                                            id: videoId,
                                            title,
                                            description,
                                            publishedAt,
                                            thumbnailUrl,
                                            duration,
                                            url: `https://www.youtube.com/watch?v=${videoId}`,
                                        });
                                    }
                                }
                            }
                        }
                    }
                    catch (parseError) {
                        console.error("[YouTubeSessionService] Error parsing ytInitialData:", parseError);
                    }
                }
                // Fallback: regex extraction if ytInitialData parsing failed
                if (videos.length === 0) {
                    const videoIdRegex = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;
                    const matches = html.matchAll(videoIdRegex);
                    const uniqueIds = new Set();
                    for (const match of matches) {
                        const videoId = match[1];
                        if (videoId && !uniqueIds.has(videoId)) {
                            uniqueIds.add(videoId);
                            videos.push({
                                id: videoId,
                                title: `Wideo ${uniqueIds.size}`,
                                description: "",
                                publishedAt: "",
                                thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                                url: `https://www.youtube.com/watch?v=${videoId}`,
                            });
                        }
                        if (videos.length >= 20)
                            break;
                    }
                }
                // Jeśli znaleziono wideo, zwróć wyniki
                if (videos.length > 0) {
                    console.log(`[YouTubeSessionService] Found ${videos.length} videos from ${endpoint}`);
                    return videos.slice(0, 20);
                }
                console.log(`[YouTubeSessionService] No videos found in ${endpoint}, trying next...`);
            }
            catch (error) {
                console.error(`[YouTubeSessionService] Error scraping ${endpoint}:`, error);
                // Kontynuuj do następnego endpointa
            }
        }
        console.log(`[YouTubeSessionService] No videos found in any endpoint`);
        return videos;
    }
    /**
     * Pobiera wideo z kanału YouTube przez oficjalne Data API v3
     */
    async fetchChannelVideosViaAPI(config) {
        if (!config.apiKey) {
            console.log("[YouTubeSessionService] No API key provided, falling back to scraping");
            return this.scrapeChannelVideos(config);
        }
        const videos = [];
        try {
            // Najpierw pobierz channel ID z URL lub handle
            let channelId = config.channelId;
            if (!channelId && config.channelUrl) {
                // Wyciągnij handle z URL (np. @gminadrawno9146)
                const handleMatch = config.channelUrl.match(/@([^/]+)/);
                if (handleMatch) {
                    const handle = handleMatch[1];
                    // Użyj search API aby znaleźć kanał po handle
                    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&key=${config.apiKey}`;
                    const searchResponse = await fetch(searchUrl);
                    if (searchResponse.ok) {
                        const searchData = (await searchResponse.json());
                        if (searchData.items && searchData.items.length > 0) {
                            channelId =
                                searchData.items[0]?.snippet?.channelId ||
                                    searchData.items[0]?.id?.channelId;
                        }
                    }
                }
            }
            if (!channelId) {
                console.log("[YouTubeSessionService] Could not determine channel ID, falling back to scraping");
                return this.scrapeChannelVideos(config);
            }
            console.log(`[YouTubeSessionService] Using YouTube Data API for channel: ${channelId}`);
            // Pobierz wideo z kanału
            const videosUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=50&key=${config.apiKey}`;
            const videosResponse = await fetch(videosUrl);
            if (!videosResponse.ok) {
                const error = await videosResponse.json();
                console.error("[YouTubeSessionService] API error:", error);
                return this.scrapeChannelVideos(config);
            }
            const videosData = (await videosResponse.json());
            for (const item of videosData.items || []) {
                const videoId = item.id?.videoId;
                const snippet = item.snippet;
                if (videoId && snippet) {
                    // Filtruj tylko sesje rady
                    const title = snippet.title || "";
                    const isSessionVideo = title.toLowerCase().includes("sesja") ||
                        title.toLowerCase().includes("rada") ||
                        title.toLowerCase().includes("obrady") ||
                        title.toLowerCase().includes("transmisja");
                    if (isSessionVideo) {
                        videos.push({
                            id: videoId,
                            title: title,
                            description: snippet.description || "",
                            publishedAt: snippet.publishedAt
                                ? new Date(snippet.publishedAt).toLocaleDateString("pl-PL")
                                : "",
                            thumbnailUrl: snippet.thumbnails?.high?.url ||
                                snippet.thumbnails?.default?.url ||
                                "",
                            url: `https://www.youtube.com/watch?v=${videoId}`,
                        });
                    }
                }
            }
            console.log(`[YouTubeSessionService] API found ${videos.length} session videos`);
            return videos;
        }
        catch (error) {
            console.error("[YouTubeSessionService] API error:", error);
            return this.scrapeChannelVideos(config);
        }
    }
    formatSessionList(sessions) {
        if (sessions.length === 0) {
            return "Nie znaleziono żadnych sesji rady na kanale YouTube.";
        }
        let output = "📺 **Dostępne sesje rady na YouTube:**\n\n";
        sessions.forEach((session, index) => {
            output += `**${index + 1}.** ${session.title}\n`;
            if (session.publishedAt) {
                output += `   📅 ${session.publishedAt}`;
            }
            if (session.duration) {
                output += ` | ⏱️ ${session.duration}`;
            }
            output += `\n   🔗 ${session.url}\n\n`;
        });
        output +=
            "\n💡 Podaj numer sesji (1-" +
                sessions.length +
                "), którą chcesz transkrybować.";
        return output;
    }
    async getVideoInfo(videoUrl) {
        try {
            // Extract video ID from URL
            const videoIdMatch = videoUrl.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/);
            if (!videoIdMatch)
                return null;
            const videoId = videoIdMatch[1];
            // Fetch video page for metadata
            const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
            });
            const html = await response.text();
            // Extract title
            const titleMatch = html.match(/<title>([^<]+)<\/title>/);
            const title = titleMatch
                ? titleMatch[1].replace(" - YouTube", "").trim()
                : "Nieznany tytuł";
            return {
                id: videoId,
                title,
                description: "",
                publishedAt: "",
                thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                url: `https://www.youtube.com/watch?v=${videoId}`,
            };
        }
        catch (error) {
            console.error("[YouTubeSessionService] Error getting video info:", error);
            return null;
        }
    }
    isSessionRequest(message) {
        const lowerMessage = message.toLowerCase();
        const sessionKeywords = [
            "transkrypcj",
            "sesj",
            "rady",
            "obrady",
            "posiedzeni",
            "nagranie rady",
            "youtube",
            "wideo rady",
            "film z sesji",
        ];
        return sessionKeywords.some((keyword) => lowerMessage.includes(keyword));
    }
    detectSessionSelection(message, availableSessions) {
        const lowerMessage = message.toLowerCase();
        // Check for number selection (1, 2, 3, etc.)
        const numberMatch = message.match(/\b(\d+)\b/);
        if (numberMatch) {
            const index = parseInt(numberMatch[1]) - 1;
            if (index >= 0 && index < availableSessions.length) {
                return availableSessions[index] || null;
            }
        }
        // Check for keyword match in session titles
        for (const session of availableSessions) {
            const titleWords = session.title.toLowerCase().split(/\s+/);
            for (const word of titleWords) {
                if (word.length > 3 && lowerMessage.includes(word)) {
                    return session;
                }
            }
        }
        return null;
    }
}
export const youtubeSessionService = new YouTubeSessionService();
//# sourceMappingURL=youtube-session-service.js.map