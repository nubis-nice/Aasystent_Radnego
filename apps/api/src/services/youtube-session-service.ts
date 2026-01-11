import { Buffer } from "node:buffer";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration?: string;
  url: string;
}

export interface YouTubeChannelConfig {
  channelUrl: string;
  channelId?: string;
  name: string;
}

export interface SessionListResult {
  success: boolean;
  sessions: YouTubeVideo[];
  channelName: string;
  error?: string;
}

export interface TranscriptionRequest {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
}

const DEFAULT_COUNCIL_CHANNEL: YouTubeChannelConfig = {
  channelUrl: "https://www.youtube.com/channel/UCte9IfWItqpLBqGYxepOweQ",
  channelId: "UCte9IfWItqpLBqGYxepOweQ",
  name: "Sesje Rady",
};

// Domyślne zapytanie wyszukiwania dla sesji rady
const DEFAULT_SEARCH_QUERY = "sesja rady drawno";

export class YouTubeSessionService {
  private openai: OpenAI | null = null;

  constructor() {}

  async initializeWithUserConfig(userId: string): Promise<void> {
    const { data: config } = await supabase
      .from("api_configurations")
      .select("*")
      .eq("user_id", userId)
      .eq("is_default", true)
      .eq("is_active", true)
      .single();

    if (!config) {
      throw new Error("Brak skonfigurowanego klucza API. Przejdź do ustawień.");
    }

    const decodedApiKey = Buffer.from(
      config.api_key_encrypted,
      "base64"
    ).toString("utf-8");

    this.openai = new OpenAI({
      apiKey: decodedApiKey,
      baseURL: config.base_url || undefined,
    });
  }

  async getCouncilSessions(
    channelConfig?: YouTubeChannelConfig,
    searchQuery?: string
  ): Promise<SessionListResult> {
    const config = channelConfig || DEFAULT_COUNCIL_CHANNEL;
    const query = searchQuery || DEFAULT_SEARCH_QUERY;

    try {
      console.log(`[YouTubeSessionService] Searching YouTube for: ${query}`);

      // Użyj wyszukiwania YouTube zamiast jednego kanału
      const sessions = await this.searchYouTubeVideos(query);

      // Jeśli wyszukiwanie nie zwróciło wyników, spróbuj z kanału
      if (sessions.length === 0) {
        console.log(
          `[YouTubeSessionService] No search results, falling back to channel: ${config.channelUrl}`
        );
        const channelSessions = await this.scrapeChannelVideos(config);
        return {
          success: true,
          sessions: channelSessions,
          channelName: config.name,
        };
      }

      return {
        success: true,
        sessions,
        channelName: `Wyniki wyszukiwania: ${query}`,
      };
    } catch (error) {
      console.error("[YouTubeSessionService] Error fetching sessions:", error);
      return {
        success: false,
        sessions: [],
        channelName: config.name,
        error:
          error instanceof Error
            ? error.message
            : "Błąd pobierania listy sesji",
      };
    }
  }

