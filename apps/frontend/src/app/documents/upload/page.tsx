"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Image,
  File,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface UploadedFile {
  file: File;
  status: "pending" | "processing" | "success" | "error";
  progress: number;
  extractedText?: string;
  error?: string;
}

const ACCEPTED_TYPES = {
  "application/pdf": { icon: FileText, label: "PDF", color: "text-red-500" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    icon: FileText,
    label: "DOCX",
    color: "text-blue-500",
  },
  "image/jpeg": { icon: Image, label: "JPG", color: "text-green-500" },
  "image/png": { icon: Image, label: "PNG", color: "text-green-500" },
  "image/webp": { icon: Image, label: "WEBP", color: "text-green-500" },
  "text/plain": { icon: File, label: "TXT", color: "text-gray-500" },
  "text/markdown": { icon: File, label: "MD", color: "text-purple-500" },
};

export default function DocumentUploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentType, setDocumentType] = useState("uploaded");

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        addFiles(selectedFiles);
      }
    },
    []
  );

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter((file) => {
      const isValidType = Object.keys(ACCEPTED_TYPES).includes(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isValidType && isValidSize;
    });

    const uploadFiles: UploadedFile[] = validFiles.map((file) => ({
      file,
      status: "pending",
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...uploadFiles]);

    // Auto-set title from first file
    if (validFiles.length > 0 && !documentTitle) {
      const firstName = validFiles[0].name.replace(/\.[^/.]+$/, "");
      setDocumentTitle(firstName);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);

    // Get auth token
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      alert("Musisz być zalogowany");
      router.push("/login");
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const uploadFile = files[i];

      // Update status
      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: "processing", progress: 10 } : f
        )
      );

      try {
        // Create form data
        const formData = new FormData();
        formData.append("file", uploadFile.file);

        // Process file (OCR if needed)
        const processResponse = await fetch(
          `${API_URL}/api/documents/process`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: formData,
          }
        );

        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, progress: 50 } : f))
        );

        if (!processResponse.ok) {
          const error = await processResponse.json();
          throw new Error(error.error || "Błąd przetwarzania pliku");
        }

        const processResult = await processResponse.json();

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? { ...f, progress: 70, extractedText: processResult.text }
              : f
          )
        );

        // Save to RAG
        const saveResponse = await fetch(
          `${API_URL}/api/documents/save-to-rag`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              text: processResult.text,
              title:
                documentTitle || uploadFile.file.name.replace(/\.[^/.]+$/, ""),
              sourceFileName: uploadFile.file.name,
              documentType,
            }),
          }
        );

        if (!saveResponse.ok) {
          const error = await saveResponse.json();
          throw new Error(error.error || "Błąd zapisu do bazy");
        }

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "success", progress: 100 } : f
          )
        );
      } catch (error) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: "error",
                  error:
                    error instanceof Error ? error.message : "Nieznany błąd",
                }
              : f
          )
        );
      }
    }

    setIsProcessing(false);
  };

  const getFileIcon = (mimeType: string) => {
    const typeInfo =
      ACCEPTED_TYPES[mimeType as keyof typeof ACCEPTED_TYPES] ||
      ACCEPTED_TYPES["text/plain"];
    const Icon = typeInfo.icon;
    return <Icon className={`h-8 w-8 ${typeInfo.color}`} />;
  };

  const allSuccess =
    files.length > 0 && files.every((f) => f.status === "success");

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/documents"
          className="p-2 rounded-xl bg-white border border-border hover:bg-secondary-50 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
            Dodaj dokument
          </h1>
          <p className="text-text-secondary mt-1">
            Prześlij dokumenty do bazy wiedzy (PDF, DOCX, obrazy z OCR)
          </p>
        </div>
      </div>

      {/* Upload area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200
          ${
            isDragging
              ? "border-primary-500 bg-primary-50"
              : "border-secondary-300 bg-white hover:border-primary-400 hover:bg-secondary-50"
          }
        `}
      >
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,.txt,.md"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <Upload
          className={`h-16 w-16 mx-auto mb-4 ${
            isDragging ? "text-primary-500" : "text-secondary-400"
          }`}
        />
        <h3 className="text-xl font-bold text-text mb-2">
          Przeciągnij pliki tutaj
        </h3>
        <p className="text-text-secondary mb-4">
          lub kliknij aby wybrać z dysku
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {Object.entries(ACCEPTED_TYPES).map(([, info]) => (
            <span
              key={info.label}
              className={`px-3 py-1 rounded-full bg-secondary-100 text-sm font-medium ${info.color}`}
            >
              {info.label}
            </span>
          ))}
        </div>
        <p className="text-xs text-text-secondary mt-4">Maks. 10MB na plik</p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <h3 className="font-bold text-lg">Wybrane pliki ({files.length})</h3>

          {files.map((uploadFile, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4 rounded-xl bg-secondary-50 border border-secondary-200"
            >
              {getFileIcon(uploadFile.file.type)}

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{uploadFile.file.name}</p>
                <p className="text-sm text-text-secondary">
                  {(uploadFile.file.size / 1024).toFixed(1)} KB
                </p>

                {uploadFile.status === "processing" && (
                  <div className="mt-2">
                    <div className="h-2 bg-secondary-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 transition-all duration-300"
                        style={{ width: `${uploadFile.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      Przetwarzanie... {uploadFile.progress}%
                    </p>
                  </div>
                )}

                {uploadFile.status === "error" && (
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {uploadFile.error}
                  </p>
                )}
              </div>

              {uploadFile.status === "pending" && (
                <button
                  onClick={() => removeFile(index)}
                  className="p-2 rounded-lg hover:bg-secondary-200 transition-colors"
                >
                  <X className="h-5 w-5 text-secondary-500" />
                </button>
              )}

              {uploadFile.status === "processing" && (
                <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
              )}

              {uploadFile.status === "success" && (
                <CheckCircle className="h-6 w-6 text-green-500" />
              )}

              {uploadFile.status === "error" && (
                <AlertCircle className="h-6 w-6 text-red-500" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Settings */}
      {files.length > 0 && !allSuccess && (
        <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <h3 className="font-bold text-lg">Ustawienia dokumentu</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Tytuł dokumentu
              </label>
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="Nazwa dokumentu..."
                className="w-full px-4 py-3 rounded-xl border-2 border-secondary-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Typ dokumentu
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-secondary-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all"
              >
                <option value="uploaded">📄 Dokument zewnętrzny</option>
                <option value="resolution">📜 Uchwała</option>
                <option value="protocol">📋 Protokół</option>
                <option value="announcement">📢 Ogłoszenie</option>
                <option value="article">📰 Artykuł</option>
                <option value="other">📎 Inny</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Link
          href="/documents"
          className="px-6 py-3 rounded-xl border-2 border-secondary-300 text-text font-semibold hover:bg-secondary-50 transition-colors"
        >
          Anuluj
        </Link>

        {allSuccess ? (
          <Link
            href="/documents"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold shadow-lg hover:from-green-600 hover:to-green-700 transition-all flex items-center gap-2"
          >
            <CheckCircle className="h-5 w-5" />
            Gotowe - przejdź do dokumentów
          </Link>
        ) : (
          <button
            onClick={processFiles}
            disabled={files.length === 0 || isProcessing}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold shadow-lg hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Przetwarzanie...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                Przetwórz i zapisz ({files.length})
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
