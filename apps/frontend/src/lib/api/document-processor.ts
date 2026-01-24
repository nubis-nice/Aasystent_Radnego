const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface ProcessedDocumentResult {
  success: boolean;
  text: string;
  metadata: {
    fileName: string;
    fileType: string;
    mimeType: string;
    fileSize: number;
    pageCount?: number;
    confidence?: number;
    language?: string;
    processingMethod: "ocr" | "text-extraction" | "direct";
  };
  error?: string;
}

export interface TranscriptSegment {
  timestamp: string;
  speaker: string;
  text: string;
  sentiment: "positive" | "neutral" | "negative";
  emotion: string;
  emotionEmoji: string;
  tension: number;
  credibility: number;
  credibilityEmoji: string;
}

export interface TranscriptionResult {
  success: boolean;
  rawTranscript: string;
  segments: TranscriptSegment[];
  summary: {
    averageTension: number;
    dominantSentiment: string;
    overallCredibility: number;
    overallCredibilityEmoji: string;
    speakerCount: number;
    duration: string;
  };
  metadata: {
    fileName: string;
    fileType: string;
    mimeType: string;
    fileSize: number;
    language: string;
  };
  formattedTranscript: string;
  error?: string;
}

export interface SaveToRAGResult {
  success: boolean;
  documentId?: string;
  message?: string;
  error?: string;
}

async function getAuthToken(): Promise<string> {
  const { supabase } = await import("@/lib/supabase/client");
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Nie jesteś zalogowany");
  }

  return session.access_token;
}

export async function processDocument(
  file: File,
): Promise<ProcessedDocumentResult> {
  const token = await getAuthToken();

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/documents/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    console.error("[DocumentProcessor] JSON parse error:", parseError);
    throw new Error("Serwer zwrócił nieprawidłową odpowiedź");
  }

  if (!response.ok) {
    throw new Error(data.error || "Błąd przetwarzania dokumentu");
  }

  return data;
}

export async function transcribeAudio(
  file: File,
): Promise<TranscriptionResult> {
  const token = await getAuthToken();

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/documents/transcribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    console.error("[DocumentProcessor] JSON parse error:", parseError);
    throw new Error("Serwer zwrócił nieprawidłową odpowiedź");
  }

  if (!response.ok) {
    throw new Error(data.error || "Błąd transkrypcji");
  }

  return data;
}

export async function saveToRAG(
  text: string,
  title: string,
  sourceFileName: string,
  documentType: string = "uploaded",
): Promise<SaveToRAGResult> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/documents/save-to-rag`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      title,
      sourceFileName,
      documentType,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd zapisu do bazy");
  }

  return data;
}
