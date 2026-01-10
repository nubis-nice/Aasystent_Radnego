"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Scale,
  TrendingUp,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  searchLegal,
  analyzeLegal,
  analyzeBudget,
  type LegalSearchResult,
  type LegalReasoningResponse,
  type BudgetAnalysisResult,
} from "@/lib/api/legal-analysis";
import { supabase } from "@/lib/supabase/client";

export default function AnalysisPage() {
  const [activeTab, setActiveTab] = useState<"search" | "legal" | "budget">(
    "search"
  );
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setAccessToken(session?.access_token || null);
      setAuthLoading(false);
    }
    checkAuth();
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Analizy Prawne</h1>
        <p className="text-text-secondary mt-1">
          Agent AI "Winsdurf" - wyszukiwanie, analiza prawna i budżetowa
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab("search")}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === "search"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <Search className="inline h-4 w-4 mr-2" />
            Wyszukiwanie
          </button>
          <button
            onClick={() => setActiveTab("legal")}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === "legal"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <Scale className="inline h-4 w-4 mr-2" />
            Analiza Prawna
          </button>
          <button
            onClick={() => setActiveTab("budget")}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === "budget"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <TrendingUp className="inline h-4 w-4 mr-2" />
            Analiza Budżetowa
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === "search" && <SearchTab accessToken={accessToken} />}
      {activeTab === "legal" && <LegalAnalysisTab accessToken={accessToken} />}
      {activeTab === "budget" && (
        <BudgetAnalysisTab accessToken={accessToken} />
      )}
    </div>
  );
}

function SearchTab({ accessToken }: { accessToken: string | null }) {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<
    "fulltext" | "semantic" | "hybrid"
  >("hybrid");
  const [results, setResults] = useState<LegalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const searchResults = await searchLegal(
        {
          query,
          searchMode,
          maxResults: 10,
        },
        accessToken || undefined
      );
      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd wyszukiwania");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <div className="bg-background-primary border border-border rounded-xl p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Zapytanie</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              placeholder="np. budżet gminy, uchwała podatkowa, plan zagospodarowania..."
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Tryb wyszukiwania
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSearchMode("fulltext")}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  searchMode === "fulltext"
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-border hover:bg-background-secondary"
                }`}
              >
                <div className="font-medium">Pełnotekstowe</div>
                <div className="text-xs text-text-secondary">Szybkie</div>
              </button>
              <button
                onClick={() => setSearchMode("semantic")}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  searchMode === "semantic"
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-border hover:bg-background-secondary"
                }`}
              >
                <div className="font-medium">Semantyczne</div>
                <div className="text-xs text-text-secondary">AI</div>
              </button>
              <button
                onClick={() => setSearchMode("hybrid")}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  searchMode === "hybrid"
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-border hover:bg-background-secondary"
                }`}
              >
                <div className="font-medium">Hybrydowe</div>
                <div className="text-xs text-text-secondary">Najlepsze</div>
              </button>
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="w-full px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Wyszukiwanie...
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                Szukaj
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 text-danger">
          <AlertTriangle className="inline h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Znaleziono {results.length} dokumentów
          </h2>
          {results.map((result) => (
            <div
              key={result.documentId}
              className="bg-background-primary border border-border rounded-lg p-4 hover:border-primary-200 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-text-primary">
                  {result.title}
                </h3>
                <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded">
                  {Math.round(result.relevanceScore * 100)}% trafność
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-3">
                {result.excerpt}
              </p>
              {result.highlights && result.highlights.length > 0 && (
                <div className="space-y-1">
                  {result.highlights.map((highlight, idx) => (
                    <div
                      key={idx}
                      className="text-xs bg-yellow-50 border-l-2 border-yellow-400 pl-2 py-1"
                    >
                      {highlight}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
                <span>Typ: {result.sourceType}</span>
                {result.publishDate && <span>Data: {result.publishDate}</span>}
                {result.url && (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    Zobacz źródło →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LegalAnalysisTab({ accessToken }: { accessToken: string | null }) {
  const [question, setQuestion] = useState("");
  const [analysisType, setAnalysisType] = useState<
    "legality" | "financial_risk" | "procedural_compliance" | "general"
  >("general");
  const [result, setResult] = useState<LegalReasoningResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!question.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const analysis = await analyzeLegal(
        {
          question,
          analysisType,
        },
        accessToken || undefined
      );
      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd analizy");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
        return "text-red-600 bg-red-50 border-red-200";
      case "high":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "low":
        return "text-green-600 bg-green-50 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Analysis Form */}
      <div className="bg-background-primary border border-border rounded-xl p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Pytanie prawne
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="np. Czy uchwała budżetowa jest zgodna z ustawą o finansach publicznych?"
              rows={4}
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Typ analizy
            </label>
            <select
              value={analysisType}
              onChange={(e) => setAnalysisType(e.target.value as any)}
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="general">Analiza kompleksowa</option>
              <option value="legality">Analiza legalności</option>
              <option value="financial_risk">Ryzyko finansowe</option>
              <option value="procedural_compliance">
                Zgodność proceduralna
              </option>
            </select>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !question.trim()}
            className="w-full px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analizuję...
              </>
            ) : (
              <>
                <Scale className="h-5 w-5" />
                Analizuj
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 text-danger">
          <AlertTriangle className="inline h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Answer */}
          <div className="bg-background-primary border border-border rounded-lg p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary-500" />
              Odpowiedź
            </h3>
            <p className="text-text-primary">{result.answer}</p>
          </div>

          {/* Risks */}
          {result.risks && result.risks.length > 0 && (
            <div className="bg-background-primary border border-border rounded-lg p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Zidentyfikowane ryzyka ({result.risks.length})
              </h3>
              <div className="space-y-3">
                {result.risks.map((risk, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-lg p-4 ${getRiskColor(
                      risk.level
                    )}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium uppercase text-xs">
                        {risk.level}
                      </span>
                    </div>
                    <p className="mb-2">{risk.description}</p>
                    {risk.recommendation && (
                      <div className="mt-2 pt-2 border-t border-current/20">
                        <span className="text-xs font-medium">
                          Rekomendacja:
                        </span>
                        <p className="text-sm mt-1">{risk.recommendation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legal Basis */}
          {result.legalBasis && result.legalBasis.length > 0 && (
            <div className="bg-background-primary border border-border rounded-lg p-6">
              <h3 className="font-semibold mb-4">Podstawy prawne</h3>
              <div className="space-y-3">
                {result.legalBasis.map((basis, idx) => (
                  <div
                    key={idx}
                    className="border border-border rounded-lg p-3"
                  >
                    <div className="font-medium text-sm mb-1">
                      {basis.title}
                    </div>
                    <p className="text-sm text-text-secondary">
                      {basis.excerpt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BudgetAnalysisTab({ accessToken }: { accessToken: string | null }) {
  void accessToken; // Placeholder - będzie używany po implementacji
  return (
    <div className="bg-background-primary border border-border rounded-xl p-6 text-center">
      <TrendingUp className="h-12 w-12 mx-auto mb-4 text-text-secondary" />
      <h3 className="font-semibold mb-2">Analiza budżetowa</h3>
      <p className="text-text-secondary">
        Funkcja w przygotowaniu. Wkrótce będziesz mógł analizować dokumenty
        budżetowe.
      </p>
    </div>
  );
}