  private async searchYouTubeVideos(query: string): Promise<YouTubeVideo[]> {
    const videos: YouTubeVideo[] = [];

    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query
      )}&sp=CAI%253D`;
      console.log(`[YouTubeSessionService] Search URL: ${searchUrl}`);

      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
          const ytData = JSON.parse(ytDataMatch[1] as string);
          const contents =
            ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents
              ?.sectionListRenderer?.contents || [];

          for (const section of contents) {
            const items = section?.itemSectionRenderer?.contents || [];
            for (const item of items) {
              const videoRenderer = item?.videoRenderer;
              if (videoRenderer) {
                const videoId = videoRenderer.videoId;
                const title =
                  videoRenderer.title?.runs?.[0]?.text || "Bez tytułu";
                const description =
                  videoRenderer.detailedMetadataSnippets?.[0]?.snippetText?.runs
                    ?.map((r: { text: string }) => r.text)
                    .join("") ||
                  videoRenderer.descriptionSnippet?.runs?.[0]?.text ||
                  "";
                const publishedAt =
                  videoRenderer.publishedTimeText?.simpleText || "";
                const thumbnailUrl =
                  videoRenderer.thumbnail?.thumbnails?.[0]?.url || "";
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
        } catch (parseError) {
          console.error(
            "[YouTubeSessionService] Error parsing search ytInitialData:",
            parseError
          );
        }
      }

      console.log(
        `[YouTubeSessionService] Search found ${videos.length} videos`
      );
      return videos.slice(0, 20); // Limit to 20 most recent
    } catch (error) {
      console.error("[YouTubeSessionService] Search error:", error);
      return [];
    }
  }

  private async scrapeChannelVideos(
    config: YouTubeChannelConfig
  ): Promise<YouTubeVideo[]> {
    const videos: YouTubeVideo[] = [];

    try {
      // Fetch channel page
      const channelUrl = `${config.channelUrl}/videos`;
      const response = await fetch(channelUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Extract video data from ytInitialData
      const ytDataMatch = html.match(/var ytInitialData = ({.+?});<\/script>/);
      if (ytDataMatch) {
        try {
          const ytData = JSON.parse(ytDataMatch[1] as string);
          const tabs =
            ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];

          for (const tab of tabs) {
            const tabContent =
              tab?.tabRenderer?.content?.richGridRenderer?.contents || [];
            for (const item of tabContent) {
              const videoRenderer =
                item?.richItemRenderer?.content?.videoRenderer;
              if (videoRenderer) {
                const videoId = videoRenderer.videoId;
                const title =
                  videoRenderer.title?.runs?.[0]?.text || "Bez tytułu";
                const description =
                  videoRenderer.descriptionSnippet?.runs?.[0]?.text || "";
                const publishedAt =
                  videoRenderer.publishedTimeText?.simpleText || "";
                const thumbnailUrl =
                  videoRenderer.thumbnail?.thumbnails?.[0]?.url || "";
                const duration = videoRenderer.lengthText?.simpleText || "";

                // Filter only sessions (sesja in title)
                if (
                  title.toLowerCase().includes("sesja") ||
                  title.toLowerCase().includes("rada") ||
                  title.toLowerCase().includes("obrady")
                ) {
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
        } catch (parseError) {
          console.error(
            "[YouTubeSessionService] Error parsing ytInitialData:",
            parseError
          );
        }
      }

      // Fallback: regex extraction if ytInitialData parsing failed
      if (videos.length === 0) {
        const videoIdRegex = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;

        const matches = html.matchAll(videoIdRegex);
        const uniqueIds = new Set<string>();

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
          if (videos.length >= 20) break;
        }
      }

      console.log(`[YouTubeSessionService] Found ${videos.length} videos`);
      return videos.slice(0, 20); // Limit to 20 most recent
    } catch (error) {
      console.error("[YouTubeSessionService] Scraping error:", error);
      throw error;
    }
  }

  formatSessionList(sessions: YouTubeVideo[]): string {
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

  async getVideoInfo(videoUrl: string): Promise<YouTubeVideo | null> {
    try {
      // Extract video ID from URL
      const videoIdMatch = videoUrl.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/);
      if (!videoIdMatch) return null;

      const videoId = videoIdMatch[1] as string;

      // Fetch video page for metadata
      const response = await fetch(
        `https://www.youtube.com/watch?v=${videoId}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }
      );

      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch
        ? titleMatch[1].replace(" - YouTube", "").trim()
        : "Nieznany tytuł";

      return {
        id: videoId as string,
        title,
        description: "",
        publishedAt: "",
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    } catch (error) {
      console.error("[YouTubeSessionService] Error getting video info:", error);
      return null;
    }
  }

  isSessionRequest(message: string): boolean {
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

  detectSessionSelection(
    message: string,
    availableSessions: YouTubeVideo[]
  ): YouTubeVideo | null {
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
