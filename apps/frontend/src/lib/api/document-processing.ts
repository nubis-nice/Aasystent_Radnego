const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface ProcessedDocument {
  id: string;
  title: string;
  content: string;
  formattedContent?: string;
  documentType: "ocr" | "transcription" | "pdf" | "other";
  sourceFileName: string;
  sourceUrl?: string;
  mimeType: string;
  fileSize: number;
  processingMethod: string;
  createdAt: string;
  metadata?: {
    sttModel?: string;
    ocrEngine?: string;
    sentiment?: SentimentAnalysis;
    speakers?: string[];
    duration?: string;
    audioIssues?: string[];
    topics?: string[];
  };
  savedToRag: boolean;
  ragDocumentId?: string;
}

export interface SentimentAnalysis {
  overall: "positive" | "negative" | "neutral" | "mixed";
  score: number;
  segments?: Array<{
    text: string;
    sentiment: string;
    emotion: string;
    tension: number;
  }>;
}

export interface ProcessingJob {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  status:
    | "pending"
    | "preprocessing"
    | "processing"
    | "analyzing"
    | "saving"
    | "completed"
    | "failed";
  progress: number;
  progressMessage: string;
  includeSentiment: boolean;
  saveToRag: boolean;
  createdAt: string;
  completedAt?: string;
  error?: string;
  resultDocumentId?: string;
}

export interface ProcessDocumentOptions {
  includeSentiment?: boolean;
  saveToRag?: boolean;
  formatAsProfessional?: boolean;
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

export async function getProcessedDocuments(): Promise<{
  success: boolean;
  documents: ProcessedDocument[];
  error?: string;
}> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/documents/processed`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd pobierania dokumentów");
  }

  return data;
}

export async function getProcessedDocument(id: string): Promise<{
  success: boolean;
  document: ProcessedDocument;
  error?: string;
}> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/documents/processed/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd pobierania dokumentu");
  }

  return data;
}

export async function processDocumentAsync(
  file: File,
  options: ProcessDocumentOptions = {}
): Promise<{
  success: boolean;
  jobId: string;
  message: string;
  error?: string;
}> {
  const token = await getAuthToken();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("includeSentiment", String(options.includeSentiment ?? true));
  formData.append("saveToRag", String(options.saveToRag ?? true));
  formData.append(
    "formatAsProfessional",
    String(options.formatAsProfessional ?? true)
  );
  formData.append("async", "true");

  const response = await fetch(`${API_URL}/api/documents/process-async`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd przetwarzania dokumentu");
  }

  return data;
}

export async function getProcessingJobs(): Promise<{
  success: boolean;
  jobs: ProcessingJob[];
  error?: string;
}> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/documents/jobs`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd pobierania zadań");
  }

  return data;
}

export async function addDocumentToRag(documentId: string): Promise<{
  success: boolean;
  ragDocumentId: string;
  error?: string;
}> {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_URL}/api/documents/processed/${documentId}/add-to-rag`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd dodawania do RAG");
  }

  return data;
}

export async function analyzeSentiment(documentId: string): Promise<{
  success: boolean;
  sentiment: SentimentAnalysis;
  error?: string;
}> {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_URL}/api/documents/processed/${documentId}/analyze-sentiment`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd analizy sentymentu");
  }

  return data;
}

export async function deleteProcessedDocument(documentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_URL}/api/documents/processed/${documentId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd usuwania dokumentu");
  }

  return data;
}

export async function formatDocumentAsProfessional(
  documentId: string
): Promise<{
  success: boolean;
  formattedContent: string;
  error?: string;
}> {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_URL}/api/documents/processed/${documentId}/format`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Błąd formatowania dokumentu");
  }

  return data;
}
