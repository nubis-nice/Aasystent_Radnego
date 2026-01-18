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

export interface TranscriptionDocumentResponse {
  success: boolean;
  document: {
    id: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  };
}

export async function getTranscriptionDocument(
  documentId: string
): Promise<TranscriptionDocumentResponse> {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_URL}/api/youtube/transcription/${documentId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd pobierania transkrypcji");
  }

  return data;
}

export interface DetailedJobResponse {
  success: boolean;
  job: {
    id: string;
    videoTitle: string;
    videoUrl: string;
    status: "waiting" | "active" | "completed" | "failed" | "delayed";
    progress: number;
    progressMessage: string;
    detailedProgress?: {
      globalProgress: number;
      globalMessage: string;
      currentStep: string;
      steps: Array<{
        name: string;
        label: string;
        status: "pending" | "active" | "completed" | "failed";
        progress: number;
        startTime?: string;
        endTime?: string;
        duration?: number;
        details?: Record<string, unknown>;
      }>;
      estimatedTimeRemaining?: number;
      startedAt: string;
      lastUpdate: string;
    };
    createdAt: string;
    completedAt?: string;
    error?: string;
    resultDocumentId?: string;
  };
}

export async function getTranscriptionJobDetailed(
  jobId: string
): Promise<DetailedJobResponse> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/youtube/job/${jobId}/detailed`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd pobierania szczegółów zadania");
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
  videoTitle?: string,
  includeSentiment?: boolean
): Promise<YouTubeTranscriptionResult> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/youtube/transcribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ videoUrl, videoTitle, includeSentiment }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd transkrypcji wideo");
  }

  return data;
}

// Typy dla asynchronicznej transkrypcji
export interface TranscriptionJob {
  id: string;
  status:
    | "pending"
    | "downloading"
    | "transcribing"
    | "analyzing"
    | "saving"
    | "completed"
    | "failed";
  progress: number;
  progressMessage: string;
  videoTitle: string;
  videoUrl?: string;
  videoDuration?: string; // np. "1:23:45"
  createdAt: string;
  completedAt?: string;
  error?: string;
  resultDocumentId?: string;
}

export interface TranscriptionJobResponse {
  success: boolean;
  jobId: string;
  status: string;
  message: string;
}

/**
 * Rozpoczyna asynchroniczną transkrypcję z zapisem do RAG
 */
export async function startAsyncTranscription(
  videoUrl: string,
  videoTitle?: string,
  options?: {
    sessionId?: string;
    includeSentiment?: boolean;
    identifySpeakers?: boolean;
  }
): Promise<TranscriptionJobResponse> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/youtube/transcribe-async`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      videoUrl,
      videoTitle,
      sessionId: options?.sessionId,
      includeSentiment: options?.includeSentiment ?? true,
      identifySpeakers: options?.identifySpeakers ?? true,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd tworzenia zadania transkrypcji");
  }

  return data;
}

/**
 * Pobiera status zadania transkrypcji
 */
export async function getTranscriptionJobStatus(
  jobId: string
): Promise<{ success: boolean; job: TranscriptionJob }> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/youtube/job/${jobId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd pobierania statusu zadania");
  }

  return data;
}

/**
 * Pobiera listę zadań transkrypcji użytkownika
 */
export async function getTranscriptionJobs(): Promise<{
  success: boolean;
  jobs: TranscriptionJob[];
}> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/youtube/jobs`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd pobierania listy zadań");
  }

  return data;
}

/**
 * Anuluje aktywne zadanie transkrypcji
 */
export async function cancelTranscriptionJob(jobId: string): Promise<{
  success: boolean;
  cancelled: boolean;
  message: string;
}> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/youtube/job/${jobId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd anulowania zadania");
  }

  return data;
}

/**
 * Usuwa zadanie transkrypcji
 */
export async function deleteTranscriptionJob(jobId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/youtube/job/${jobId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd usuwania zadania");
  }

  return data;
}

/**
 * Ponawia nieudane zadanie transkrypcji
 */
export async function retryTranscriptionJob(jobId: string): Promise<{
  success: boolean;
  newJobId?: string;
  message: string;
}> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/youtube/job/${jobId}/retry`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd ponowienia zadania");
  }

  return data;
}
