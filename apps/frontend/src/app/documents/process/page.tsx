"use client";

import { useState } from "react";
import { ArrowLeft, Paperclip, Loader2, FileText, Upload } from "lucide-react";
import Link from "next/link";

export default function DocumentProcessPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleProcess = async () => {
    if (!file) {
      setError("Wybierz plik do przetworzenia");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/documents/process", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Błąd przetwarzania pliku");
      }

      const data = await response.json();
      setResult(data.text || data.transcription);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd przetwarzania");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/documents"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Powrót do dokumentów</span>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
              <Paperclip className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                OCR / Transkrypcja
              </h1>
              <p className="text-slate-600">
                Przetwórz dokumenty (OCR) lub pliki audio/video (transkrypcja)
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Wybierz plik
              </label>
              <div className="relative">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png,.mp3,.mp4,.wav,.m4a"
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="flex items-center justify-center gap-3 w-full px-6 py-8 rounded-xl border-2 border-dashed border-slate-300 hover:border-primary-400 hover:bg-primary-50 transition-all cursor-pointer"
                >
                  <Upload className="h-8 w-8 text-slate-400" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      {file ? file.name : "Kliknij aby wybrać plik"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      PDF, obrazy (OCR) lub audio/video (transkrypcja)
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleProcess}
              disabled={loading || !file}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4 text-white font-semibold shadow-lg hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Przetwarzam...</span>
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  <span>Przetwórz plik</span>
                </>
              )}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-bold text-slate-800">Wynik</h3>
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 max-h-96 overflow-y-auto">
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {result}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
