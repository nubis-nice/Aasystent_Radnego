"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Database,
  Loader2,
  Download,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

interface FetchResult {
  success: boolean;
  documentsCount: number;
  message: string;
}

export default function FetchRAGPage() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!sourceUrl.trim()) {
      setError("Podaj URL źródła dokumentacji");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await fetch("/api/rag/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });

      if (!response.ok) {
        throw new Error("Błąd pobierania dokumentacji");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd pobierania");
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
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-slate-800">
                  Zasilanie RAG
                </h1>
                <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold">
                  BETA
                </span>
              </div>
              <p className="text-slate-600">
                Pobierz dokumentację ze źródeł zewnętrznych do zasilenia bazy
                RAG
              </p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Funkcja w fazie beta</p>
              <p>
                Ta funkcja pozwala na automatyczne pobieranie dokumentacji z
                różnych źródeł (strony internetowe, repozytoria, API) i
                dodawanie ich do bazy wiedzy RAG.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                URL źródła dokumentacji
              </label>
              <input
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/docs lub https://github.com/user/repo"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all"
              />
              <p className="mt-2 text-xs text-slate-500">
                Obsługiwane źródła: strony internetowe, GitHub, GitLab,
                dokumentacja API
              </p>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleFetch}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-white font-semibold shadow-lg hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Pobieranie dokumentacji...</span>
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  <span>Pobierz i zaindeksuj</span>
                </>
              )}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className="mt-8">
              {result.success ? (
                <div className="p-6 rounded-xl bg-green-50 border border-green-200">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                    <div>
                      <h3 className="text-lg font-bold text-green-800 mb-2">
                        Sukces!
                      </h3>
                      <p className="text-green-700 mb-2">{result.message}</p>
                      <p className="text-sm text-green-600">
                        Pobrano i zaindeksowano{" "}
                        <strong>{result.documentsCount}</strong> dokumentów
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-red-50 border border-red-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
                    <div>
                      <h3 className="text-lg font-bold text-red-800 mb-2">
                        Błąd
                      </h3>
                      <p className="text-red-700">{result.message}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
