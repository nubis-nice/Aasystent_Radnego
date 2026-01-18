import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getAuthToken(): Promise<string | null> {
  const { data: refreshData, error: refreshError } =
    await supabase.auth.refreshSession();

  if (refreshError || !refreshData.session) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  return refreshData.session.access_token;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  duration: number;
}

export interface VoiceCommandResult {
  intent: "navigation" | "search" | "chat" | "control" | "unknown";
  confidence: number;
  action: {
    type: "navigate" | "search" | "chat" | "control";
    [key: string]: unknown;
  };
  entities?: {
    [key: string]: unknown;
  };
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Nie jesteś zalogowany");
  }

  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");

  try {
    const response = await fetch(`${API_URL}/api/voice/transcribe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data: TranscriptionResult = await response.json();
    return data.text;
  } catch (error) {
    console.error("Transcription error:", error);
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("Timeout - transkrypcja trwała zbyt długo");
    }
    throw error;
  }
}

export async function processVoiceCommand(
  transcription: string
): Promise<VoiceCommandResult> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Nie jesteś zalogowany");
  }

  try {
    const response = await fetch(`${API_URL}/api/voice/command`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ transcription }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error("Command processing error:", error);
    throw error;
  }
}

export interface VoiceSettings {
  wakeWord: string;
  continuousMode: boolean;
  autoTTS: boolean;
  ttsVoice: string;
  ttsSpeed: number;
}

export async function getVoiceSettings(): Promise<VoiceSettings> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Nie jesteś zalogowany");
  }

  const response = await fetch(`${API_URL}/api/voice/settings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch voice settings");
  }

  return response.json();
}

export async function updateVoiceSettings(
  settings: Partial<VoiceSettings>
): Promise<void> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Nie jesteś zalogowany");
  }

  const response = await fetch(`${API_URL}/api/voice/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw new Error("Failed to update voice settings");
  }
}
