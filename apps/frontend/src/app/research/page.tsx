"use client";

/**
 * Deep Internet Researcher - UI
 * Agent AI "Winsdurf" - Zaawansowany research internetowy
 */

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import type {
  DeepResearchRequest,
  DeepResearchReport,
  ResearchDepth,
  ResearchType,
} from "@shared/types/deep-research";
import { performResearch, getResearchHistory } from "@/lib/api/deep-research";

export default function ResearchPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [researchType, setResearchType] = useState<ResearchType>("legal");
  const [depth, setDepth] = useState<ResearchDepth>("standard");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DeepResearchReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"research" | "history">(
    "research"
  );
  const [history, setHistory] = useState<DeepResearchReport[]>([]);

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

  const handleResearch = async () => {
    if (!query.trim() || !accessToken) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const request: DeepResearchRequest = {
        query: query.trim(),
        researchType,
        depth,
        maxResults: depth === "quick" ? 5 : depth === "standard" ? 20 : 50,
      };

      const result = await performResearch(request, accessToken);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!accessToken) return;

    try {
      const reports = await getResearchHistory(accessToken);
      setHistory(reports);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  const handleTabChange = (tab: "research" | "history") => {
    setActiveTab(tab);
    if (tab === "history") {
      loadHistory();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Deep Internet Researcher</h1>
          <p className="text-muted-foreground">
            Zaawansowany research internetowy z AI - wyszukiwanie, analiza i
            synteza informacji prawnych
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-border">
          <button
            onClick={() => handleTabChange("research")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "research"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Nowy Research
          </button>
          <button
            onClick={() => handleTabChange("history")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "history"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Historia
          </button>
        </div>

        {/* Research Tab */}
        {activeTab === "research" && (
          <div className="space-y-6">
            {/* Research Form */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Zadaj pytanie</h2>

              <div className="space-y-4">
                {/* Query Input */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Pytanie badawcze
                  </label>
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Np. Jakie są wymogi formalne dla uchwały budżetowej gminy?"
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    rows={4}
                  />
                </div>

                {/* Research Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Typ researchu
                    </label>
                    <select
                      value={researchType}
                      onChange={(e) =>
                        setResearchType(e.target.value as ResearchType)
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="legal">Prawny</option>
                      <option value="financial">Finansowy</option>
                      <option value="procedural">Proceduralny</option>
                      <option value="general">Ogólny</option>
                    </select>
                  </div>

                  {/* Depth */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Głębokość researchu
                    </label>
                    <select
                      value={depth}
                      onChange={(e) =>
                        setDepth(e.target.value as ResearchDepth)
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="quick">Szybki (5 źródeł, ~5s)</option>
                      <option value="standard">
                        Standardowy (20 źródeł, ~15s)
                      </option>
                      <option value="deep">Głęboki (50+ źródeł, ~30s)</option>
                    </select>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleResearch}
                  disabled={loading || !query.trim()}
                  className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Szukam..." : "Rozpocznij Research"}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="bg-card border border-border rounded-lg p-8">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  <p className="text-muted-foreground">
                    Przeszukuję internet i analizuję wyniki...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    To może potrwać{" "}
                    {depth === "quick"
                      ? "5-10"
                      : depth === "standard"
                      ? "15-20"
                      : "30-40"}{" "}
                    sekund
                  </p>
                </div>
              </div>
            )}

            {/* Results */}
            {report && !loading && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Podsumowanie</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Pewność:
                      </span>
                      <span
                        className={`font-medium ${
                          report.confidence > 0.7
                            ? "text-green-600"
                            : report.confidence > 0.4
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {Math.round(report.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap">
                    {report.summary}
                  </p>
                </div>

                {/* Key Findings */}
                {report.keyFindings.length > 0 && (
                  <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">
                      Kluczowe ustalenia
                    </h2>
                    <ul className="space-y-2">
                      {report.keyFindings.map((finding, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="text-primary font-medium">
                            {i + 1}.
                          </span>
                          <span className="text-foreground">{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sources Statistics */}
                <div className="bg-card border border-border rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">
                    Źródła ({report.results.length})
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {report.sources.map((source) => (
                      <div
                        key={source.name}
                        className="text-center p-3 bg-muted rounded-lg"
                      >
                        <div className="text-2xl font-bold text-primary">
                          {source.count}
                        </div>
                        <div className="text-sm text-muted-foreground capitalize">
                          {source.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {Math.round(source.avgRelevance * 100)}% trafność
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Results List */}
                <div className="bg-card border border-border rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">
                    Wyniki researchu
                  </h2>
                  <div className="space-y-4">
                    {report.results.map((result, i) => (
                      <div
                        key={result.id}
                        className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium text-lg flex-1">
                            {result.title}
                          </h3>
                          <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full capitalize">
                            {result.source}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {result.excerpt}
                        </p>
                        <div className="flex items-center justify-between">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            Zobacz źródło →
                          </a>
                          <span className="text-xs text-muted-foreground">
                            Trafność: {Math.round(result.relevanceScore * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Related Queries */}
                {report.relatedQueries.length > 0 && (
                  <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">
                      Powiązane pytania
                    </h2>
                    <div className="space-y-2">
                      {report.relatedQueries.map((relatedQuery, i) => (
                        <button
                          key={i}
                          onClick={() => setQuery(relatedQuery)}
                          className="w-full text-left px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                        >
                          {relatedQuery}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="text-center text-sm text-muted-foreground">
                  Czas przetwarzania:{" "}
                  {(report.processingTime / 1000).toFixed(1)}s
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Historia researchu</h2>
            {history.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Brak historii researchu
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium">{item.query}</h3>
                      <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full capitalize">
                        {item.researchType}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {item.summary}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {new Date(item.generatedAt).toLocaleString("pl-PL")}
                      </span>
                      <span>Pewność: {Math.round(item.confidence * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
