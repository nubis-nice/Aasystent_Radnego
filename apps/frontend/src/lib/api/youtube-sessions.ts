const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration?: string;
  url: string;
}

export interface YouTubeSessionsResult {
  success: boolean;
  channelName: string;
  sessions: YouTubeVideo[];
  formattedList: string;
  error?: string;
}

async function getAuthToken(): Promise<string> {
  const { supabase } = await import("@/lib/supabase/client");
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Brak aktywnej sesji. Zaloguj się ponownie.");
  }

  return session.access_token;
}

export async function getYouTubeSessions(): Promise<YouTubeSessionsResult> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/youtube/sessions`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd pobierania sesji YouTube");
  }

  return data;
}

export async function getYouTubeVideoInfo(
  videoUrl: string
): Promise<YouTubeVideo> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/youtube/session-info`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ videoUrl }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd pobierania info o wideo");
  }

  return data.video;
}

export interface YouTubeTranscriptionResult {
  success: boolean;
  rawTranscript: string;
  formattedTranscript: string;
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
  }>;
  summary: {
    averageTension: number;
    dominantSentiment: string;
    overallCredibility: number;
    overallCredibilityEmoji: string;
    speakerCount: number;
    duration: string;
  };
  metadata: {
    videoId: string;
    videoTitle: string;
    videoUrl: string;
  };
  error?: string;
}

export async function transcribeYouTubeVideo(
  videoUrl: string,
  videoTitle?: string
): Promise<YouTubeTranscriptionResult> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/youtube/transcribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ videoUrl, videoTitle }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd transkrypcji wideo");
  }

  return data;
}
