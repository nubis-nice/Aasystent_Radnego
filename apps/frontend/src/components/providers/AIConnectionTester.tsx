"use client";

import { useState } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  MessageSquare,
  Database,
  Eye,
  Mic,
  Volume2,
} from "lucide-react";

type AIFunctionType = "llm" | "embeddings" | "vision" | "stt" | "tts";

interface TestConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  models: {
    llm?: string;
    embeddings?: string;
    vision?: string;
    stt?: string;
    tts?: string;
  };
  enabledFunctions: AIFunctionType[];
}

interface SingleTestResult {
  function: AIFunctionType;
  status: "pending" | "testing" | "success" | "failed" | "skipped";
  responseTimeMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface AIConnectionTesterProps {
  config: TestConfig;
  disabled?: boolean;
  onTestComplete?: (results: SingleTestResult[]) => void;
}

const FUNCTION_INFO: Record<
  AIFunctionType,
  { label: string; icon: React.ReactNode; testEndpoint: string; color: string }
> = {
  llm: {
    label: "Chat / LLM",
    icon: <MessageSquare className="h-4 w-4" />,
    testEndpoint: "/api/test/chat-direct",
    color: "blue",
  },
  embeddings: {
    label: "Embeddings",
    icon: <Database className="h-4 w-4" />,
    testEndpoint: "/api/test/embeddings-direct",
    color: "purple",
  },
  vision: {
    label: "Vision",
    icon: <Eye className="h-4 w-4" />,
    testEndpoint: "/api/test/vision-direct",
    color: "green",
  },
  stt: {
    label: "Speech-to-Text",
    icon: <Mic className="h-4 w-4" />,
    testEndpoint: "/api/test/stt-direct",
    color: "orange",
  },
  tts: {
    label: "Text-to-Speech",
    icon: <Volume2 className="h-4 w-4" />,
    testEndpoint: "/api/test/tts-direct",
    color: "pink",
  },
};

export function AIConnectionTester({
  config,
  disabled = false,
  onTestComplete,
}: AIConnectionTesterProps) {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<SingleTestResult[]>([]);

  const initializeResults = (): SingleTestResult[] => {
    return config.enabledFunctions.map((func) => ({
      function: func,
      status: "pending",
    }));
  };

  const testSingleFunction = async (
    func: AIFunctionType
  ): Promise<SingleTestResult> => {
    const model = config.models[func];
    if (!model) {
      return {
        function: func,
        status: "skipped",
        error: "Brak skonfigurowanego modelu",
      };
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const startTime = Date.now();

    try {
      const response = await fetch(`${apiUrl}/api/test/function`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: config.provider,
          api_key: config.apiKey,
          base_url: config.baseUrl,
          function_type: func,
          model_name: model,
        }),
      });

      const responseTime = Date.now() - startTime;
      const data = await response.json();

      if (response.ok && data.success) {
        return {
          function: func,
          status: "success",
          responseTimeMs: responseTime,
          details: data.details,
        };
      } else {
        return {
          function: func,
          status: "failed",
          responseTimeMs: responseTime,
          error: data.error || data.message || "Test nieudany",
        };
      }
    } catch (error) {
      return {
        function: func,
        status: "failed",
        responseTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Błąd połączenia",
      };
    }
  };

  const runAllTests = async () => {
    if (!config.apiKey && config.provider !== "local") {
      setResults([
        {
          function: "llm",
          status: "failed",
          error: "Brak klucza API",
        },
      ]);
      return;
    }

    setTesting(true);
    const initialResults = initializeResults();
    setResults(initialResults);

    const finalResults: SingleTestResult[] = [];

    for (const func of config.enabledFunctions) {
      // Testing function: ${func}

      // Update status to testing
      setResults((prev) =>
        prev.map((r) => (r.function === func ? { ...r, status: "testing" } : r))
      );

      const result = await testSingleFunction(func);
      finalResults.push(result);

      // Update with result
      setResults((prev) => prev.map((r) => (r.function === func ? result : r)));

      // Small delay between tests
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setTesting(false);

    if (onTestComplete) {
      onTestComplete(finalResults);
    }
  };

  const getStatusIcon = (status: SingleTestResult["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "testing":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case "skipped":
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
      default:
        return (
          <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
        );
    }
  };

  const getStatusBg = (status: SingleTestResult["status"]) => {
    switch (status) {
      case "success":
        return "bg-green-50 border-green-200";
      case "failed":
        return "bg-red-50 border-red-200";
      case "testing":
        return "bg-blue-50 border-blue-200";
      case "skipped":
        return "bg-gray-50 border-gray-200";
      default:
        return "bg-white border-gray-200";
    }
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status === "failed").length;
  const totalEnabled = config.enabledFunctions.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Test połączenia</h3>
          <p className="text-sm text-slate-500">
            Testuj każdą funkcję AI osobno
          </p>
        </div>
        <button
          onClick={runAllTests}
          disabled={disabled || testing}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Testowanie...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Uruchom testy
            </>
          )}
        </button>
      </div>

      {/* Summary */}
      {results.length > 0 && !testing && (
        <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Wynik:</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-700">{successCount} OK</span>
          </div>
          {failedCount > 0 && (
            <div className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-700">{failedCount} błędów</span>
            </div>
          )}
          <div className="text-sm text-slate-500">z {totalEnabled} funkcji</div>
        </div>
      )}

      {/* Test Results Grid */}
      {(results.length > 0 || testing) && (
        <div className="grid gap-3">
          {(results.length > 0 ? results : initializeResults()).map(
            (result) => {
              const info = FUNCTION_INFO[result.function];
              return (
                <div
                  key={result.function}
                  className={`p-4 rounded-xl border-2 transition-all ${getStatusBg(
                    result.status
                  )}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg bg-${info.color}-100 text-${info.color}-600`}
                      >
                        {info.icon}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">
                          {info.label}
                        </div>
                        <div className="text-sm text-slate-500">
                          Model:{" "}
                          {config.models[result.function] || "nie ustawiony"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {result.responseTimeMs && (
                        <span className="text-sm text-slate-500">
                          {result.responseTimeMs}ms
                        </span>
                      )}
                      {getStatusIcon(result.status)}
                    </div>
                  </div>

                  {/* Error message */}
                  {result.error && (
                    <div className="mt-3 p-2 bg-red-100 rounded-lg text-sm text-red-700">
                      {result.error.includes("404") ? (
                        <span>
                          <strong>Model nie znaleziony:</strong>{" "}
                          {config.models[result.function]} nie jest
                          zainstalowany. Użyj przycisku odświeżania aby pobrać
                          listę dostępnych modeli.
                        </span>
                      ) : (
                        result.error
                      )}
                    </div>
                  )}

                  {/* Success details */}
                  {result.status === "success" && result.details && (
                    <div className="mt-3 p-2 bg-green-100 rounded-lg text-sm text-green-700">
                      {result.function === "embeddings" &&
                        typeof result.details.dimensions === "number" && (
                          <span>
                            Wymiary wektora: {result.details.dimensions}
                          </span>
                        )}
                      {result.function === "llm" &&
                        typeof result.details.response === "string" && (
                          <span>
                            Odpowiedź:{" "}
                            {result.details.response.substring(0, 100)}
                            ...
                          </span>
                        )}
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      )}

      {/* Info when no tests run */}
      {results.length === 0 && !testing && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm text-slate-700">
                Kliknij <strong>Uruchom testy</strong> aby sprawdzić połączenie
                z każdą funkcją AI.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Testy sprawdzą:{" "}
                {config.enabledFunctions
                  .map((f) => FUNCTION_INFO[f].label)
                  .join(", ")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
