"use client";

import { useState, useRef } from "react";
import {
  Paperclip,
  X,
  Loader2,
  FileText,
  Image,
  File,
  Database,
  MessageSquare,
  FileSearch,
  ClipboardCopy,
  Check,
  Mic,
  Video,
} from "lucide-react";
import {
  processDocument,
  saveToRAG,
  transcribeAudio,
  type ProcessedDocumentResult,
  type TranscriptionResult,
} from "@/lib/api/document-processor";

interface DocumentUploadButtonProps {
  onTextExtracted?: (text: string, action: string) => void;
  onError?: (error: string) => void;
}

type ProcessingAction = "summarize" | "analyze" | "chat" | "copy" | "save-rag";

const AUDIO_VIDEO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".flac",
  ".aac",
  ".mp4",
  ".webm",
  ".mkv",
  ".avi",
  ".mov",
];

export function DocumentUploadButton({
  onTextExtracted,
  onError,
}: DocumentUploadButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedResult, setProcessedResult] =
    useState<ProcessedDocumentResult | null>(null);
  const [transcriptionResult, setTranscriptionResult] =
    useState<TranscriptionResult | null>(null);
  const [isAudioVideo, setIsAudioVideo] = useState(false);
  const [isSavingToRAG, setIsSavingToRAG] = useState(false);
  const [savedToRAG, setSavedToRAG] = useState(false);
  const [copied, setCopied] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAudioVideoFile = (fileName: string): boolean => {
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
    return AUDIO_VIDEO_EXTENSIONS.includes(ext);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessedResult(null);
    setTranscriptionResult(null);
    setSavedToRAG(false);
    setDocumentTitle(file.name.replace(/\.[^/.]+$/, ""));

    const isAV = isAudioVideoFile(file.name);
    setIsAudioVideo(isAV);

    try {
      if (isAV) {
        const result = await transcribeAudio(file);
        setTranscriptionResult(result);
      } else {
        const result = await processDocument(file);
        setProcessedResult(result);
      }
      setIsOpen(true);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Błąd przetwarzania");
      setIsOpen(false);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const getTextContent = (): string => {
    if (isAudioVideo && transcriptionResult) {
      return transcriptionResult.formattedTranscript;
    }
    return processedResult?.text || "";
  };

  const getFileName = (): string => {
    if (isAudioVideo && transcriptionResult) {
      return transcriptionResult.metadata.fileName;
    }
    return processedResult?.metadata.fileName || "";
  };

  const handleAction = async (action: ProcessingAction) => {
    const textContent = getTextContent();
    if (!textContent) return;

    switch (action) {
      case "copy":
        await navigator.clipboard.writeText(textContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        break;

      case "save-rag":
        if (!documentTitle.trim()) {
          onError?.("Podaj tytuł dokumentu");
          return;
        }
        setIsSavingToRAG(true);
        try {
          await saveToRAG(
            textContent,
            documentTitle,
            getFileName(),
            isAudioVideo ? "transcription" : "uploaded"
          );
          setSavedToRAG(true);
        } catch (error) {
          onError?.(
            error instanceof Error ? error.message : "Błąd zapisu do bazy"
          );
        } finally {
          setIsSavingToRAG(false);
        }
        break;

      case "summarize":
        onTextExtracted?.(
          `Podsumuj poniższą transkrypcję/tekst:\n\n${textContent}`,
          "summarize"
        );
        setIsOpen(false);
        break;

      case "analyze":
        onTextExtracted?.(
          `Przeprowadź analizę poniższego dokumentu/transkrypcji:\n\n${textContent}`,
          "analyze"
        );
        setIsOpen(false);
        break;

      case "chat":
        onTextExtracted?.(textContent, "chat");
        setIsOpen(false);
        break;
    }
  };

  const getFileIcon = () => {
    if (isAudioVideo && transcriptionResult) {
      const fileType = transcriptionResult.metadata.fileType;
      if (fileType === "audio") {
        return <Mic className="h-8 w-8 text-purple-500" />;
      }
      return <Video className="h-8 w-8 text-pink-500" />;
    }

    if (!processedResult) return <File className="h-8 w-8" />;

    switch (processedResult.metadata.fileType) {
      case "image":
        return <Image className="h-8 w-8 text-green-500" />;
      case "pdf":
        return <FileText className="h-8 w-8 text-red-500" />;
      case "docx":
        return <FileText className="h-8 w-8 text-blue-500" />;
      default:
        return <File className="h-8 w-8 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <>
      {/* Upload Button */}
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf,.docx,.txt,.md,.mp3,.wav,.ogg,.m4a,.flac,.aac,.mp4,.webm,.mkv,.avi,.mov"
          onChange={handleFileSelect}
          className="hidden"
          id="document-upload"
        />
        <label
          htmlFor="document-upload"
          className={`h-full px-3 rounded-xl border-2 border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors cursor-pointer flex items-center justify-center ${
            isProcessing ? "opacity-50 cursor-wait" : ""
          }`}
          title="Przetwórz dokument (OCR) lub audio/video (transkrypcja)"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 text-primary-500 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4 text-text-secondary" />
          )}
        </label>
      </div>

      {/* Modal */}
      {isOpen && (processedResult || transcriptionResult) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-secondary-200">
              <div className="flex items-center gap-3">
                {getFileIcon()}
                <div>
                  <h2 className="font-bold text-lg">
                    {isAudioVideo
                      ? "Transkrypcja audio/video"
                      : "Przetworzony dokument"}
                  </h2>
                  <p className="text-xs text-text-secondary">
                    {isAudioVideo && transcriptionResult ? (
                      <>
                        {transcriptionResult.metadata.fileName} •{" "}
                        {formatFileSize(transcriptionResult.metadata.fileSize)}
                        {transcriptionResult.summary.duration &&
                          ` • ${transcriptionResult.summary.duration}`}
                        {` • ${transcriptionResult.summary.speakerCount} rozmówców`}
                      </>
                    ) : processedResult ? (
                      <>
                        {processedResult.metadata.fileName} •{" "}
                        {formatFileSize(processedResult.metadata.fileSize)}
                        {processedResult.metadata.pageCount &&
                          ` • ${processedResult.metadata.pageCount} str.`}
                        {processedResult.metadata.processingMethod === "ocr" &&
                          " • OCR"}
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Transcription Summary for Audio/Video */}
              {isAudioVideo && transcriptionResult && (
                <div className="bg-purple-50 rounded-xl p-4 mb-4 border border-purple-200">
                  <h3 className="text-sm font-semibold text-purple-800 mb-3">
                    📈 Podsumowanie analizy
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-600">⚡</span>
                      <span>
                        Napięcie:{" "}
                        <strong>
                          {transcriptionResult.summary.averageTension.toFixed(
                            1
                          )}
                          /10
                        </strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-purple-600">📊</span>
                      <span>
                        Sentyment:{" "}
                        <strong>
                          {transcriptionResult.summary.dominantSentiment}
                        </strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-purple-600">🎯</span>
                      <span>
                        Wiarygodność:{" "}
                        <strong>
                          {transcriptionResult.summary.overallCredibility}%{" "}
                          {transcriptionResult.summary.overallCredibilityEmoji}
                        </strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-purple-600">👥</span>
                      <span>
                        Rozmówcy:{" "}
                        <strong>
                          {transcriptionResult.summary.speakerCount}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-secondary-50 rounded-xl p-4 mb-4">
                <h3 className="text-xs font-semibold text-text-secondary uppercase mb-2">
                  {isAudioVideo
                    ? "Transkrypcja z analizą"
                    : "Wyodrębniony tekst"}{" "}
                  ({getTextContent().length} znaków)
                </h3>
                <div className="bg-white rounded-lg p-3 max-h-60 overflow-y-auto border border-secondary-200">
                  <pre className="text-sm whitespace-pre-wrap font-sans text-text">
                    {getTextContent().slice(0, 3000)}
                    {getTextContent().length > 3000 && (
                      <span className="text-text-secondary">
                        ... (pokazano 3000 z {getTextContent().length} znaków)
                      </span>
                    )}
                  </pre>
                </div>
              </div>

              {/* Save to RAG section */}
              <div className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-200">
                <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Dodać do bazy wiedzy (RAG)?
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    placeholder="Tytuł dokumentu"
                    className="flex-1 px-3 py-2 rounded-lg border border-amber-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    onClick={() => handleAction("save-rag")}
                    disabled={isSavingToRAG || savedToRAG}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      savedToRAG
                        ? "bg-green-500 text-white"
                        : "bg-amber-500 hover:bg-amber-600 text-white"
                    } disabled:opacity-50`}
                  >
                    {isSavingToRAG ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : savedToRAG ? (
                      <>
                        <Check className="h-4 w-4" /> Zapisano
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4" /> Zapisz
                      </>
                    )}
                  </button>
                </div>
                {savedToRAG && (
                  <p className="text-xs text-green-700 mt-2">
                    ✓ Dokument został dodany do bazy wiedzy. AI będzie go używać
                    w odpowiedziach.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-text-secondary mb-3">
                  Co chcesz zrobić z tym tekstem?
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleAction("summarize")}
                    className="flex items-center gap-3 p-3 rounded-xl border-2 border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
                  >
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileSearch className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Podsumuj</p>
                      <p className="text-xs text-text-secondary">
                        Streść dokument
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleAction("analyze")}
                    className="flex items-center gap-3 p-3 rounded-xl border-2 border-secondary-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                  >
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <FileText className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Analizuj prawnie</p>
                      <p className="text-xs text-text-secondary">
                        Analiza prawna
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleAction("chat")}
                    className="flex items-center gap-3 p-3 rounded-xl border-2 border-secondary-200 hover:border-green-300 hover:bg-green-50 transition-colors text-left"
                  >
                    <div className="p-2 bg-green-100 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Zapytaj o treść</p>
                      <p className="text-xs text-text-secondary">
                        Wklej do chatu
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleAction("copy")}
                    className="flex items-center gap-3 p-3 rounded-xl border-2 border-secondary-200 hover:border-secondary-400 hover:bg-secondary-100 transition-colors text-left"
                  >
                    <div className="p-2 bg-secondary-200 rounded-lg">
                      {copied ? (
                        <Check className="h-5 w-5 text-green-600" />
                      ) : (
                        <ClipboardCopy className="h-5 w-5 text-secondary-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {copied ? "Skopiowano!" : "Kopiuj tekst"}
                      </p>
                      <p className="text-xs text-text-secondary">Do schowka</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-secondary-200 bg-secondary-50">
              <p className="text-xs text-text-secondary text-center">
                {isAudioVideo && transcriptionResult ? (
                  <>🎤 Transkrypcja przez Whisper + Analiza GPT-4</>
                ) : processedResult ? (
                  <>
                    {processedResult.metadata.processingMethod === "ocr"
                      ? "🔍 Tekst wyodrębniony przez OCR (GPT-4 Vision)"
                      : "📄 Tekst wyodrębniony bezpośrednio z dokumentu"}
                    {processedResult.metadata.confidence &&
                      ` • Pewność: ${Math.round(
                        processedResult.metadata.confidence * 100
                      )}%`}
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
